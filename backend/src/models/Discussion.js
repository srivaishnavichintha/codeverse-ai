const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

// ─────────────────────────────────────────────
// DISCUSSION (thread level)
// ─────────────────────────────────────────────
const DiscussionSchema = new mongoose.Schema({
  problem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
    required: false,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title:   { type: String, required: true, trim: true, maxlength: 200 },
  body:    { type: String, required: true },        // Markdown
  tags:    [{ type: String }],                      // "approach", "hint", "editorial"
  category:{ type: String, default: 'general', enum: ['general', 'problem', 'interview', 'doubt'] },

  // Aggregated counts (cached to avoid joins on every list view)
  commentCount: { type: Number, default: 0 },
  upvoteCount:  { type: Number, default: 0 },

  // Upvoters stored as Set — but for millions of users, use a
  // separate DiscussionVote collection instead (see below).
  // For now, array is fine up to ~1000 votes per discussion.
  upvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  isPinned:   { type: Boolean, default: false },
  isLocked:   { type: Boolean, default: false },
  isDeleted:  { type: Boolean, default: false },
}, {
  timestamps: true,
});

DiscussionSchema.index({ problem: 1, createdAt: -1 });
DiscussionSchema.index({ problem: 1, upvoteCount: -1 });  // "top discussions"
DiscussionSchema.index({ author: 1, createdAt: -1 });
DiscussionSchema.index({ tags: 1, createdAt: -1 });
DiscussionSchema.index({ title: 'text', body: 'text' });  // full-text

// ── Compound indexes covering isDeleted filter (used on every list query) ──
// getAllDiscussions: { isDeleted: false }, sort createdAt:-1 or upvoteCount:-1
DiscussionSchema.index({ isDeleted: 1, createdAt: -1 });
DiscussionSchema.index({ isDeleted: 1, upvoteCount: -1, commentCount: -1 }); // getTrending
// getTopContributors aggregation: $match { isDeleted: false } → $group by author
DiscussionSchema.index({ isDeleted: 1, author: 1 });

DiscussionSchema.plugin(mongoosePaginate);

// ─────────────────────────────────────────────
// COMMENT (flat + nested replies via parentComment)
// ─────────────────────────────────────────────
/**
 * DESIGN: Flat collection with parentComment reference.
 * This supports infinite nesting without document size limits.
 * Fetch top-level comments first, then lazy-load replies.
 * Alternative (embedded replies array) breaks at scale.
 */
const CommentSchema = new mongoose.Schema({
  discussion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion',
    required: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  body:          { type: String, required: true },  // Markdown
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null,  // null = top-level comment
  },

  // Vote tracking
  upvoteCount:  { type: Number, default: 0 },
  upvotedBy:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Aggregated reply count (to show "3 replies" without fetching them)
  replyCount:  { type: Number, default: 0 },

  isDeleted:   { type: Boolean, default: false },
}, {
  timestamps: true,
});

CommentSchema.index({ discussion: 1, parentComment: 1, createdAt: 1 }); // thread fetch
CommentSchema.index({ author: 1, createdAt: -1 });
CommentSchema.index({ discussion: 1, upvoteCount: -1 }); // "top comments"

CommentSchema.plugin(mongoosePaginate);

// ─────────────────────────────────────────────
// VOTE (separate collection for high-volume discussions)
// ─────────────────────────────────────────────
/**
 * DiscussionVote / CommentVote
 * Using embedded upvotedBy[] arrays is fine up to ~1000 votes.
 * Beyond that, a separate Vote collection scales better.
 * Feature teams can swap to this pattern if discussions go viral.
 */
const VoteSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['Discussion', 'Comment'], required: true },
  targetId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  value:      { type: Number, enum: [1, -1], default: 1 }, // upvote / downvote
}, {
  timestamps: true,
});

VoteSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true }); // one vote per user
VoteSchema.index({ targetType: 1, targetId: 1 }); // fetch all votes for a target

const Discussion = mongoose.model('Discussion', DiscussionSchema);
const Comment    = mongoose.model('Comment', CommentSchema);
const Vote       = mongoose.model('Vote', VoteSchema);

module.exports = { Discussion, Comment, Vote };