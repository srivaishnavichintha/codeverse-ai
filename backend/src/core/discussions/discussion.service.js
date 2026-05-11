const discussionRepo = require('./discussion.repository');
const AppError       = require('../../utils/AppError');

class DiscussionService {
  async listDiscussions(problemId, pagination, sort) {
    return discussionRepo.findByProblem(problemId, { ...pagination, sort });
  }

  async getDiscussion(id) {
    const discussion = await discussionRepo.findById(id);
    if (!discussion) throw new AppError('Discussion not found', 404);
    await discussionRepo.incrementViews(id);
    return discussion;
  }

  async createDiscussion(problemId, authorId, { title, body, tags, category }) {
    return discussionRepo.create({ problemId, authorId, title, body, tags, category });
  }

  async updateDiscussion(id, userId, role, fields) {
    const discussion = await discussionRepo.findById(id);
    if (!discussion) throw new AppError('Discussion not found', 404);
    if (discussion.author_id !== userId && role !== 'admin' && role !== 'moderator') {
      throw new AppError('Not authorised to edit this discussion', 403);
    }
    return discussionRepo.update(id, fields);
  }

  async deleteDiscussion(id, userId, role) {
    const discussion = await discussionRepo.findById(id);
    if (!discussion) throw new AppError('Discussion not found', 404);
    if (discussion.author_id !== userId && role !== 'admin' && role !== 'moderator') {
      throw new AppError('Not authorised to delete this discussion', 403);
    }
    await discussionRepo.delete(id);
  }

  // Comments
  async getComments(discussionId, pagination) {
    return discussionRepo.getComments(discussionId, pagination);
  }

  async createComment(discussionId, authorId, { parentId, body }) {
    const discussion = await discussionRepo.findById(discussionId);
    if (!discussion) throw new AppError('Discussion not found', 404);

    if (parentId) {
      const parent = await discussionRepo.findCommentById(parentId);
      if (!parent || parent.discussion_id !== discussionId) {
        throw new AppError('Parent comment not found', 404);
      }
    }

    return discussionRepo.createComment({ discussionId, authorId, parentId, body });
  }

  async updateComment(commentId, userId, body) {
    const comment = await discussionRepo.findCommentById(commentId);
    if (!comment) throw new AppError('Comment not found', 404);
    if (comment.author_id !== userId) throw new AppError('Not authorised', 403);
    return discussionRepo.updateComment(commentId, body);
  }

  async deleteComment(commentId, userId, role) {
    const comment = await discussionRepo.findCommentById(commentId);
    if (!comment) throw new AppError('Comment not found', 404);
    if (comment.author_id !== userId && role !== 'admin' && role !== 'moderator') {
      throw new AppError('Not authorised', 403);
    }
    await discussionRepo.softDeleteComment(commentId);
  }

  // Votes
  async vote(userId, targetType, targetId, value) {
    if (!['discussion', 'comment'].includes(targetType)) {
      throw new AppError('Invalid target type', 400);
    }
    if (!['upvote', 'downvote'].includes(value)) {
      throw new AppError('Invalid vote value', 400);
    }
    await discussionRepo.vote(userId, targetType, targetId, value);
    return { message: 'Vote recorded' };
  }
}

module.exports = new DiscussionService();
