'use strict';

const mongoose = require('mongoose');

/**
 * ContestRewardLog
 *
 * Immutable audit trail for every coin transaction related to contests.
 * Used for reconciliation, disputes, and admin dashboards.
 */
const contestRewardLogSchema = new mongoose.Schema(
  {
    contest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContestZone',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ['entry_lock', 'reward_win', 'refund_expiry', 'refund_partial', 'platform_fee', 'refund_cheat'],
      required: true,
    },

    amount:      { type: Number, required: true },  // positive = credit, negative = debit
    rank:        { type: Number, default: null },    // rank at time of distribution
    description: { type: String, default: '' },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

contestRewardLogSchema.index({ contest: 1, type: 1 });
contestRewardLogSchema.index({ user: 1, processedAt: -1 });

module.exports = mongoose.model('ContestRewardLog', contestRewardLogSchema);
