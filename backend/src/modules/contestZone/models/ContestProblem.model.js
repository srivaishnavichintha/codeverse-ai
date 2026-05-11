'use strict';

const mongoose = require('mongoose');

/**
 * ContestProblem
 *
 * Stores AI-generated problems specifically for Contest Zone.
 * Kept separate from the main Problem collection to avoid polluting
 * the public problem bank and to allow contest-specific metadata.
 */
const testCaseSchema = new mongoose.Schema(
  {
    input:          { type: String, required: true },
    expectedOutput: { type: String, required: true },
    isPublic:       { type: Boolean, default: false },
    explanation:    { type: String, default: '' },
  },
  { _id: true }
);

const contestProblemSchema = new mongoose.Schema(
  {
    contest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContestZone',
      required: true,
      index: true,
    },

    // ── Problem content ───────────────────────────────────
    title:        { type: String, required: true },
    description:  { type: String, required: true },
    difficulty:   { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    constraints:  { type: String, default: '' },
    examples:     { type: String, default: '' },
    timeLimit:    { type: Number, default: 2000 },   // ms
    memoryLimit:  { type: Number, default: 256 },    // MB
    expectedComplexity: { type: String, default: '' },

    // ── Starter code ──────────────────────────────────────
    starterCode: {
      javascript: { type: String, default: '' },
      python:     { type: String, default: '' },
      java:       { type: String, default: '' },
      cpp:        { type: String, default: '' },
    },

    // ── Test cases ────────────────────────────────────────
    testCases: [testCaseSchema],

    // ── AI generation metadata ────────────────────────────
    generatedByAI:  { type: Boolean, default: true },
    aiModel:        { type: String, default: '' },
    generationHash: { type: String, default: '' },   // for duplicate detection

    // ── Points ────────────────────────────────────────────
    maxPoints: { type: Number, default: 100 },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────
contestProblemSchema.index({ contest: 1 });
contestProblemSchema.index({ difficulty: 1, generationHash: 1 });

module.exports = mongoose.model('ContestProblem', contestProblemSchema);
