const submissionRepo = require('./submission.repository');
const problemService  = require('../problems/problem.service');
const AppError        = require('../../utils/AppError');

class SubmissionService {
  async submit({ userId, problemSlug, language, sourceCode }) {
    // Validate problem exists
    const problem = await problemService.getProblem(problemSlug, userId);

    const submission = await submissionRepo.create({
      userId,
      problemId: problem.id,
      language,
      sourceCode,
    });

    // In a real system, push to a message queue (RabbitMQ / SQS) here.
    // The judge worker pulls the job, runs the code against all test cases,
    // then calls PATCH /internal/submissions/:id/verdict.
    // For now we return the pending submission.
    return submission;
  }

  async getSubmission(id, requestingUserId, requestingUserRole) {
    const submission = await submissionRepo.findById(id);
    if (!submission) throw new AppError('Submission not found', 404);

    // Only the owner or admin can see source code
    if (submission.user_id !== requestingUserId && requestingUserRole !== 'admin') {
      delete submission.source_code;
    }
    return submission;
  }

  async getUserSubmissions(userId, pagination, filters) {
    return submissionRepo.findByUser(userId, { ...pagination, ...filters });
  }

  async getProblemSubmissions(problemId, pagination, userId) {
    return submissionRepo.findByProblem(problemId, { ...pagination, userId });
  }

  async getFastestAccepted(problemId, pagination) {
    return submissionRepo.getFastestAccepted(problemId, pagination);
  }

  // Called by internal judge service only — should be behind an internal API key
  async updateVerdict(id, verdictData) {
    const updated = await submissionRepo.updateVerdict(id, verdictData);
    if (!updated) throw new AppError('Submission not found', 404);
    return updated;
  }
}

module.exports = new SubmissionService();
