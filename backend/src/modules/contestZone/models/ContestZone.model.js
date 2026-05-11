'use strict';

const mongoose = require('mongoose');

/**
 * ContestZone Model
 *
 * Supports two types:
 *   public  — visible to all, only Advanced users can create, affects rating
 *   private — invite-link, beginner-friendly, no rating updates
 *
 * Contest lifecycle states:
 *   WAITING → FILLING → STARTING → ACTIVE → EVALUATING → COMPLETED
 *                                          ↗
 *   WAITING → EXPIRED → REFUNDED
 */

const contestZoneSchema = new mongoose.Schema(
  {
    // ── Identity ───────────────────────────────────────────
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: ['public', 'private'],
      required: true,
      index: true,
    },

    // ── Creator ────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ── Problem config ─────────────────────────────────────
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'mixed'],
      default: 'medium',
    },
    problemCount: {
      type: Number,
      default: 1,
      min: 1,
      max: 5,
    },
    // References to generated ContestProblem docs
    problems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ContestProblem',
      },
    ],

    // ── Participant limits ─────────────────────────────────
    minParticipants: { type: Number, default: 2,  min: 2,  max: 20 },
    maxParticipants: { type: Number, default: 10, min: 2,  max: 20 },

    // ── Entry fee & coins ──────────────────────────────────
    entryFee: {
      type: Number,
      required: true,
      min: 0,
      max: 10000,
    },
    prizePool: {
      type: Number,
      default: 0,
    },
    platformFeePercent: {
      type: Number,
      default: 10, // 10%
    },

    // ── State ──────────────────────────────────────────────
    status: {
      type: String,
      enum: ['waiting', 'filling', 'starting', 'active', 'evaluating', 'completed', 'expired', 'refunded', 'cancelled'],
      default: 'waiting',
      index: true,
    },

    // ── Timing ────────────────────────────────────────────
    /**
     * durationMinutes: how long the contest runs once ACTIVE (coding window)
     * expiryMinutes:   how long to wait in WAITING/FILLING before auto-expiry
     */
    durationMinutes: { type: Number, default: 30, min: 5, max: 180 },

    scheduledStartAt: { type: Date },  // set when STARTING countdown begins
    startedAt:        { type: Date },  // set when ACTIVE
    endedAt:          { type: Date },  // set when COMPLETED or EXPIRED

    // ── Invite (private contests) ──────────────────────────
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
    },

    // ── Anti-cheat ────────────────────────────────────────
    flagged: { type: Boolean, default: false },
    flagReason: { type: String, default: null },
    invalidated: { type: Boolean, default: false },

    // ── Reward tracking ────────────────────────────────────
    rewardsDistributed: { type: Boolean, default: false },
    coinsRefunded:      { type: Boolean, default: false },

    // ── Participant count (denormalized for quick reads) ───
    currentParticipants: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────
contestZoneSchema.index({ status: 1, type: 1 });
contestZoneSchema.index({ createdBy: 1, status: 1 });
contestZoneSchema.index({ status: 1, createdAt: -1 });
contestZoneSchema.index({ inviteCode: 1 }, { sparse: true });

// ── Virtual: isFull ───────────────────────────────────────
contestZoneSchema.virtual('isFull').get(function () {
  return this.currentParticipants >= this.maxParticipants;
});

// ── Virtual: isExpired ────────────────────────────────────
contestZoneSchema.virtual('isExpired').get(function () {
  return ['expired', 'refunded', 'cancelled'].includes(this.status);
});

module.exports = mongoose.model('ContestZone', contestZoneSchema);
