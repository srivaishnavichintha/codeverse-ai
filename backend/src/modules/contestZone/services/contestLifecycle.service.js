'use strict';

/**
 * Contest Lifecycle Service
 *
 * Manages the contest state machine:
 *   WAITING → FILLING → STARTING → ACTIVE → EVALUATING → COMPLETED
 *                                          ↗
 *   WAITING → EXPIRED → REFUNDED
 *
 * Uses in-process timers (Map-based) for expiry.
 * In a multi-process deployment, replace with a Bull queue or Redis TTL.
 */

const ContestZone        = require('../models/ContestZone.model');
const ContestParticipant = require('../models/ContestParticipant.model');
const { refundAllParticipants, distributePublicRewards, distributePrivateRewards } = require('./coinLock.service');
const { generateContestProblems } = require('./contestAI.service');
const { finalizeRanks }           = require('./leaderboard.service');

// ── Timer registry (in-process) ──────────────────────────
// contestId → { expiryTimer, startTimer }
const timers = new Map();

// ── Expiry windows ────────────────────────────────────────
const EXPIRY_MS = {
  public:  10 * 60 * 1000,  // 10 min
  private: 30 * 60 * 1000,  // 30 min
};

const STARTING_COUNTDOWN_MS = 15_000; // 15-second countdown before ACTIVE

// ─── Start expiry timer for a contest ────────────────────────────────────────

function scheduleExpiry(contestId, type, io) {
  const delay = EXPIRY_MS[type] || EXPIRY_MS.public;
  clearContestTimers(contestId);

  const expiryTimer = setTimeout(async () => {
    try {
      await expireContest(contestId, io);
    } catch (err) {
      console.error(`[ContestLifecycle] Expiry error for ${contestId}:`, err.message);
    }
  }, delay);

  timers.set(contestId, { expiryTimer, startTimer: null });
}

// ─── Clear timers for a contest ───────────────────────────────────────────────

function clearContestTimers(contestId) {
  const t = timers.get(contestId);
  if (t) {
    if (t.expiryTimer) clearTimeout(t.expiryTimer);
    if (t.startTimer)  clearTimeout(t.startTimer);
    timers.delete(contestId);
  }
}

// ─── Expire a contest ─────────────────────────────────────────────────────────

async function expireContest(contestId, io) {
  const contest = await ContestZone.findById(contestId);
  if (!contest) return;

  // Already resolved — skip
  if (['completed', 'expired', 'refunded', 'cancelled'].includes(contest.status)) return;

  await ContestZone.findByIdAndUpdate(contestId, {
    status:  'expired',
    endedAt: new Date(),
  });

  // Refund all locked coins
  await refundAllParticipants(contestId);

  await ContestZone.findByIdAndUpdate(contestId, {
    status:         'refunded',
    coinsRefunded:  true,
  });

  // Notify socket room
  if (io) {
    io.to(`contest:${contestId}`).emit('contest:expired', {
      contestId,
      message: 'Contest expired — all coins refunded',
    });
    // Clean up room after brief delay
    setTimeout(() => {
      io.in(`contest:${contestId}`).socketsLeave(`contest:${contestId}`);
    }, 5000);
  }

  clearContestTimers(contestId);
  console.log(`[ContestLifecycle] Contest ${contestId} expired and refunded.`);
}

// ─── Try to start contest when full ──────────────────────────────────────────

async function tryStartContest(contestId, io) {
  const contest = await ContestZone.findById(contestId);
  if (!contest) return;

  // Already starting or active
  if (!['filling', 'waiting'].includes(contest.status)) return;

  const participants = await ContestParticipant.countDocuments({
    contest: contestId, isActive: true,
  });

  if (participants < contest.minParticipants) return;

  // Cancel expiry timer — enough players joined
  clearContestTimers(contestId);

  // Move to STARTING state with 15-second countdown
  const scheduledStartAt = new Date(Date.now() + STARTING_COUNTDOWN_MS);
  await ContestZone.findByIdAndUpdate(contestId, {
    status:           'starting',
    scheduledStartAt,
  });

  if (io) {
    io.to(`contest:${contestId}`).emit('contest:starting', {
      contestId,
      scheduledStartAt,
      message: 'Contest starting in 15 seconds!',
    });
  }

  // Generate problems in the background (during countdown)
  generateContestProblems({
    contestId,
    difficulty: contest.difficulty,
    count:      contest.problemCount,
  }).then(async (problems) => {
    const problemIds = problems.map(p => p._id);
    await ContestZone.findByIdAndUpdate(contestId, { problems: problemIds });
  }).catch(err => {
    console.error(`[ContestLifecycle] Problem generation failed for ${contestId}:`, err.message);
  });

  // Schedule ACTIVE transition
  const startTimer = setTimeout(async () => {
    await activateContest(contestId, io);
  }, STARTING_COUNTDOWN_MS);

  timers.set(contestId, { expiryTimer: null, startTimer });
}

// ─── Activate contest (ACTIVE state) ─────────────────────────────────────────

async function activateContest(contestId, io) {
  const contest = await ContestZone.findById(contestId);
  if (!contest || contest.status !== 'starting') return;

  const startedAt = new Date();
  const endAt = new Date(startedAt.getTime() + contest.durationMinutes * 60_000);

  await ContestZone.findByIdAndUpdate(contestId, {
    status:    'active',
    startedAt,
  });

  if (io) {
    io.to(`contest:${contestId}`).emit('contest:active', {
      contestId,
      startedAt,
      endsAt: endAt,
      durationMinutes: contest.durationMinutes,
    });
  }

  // Schedule auto-end
  const expiryTimer = setTimeout(async () => {
    await completeContest(contestId, io);
  }, contest.durationMinutes * 60_000);

  timers.set(contestId, { expiryTimer, startTimer: null });
  console.log(`[ContestLifecycle] Contest ${contestId} is now ACTIVE.`);
}

// ─── Complete contest ─────────────────────────────────────────────────────────

async function completeContest(contestId, io) {
  const contest = await ContestZone.findById(contestId);
  if (!contest || !['active', 'evaluating'].includes(contest.status)) return;

  await ContestZone.findByIdAndUpdate(contestId, {
    status:  'evaluating',
    endedAt: new Date(),
  });

  clearContestTimers(contestId);

  // Finalize ranks
  const rankedParticipants = await finalizeRanks(contestId);

  // Distribute rewards
  const rankedDocs = await ContestParticipant.find({
    contest:      contestId,
    isActive:     true,
    disqualified: false,
  }).sort({ rank: 1 });

  if (contest.type === 'public') {
    await distributePublicRewards(contest, rankedDocs);
    // Update ratings for public contest participants
    await updateRatingsForPublicContest(rankedDocs);
  } else {
    await distributePrivateRewards(contest, rankedDocs);
  }

  await ContestZone.findByIdAndUpdate(contestId, {
    status:             'completed',
    rewardsDistributed: true,
  });

  // Announce winner
  const winner = rankedParticipants[0] || null;
  if (io) {
    io.to(`contest:${contestId}`).emit('contest:completed', {
      contestId,
      winner,
      leaderboard: rankedParticipants.slice(0, 10),
      message: 'Contest completed!',
    });

    setTimeout(() => {
      io.in(`contest:${contestId}`).socketsLeave(`contest:${contestId}`);
    }, 10_000);
  }

  console.log(`[ContestLifecycle] Contest ${contestId} COMPLETED.`);
}

// ─── Rating updates (public contests only) ────────────────────────────────────

async function updateRatingsForPublicContest(rankedDocs) {
  const User = require('../../../models/User');
  const total = rankedDocs.length;

  // Simple Elo-like rating change: winner gains more, loser loses less
  for (let i = 0; i < rankedDocs.length; i++) {
    const p = rankedDocs[i];
    const rank = i + 1;
    // Top half gain points, bottom half lose points
    const ratingDelta = Math.round((total / 2 - rank) * 5);

    await User.findByIdAndUpdate(p.user, {
      $inc: { rating: ratingDelta },
    });
  }
}

// ─── Recover timers on server restart ────────────────────────────────────────

/**
 * Called at server startup to reschedule timers for in-progress contests.
 * Prevents contests from being stuck after a server restart.
 */
async function recoverActiveContests(io) {
  const activeContests = await ContestZone.find({
    status: { $in: ['waiting', 'filling', 'starting', 'active'] },
  });

  for (const contest of activeContests) {
    const now = Date.now();
    const createdAt = contest.createdAt.getTime();
    const expiryMs = EXPIRY_MS[contest.type] || EXPIRY_MS.public;

    if (contest.status === 'waiting' || contest.status === 'filling') {
      const remaining = expiryMs - (now - createdAt);
      if (remaining <= 0) {
        await expireContest(contest._id.toString(), io);
      } else {
        // Re-schedule remaining window
        const expiryTimer = setTimeout(() => expireContest(contest._id.toString(), io), remaining);
        timers.set(contest._id.toString(), { expiryTimer, startTimer: null });
      }
    } else if (contest.status === 'active') {
      const endAt = contest.startedAt
        ? new Date(contest.startedAt.getTime() + contest.durationMinutes * 60_000)
        : new Date(now + 60_000);
      const remaining = endAt.getTime() - now;
      if (remaining <= 0) {
        await completeContest(contest._id.toString(), io);
      } else {
        const expiryTimer = setTimeout(() => completeContest(contest._id.toString(), io), remaining);
        timers.set(contest._id.toString(), { expiryTimer, startTimer: null });
      }
    }
  }

  console.log(`[ContestLifecycle] Recovered ${activeContests.length} in-progress contests.`);
}

module.exports = {
  scheduleExpiry,
  clearContestTimers,
  expireContest,
  tryStartContest,
  activateContest,
  completeContest,
  recoverActiveContests,
};
