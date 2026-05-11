'use strict';

const mongoose = require('mongoose');

/**
 * ContestSubmission
 *
 * Tracks each code submission within a contest.
 * Separate from the main Submission model to keep contest metrics isolated.
 */
const contestSubmissionSchema = new mongoose.Schema(
  {
    contest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContestZone',
      required: true,
      index: true,
    },
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContestProblem',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ── Code ──────────────────────────────────────────────
    code:     { type: String, required: true },
    language: {
      type: String,
      enum: ['javascript', 'python', 'java', 'cpp'],
      required: true,
    },

    // ── Judge result ──────────────────────────────────────
    verdict: {
      type: String,
      enum: ['Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Runtime Error', 'Compilation Error', 'Internal Error', 'Pending'],
      default: 'Pending',
    },
    score:      { type: Number, default: 0 },    // 0–100
    runtimeMs:  { type: Number, default: 0 },
    memoryKb:   { type: Number, default: 0 },
    testResults: [
      {
        testCaseId: mongoose.Schema.Types.ObjectId,
        passed:     Boolean,
        runtimeMs:  Number,
        memoryKb:   Number,
        stderr:     String,
      },
    ],

    // ── Anti-cheat ────────────────────────────────────────
    plagiarismScore:   { type: Number, default: 0 },  // 0–1
    flaggedForReview:  { type: Boolean, default: false },

    // ── Attempt tracking ──────────────────────────────────
    attemptNumber: { type: Number, default: 1 },
    judgedAt:      { type: Date },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────
contestSubmissionSchema.index({ contest: 1, user: 1, problem: 1 });
contestSubmissionSchema.index({ contest: 1, verdict: 1 });
contestSubmissionSchema.index({ contest: 1, score: -1, runtimeMs: 1 });

module.exports = mongoose.model('ContestSubmission', contestSubmissionSchema);
