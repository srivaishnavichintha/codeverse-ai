const mongoose = require('mongoose');

const interviewQuestionSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    questionNumber: { type: Number, required: true },
    questionText: { type: String, required: true },
    category: {
      type: String,
      enum: ['complexity', 'optimization', 'approach', 'edge_case', 'concept', 'behavioral'],
      default: 'concept',
    },
    relatedProblem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      default: null,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    userAnswer: { type: String, default: null },
    answeredAt: { type: Date, default: null },
    evaluation: {
      score: { type: Number, min: 0, max: 10, default: null },
      feedback: { type: String, default: null },
      correct: { type: Boolean, default: null },
      evaluatedAt: { type: Date, default: null },
    },
    isAdaptive: { type: Boolean, default: false },
    basedOnQuestion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewQuestion',
      default: null,
    },
  },
  { timestamps: true }
);

interviewQuestionSchema.index({ session: 1, questionNumber: 1 });
interviewQuestionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('InterviewQuestion', interviewQuestionSchema);
