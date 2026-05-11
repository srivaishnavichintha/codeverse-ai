const mongoose = require('mongoose');

/**
 * TestCase Collection
 * ──────────────────
 * DESIGN DECISION: Stored in a SEPARATE collection (not embedded in Problem)
 * Reasons:
 *   1. Hidden test cases must NEVER be returned in problem read APIs — separate
 *      collection makes it impossible to accidentally leak them via populate().
 *   2. Problems can have hundreds of test cases; embedding bloats problem docs.
 *   3. Test cases can be updated independently without touching problem versioning.
 *
 * Access control: Only the judge service (internal) ever reads hidden test cases.
 * The API layer must NEVER expose isHidden=true cases to clients.
 */
const TestCaseSchema = new mongoose.Schema({
  problem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
    required: true,
  },
  input: {
  type: String,
  default: '',
},

output: {
  type: String,
  default: '',
},
  isHidden: { type: Boolean, default: true },   // true = judge-only, false = visible sample
  isSample: { type: Boolean, default: false },  // shown as example in problem UI
  order:    { type: Number, default: 0 },       // display/run order
  note:     { type: String },                   // internal note for problem setters
  weight:   { type: Number, default: 1 },       // partial scoring (future feature)
}, {
  timestamps: true,
});

// ─────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────
TestCaseSchema.index({ problem: 1, isHidden: 1 }); // fetch visible/hidden per problem
TestCaseSchema.index({ problem: 1, order: 1 });    // ordered test run

module.exports = mongoose.model('TestCase', TestCaseSchema);
