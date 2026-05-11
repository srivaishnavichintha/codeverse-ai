const problemService = require('./problem.service');
const { parsePagination, paginatedResponse, successResponse } = require('../../utils/pagination');

async function listProblems(req, res) {
  const pg = parsePagination(req.query);
  const filters = {
    difficulty: req.query.difficulty || null,
    tagSlug:    req.query.tag        || null,
    search:     req.query.search     || null,
  };
  const userId = req.user?.id || null;
  const { rows, total } = await problemService.listProblems(filters, pg, userId);
  paginatedResponse(res, { data: rows, total, ...pg });
}

async function getProblem(req, res) {
  const userId  = req.user?.id || null;
  const problem = await problemService.getProblem(req.params.slug, userId);
  successResponse(res, problem);
}

async function createProblem(req, res) {
  const problem = await problemService.createProblem(req.body, req.user.id);
  successResponse(res, problem, 201);
}

async function updateProblem(req, res) {
  const problem = await problemService.updateProblem(
    req.params.problemId, req.body, req.user.id
  );
  successResponse(res, problem);
}

async function getProblemStats(req, res) {
  const stats = await problemService.getProblemStats(req.params.problemId);
  successResponse(res, stats);
}

async function getAllTags(req, res) {
  const tags = await problemService.getAllTags();
  successResponse(res, tags);
}

module.exports = { listProblems, getProblem, createProblem, updateProblem, getProblemStats, getAllTags };
