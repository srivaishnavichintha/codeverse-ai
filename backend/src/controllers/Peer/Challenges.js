const Challenge = require('../../models/Peer/Challenges');
const User = require('../../models/User');
const Problem = require('../../models/Problem');
const Notification = require('../../models/Notification');
const { createBattleFromChallenge } = require('../../services/Peer/BattleServices');

// Helper: expiry time (customize as needed)
const getExpiryTime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15); // 15 min expiry (change if needed)
  return now;
};


// ─────────────────────────────────────────────
// 1. CREATE CHALLENGE
exports.createChallenge = async (req, res, next) => {
  try {
    const challengerId = req.user.id;
    const { opponentId, scheduledAt, durationMinutes, numberOfProblems = 1 } = req.body;

    if (!opponentId || !scheduledAt || !durationMinutes) {
      return res.status(400).json({ message: 'Missing fields' });
    }

    if (challengerId === opponentId) {
      return res.status(400).json({ message: 'Cannot challenge yourself' });
    }

    const start = new Date(scheduledAt);
    const end = new Date(start.getTime() + durationMinutes * 60000);

    if (start < new Date()) {
      return res.status(400).json({ message: 'Cannot schedule a challenge in the past' });
    }

    // 🔥 CONFLICT CHECK
    const conflict = await Challenge.findOne({
      status: { $in: ['pending', 'accepted'] },
      $or: [
        { challenger: challengerId },
        { opponent: challengerId },
        { challenger: opponentId },
        { opponent: opponentId },
      ],
      scheduledAt: { $lt: end },
      endsAt: { $gt: start },
    });

    if (conflict) {
      return res.status(400).json({
        message: 'Time slot conflict with existing challenge',
      });
    }

    const challenge = await Challenge.create({
      challenger: challengerId,
      opponent: opponentId,
      scheduledAt: start,
      endsAt: end,
      durationMinutes,
      numberOfProblems,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const challengerUser = await User.findById(challengerId);
    if (challengerUser) {
      await Notification.create({
        user: opponentId,
        type: 'challenge_received',
        title: 'New Challenge',
        message: `${challengerUser.username} challenged you to a duel!`,
        metadata: { challengeId: challenge._id }
      });
    }

    res.status(201).json({
      message: 'Challenge scheduled successfully',
      challenge,
    });

  } catch (err) {
    next(err);
  }
};


// ─────────────────────────────────────────────
// 2. RESPOND TO CHALLENGE (ACCEPT / REJECT)
// ─────────────────────────────────────────────
exports.respondToChallenge = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { action } = req.body; // 'accept' | 'reject'

    const challenge = await Challenge.findById(id);

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    // Only opponent can respond
    if (challenge.opponent.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to respond' });
    }

    // Must be pending
    if (challenge.status !== 'pending') {
      return res.status(400).json({ message: 'Challenge already responded' });
    }

    if (challenge.scheduledAt < new Date()) {
      return res.status(400).json({
        message: 'Cannot accept past challenge',
      });
    }
    // Check expiry
    if (challenge.expiresAt < new Date()) {
      challenge.status = 'expired';
      await challenge.save();
      return res.status(400).json({ message: 'Challenge expired' });
    }

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }
    if (action === 'accept') {
      challenge.status = 'accepted';
      challenge.respondedAt = new Date();

      await challenge.save();

      // Deduct 5 points from both users
      const challengerUser = await User.findById(challenge.challenger);
      const opponentUser = await User.findById(challenge.opponent);
      
      if (challengerUser && opponentUser) {
        challengerUser.rating = Math.max(0, challengerUser.rating - 5);
        opponentUser.rating = Math.max(0, opponentUser.rating - 5);
        await challengerUser.save();
        await opponentUser.save();

        await Notification.create([
          { user: challenge.challenger, type: 'points_transaction', title: 'Points Deducted', message: '5 points deducted for entering battle' },
          { user: challenge.opponent, type: 'points_transaction', title: 'Points Deducted', message: '5 points deducted for entering battle' },
          { user: challenge.challenger, type: 'challenge_accepted', title: 'Challenge Accepted', message: `${opponentUser.username} accepted your challenge!` }
        ]);
      }

      const battle = await createBattleFromChallenge(challenge);

      return res.status(200).json({
        message: 'Challenge accepted and battle created',
        challenge,
        battle,
      });
    }
    else {
      challenge.status = 'rejected';
      challenge.respondedAt = new Date();

      await challenge.save();

      await Notification.create({
        user: challenge.challenger,
        type: 'challenge_rejected',
        title: 'Challenge Declined',
        message: 'Your challenge was declined.'
      });
    }

    res.status(200).json({
      message: `Challenge ${action}ed`,
      challenge,
    });

  } catch (err) {
    next(err);
  }
};


// ─────────────────────────────────────────────
// 3. GET INCOMING CHALLENGES
// ─────────────────────────────────────────────
exports.getIncomingChallenges = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const challenges = await Challenge.find({
      opponent: userId,
    })
      .populate({
        path: 'challenger',
        select: 'username rating level', // avoid pulling stats → prevents virtual issues
      })
      .sort({ createdAt: -1 })
      .lean(); // 🔥 important → avoids mongoose virtual execution

    const now = Date.now();
    const processedChallenges = challenges.map(c => {
      if (c.scheduledAt && new Date(c.scheduledAt).getTime() > now) {
        c.problemTitle = 'Hidden until start';
      } else {
        c.problemTitle = `${c.numberOfProblems || 1} Problem(s)`;
      }
      return c;
    });

    res.status(200).json({
      success: true,
      count: processedChallenges.length,
      challenges: processedChallenges,
    });

  } catch (err) {
    next(err);
  }
};


// ─────────────────────────────────────────────
// 4. GET OUTGOING CHALLENGES
// ─────────────────────────────────────────────
exports.getOutgoingChallenges = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const challenges = await Challenge.find({
      challenger: userId,
    })
      .populate({
        path: 'opponent',
        select: 'username rating level',
      })
      .sort({ createdAt: -1 })
      .lean(); // 🔥 same here

    const now = Date.now();
    const processedChallenges = challenges.map(c => {
      if (c.scheduledAt && new Date(c.scheduledAt).getTime() > now) {
        c.problemTitle = 'Hidden until start';
      } else {
        c.problemTitle = `${c.numberOfProblems || 1} Problem(s)`;
      }
      return c;
    });

    res.status(200).json({
      success: true,
      count: processedChallenges.length,
      challenges: processedChallenges,
    });

  } catch (err) {
    next(err);
  }
};


// ─────────────────────────────────────────────
// 5. CANCEL CHALLENGE
// ─────────────────────────────────────────────
exports.cancelChallenge = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const challenge = await Challenge.findById(id);

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    // Only challenger can cancel
    if (challenge.challenger.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to cancel' });
    }

    // Only pending challenges can be cancelled
    if (challenge.status !== 'pending') {
      return res.status(400).json({ message: 'Cannot cancel this challenge' });
    }

    challenge.status = 'cancelled';
    await challenge.save();

    res.status(200).json({
      message: 'Challenge cancelled successfully',
      challenge,
    });

  } catch (err) {
    next(err);
  }
};