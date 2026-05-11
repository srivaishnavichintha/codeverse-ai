'use strict';

/**
 * CoinLock Service
 *
 * Manages the temporary coin locking system for Contest Zone.
 *
 * Design:
 *   User.walletCoins  = total coins (decremented when locked)
 *   User.lockedCoins  = coins held in contest escrow
 *
 * On join:   walletCoins -= fee, lockedCoins += fee
 * On win:    lockedCoins -= fee, walletCoins += reward
 * On expiry: lockedCoins -= fee, walletCoins += fee  (full refund)
 *
 * NOTE: User model does NOT yet have walletCoins/lockedCoins fields.
 *       This service uses $inc updates that Mongoose will create on first use
 *       (or they can be added to the schema). We use atomic $inc to avoid
 *       race conditions with concurrent joins.
 */

const mongoose = require('mongoose');
const User = require('../../../models/User');
const ContestRewardLog = require('../models/ContestRewardLog.model');
const ContestParticipant = require('../models/ContestParticipant.model');

// ─── Lock coins when joining contest ─────────────────────────────────────────

/**
 * Lock entryFee coins from user's wallet.
 * Throws if insufficient balance.
 *
 * @returns {Object} updated user wallet state
 */
async function lockCoins({ userId, contestId, entryFee, session }) {
  if (entryFee <= 0) return { walletCoins: 0, lockedCoins: 0 }; // free contest

  // Atomic check-and-debit — prevents race conditions
  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      $expr: { $gte: [{ $ifNull: ['$walletCoins', 0] }, entryFee] },
    },
    {
      $inc: {
        walletCoins: -entryFee,
        lockedCoins:  entryFee,
      },
    },
    { new: true, session }
  );

  if (!updated) {
    throw new Error('Insufficient coins to join this contest');
  }

  // Audit log
  await ContestRewardLog.create(
    [
      {
        contest:     contestId,
        user:        userId,
        type:        'entry_lock',
        amount:      -entryFee,
        description: `Entry fee locked for contest ${contestId}`,
        processedAt: new Date(),
      },
    ],
    { session }
  );

  return {
    walletCoins: updated.walletCoins || 0,
    lockedCoins: updated.lockedCoins || 0,
  };
}

// ─── Release locked coins (rewards or refund) ────────────────────────────────

/**
 * Credit coins to a user (reward, refund, or partial refund).
 */
async function creditCoins({ userId, contestId, amount, type, rank = null, description = '', session }) {
  if (amount <= 0) return;

  await User.findByIdAndUpdate(
    userId,
    {
      $inc: {
        walletCoins: amount,
        lockedCoins: -amount,  // release from escrow; may go negative if reward > fee — cap at 0
      },
    },
    { session }
  );

  // Clamp lockedCoins to 0 (rewards can exceed entry fee for winners)
  await User.findOneAndUpdate(
    { _id: userId, lockedCoins: { $lt: 0 } },
    { $set: { lockedCoins: 0 } },
    { session }
  );

  await ContestRewardLog.create(
    [
      {
        contest: contestId,
        user:    userId,
        type,
        amount,
        rank,
        description,
        processedAt: new Date(),
      },
    ],
    { session }
  );
}

// ─── Refund all participants (contest expired) ────────────────────────────────

async function refundAllParticipants(contestId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const participants = await ContestParticipant.find({
      contest:        contestId,
      coinsLocked:    true,
      coinsRefunded:  false,
      isActive:       true,
    }).session(session);

    for (const p of participants) {
      await creditCoins({
        userId:      p.user,
        contestId,
        amount:      p.entryFee,
        type:        'refund_expiry',
        description: 'Contest expired — full refund',
        session,
      });

      await ContestParticipant.findByIdAndUpdate(
        p._id,
        { coinsLocked: false, coinsRefunded: true },
        { session }
      );
    }

    await session.commitTransaction();
    return { refundedCount: participants.length };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ─── Distribute rewards (contest completed) ───────────────────────────────────

/**
 * Public contest reward distribution.
 * 1st: 50%, 2nd: 25%, 3rd: 15%, platform: 10%
 */
async function distributePublicRewards(contest, rankedParticipants) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const pool = contest.prizePool;
    const platFee = Math.floor(pool * (contest.platformFeePercent / 100));
    const distributable = pool - platFee;

    const REWARD_SPLIT = [0.50, 0.25, 0.15]; // top 3

    for (let i = 0; i < rankedParticipants.length; i++) {
      const p = rankedParticipants[i];
      const splitPct = REWARD_SPLIT[i] || 0;
      const reward = Math.floor(distributable * splitPct);

      if (reward > 0) {
        await creditCoins({
          userId:      p.user,
          contestId:   contest._id,
          amount:      reward,
          type:        'reward_win',
          rank:        i + 1,
          description: `Rank ${i + 1} reward — public contest`,
          session,
        });
      } else {
        // No prize but still unlock coins
        await User.findByIdAndUpdate(
          p.user,
          { $inc: { lockedCoins: -p.entryFee } },
          { session }
        );
        // Clamp
        await User.findOneAndUpdate(
          { _id: p.user, lockedCoins: { $lt: 0 } },
          { $set: { lockedCoins: 0 } },
          { session }
        );
      }

      await ContestParticipant.findByIdAndUpdate(
        p._id,
        {
          coinsLocked:  false,
          rewardAmount: reward,
          rewardPaid:   true,
          rank:         i + 1,
        },
        { session }
      );
    }

    // Platform fee log
    await ContestRewardLog.create(
      [
        {
          contest:     contest._id,
          user:        contest.createdBy,
          type:        'platform_fee',
          amount:      platFee,
          description: 'Platform fee — public contest',
          processedAt: new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Private contest reward distribution.
 * 1st: 35%, 2nd: 20%, 3rd: 10%, losers: partial refund, platform: remainder
 */
async function distributePrivateRewards(contest, rankedParticipants) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const pool = contest.prizePool;
    const REWARD_SPLIT = [0.35, 0.20, 0.10];
    const topRewards = REWARD_SPLIT.map(p => Math.floor(pool * p));
    const topTotal = topRewards.reduce((a, b) => a + b, 0);

    // Remaining goes to partial refunds + platform
    const remaining = pool - topTotal;
    const loserCount = Math.max(0, rankedParticipants.length - 3);
    const partialRefund = loserCount > 0 ? Math.floor(remaining * 0.6 / loserCount) : 0;

    for (let i = 0; i < rankedParticipants.length; i++) {
      const p = rankedParticipants[i];
      let reward = 0;

      if (i < 3) {
        reward = topRewards[i] || 0;
      } else {
        reward = partialRefund;
      }

      const rewardType = i < 3 ? 'reward_win' : 'refund_partial';

      if (reward > 0) {
        await creditCoins({
          userId:      p.user,
          contestId:   contest._id,
          amount:      reward,
          type:        rewardType,
          rank:        i + 1,
          description: `Rank ${i + 1} ${rewardType} — private contest`,
          session,
        });
      } else {
        await User.findByIdAndUpdate(
          p.user,
          { $inc: { lockedCoins: -p.entryFee } },
          { session }
        );
        await User.findOneAndUpdate(
          { _id: p.user, lockedCoins: { $lt: 0 } },
          { $set: { lockedCoins: 0 } },
          { session }
        );
      }

      await ContestParticipant.findByIdAndUpdate(
        p._id,
        {
          coinsLocked:  false,
          rewardAmount: reward,
          rewardPaid:   true,
          rank:         i + 1,
        },
        { session }
      );
    }

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = {
  lockCoins,
  creditCoins,
  refundAllParticipants,
  distributePublicRewards,
  distributePrivateRewards,
};
