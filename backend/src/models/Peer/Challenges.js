const mongoose = require('mongoose');

// ─────────────────────────────────────────────
// CHALLENGE SCHEMA (Scheduled Invitations)
// ─────────────────────────────────────────────
const ChallengeSchema = new mongoose.Schema({
  challenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  opponent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  problemTitle: {
    type: String,
    default: 'Hidden',
  },

  numberOfProblems: {
    type: Number,
    default: 1,
    min: 1,
    max: 5,
  },

  // Scheduling
  scheduledAt: {
    type: Date,
    required: true,
    index: true,
  },

  durationMinutes: {
    type: Number,
    required: true,
    min: 5,
    max: 180, // limit (optional)
  },

  // Derived (optional optimization)
  endsAt: {
    type: Date,
    required: true,
    index: true,
  },

  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired', 'cancelled'],
    default: 'pending',
    index: true,
  },

  respondedAt: {
    type: Date,
    default: null,
  },

  // Expiry for invitation response
  expiresAt: {
    type: Date,
    required: true,
  },

  isSeen: {
    type: Boolean,
    default: false,
  },

}, {
  timestamps: true,
});

// ─────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────

// incoming/outgoing
ChallengeSchema.index({ opponent: 1, status: 1 });
ChallengeSchema.index({ challenger: 1, status: 1 });

// prevent duplicate pending
ChallengeSchema.index(
  { challenger: 1, opponent: 1, scheduledAt: 1, status: 1 },
  { partialFilterExpression: { status: 'pending' } }
);

// TTL
ChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─────────────────────────────────────────────
// VALIDATIONS
// ─────────────────────────────────────────────
ChallengeSchema.pre('validate', function (next) {
  if (this.challenger.equals(this.opponent)) {
    return next(new Error('Cannot challenge yourself'));
  }

  // auto-calculate endsAt
  if (this.scheduledAt && this.durationMinutes) {
    this.endsAt = new Date(
      this.scheduledAt.getTime() + this.durationMinutes * 60000
    );
  }

  next();
});

module.exports = mongoose.model('Challenge', ChallengeSchema);