const problemRepo = require('./problem.repository');
const AppError    = require('../../utils/AppError');

class ProblemService {
  async listProblems(filters, pagination, userId) {
    return problemRepo.findAll({ ...filters, ...pagination, userId });
  }

  async getProblem(slug, userId) {
    const problem = await problemRepo.findBySlug(slug, userId);
    if (!problem) throw new AppError('Problem not found', 404);

    const [examples, visibleTests] = await Promise.all([
      problemRepo.getExamples(problem.id),
      problemRepo.getVisibleTestCases(problem.id),
    ]);

    return { ...problem, examples, visible_test_cases: visibleTests };
  }

  async createProblem(data, createdBy) {
    return problemRepo.create(data, createdBy);
  }

  async updateProblem(id, fields, changedBy) {
    const existing = await problemRepo.findById(id);
    if (!existing) throw new AppError('Problem not found', 404);
    return problemRepo.update(id, fields, changedBy);
  }

  async getProblemStats(id) {
    const stats = await problemRepo.getStats(id);
    if (!stats) throw new AppError('Problem stats not found', 404);
    return stats;
  }

  async getAllTags() {
    return problemRepo.getAllTags();
  }

  // Judge-internal: returns ALL test cases including hidden ones
  // This method should only be called from the judge service, never from a public endpoint
  async getTestCasesForJudge(problemId) {
    return problemRepo.getAllTestCases(problemId);
  }
}

module.exports = new ProblemService();
