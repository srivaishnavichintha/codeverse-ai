const mongoose = require('mongoose');

const problemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
    },
    editorial: {
      type: String,
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      required: true,
    },
    hints:       [{ type: String }],
    tags:        [{ type: String }],
    companies:   [{ type: String }],   // used by AI Interview for targeted questions
    constraints: [{ type: String }],
    examples: [
      {
        input:       String,
        output:      String,
        explanation: String,
      },
    ],

    // ── NEW: starter code per language ───────────────────
    // Sent to the frontend editor when the user selects a language.
    starterCode: {
      javascript: { type: String, default: '// Write your solution here\n' },
      python:     { type: String, default: '# Write your solution here\n' },
      java:       { type: String, default: '// Write your solution here\n' },
      cpp:        { type: String, default: '// Write your solution here\n' },
      typescript: { type: String, default: '// Write your solution here\n' },
      go:         { type: String, default: '// Write your solution here\n' },
    },

    // ── NEW: submission analytics ─────────────────────────
    // Stored aggregates — updated via $inc, never COUNT(*).
    // acceptanceRate is a virtual computed from these two fields.
    totalSubmissions: { type: Number, default: 0 },
    totalAccepted:    { type: Number, default: 0 },

    // ── Existing extension points ─────────────────────────
    isPremium: { type: Boolean, default: false },   // subscription gating
    isActive:  { type: Boolean, default: true },

    // Controls sort order on the problems list
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────
problemSchema.index({ slug: 1 });
problemSchema.index({ difficulty: 1 });
problemSchema.index({ isActive: 1, order: 1 });
problemSchema.index({ title: 'text', tags: 'text' });  // full-text search

// ── Virtual: acceptanceRate ───────────────────────────────
// Computed from stored counters — never stored, per architecture decision
problemSchema.virtual('acceptanceRate').get(function () {
  if (!this.analytics) return 0;

  const { totalSubmissions = 0, acceptedSubmissions = 0 } = this.analytics;

  if (!totalSubmissions) return 0;

  return parseFloat(((acceptedSubmissions / totalSubmissions) * 100).toFixed(2));
});
module.exports = mongoose.model('Problem', problemSchema);
