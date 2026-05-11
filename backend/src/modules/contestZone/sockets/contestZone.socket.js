'use strict';

/**
 * Contest Zone — Socket.IO handler
 *
 * Room naming convention:
 *   contest:{contestId}   — shared room for all contest participants (leaderboard, announcements)
 *   user:{userId}         — personal room for submission results
 *
 * Design principles:
 *   - Authenticate on connection (JWT in handshake)
 *   - Throttle high-frequency events (leaderboard requests)
 *   - Clean up rooms on disconnect
 *   - No memory leaks: all timers/intervals tracked and cleared
 */

const jwt             = require('jsonwebtoken');
const User            = require('../../../models/User');
const ContestZone     = require('../models/ContestZone.model');
const ContestParticipant = require('../models/ContestParticipant.model');
const { getLeaderboard } = require('../services/leaderboard.service');
const { tryStartContest } = require('../services/contestLifecycle.service');

// ── Throttle registry — prevents leaderboard request spam ────────────────────
// socketId → last request timestamp
const leaderboardThrottle = new Map();
const THROTTLE_MS = 2000; // max 1 leaderboard pull per 2 seconds per socket

/**
 * Register all Contest Zone socket events.
 * Call this from the main socket.io initialization in server.js.
 *
 * @param {Server} io — Socket.IO server
 */
function registerContestSockets(io) {
  // ── Authentication middleware ─────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id username avatar isActive').lean();
      if (!user || !user.isActive) return next(new Error('User not found'));

      socket.userId   = user._id.toString();
      socket.username = user.username;
      socket.avatar   = user.avatar || null;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, username } = socket;

    // Join user's personal room for private events
    socket.join(`user:${userId}`);

    // ── Join contest room ─────────────────────────────────
    socket.on('contest:join', async ({ contestId }) => {
      try {
        if (!contestId) return;

        // Verify user is a registered participant
        const participant = await ContestParticipant.findOne({
          contest:  contestId,
          user:     userId,
          isActive: true,
        }).lean();

        if (!participant) {
          socket.emit('contest:error', { message: 'You are not a participant of this contest' });
          return;
        }

        socket.join(`contest:${contestId}`);
        socket.contestId = contestId;

        // Send current state to joining user
        const contest = await ContestZone.findById(contestId)
          .select('status currentParticipants maxParticipants startedAt durationMinutes scheduledStartAt')
          .lean();

        const leaderboard = await getLeaderboard(contestId);
        const participantCount = await ContestParticipant.countDocuments({ contest: contestId, isActive: true });

        socket.emit('contest:state', {
          contestId,
          status:        contest.status,
          participants:  participantCount,
          maxParticipants: contest.maxParticipants,
          startedAt:     contest.startedAt,
          durationMinutes: contest.durationMinutes,
          scheduledStartAt: contest.scheduledStartAt,
          leaderboard:   leaderboard.slice(0, 10),
        });

        // Notify others
        socket.to(`contest:${contestId}`).emit('contest:participant:joined', {
          userId,
          username,
          participants: participantCount,
        });

        console.log(`[Socket] ${username} joined contest room: ${contestId}`);
      } catch (err) {
        console.error('[Socket] contest:join error:', err.message);
        socket.emit('contest:error', { message: 'Failed to join contest room' });
      }
    });

    // ── Leave contest room ────────────────────────────────
    socket.on('contest:leave', async ({ contestId }) => {
      socket.leave(`contest:${contestId}`);
      socket.contestId = null;

      const participantCount = await ContestParticipant.countDocuments({
        contest: contestId, isActive: true,
      }).catch(() => 0);

      socket.to(`contest:${contestId}`).emit('contest:participant:left', {
        userId,
        username,
        participants: participantCount,
      });
    });

    // ── Request leaderboard (throttled) ───────────────────
    socket.on('contest:leaderboard:request', async ({ contestId }) => {
      const now  = Date.now();
      const last = leaderboardThrottle.get(socket.id) || 0;
      if (now - last < THROTTLE_MS) return; // throttle
      leaderboardThrottle.set(socket.id, now);

      try {
        const entries = await getLeaderboard(contestId);
        socket.emit('contest:leaderboard:data', {
          contestId,
          leaderboard: entries.slice(0, 20),
          ts: new Date(),
        });
      } catch (err) {
        socket.emit('contest:error', { message: 'Failed to fetch leaderboard' });
      }
    });

    // ── Request contest countdown ─────────────────────────
    socket.on('contest:countdown:request', async ({ contestId }) => {
      try {
        const contest = await ContestZone.findById(contestId)
          .select('status startedAt durationMinutes scheduledStartAt endedAt')
          .lean();

        if (!contest) return;

        const now = Date.now();
        let countdown = null;

        if (contest.status === 'starting' && contest.scheduledStartAt) {
          countdown = Math.max(0, new Date(contest.scheduledStartAt).getTime() - now);
        } else if (contest.status === 'active' && contest.startedAt) {
          const endsAt = new Date(contest.startedAt).getTime() + contest.durationMinutes * 60_000;
          countdown = Math.max(0, endsAt - now);
        }

        socket.emit('contest:countdown:data', { contestId, status: contest.status, remainingMs: countdown });
      } catch (err) {
        socket.emit('contest:error', { message: 'Failed to get countdown' });
      }
    });

    // ── Disconnect cleanup ────────────────────────────────
    socket.on('disconnect', () => {
      leaderboardThrottle.delete(socket.id);

      if (socket.contestId) {
        ContestParticipant.countDocuments({
          contest: socket.contestId, isActive: true,
        }).then(count => {
          io.to(`contest:${socket.contestId}`).emit('contest:participant:left', {
            userId,
            username,
            participants: count,
          });
        }).catch(() => {});
      }
    });
  });
}

module.exports = { registerContestSockets };
