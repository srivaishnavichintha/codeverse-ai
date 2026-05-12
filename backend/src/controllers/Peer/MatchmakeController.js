'use strict';

/**
 * Matchmaking queue — Redis sorted-set implementation
 *
 * Data layout in Redis
 * ────────────────────
 * Sorted set  : "matchmake:queue"
 *   member    : userId (string)
 *   score     : User.rating  (numeric, enables ZRANGEBYSCORE range scan)
 *
 * Hash        : "matchmake:meta:<userId>"
 *   fields    : rating, durationMinutes, numberOfProblems, enqueuedAt
 *   TTL       : QUEUE_TTL_SECONDS  (auto-expires stale entries)
 *
 * String      : "matchmake:paired:<userId>"
 *   value     : JSON { battleId, opponentId, pairedAt }
 *   TTL       : 120 s  (frontend should poll and then read the battle)
 *
 * Flow
 * ────
 * POST /matchmake
 *   1. Remove any stale entry for this user.
 *   2. Scan the sorted set for a waiting player within ±RATING_BAND points.
 *   3a. Match found → dequeue both, synthesise a Challenge doc, call
 *       createBattleFromChallenge, store paired keys, return battle.
 *   3b. No match → enqueue caller, return { status: 'waiting', token: userId }.
 *
 * GET  /matchmake/status   → check paired key; 'waiting' | 'paired' | 'not_in_queue'
 * DELETE /matchmake        → remove caller from queue
 */

const User      = require('../../models/User');
const Challenge = require('../../models/Peer/Challenges');
const { getRedis }                   = require('../../config/redis');
const { createBattleFromChallenge }  = require('../../services/Peer/BattleServices');

const QUEUE_KEY        = 'matchmake:queue';
const RATING_BAND      = 200;   // ±200 Elo
const QUEUE_TTL_SECONDS = 30;   // auto-expire stale queue entries after 30 s
const PAIRED_TTL_SECONDS = 120; // paired result lives 2 min for the frontend to pick up

// ─── helpers ─────────────────────────────────────────────────────────────────

function metaKey(userId)   { return `matchmake:meta:${userId}`; }
function pairedKey(userId) { return `matchmake:paired:${userId}`; }

/** Remove a user from both the sorted set and their meta hash. */
async function dequeueUser(redis, userId) {
  await Promise.all([
    redis.zRem(QUEUE_KEY, userId),
    redis.del(metaKey(userId)),
  ]);
}

/**
 * Build a minimal in-memory challenge object that satisfies
 * createBattleFromChallenge's field access pattern without
 * persisting an unwanted Challenge document.
 */
function syntheticChallenge(challenger, opponent, durationMinutes, numberOfProblems) {
  const now   = new Date();
  const endsAt = new Date(now.getTime() + durationMinutes * 60_000);
  return {
    _id:              null,             // no DB row — battle.challengeId will be null
    challenger:       challenger._id,
    opponent:         opponent._id,
    scheduledAt:      now,
    endsAt,
    durationMinutes,
    numberOfProblems: numberOfProblems || 1,
  };
}

// ─── POST /api/peers/matchmake ────────────────────────────────────────────────

exports.enterQueue = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { durationMinutes = 30, numberOfProblems = 1 } = req.body;

    const redis = getRedis();

    // Always clean up any previous entry so re-queuing is idempotent
    await dequeueUser(redis, userId);

    // Also clear any stale paired result so old data doesn't confuse the poller
    await redis.del(pairedKey(userId));

    const caller = await User.findById(userId).select('rating username').lean();
    if (!caller) return res.status(404).json({ success: false, message: 'User not found' });

    const callerRating = caller.rating || 1200;

    // ── Scan for a suitable waiting opponent ─────────────────────────────────
    const minScore = callerRating - RATING_BAND;
    const maxScore = callerRating + RATING_BAND;

    // ZRANGEBYSCORE returns members (userIds) within the rating band
    const candidates = await redis.zRangeByScore(QUEUE_KEY, minScore, maxScore);

    // Exclude self (shouldn't be in queue since we just removed, but be safe)
    const opponentId = candidates.find(id => id !== userId);

    if (opponentId) {
      // ── MATCH FOUND ───────────────────────────────────────────────────────
      const opponentMeta = await redis.hGetAll(metaKey(opponentId));

      // Dequeue the opponent atomically before anyone else grabs them
      await dequeueUser(redis, opponentId);

      const opponent = await User.findById(opponentId).select('rating username').lean();
      if (!opponent) {
        // Opponent vanished between scan and fetch — fall back to queueing caller
        // (handled below by falling through to the enqueue block)
        // We'll just enqueue the caller and tell them to keep waiting.
        await redis.zAdd(QUEUE_KEY, { score: callerRating, value: userId });
        await redis.hSet(metaKey(userId), {
          rating: callerRating,
          durationMinutes,
          numberOfProblems,
          enqueuedAt: Date.now(),
        });
        await redis.expire(metaKey(userId), QUEUE_TTL_SECONDS);
        return res.json({
          success: true,
          status:  'waiting',
          token:   userId,
          message: 'Opponent disappeared; re-queued. Poll /matchmake/status.',
        });
      }

      // Prefer the opponent's battle settings if they asked for a longer session
      const finalDuration = Math.max(
        durationMinutes,
        parseInt(opponentMeta.durationMinutes || 30, 10)
      );
      const finalProblems = Math.max(
        numberOfProblems,
        parseInt(opponentMeta.numberOfProblems || 1, 10)
      );

      const challenge = syntheticChallenge(
        { _id: userId },
        { _id: opponentId },
        finalDuration,
        finalProblems
      );

      let battle;
      try {
        battle = await createBattleFromChallenge(challenge);
      } catch (battleErr) {
        // If battle creation fails, put both players back in queue gracefully
        await redis.zAdd(QUEUE_KEY, { score: callerRating, value: userId });
        const oppRating = opponent.rating || 1200;
        await redis.zAdd(QUEUE_KEY, { score: oppRating, value: opponentId });
        return next(battleErr);
      }

      // Write paired result for both players so polling works
      const pairedPayload = (myId, theirId) =>
        JSON.stringify({ battleId: battle._id, opponentId: theirId, pairedAt: Date.now() });

      await Promise.all([
        redis.setEx(pairedKey(userId),     PAIRED_TTL_SECONDS, pairedPayload(userId, opponentId)),
        redis.setEx(pairedKey(opponentId), PAIRED_TTL_SECONDS, pairedPayload(opponentId, userId)),
      ]);

      return res.status(201).json({
        success:  true,
        status:   'paired',
        battleId: battle._id,
        opponent: { id: opponentId, username: opponent.username, rating: opponent.rating },
        battle,
      });
    }

    // ── NO MATCH — enqueue caller ─────────────────────────────────────────────
    await redis.zAdd(QUEUE_KEY, { score: callerRating, value: userId });
    await redis.hSet(metaKey(userId), {
      rating:           callerRating,
      durationMinutes,
      numberOfProblems,
      enqueuedAt:       Date.now(),
    });
    // TTL on meta hash so stale entries self-clean even if DELETE is never called
    await redis.expire(metaKey(userId), QUEUE_TTL_SECONDS);
    // Also set a score-expiry via a separate expiry key — sorted-set members have
    // no native TTL, so we rely on the meta expiry + a background ZREM (see note).
    // As a belt-and-suspenders measure, schedule a delayed removal via a Redis
    // string that the status endpoint checks and cleans up.
    await redis.setEx(`matchmake:expiry:${userId}`, QUEUE_TTL_SECONDS, '1');

    return res.json({
      success: true,
      status:  'waiting',
      token:   userId,
      message: `In queue. Poll GET /api/peers/matchmake/status within ${QUEUE_TTL_SECONDS}s.`,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/peers/matchmake/status ─────────────────────────────────────────

exports.getQueueStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const redis  = getRedis();

    // Check if the user has been paired already
    const pairedRaw = await redis.get(pairedKey(userId));
    if (pairedRaw) {
      const paired = JSON.parse(pairedRaw);
      return res.json({ success: true, status: 'paired', ...paired });
    }

    // Check if still in the queue (zScore returns null if not present)
    const score = await redis.zScore(QUEUE_KEY, userId);
    if (score !== null) {
      // Check if the expiry sentinel has expired — if so, the queue slot is stale
      const expiry = await redis.get(`matchmake:expiry:${userId}`);
      if (!expiry) {
        // TTL lapsed but zSet member wasn't cleaned — remove it now
        await dequeueUser(redis, userId);
        return res.json({ success: true, status: 'expired', message: 'Queue timed out. Re-enter the queue.' });
      }
      return res.json({ success: true, status: 'waiting' });
    }

    return res.json({ success: true, status: 'not_in_queue' });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/peers/matchmake ─────────────────────────────────────────────

exports.leaveQueue = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const redis  = getRedis();

    await Promise.all([
      dequeueUser(redis, userId),
      redis.del(`matchmake:expiry:${userId}`),
    ]);

    return res.json({ success: true, message: 'Removed from matchmaking queue.' });
  } catch (err) {
    next(err);
  }
};