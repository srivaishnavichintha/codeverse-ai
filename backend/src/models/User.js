const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    displayName: { type: String, default: '' },
    lastSeenAt:  { type: Date,   default: null },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      // Added 'company_recruiter' as extension point from your architecture doc
      enum: ['user', 'admin', 'moderator', 'company_recruiter'],
      default: 'user',
    },

    // ── NEW: submission stats ────────────────────────────
    // These are stored aggregates — updated atomically via $inc
    // after every accepted submission. Never computed dynamically.
    stats: {
      totalSolved:      { type: Number, default: 0 },
      easySolved:       { type: Number, default: 0 },
      mediumSolved:     { type: Number, default: 0 },
      hardSolved:       { type: Number, default: 0 },
      totalSubmissions: { type: Number, default: 0 },
    },
    
    // ── NEW: Peer Challenge Stats ────────────────────────
    level:                { type: Number, default: 1 },
    streak:               { type: Number, default: 0 },
    contestWins:          { type: Number, default: 0 },
    contestsParticipated: { type: Number, default: 0 },
    wins:                 { type: Number, default: 0 },
    losses:               { type: Number, default: 0 },
    // ── END NEW ──────────────────────────────────────────

    // ── Existing fields from your architecture ────────────
    rating:   { type: Number, default: 1200 },
    ratingHistory: [
      {
        label: { type: String }, // e.g. "B127"
        score: { type: Number },
        win:   { type: Boolean },
      }
    ],
    country:  { type: String, default: '' },
    avatar:   { type: String, default: null },
    bio:      { type: String, default: '' },

    // Required by the AI Interview credit system
    credits:  { type: Number, default: 40 },

    // Activity heatmap — sparse array, pruned >1yr by cron
    activity: [
      {
        date:  { type: String },   // 'YYYY-MM-DD'
        count: { type: Number, default: 0 },
      },
    ],

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ── Indexes from your architecture ───────────────────────
userSchema.index({ rating: -1 });
userSchema.index({ country: 1 });

// ── Password hashing ──────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Virtual: accuracy ─────────────────────────────────────
// Computed from stored counts — never stored, per architecture decision
userSchema.virtual('accuracy').get(function () {
  if (!this.stats) return 0;

  const {
    totalSubmissions = 0,
    totalSolved: acceptedSubmissions = 0
  } = this.stats;

  if (!totalSubmissions) return 0;

  return parseFloat(
    ((acceptedSubmissions / totalSubmissions) * 100).toFixed(2)
  );
});

module.exports = mongoose.model('User', userSchema);
