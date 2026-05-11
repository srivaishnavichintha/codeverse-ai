const mongoose = require('mongoose');

/**
 * InterviewQuestions — standalone AI-generated question bank.
 *
 * This collection stores questions that were generated for users during
 * interview sessions. Unlike InterviewQuestion (which is tied 1-to-1 to a
 * session), this collection acts as a reusable, queryable question bank.
 *
 * Fields:
 *  - userId        : who the question was generated for
 *  - sessionId     : the interview session it originated from (optional)
 *  - question      : the question text
 *  - topic         : general topic area (e.g. "arrays", "dynamic programming")
 *  - difficulty    : easy | medium | hard
 *  - category      : question type
 *  - aiGenerated   : always true for programmatically created questions
 *  - createdAt     : auto-managed by Mongoose
 */
const interviewQuestionsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      default: null,
      index: true,
    },
    question: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
      minlength: [10, 'Question must be at least 10 characters'],
    },
    topic: {
      type: String,
      required: [true, 'Topic is required'],
      trim: true,
      lowercase: true,
    },
    difficulty: {
      type: String,
      enum: {
        values: ['easy', 'medium', 'hard'],
        message: 'Difficulty must be easy, medium, or hard',
      },
      required: [true, 'Difficulty is required'],
      lowercase: true,
    },
    category: {
      type: String,
      enum: [
        'complexity',
        'optimization',
        'approach',
        'edge_case',
        'concept',
        'behavioral',
        'system_design',
        'data_structures',
        'algorithms',
      ],
      default: 'concept',
    },
    aiGenerated: {
      type: Boolean,
      default: true,
    },
    // Optional: link to the problem this question was generated FROM
    relatedProblemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      default: null,
    },
    // Whether the user has answered this question (for tracking)
    answered: {
      type: Boolean,
      default: false,
    },
    userAnswer: {
      type: String,
      default: null,
    },
    answeredAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index for user question history queries
interviewQuestionsSchema.index({ userId: 1, createdAt: -1 });
interviewQuestionsSchema.index({ userId: 1, difficulty: 1 });
interviewQuestionsSchema.index({ userId: 1, topic: 1 });

module.exports = mongoose.model('InterviewQuestions', interviewQuestionsSchema);
