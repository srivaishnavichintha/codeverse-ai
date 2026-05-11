const { Discussion, Comment, Vote } = require('../models/Discussion');
const Problem = require('../models/Problem');

// Helper: resolve problemId param which may be a slug OR ObjectId
async function resolveProblemId(param) {
  const mongoose = require('mongoose');
  if (mongoose.Types.ObjectId.isValid(param)) return param;
  const problem = await Problem.findOne({ slug: param }).select('_id').lean();
  if (!problem) {
    const err = new Error('Problem not found');
    err.statusCode = 404;
    throw err;
  }
  return problem._id;
}
exports.getAllDiscussions = async (req, res, next) => {
  try {
    const sort =
      req.query.sort === 'top'
        ? { upvoteCount: -1 }
        : { createdAt: -1 };

    const result = await Discussion.paginate(
      { isDeleted: false },
      {
        page: parseInt(req.query.page) || 1,
        limit: 20,
        sort,
        populate: {
          path: 'author',
          select: 'username avatar level',
        },
      }
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/problems/:problemId/discussions
exports.getDiscussions = async (req, res, next) => {
  try {
    const sort = req.query.sort === 'top' ? { upvoteCount: -1 } : { createdAt: -1 };
    const result = await Discussion.paginate(
      { problem: await resolveProblemId(req.params.problemId), isDeleted: false },
      {
        page: parseInt(req.query.page) || 1,
        limit: 20,
        sort,
        populate: { path: 'author', select: 'username avatar level' },
      }
    );
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};
exports.getDiscussion = async (req, res, next) => {
  try {
    const discussion = await Discussion.findById(req.params.id)
      .populate('author', 'username avatar level');

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found',
      });
    }

    res.json({
      success: true,
      data: discussion,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/problems/:problemId/discussions OR /api/discussions
exports.createDiscussion = async (req, res, next) => {
  try {
    const problemId = req.params.problemId || req.body.problemId;
    let problem;
    try {
      problem = problemId ? await resolveProblemId(problemId) : undefined;
    } catch (e) {
      problem = undefined;
    }
    
    let discussion = await Discussion.create({
      problem: problem,
      author: req.user.id,
      title: req.body.title,
      body: req.body.body,
      tags: req.body.tags || [],
      category: req.body.category || 'general',
    });

    discussion = await discussion.populate('author', 'username avatar level');
    res.status(201).json({ success: true, data: { discussion } });
  } catch (err) { next(err); }
};

// DELETE /api/discussions/:id
exports.deleteDiscussion = async (req, res, next) => {
  try {
    const discussion = await Discussion.findById(req.params.id);
    if (!discussion) {
      return res.status(404).json({ success: false, message: 'Discussion not found' });
    }
    
    if (discussion.author.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete' });
    }
    
    discussion.isDeleted = true;
    await discussion.save();
    
    res.json({ success: true, message: 'Discussion deleted' });
  } catch (err) {
    next(err);
  }
};

// GET /api/discussions/:id/comments
exports.getComments = async (req, res, next) => {
  try {
    const result = await Comment.paginate(
      { discussion: req.params.id, parentComment: null, isDeleted: false },
      {
        page: parseInt(req.query.page) || 1,
        limit: 20,
        sort: { upvoteCount: -1, createdAt: 1 },
        populate: { path: 'author', select: 'username avatar level' },
        select: '-upvotedBy',
      }
    );
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// POST /api/discussions/:id/comments
exports.addComment = async (req, res, next) => {
  try {
    const comment = await Comment.create({
      discussion: req.params.id,
      author: req.user.id,
      body: req.body.body,
      parentComment: req.body.parentComment || null,
    });

    // Increment discussion comment count
    await Discussion.findByIdAndUpdate(req.params.id, { $inc: { commentCount: 1 } });

    // Increment parent reply count
    if (req.body.parentComment) {
      await Comment.findByIdAndUpdate(req.body.parentComment, { $inc: { replyCount: 1 } });
    }

    res.status(201).json({ success: true, data: { comment } });
  } catch (err) { next(err); }
};

// POST /api/discussions/:id/vote
exports.voteDiscussion = async (req, res, next) => {
  try {
    const discussionId = req.params.id;
    const userId = req.user.id;

    // Check existing vote
    const existing = await Vote.findOne({
      user: userId, targetType: 'Discussion', targetId: discussionId,
    });

    if (existing) {
      // Remove vote (toggle)
      await existing.deleteOne();
      await Discussion.findByIdAndUpdate(discussionId, { $inc: { upvoteCount: -1 }, $pull: { upvotedBy: userId } });
      return res.json({ success: true, message: 'Vote removed' });
    }

    await Vote.create({ user: userId, targetType: 'Discussion', targetId: discussionId });
    await Discussion.findByIdAndUpdate(discussionId, { $inc: { upvoteCount: 1 }, $addToSet: { upvotedBy: userId } });
    res.json({ success: true, message: 'Upvoted' });
  } catch (err) { next(err); }
};

// POST /api/discussions/:id/pin
exports.pinDiscussion = async (req, res, next) => {
  try {
    const discussionId = req.params.id;
    const userId = req.user.id;

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) return res.status(404).json({ success: false, message: 'Discussion not found' });

    // Ensure the user is the author or admin
    if (discussion.author.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to pin this discussion' });
    }

    discussion.isPinned = !discussion.isPinned;
    await discussion.save();

    res.json({ success: true, data: discussion });
  } catch (err) { next(err); }
};

// POST /api/comments/:id/vote
exports.voteComment = async (req, res, next) => {
  try {
    const commentId = req.params.id;
    const userId = req.user.id;

    const existing = await Vote.findOne({
      user: userId, targetType: 'Comment', targetId: commentId,
    });

    if (existing) {
      await existing.deleteOne();
      await Comment.findByIdAndUpdate(commentId, { $inc: { upvoteCount: -1 }, $pull: { upvotedBy: userId } });
      return res.json({ success: true, message: 'Vote removed' });
    }

    await Vote.create({ user: userId, targetType: 'Comment', targetId: commentId });
    await Comment.findByIdAndUpdate(commentId, { $inc: { upvoteCount: 1 }, $addToSet: { upvotedBy: userId } });
    res.json({ success: true, message: 'Upvoted' });
  } catch (err) { next(err); }
};

// GET /api/discussions/stats/trending
exports.getTrending = async (req, res, next) => {
  try {
    const trending = await Discussion.find({ isDeleted: false })
      .sort({ upvoteCount: -1, commentCount: -1, createdAt: -1 })
      .limit(5)
      .select('title commentCount upvoteCount');
      
    res.json({ success: true, data: trending });
  } catch (err) { next(err); }
};

// GET /api/discussions/stats/contributors
exports.getTopContributors = async (req, res, next) => {
  try {
    const contributors = await Discussion.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$author', posts: { $sum: 1 } } },
      { $sort: { posts: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 1, posts: 1, username: '$user.username', level: '$user.level' } }
    ]);
    
    res.json({ success: true, data: contributors });
  } catch (err) { next(err); }
};
