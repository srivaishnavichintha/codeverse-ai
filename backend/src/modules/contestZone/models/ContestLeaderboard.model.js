'use strict';

const mongoose = require('mongoose');

/**
 * ContestLeaderboard
 *
 * Denormalized leaderboard snapshot — one document per contest.
 * Updated after every accepted submission. Optimized for fast reads
 * during live contests (Socket.IO broadcasts use this document).
 *
 * The `entries` array is kept sorted by (totalScore DESC, totalRuntime ASC).
 */
const leaderboardEntrySchema = new mongoose.Schema(
  {
    rank:           { type: Number, required: true },
    user:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username:       { type: String, required: true },
    avatar:         { type: String, default: null },
    totalScore:     { type: Number, default: 0 },
    totalRuntime:   { type: Number, default: 0 },
    problemsSolved: { type: Number, default: 0 },
    lastSolvedAt:   { type: Date, default: null },
  },
  { _id: false }
);

const contestLeaderboardSchema = new mongoose.Schema(
  {
    contest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContestZone',
      required: true,
      unique: true,
      index: true,
    },
    entries:    [leaderboardEntrySchema],
    updatedAt:  { type: Date, default: Date.now },
    version:    { type: Number, default: 0 },   // incremented each update — for optimistic concurrency
  },
  { timestamps: false }
);

module.exports = mongoose.model('ContestLeaderboard', contestLeaderboardSchema);
