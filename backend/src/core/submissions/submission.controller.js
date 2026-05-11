const submissionService = require('./submission.service');
const { parsePagination, paginatedResponse, successResponse } = require('../../utils/pagination');

async function submit(req, res) {
  const { problem_slug, language, source_code } = req.body;
  const submission = await submissionService.submit({
    userId:      req.user.id,
    problemSlug: problem_slug,
    language,
    sourceCode:  source_code,
  });
  successResponse(res, submission, 202); // 202 Accepted — judging is async
}

async function getSubmission(req, res) {
  const submission = await submissionService.getSubmission(
    req.params.submissionId,
    req.user.id,
    req.user.role
  );
  successResponse(res, submission);
}

async function getMySubmissions(req, res) {
  const pg = parsePagination(req.query);
  const filters = {
    problemId: req.query.problem_id || null,
    verdict:   req.query.verdict    || null,
  };
  const { rows, total } = await submissionService.getUserSubmissions(req.user.id, pg, filters);
  paginatedResponse(res, { data: rows, total, ...pg });
}

async function getProblemSubmissions(req, res) {
  const pg = parsePagination(req.query);
  const { rows, total } = await submissionService.getProblemSubmissions(
    req.params.problemId, pg, req.user?.id
  );
  paginatedResponse(res, { data: rows, total, ...pg });
}

async function getFastestAccepted(req, res) {
  const pg = parsePagination(req.query);
  const rows = await submissionService.getFastestAccepted(req.params.problemId, pg);
  successResponse(res, rows);
}

// Internal endpoint — protected by INTERNAL_API_KEY header in route layer
async function updateVerdict(req, res) {
  const updated = await submissionService.updateVerdict(
    req.params.submissionId, req.body
  );
  successResponse(res, updated);
}

module.exports = {
  submit, getSubmission, getMySubmissions,
  getProblemSubmissions, getFastestAccepted, updateVerdict,
};
