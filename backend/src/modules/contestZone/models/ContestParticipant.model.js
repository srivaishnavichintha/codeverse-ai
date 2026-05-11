'use strict';

const mongoose = require('mongoose');

/**
 * ContestParticipant
 *
 * One document per (contest × user) pair.
 * Tracks coin locking, score, rank, and reward state.
 */
const contestParticipantSchema = new mongoose.Schema(
  {
    contest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContestZone',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ── Coin state ────────────────────────────────────────
    entryFee:     { type: Number, required: true },
    coinsLocked:  { type: Boolean, default: true  },  // true until contest ends/expires
    coinsRefunded:{ type: Boolean, default: false },

    // ── Scoring ───────────────────────────────────────────
    totalScore:   { type: Number, default: 0 },
    totalRuntime: { type: Number, default: 0 },  // ms — tiebreaker
    problemsSolved: { type: Number, default: 0 },
    rank:         { type: Number, default: null },

    // ── Reward ────────────────────────────────────────────
    rewardAmount: { type: Number, default: 0 },
    rewardPaid:   { type: Boolean, default: false },

    // ── Anti-cheat ────────────────────────────────────────
    disqualified: { type: Boolean, default: false },
    disqualifyReason: { type: String, default: null },

    // ── Misc ──────────────────────────────────────────────
    joinedAt:      { type: Date, default: Date.now },
    lastActivityAt:{ type: Date, default: Date.now },
    isActive:      { type: Boolean, default: true },  // false if left contest
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────
contestParticipantSchema.index({ contest: 1, user: 1 }, { unique: true });
contestParticipantSchema.index({ contest: 1, rank: 1 });
contestParticipantSchema.index({ contest: 1, totalScore: -1, totalRuntime: 1 });

module.exports = mongoose.model('ContestParticipant', contestParticipantSchema);
