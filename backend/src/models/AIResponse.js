const mongoose = require('mongoose');

const aiResponseSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
    },
    type: {
      type: String,
      enum: ['question_generation', 'answer_evaluation', 'final_report', 'code_analysis'],
      required: true,
    },
    prompt: { type: String, required: true },
    rawResponse: { type: String, default: null },
    parsedResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    model: { type: String, default: 'llama-3.3-70b-versatile' },
    tokensUsed: {
      input: { type: Number, default: 0 },
      output: { type: Number, default: 0 },
    },
    latencyMs: { type: Number, default: null },
    success: { type: Boolean, default: true },
    errorMessage: { type: String, default: null },
    validationPassed: { type: Boolean, default: null },
  },
  { timestamps: true }
);

aiResponseSchema.index({ session: 1, type: 1 });

module.exports = mongoose.model('AIResponse', aiResponseSchema);
