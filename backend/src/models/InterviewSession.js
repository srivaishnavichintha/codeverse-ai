const mongoose = require('mongoose');

const interviewSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'coding', 'ai_phase', 'completed', 'failed', 'expired'],
      default: 'pending',
    },
    phase: {
      type: String,
      enum: ['coding', 'ai', 'done'],
      default: 'coding',
    },
    assignedProblems: [
      {
        problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem' },
        submission: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', default: null },
        solved: { type: Boolean, default: false },
      },
    ],
    solvedCount: { type: Number, default: 0 },
    qualifiedForAI: { type: Boolean, default: false },
    creditTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CreditTransaction',
      default: null,
    },
    aiJobId: { type: String, default: null },
    aiAnalysisStatus: {
      type: String,
      enum: ['not_started', 'queued', 'processing', 'done', 'error'],
      default: 'not_started',
    },
    finalReport: {
      overallScore: { type: Number, default: null },
      technicalScore: { type: Number, default: null },
      communicationScore: { type: Number, default: null },
      problemSolvingScore: { type: Number, default: null },
      summary: { type: String, default: null },
      strengths: [String],
      weaknesses: [String],
      recommendation: { type: String, default: null },
      eligibleCompanies: [String],
      suggestedTopics: [String],
      behavioralImprovements: [String],
      generatedAt: { type: Date, default: null },
    },
    violationCount:  { type: Number, default: 0 },
violationLog: [
  {
    type:      { type: String, enum: ['tab_switch', 'fullscreen_exit', 'devtools', 'copy_paste'] },
    timestamp: { type: Date },
  }
],
terminationReason: { type: String, enum: ['violations', 'timeout', 'user_exit', null], default: null },
    startedAt: { type: Date, default: null },
    codingDeadline: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    idempotencyKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

interviewSessionSchema.index({ user: 1, status: 1 });
interviewSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 * 7 });

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);
