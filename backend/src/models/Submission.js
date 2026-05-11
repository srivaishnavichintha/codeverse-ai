const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

/**
 * Submission — Append-only judge log.
 *
 * SOURCE TRACKING (the two new fields)
 * ─────────────────────────────────────
 * sourceType tells you WHERE the submission came from:
 *   'practice'  → standard problem page (default, existing behaviour)
 *   'potd'      → Problem of the Day challenge
 *   'interview' → AI interview session coding round
 *   'contest'   → contest round (future)
 *
 * sourceId is the parent session/contest ObjectId:
 *   'interview' → InterviewSession._id
 *   'contest'   → Contest._id
 *   'potd'      → null  (the date is on Problem.potd.date — no extra id needed)
 *   'practice'  → null
 *
 * This lets feature teams query their own submissions without touching
 * unrelated data:
 *   Submission.find({ sourceType: 'interview', sourceId: sessionId })
 *   Submission.find({ sourceType: 'potd', createdAt: { $gte: todayStart } })
 */
const SubmissionSchema = new mongoose.Schema({
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

  // ── Source tracking ───────────────────────────────────────────────────────
  sourceType: {
    type:    String,
    enum:    ['practice', 'potd', 'interview', 'contest' ,'challenge'],
    default: 'practice',
  },
  sourceId: {
    type:    mongoose.Schema.Types.ObjectId,
    default: null,
  },

  // ── Code ─────────────────────────────────────────────────────────────────
  code:     { type: String, required: true },
  language: { type: String, required: true },

  // ── Judge result ─────────────────────────────────────────────────────────
  verdict: {
    type: String,
    enum: [
      'Accepted', 'Wrong Answer', 'Time Limit Exceeded',
      'Memory Limit Exceeded', 'Runtime Error', 'Compilation Error',
      'Pending', 'Running',
    ],
    default: 'Pending',
  },
  runtimeMs: { type: Number, default: null },
  memoryKb:  { type: Number, default: null },

  testResults: [{
    testCaseId:     { type: mongoose.Schema.Types.ObjectId },
    passed:         { type: Boolean },
    runtimeMs:      { type: Number },
    memoryKb:       { type: Number },
    actualOutput:   { type: String },
    expectedOutput: { type: String },
    error:          { type: String },
    isHidden:       { type: Boolean, default: false },
  }],

  judgeToken: { type: String, default: null },
}, {
  timestamps: true,
});

// ─────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────
SubmissionSchema.index({ user: 1, createdAt: -1 });           // user history
SubmissionSchema.index({ problem: 1, verdict: 1 });           // problem analytics
SubmissionSchema.index({ user: 1, problem: 1, verdict: 1 });  // UserProblemStats update
SubmissionSchema.index({ sourceType: 1, sourceId: 1 });       // session-scoped queries
SubmissionSchema.index({ createdAt: -1 });                    // archival

SubmissionSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Submission', SubmissionSchema);
