const mongoose = require('mongoose');

/**
 * UserProblemStats — The "helper table" (bridge collection)
 * ──────────────────────────────────────────────────────────
 * One document per (user, problem) pair.
 *
 * WHY THIS EXISTS:
 *   Q: "Has user X solved problem Y?" — needs O(1) answer.
 *   Bad approach: scan Submission collection for (user, problem, verdict=AC) → O(n) even with indexes.
 *   Good approach: this collection. One lookup by compound index = O(log n).
 *
 *   Q: "What's user X's accuracy on problem Y?"
 *   This stores per-problem submission count + accepted count.
 *
 *   Q: "Show user's solve status on a list of 50 problems"
 *   Bulk fetch by userId + problemId in one query.
 *
 * HOW IT'S UPDATED:
 *   After every submission verdict (by a post-save hook or event):
 *     - Upsert this document (findOneAndUpdate with upsert:true)
 *     - Update User.stats (totalSolved, totalSubmissions, etc.)
 *     - Update Problem.analytics (totalSubmissions, acceptedSubmissions, etc.)
 *
 * SCALABILITY:
 *   ~500M users × 3000 problems = impractical to pre-create. Sparse — only created on first attempt.
 */
const UserProblemStatsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  problem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
    required: true,
  },

  isSolved:   { type: Boolean, default: false },   // has ever got AC
  solvedAt:   { type: Date, default: null },        // first AC time

  totalAttempts:    { type: Number, default: 0 },
  acceptedAttempts: { type: Number, default: 0 },

  bestRuntimeMs: { type: Number, default: null },   // fastest AC runtime
  bestMemoryKb:  { type: Number, default: null },

  lastSubmittedAt: { type: Date, default: null },
  lastVerdict:     { type: String, default: null },

  // Languages used on this problem
  languagesUsed: [{ type: String }],
}, {
  timestamps: true,
});

// ─────────────────────────────────────────────
// INDEXES — this collection is read very heavily
// ─────────────────────────────────────────────
UserProblemStatsSchema.index({ user: 1, problem: 1 }, { unique: true }); // primary lookup
UserProblemStatsSchema.index({ user: 1, isSolved: 1 });                  // "all solved problems by user"
UserProblemStatsSchema.index({ problem: 1, isSolved: 1 });               // "who solved this problem"

module.exports = mongoose.model('UserProblemStats', UserProblemStatsSchema);
