const discussionService = require('./discussion.service');
const { parsePagination, paginatedResponse, successResponse } = require('../../utils/pagination');

async function listDiscussions(req, res) {
  const pg   = parsePagination(req.query);
  const sort = req.query.sort || 'newest';
  const { rows, total } = await discussionService.listDiscussions(
    req.params.problemId, pg, sort
  );
  paginatedResponse(res, { data: rows, total, ...pg });
}

async function getDiscussion(req, res) {
  const discussion = await discussionService.getDiscussion(req.params.discussionId);
  successResponse(res, discussion);
}

async function createDiscussion(req, res) {
  const discussion = await discussionService.createDiscussion(
    req.params.problemId, req.user.id, req.body
  );
  successResponse(res, discussion, 201);
}

async function updateDiscussion(req, res) {
  const updated = await discussionService.updateDiscussion(
    req.params.discussionId, req.user.id, req.user.role, req.body
  );
  successResponse(res, updated);
}

async function deleteDiscussion(req, res) {
  await discussionService.deleteDiscussion(
    req.params.discussionId, req.user.id, req.user.role
  );
  res.status(204).end();
}

async function getComments(req, res) {
  const pg = parsePagination(req.query);
  const { rows, total } = await discussionService.getComments(req.params.discussionId, pg);
  paginatedResponse(res, { data: rows, total, ...pg });
}

async function createComment(req, res) {
  const comment = await discussionService.createComment(
    req.params.discussionId, req.user.id, req.body
  );
  successResponse(res, comment, 201);
}

async function updateComment(req, res) {
  const updated = await discussionService.updateComment(
    req.params.commentId, req.user.id, req.body.body
  );
  successResponse(res, updated);
}

async function deleteComment(req, res) {
  await discussionService.deleteComment(
    req.params.commentId, req.user.id, req.user.role
  );
  res.status(204).end();
}

async function vote(req, res) {
  const result = await discussionService.vote(
    req.user.id,
    req.body.target_type,
    req.body.target_id,
    req.body.value
  );
  successResponse(res, result);
}

module.exports = {
  listDiscussions, getDiscussion, createDiscussion, updateDiscussion, deleteDiscussion,
  getComments, createComment, updateComment, deleteComment, vote,
};
