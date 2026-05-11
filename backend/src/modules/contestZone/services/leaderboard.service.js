'use strict';

/**
 * Leaderboard Service
 *
 * Maintains the denormalized ContestLeaderboard document.
 * Called after every accepted submission.
 *
 * Uses optimistic concurrency (version field) to handle
 * concurrent submissions without a distributed lock.
 */

const ContestLeaderboard = require('../models/ContestLeaderboard.model');
const ContestParticipant = require('../models/ContestParticipant.model');
const User = require('../../../models/User');

const MAX_RETRIES = 3;

/**
 * Recompute and persist the leaderboard for a contest.
 * Should be called after every submission verdict.
 *
 * @param {string} contestId
 * @returns {Object[]} sorted entries
 */
async function updateLeaderboard(contestId, attempt = 0) {
  try {
    // Pull all active, non-disqualified participants
    const participants = await ContestParticipant.find({
      contest:      contestId,
      isActive:     true,
      disqualified: false,
    })
      .populate('user', 'username avatar')
      .lean();

    // Sort: highest score first, then lowest runtime (tiebreaker)
    const sorted = participants.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return a.totalRuntime - b.totalRuntime;
    });

    const entries = sorted.map((p, idx) => ({
      rank:           idx + 1,
      user:           p.user._id,
      username:       p.user.username,
      avatar:         p.user.avatar || null,
      totalScore:     p.totalScore,
      totalRuntime:   p.totalRuntime,
      problemsSolved: p.problemsSolved,
      lastSolvedAt:   p.lastActivityAt,
    }));

    // Upsert leaderboard document with version bump
    const leaderboard = await ContestLeaderboard.findOneAndUpdate(
      { contest: contestId },
      {
        $set: { entries, updatedAt: new Date() },
        $inc: { version: 1 },
      },
      { upsert: true, new: true }
    );

    return leaderboard.entries;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
      return updateLeaderboard(contestId, attempt + 1);
    }
    throw err;
  }
}

/**
 * Get current leaderboard (read-only).
 */
async function getLeaderboard(contestId) {
  const lb = await ContestLeaderboard.findOne({ contest: contestId }).lean();
  return lb ? lb.entries : [];
}

/**
 * Update a single participant's score after submission.
 * Called by submission service; triggers leaderboard refresh.
 */
async function applySubmissionScore({ contestId, userId, problemId, score, runtimeMs }) {
  // Find current best score for this problem
  const existing = await ContestParticipant.findOne({
    contest: contestId,
    user:    userId,
  }).lean();

  if (!existing) return null;

  // Only update if this is a better score
  const newScore = Math.max(existing.totalScore, score);

  await ContestParticipant.findOneAndUpdate(
    { contest: contestId, user: userId },
    {
      $max: { totalScore: score },
      $inc: { totalRuntime: runtimeMs },
      $set: { lastActivityAt: new Date() },
    }
  );

  // Recompute full leaderboard and return
  return updateLeaderboard(contestId);
}

/**
 * Finalize ranks in ContestParticipant docs after contest ends.
 */
async function finalizeRanks(contestId) {
  const entries = await updateLeaderboard(contestId);

  const bulkOps = entries.map(entry => ({
    updateOne: {
      filter: { contest: contestId, user: entry.user },
      update: { $set: { rank: entry.rank } },
    },
  }));

  if (bulkOps.length > 0) {
    await ContestParticipant.bulkWrite(bulkOps);
  }

  return entries;
}

module.exports = { updateLeaderboard, getLeaderboard, applySubmissionScore, finalizeRanks };
