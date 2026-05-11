'use strict';

/**
 * Contest Zone Controller
 *
 * Handles all REST API endpoints for Contest Zone.
 * Socket.IO instance is attached to req.io by the app middleware.
 */

const crypto  = require('crypto');
const mongoose = require('mongoose');
const ContestZone        = require('../models/ContestZone.model');
const ContestParticipant = require('../models/ContestParticipant.model');
const ContestProblem     = require('../models/ContestProblem.model');
const ContestLeaderboard = require('../models/ContestLeaderboard.model');
const ContestRewardLog   = require('../models/ContestRewardLog.model');
const User               = require('../../../models/User');
const { lockCoins }      = require('../services/coinLock.service');
const { scheduleExpiry, tryStartContest, completeContest, expireContest } = require('../services/contestLifecycle.service');
const { getLeaderboard } = require('../services/leaderboard.service');
const { evaluateContestSubmission } = require('../services/contestSubmission.service');
const { validateContest, invalidateContest } = require('../services/antiCheat.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function paginationOpts(query) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(50, parseInt(query.limit) || 20);
  return { skip: (page - 1) * limit, limit, page };
}

// ─── User level helper ────────────────────────────────────────────────────────
/**
 * Derive contest permission level from user record.
 * Uses the `stats.totalSolved` field as a proxy for level.
 * Adjust thresholds to match your system.
 */
async function getUserLevel(userId) {
  const user = await User.findById(userId).select('stats.totalSolved role').lean();
  if (!user) return 'beginner';
  if (user.role === 'admin' || user.role === 'moderator') return 'advanced';
  const solved = user.stats?.totalSolved || 0;
  if (solved >= 50) return 'advanced';
  if (solved >= 15) return 'intermediate';
  return 'beginner';
}

// ─── CREATE CONTEST ───────────────────────────────────────────────────────────

exports.createContest = asyncHandler(async (req, res) => {
  const io = req.app.get('io');
  const userId = req.user.id;

  const {
    title,
    description = '',
    type,
    difficulty = 'medium',
    problemCount = 1,
    minParticipants = 2,
    maxParticipants = 10,
    entryFee = 0,
    durationMinutes = 30,
    platformFeePercent = 10,
    scheduledStartAt = null,
  } = req.body;

  // ── Validations ────────────────────────────────────────
  if (!['public', 'private'].includes(type)) {
    return res.status(400).json({ success: false, message: 'type must be public or private' });
  }

  const level = await getUserLevel(userId);

  if (type === 'public' && level !== 'advanced') {
    return res.status(403).json({ success: false, message: 'Only Advanced users can create public contests' });
  }

  // Active contest limit check for private contests
  if (type === 'private') {
    const activeLimit = level === 'beginner' ? 1 : level === 'intermediate' ? 2 : 10;
    const activeCount = await ContestZone.countDocuments({
      createdBy: userId,
      type:      'private',
      status:    { $in: ['waiting', 'filling', 'starting', 'active'] },
    });
    if (activeCount >= activeLimit) {
      return res.status(403).json({
        success: false,
        message: `${level} users can have at most ${activeLimit} active private contest(s)`,
      });
    }
  }

  if (maxParticipants < minParticipants) {
    return res.status(400).json({ success: false, message: 'maxParticipants must be ≥ minParticipants' });
  }
  if (maxParticipants > 20) {
    return res.status(400).json({ success: false, message: 'maxParticipants cannot exceed 20' });
  }
  if (problemCount < 1 || problemCount > 5) {
    return res.status(400).json({ success: false, message: 'problemCount must be 1–5' });
  }

  // Validate scheduledStartAt if provided
  let parsedScheduledAt = null;
  if (scheduledStartAt) {
    parsedScheduledAt = new Date(scheduledStartAt);
    if (isNaN(parsedScheduledAt.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid scheduledStartAt date' });
    }
    // Must be at least 2 minutes in the future
    if (parsedScheduledAt.getTime() < Date.now() + 2 * 60 * 1000) {
      return res.status(400).json({ success: false, message: 'Scheduled start must be at least 2 minutes in the future' });
    }
  }

  // ── Generate invite code for private contests ──────────
  const inviteCode = type === 'private'
    ? crypto.randomBytes(6).toString('hex').toUpperCase()
    : undefined;

  const contest = await ContestZone.create({
    title:              title.trim(),
    description,
    type,
    difficulty,
    problemCount,
    createdBy:          userId,
    minParticipants,
    maxParticipants,
    entryFee,
    durationMinutes,
    platformFeePercent,
    inviteCode,
    scheduledStartAt:   parsedScheduledAt,
    status:             'waiting',
  });

  // Schedule expiry timer
  scheduleExpiry(contest._id.toString(), type, io);

  res.status(201).json({
    success: true,
    data: {
      contest,
      inviteLink: inviteCode ? `${process.env.CLIENT_URL}/contest-zone/join/${inviteCode}` : null,
    },
  });
});

// ─── JOIN CONTEST ─────────────────────────────────────────────────────────────

exports.joinContest = asyncHandler(async (req, res) => {
  const io = req.app.get('io');
  const userId = req.user.id;
  const { contestId } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const contest = await ContestZone.findById(contestId).session(session);
    if (!contest) throw new Error('Contest not found');

    if (!['waiting', 'filling'].includes(contest.status)) {
      throw new Error(`Cannot join a contest with status: ${contest.status}`);
    }

    if (contest.currentParticipants >= contest.maxParticipants) {
      throw new Error('Contest is full');
    }

    // Prevent duplicate join
    const existing = await ContestParticipant.findOne({ contest: contestId, user: userId }).session(session);
    if (existing) throw new Error('You have already joined this contest');

    // Lock coins
    await lockCoins({ userId, contestId, entryFee: contest.entryFee, session });

    // Create participant record
    await ContestParticipant.create([{
      contest:  contestId,
      user:     userId,
      entryFee: contest.entryFee,
    }], { session });

    // Update participant count and status
    const newCount  = contest.currentParticipants + 1;
    const newStatus = newCount >= contest.minParticipants ? 'filling' : 'waiting';
    await ContestZone.findByIdAndUpdate(
      contestId,
      { currentParticipants: newCount, status: newStatus },
      { session }
    );

    // Update prize pool
    await ContestZone.findByIdAndUpdate(
      contestId,
      { $inc: { prizePool: contest.entryFee } },
      { session }
    );

    await session.commitTransaction();

    // Try to auto-start if full
    await tryStartContest(contestId, io);

    // Notify socket room
    if (io) {
      io.to(`contest:${contestId}`).emit('contest:participant:joined', {
        contestId,
        participants: newCount,
        maxParticipants: contest.maxParticipants,
      });
    }

    res.json({ success: true, message: 'Joined contest successfully' });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
});

// ─── JOIN BY INVITE CODE (private contests) ───────────────────────────────────

exports.joinByInvite = asyncHandler(async (req, res) => {
  const { inviteCode } = req.params;
  const contest = await ContestZone.findOne({ inviteCode: inviteCode.toUpperCase() }).lean();

  if (!contest) {
    return res.status(404).json({ success: false, message: 'Invalid invite code' });
  }
  if (contest.type !== 'private') {
    return res.status(400).json({ success: false, message: 'This is not a private contest' });
  }

  // Reuse join logic
  req.params.contestId = contest._id.toString();
  return exports.joinContest(req, res);
});

// ─── LEAVE CONTEST ────────────────────────────────────────────────────────────

exports.leaveContest = asyncHandler(async (req, res) => {
  const io = req.app.get('io');
  const userId = req.user.id;
  const { contestId } = req.params;

  const contest = await ContestZone.findById(contestId);
  if (!contest) return res.status(404).json({ success: false, message: 'Contest not found' });

  // Can only leave before ACTIVE
  if (['active', 'evaluating', 'completed'].includes(contest.status)) {
    return res.status(400).json({ success: false, message: 'Cannot leave an active or completed contest' });
  }

  const participant = await ContestParticipant.findOne({ contest: contestId, user: userId, isActive: true });
  if (!participant) return res.status(404).json({ success: false, message: 'Not a participant' });

  // Refund entry fee
  const { creditCoins } = require('../services/coinLock.service');
  await creditCoins({
    userId,
    contestId,
    amount:      participant.entryFee,
    type:        'refund_expiry',
    description: 'Participant left before contest started',
  });

  await ContestParticipant.findByIdAndUpdate(participant._id, {
    isActive:      false,
    coinsLocked:   false,
    coinsRefunded: true,
  });

  await ContestZone.findByIdAndUpdate(contestId, {
    $inc: { currentParticipants: -1, prizePool: -participant.entryFee },
  });

  if (io) {
    const count = await ContestParticipant.countDocuments({ contest: contestId, isActive: true });
    io.to(`contest:${contestId}`).emit('contest:participant:left', {
      contestId, participants: count,
    });
  }

  res.json({ success: true, message: 'Left contest and coins refunded' });
});

// ─── GET CONTEST DETAILS ──────────────────────────────────────────────────────

exports.getContest = asyncHandler(async (req, res) => {
  const { contestId } = req.params;
  const userId = req.user?.id;

  const contest = await ContestZone.findById(contestId)
    .populate('createdBy', 'username avatar')
    .lean();

  if (!contest) return res.status(404).json({ success: false, message: 'Contest not found' });

  let isParticipant = false;
  let myRank = null;

  if (userId) {
    const p = await ContestParticipant.findOne({ contest: contestId, user: userId }).lean();
    isParticipant = !!p;
    myRank = p?.rank || null;
  }

  // Private contest visibility: only creator or participants can view details
  if (contest.type === 'private') {
    const isCreator = userId && contest.createdBy?._id?.toString() === userId;
    if (!isCreator && !isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'This is a private contest. Join using the invite code to access it.',
      });
    }
  }

  // Don't expose test cases until contest is completed
  let problems = [];
  if (['active', 'evaluating', 'completed'].includes(contest.status)) {
    problems = await ContestProblem.find({ contest: contestId })
      .select(contest.status === 'completed' ? undefined : '-testCases')
      .lean();
  }

  res.json({
    success: true,
    data: {
      contest,
      problems,
      isParticipant,
      myRank,
    },
  });
});

// ─── LIST CONTESTS ────────────────────────────────────────────────────────────

exports.listContests = asyncHandler(async (req, res) => {
  const { type, status, page, limit } = req.query;
  const { skip, limit: lim } = paginationOpts({ page, limit });
  const userId = req.user?.id || null;

  const filter = {};
  if (type)   filter.type   = type;
  if (status) filter.status = status;

  // ── Private contest visibility ────────────────────────────
  // Private contests are ONLY visible to:
  //   1. The creator
  //   2. Users who have joined (participants)
  // Public contests are visible to everyone.
  //
  // If no type filter is set (showing all), we build an $or:
  //   - All public contests
  //   - Private contests where user is creator or participant
  // If type=private is explicitly requested, restrict to user's own.
  // If type=public, no extra filtering needed.

  if (type === 'private') {
    // Only show private contests the user is involved in
    if (!userId) {
      // Not logged in — no private contests visible
      return res.json({ success: true, data: { contests: [], total: 0, page: 1, pages: 0 } });
    }
    // Get contest IDs where user is a participant
    const myParticipations = await ContestParticipant.find({ user: userId, isActive: true })
      .select('contest')
      .lean();
    const participatedIds = myParticipations.map(p => p.contest);

    filter.$or = [
      { createdBy: userId },
      { _id: { $in: participatedIds } },
    ];
  } else if (!type || type === 'all') {
    // Mixed view: all public + only user's private contests
    if (userId) {
      const myParticipations = await ContestParticipant.find({ user: userId, isActive: true })
        .select('contest')
        .lean();
      const participatedIds = myParticipations.map(p => p.contest);

      delete filter.type; // remove any type filter
      filter.$or = [
        { type: 'public' },
        { type: 'private', createdBy: userId },
        { type: 'private', _id: { $in: participatedIds } },
      ];
    } else {
      // Not logged in — only public contests
      filter.type = 'public';
    }
  }
  // If type === 'public', no additional filtering needed (filter.type = 'public' already set)

  const [contests, total] = await Promise.all([
    ContestZone.find(filter)
      .populate('createdBy', 'username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    ContestZone.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: { contests, total, page: Math.ceil(skip / lim) + 1, pages: Math.ceil(total / lim) },
  });
});

// ─── GET LEADERBOARD ──────────────────────────────────────────────────────────

exports.getLeaderboard = asyncHandler(async (req, res) => {
  const { contestId } = req.params;
  const entries = await getLeaderboard(contestId);
  res.json({ success: true, data: { contestId, leaderboard: entries } });
});

// ─── SUBMIT SOLUTION ──────────────────────────────────────────────────────────

exports.submitSolution = asyncHandler(async (req, res) => {
  const io = req.app.get('io');
  const userId = req.user.id;
  const { contestId } = req.params;
  const { problemId, code, language } = req.body;

  if (!problemId || !code || !language) {
    return res.status(400).json({ success: false, message: 'problemId, code, and language are required' });
  }
  if (!['javascript', 'python', 'java', 'cpp'].includes(language)) {
    return res.status(400).json({ success: false, message: 'Unsupported language' });
  }

  const result = await evaluateContestSubmission({ contestId, problemId, userId, code, language, io });

  res.json({ success: true, data: result });
});

// ─── CONTEST HISTORY ──────────────────────────────────────────────────────────

exports.getHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { skip, limit } = paginationOpts(req.query);

  const participations = await ContestParticipant.find({ user: userId })
    .populate({
      path:   'contest',
      select: 'title type status difficulty entryFee durationMinutes startedAt endedAt',
    })
    .sort({ joinedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.json({ success: true, data: participations });
});

// ─── START CONTEST (creator or admin — manually trigger start) ────────────────

exports.startContest = asyncHandler(async (req, res) => {
  const io = req.app.get('io');
  const userId = req.user.id;
  const { contestId } = req.params;

  const contest = await ContestZone.findById(contestId);
  if (!contest) return res.status(404).json({ success: false, message: 'Contest not found' });

  const isCreator = contest.createdBy.toString() === userId;
  const isAdmin   = req.user.role === 'admin';

  if (!isCreator && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Only the creator or admin can start the contest' });
  }

  if (!['waiting', 'filling'].includes(contest.status)) {
    return res.status(400).json({ success: false, message: `Cannot start a contest with status: ${contest.status}` });
  }

  const participantCount = await ContestParticipant.countDocuments({ contest: contestId, isActive: true });
  if (participantCount < contest.minParticipants) {
    return res.status(400).json({
      success: false,
      message: `Need at least ${contest.minParticipants} participants to start (currently ${participantCount})`,
    });
  }

  // Trigger the starting countdown (reuses the lifecycle service)
  await tryStartContest(contestId, io);

  res.json({ success: true, message: 'Contest starting countdown initiated!' });
});

// ─── CANCEL CONTEST (creator or admin only) ───────────────────────────────────

exports.cancelContest = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { contestId } = req.params;

  const contest = await ContestZone.findById(contestId);
  if (!contest) return res.status(404).json({ success: false, message: 'Contest not found' });

  const isCreator = contest.createdBy.toString() === userId;
  const isAdmin   = req.user.role === 'admin';

  if (!isCreator && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Only the creator or admin can cancel' });
  }

  if (['active', 'completed', 'cancelled'].includes(contest.status)) {
    return res.status(400).json({ success: false, message: `Cannot cancel a ${contest.status} contest` });
  }

  await expireContest(contestId, req.app.get('io'));

  res.json({ success: true, message: 'Contest cancelled and coins refunded' });
});

// ─── GET REWARD LOGS ──────────────────────────────────────────────────────────

exports.getRewardLogs = asyncHandler(async (req, res) => {
  const { contestId } = req.params;
  const logs = await ContestRewardLog.find({ contest: contestId })
    .populate('user', 'username')
    .sort({ processedAt: 1 })
    .lean();

  res.json({ success: true, data: logs });
});

// ─── GET MY SUBMISSIONS IN A CONTEST ─────────────────────────────────────────

exports.getMySubmissions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { contestId } = req.params;
  const ContestSubmission = require('../models/ContestSubmission.model');

  const subs = await ContestSubmission.find({ contest: contestId, user: userId })
    .select('-testResults')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: subs });
});

// ─── ADMIN: Force complete contest ────────────────────────────────────────────

exports.forceComplete = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  const { contestId } = req.params;
  await completeContest(contestId, req.app.get('io'));
  res.json({ success: true, message: 'Contest force-completed' });
});

// ─── ADMIN: Invalidate contest (cheat detected) ───────────────────────────────

exports.invalidateContest = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  const { contestId } = req.params;
  const { reason = 'Cheating detected' } = req.body;

  await invalidateContest(contestId, reason);
  res.json({ success: true, message: 'Contest invalidated and coins refunded' });
});
