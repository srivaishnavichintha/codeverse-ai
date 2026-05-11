const mongoose = require('mongoose');

// ─────────────────────────────────────────────
// BATTLE SCHEMA (Production Ready)
// ─────────────────────────────────────────────

const BattleSchema = new mongoose.Schema(
  {
    // ─────────────────────────────────────────
    // Origin
    // ─────────────────────────────────────────
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Challenge',
      default: null,
      index: true,
    },

    // ─────────────────────────────────────────
    // Players (ALWAYS SORTED)
    // ─────────────────────────────────────────
    player1Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    player2Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ─────────────────────────────────────────
    // Problem (assigned at battle start)
    // ─────────────────────────────────────────
    problemIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      index: true,
    }],

    // ─────────────────────────────────────────
    // Scheduling (copied from Challenge → IMMUTABLE)
    // ─────────────────────────────────────────
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },

    durationMinutes: {
      type: Number,
      required: true,
      min: 5,
      max: 180,
    },


     player1RatingAtStart: { type: Number, default: 1200 },
    player2RatingAtStart: { type: Number, default: 1200 },

    endsAt: {
      type: Date,
      required: true,
      index: true,
    },
  
    // ─────────────────────────────────────────
    // Lifecycle timestamps
    // ─────────────────────────────────────────
    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    // ─────────────────────────────────────────
    // Status machine
    // ─────────────────────────────────────────
    status: {
      type: String,
      enum: [
        'pending',     // waiting for scheduled time
        'ongoing',     // active
        'evaluating',  // AI processing
        'completed',   // finished
        'cancelled',
        'expired',
        'error',
      ],
      default: 'pending',
      index: true,
    },

    // ─────────────────────────────────────────
    // Outcome
    // ─────────────────────────────────────────
    winnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    isTie: {
      type: Boolean,
      default: false,
    },

    resultReason: {
      type: String,
      enum: [
        'first_ac',
        'faster_time',
        'more_testcases',
        'ai_decision',
        'timeout',
        'tie',
      ],
      default: null,
    },

    hybridOverrideApplied: {
      type: Boolean,
      default: false,
    },

    // ─────────────────────────────────────────
    // Performance Snapshot (denormalized)
    // ─────────────────────────────────────────
    playerStats: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        submissionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Submission',
        },
        solvedAt: Date,
        attempts: { type: Number, default: 0 },
        score: { type: Number, default: 0 },
      },
    ],

    // ─────────────────────────────────────────
    // Visibility
    // ─────────────────────────────────────────
    player1SeenResult: {
      type: Boolean,
      default: false,
    },
    player2SeenResult: {
      type: Boolean,
      default: false,
    },

    // ─────────────────────────────────────────
    // Expiry (ONLY for active battles)
    // ─────────────────────────────────────────
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────

// Active battles per player
BattleSchema.index({ player1Id: 1, status: 1 });
BattleSchema.index({ player2Id: 1, status: 1 });

// Player pair history
BattleSchema.index({ player1Id: 1, player2Id: 1 });

// Scheduling queries
BattleSchema.index({ scheduledAt: 1, status: 1 });
BattleSchema.index({ endsAt: 1, status: 1 });

// Prevent duplicate active battles
BattleSchema.index(
  { player1Id: 1, player2Id: 1, problemIds: 1, status: 1 },
  {
    partialFilterExpression: {
      status: { $in: ['pending', 'ongoing'] },
    },
  }
);

// ✅ SAFE TTL (only deletes active battles)
BattleSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: {
      status: { $in: ['pending', 'ongoing'] },
    },
  }
);

// ─────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────

// Normalize players + derive fields
BattleSchema.pre('validate', function (next) {
  // Ensure players are different
  if (this.player1Id.equals(this.player2Id)) {
    return next(new Error('Players must be different'));
  }

  // Normalize ordering (important!)
  if (this.player1Id.toString() > this.player2Id.toString()) {
    const temp = this.player1Id;
    this.player1Id = this.player2Id;
    this.player2Id = temp;
  }

  // Compute endsAt
  if (this.scheduledAt && this.durationMinutes) {
    this.endsAt = new Date(
      this.scheduledAt.getTime() + this.durationMinutes * 60000
    );
  }

  // Set startedAt = scheduledAt (important fix)
  if (!this.startedAt && this.scheduledAt) {
    this.startedAt = this.scheduledAt;
  }

  // Expiry (24h after end)
  if (!this.expiresAt && this.endsAt) {
    const GRACE = 24 * 60 * 60 * 1000;
    this.expiresAt = new Date(this.endsAt.getTime() + GRACE);
  }

  next();
});

// ─────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────

BattleSchema.methods.hasPlayer = function (userId) {
  return (
    this.player1Id.equals(userId) ||
    this.player2Id.equals(userId)
  );
};

BattleSchema.methods.isExpired = function () {
  return this.endsAt && new Date() > this.endsAt;
};

BattleSchema.methods.remainingSeconds = function () {
  const diff = this.endsAt - Date.now();
  return diff > 0 ? Math.floor(diff / 1000) : 0;
};

BattleSchema.methods.markResultSeen = function (userId) {
  if (this.player1Id.equals(userId)) this.player1SeenResult = true;
  if (this.player2Id.equals(userId)) this.player2SeenResult = true;
  return this.save();
};

// ─────────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────────

BattleSchema.statics.findForPlayer = function (userId) {
  return this.find({
    $or: [{ player1Id: userId }, { player2Id: userId }],
  }).sort({ createdAt: -1 });
};

BattleSchema.statics.findActiveBattles = function (userId) {
  return this.find({
    $or: [{ player1Id: userId }, { player2Id: userId }],
    status: { $in: ['pending', 'ongoing', 'evaluating'] },
  });
};

BattleSchema.statics.findExpiredUnclosed = function () {
  return this.find({
    endsAt: { $lte: new Date() },
    status: { $in: ['pending', 'ongoing'] },
  });
};

module.exports = mongoose.model('Battle', BattleSchema);