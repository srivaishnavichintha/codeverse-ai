const User = require('../models/User');
const Problem = require('../models/Problem');
const UserProblemStats = require('../models/UserProblemStats');

/**
 * StatsService
 * ─────────────
 * Called after every submission receives a verdict.
 * Updates three places atomically (best-effort):
 *   1. UserProblemStats  — per-user-per-problem record
 *   2. User.stats        — aggregated user-level counters
 *   3. Problem.analytics — aggregated problem-level counters
 *
 * WHY STORED AGGREGATES (not dynamic compute):
 *   Dynamic: SELECT COUNT(*) WHERE userId=X AND verdict=AC → full collection scan
 *            even with indexes, at 100M submissions this is 100-500ms.
 *   Stored:  User.stats.totalSolved → single document field read → < 1ms.
 *   Tradeoff: slight eventual consistency (if job crashes mid-update).
 *   Solution: idempotent upserts + periodic reconciliation cron job.
 */
const StatsService = {

  /**
   * Main entry point — call this after every verdict is written.
   * @param {Object} submission - populated Submission document
   */
  async onSubmissionVerdict(submission) {
    const { user: userId, problem: problemId, verdict, runtimeMs, memoryKb, language } = submission;
    const isAccepted = verdict === 'Accepted';

    // ── 1. Upsert UserProblemStats ──
    const ups = await UserProblemStats.findOneAndUpdate(
      { user: userId, problem: problemId },
      {
        $inc: {
          totalAttempts: 1,
          ...(isAccepted && { acceptedAttempts: 1 }),
        },
        $addToSet: { languagesUsed: language },
        $set: {
          lastSubmittedAt: new Date(),
          lastVerdict: verdict,
        },
      },
      { upsert: true, new: true }
    );

    const isFirstAttempt = ups.totalAttempts === 1;
    const isFirstAccept  = isAccepted && !ups.isSolved;

    if (isFirstAccept) {
      await UserProblemStats.findOneAndUpdate(
        { user: userId, problem: problemId },
        { $set: { isSolved: true, solvedAt: new Date() } }
      );
      // Update best runtime/memory
      if (runtimeMs !== null) {
        await UserProblemStats.findOneAndUpdate(
          { user: userId, problem: problemId,
            $or: [{ bestRuntimeMs: null }, { bestRuntimeMs: { $gt: runtimeMs } }] },
          { $set: { bestRuntimeMs: runtimeMs } }
        );
      }
    }

    // ── 2. Update User.stats ──
    const problem = await Problem.findById(problemId).select('difficulty');
    const diffField = problem ? `stats.${problem.difficulty.toLowerCase()}Solved` : null;

    const userUpdate = {
      $inc: {
        'stats.totalSubmissions': 1,
        ...(isAccepted && { 'stats.acceptedSubmissions': 1 }),
        ...(isFirstAccept && { 'stats.totalSolved': 1 }),
        ...(isFirstAccept && diffField && { [diffField]: 1 }),
      },
      $set: { 'stats.lastActiveDate': new Date().toISOString().split('T')[0] },
    };

    if (isFirstAccept) {
      userUpdate.$addToSet = { solvedProblems: problemId };
    }

    await User.findByIdAndUpdate(userId, userUpdate);
    await this._updateActivityHeatmap(userId);

    // ── 3. Update Problem.analytics ──
    const problemUpdate = {
      $inc: {
        'analytics.totalSubmissions': 1,
        ...(isAccepted && { 'analytics.acceptedSubmissions': 1 }),
        ...(isFirstAttempt && { 'analytics.totalAttempted': 1 }),
        ...(isFirstAccept && { 'analytics.totalSolved': 1 }),
      },
    };

    await Problem.findByIdAndUpdate(problemId, problemUpdate);
  },

  /**
   * Update the daily activity heatmap for a user.
   * Upserts today's entry, creates if missing.
   */
  async _updateActivityHeatmap(userId) {
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

    // Try to increment existing entry
    const result = await User.findOneAndUpdate(
      { _id: userId, 'activity.date': today },
      { $inc: { 'activity.$.count': 1 } }
    );

    // If today doesn't exist yet, push a new entry
    if (!result) {
      await User.findByIdAndUpdate(userId, {
        $push: { activity: { date: today, count: 1 } },
      });
    }
  },

  /**
   * Recompute and fix stats for a user from scratch.
   * Used by reconciliation cron job or admin repair tools.
   */
  async reconcileUserStats(userId) {
    const Submission = require('../models/Submission');

    const [totalSubs, acceptedSubs, solvedProblems] = await Promise.all([
      Submission.countDocuments({ user: userId }),
      Submission.countDocuments({ user: userId, verdict: 'Accepted' }),
      UserProblemStats.distinct('problem', { user: userId, isSolved: true }),
    ]);

    await User.findByIdAndUpdate(userId, {
      $set: {
        'stats.totalSubmissions': totalSubs,
        'stats.acceptedSubmissions': acceptedSubs,
        'stats.totalSolved': solvedProblems.length,
        solvedProblems,
      },
    });

    return { totalSubs, acceptedSubs, solvedCount: solvedProblems.length };
  },
};

module.exports = StatsService;
