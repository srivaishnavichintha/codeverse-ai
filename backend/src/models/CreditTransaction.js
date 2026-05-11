const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['debit', 'credit', 'refund'],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: {
      type: String,
      enum: [
        'interview_start',
        'interview_refund',
        'admin_grant',
        'signup_bonus',
        'purchase',
        'other',
      ],
      required: true,
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      default: null,
    },
    idempotencyKey: { type: String, unique: true, sparse: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

creditTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('CreditTransaction', creditTransactionSchema);
