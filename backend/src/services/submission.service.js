'use strict';

const Submission = require('../models/Submission');

// ─────────────────────────────────────────────
// GET USER SUBMISSIONS (Paginated + Filter)
// Uses correct model field names: user, problem, verdict
// ─────────────────────────────────────────────
const getUserSubmissions = async ({ userId, problemId, page, limit }) => {
  // Submission model uses 'user' not 'userId'
  const filter = { user: userId };
  if (problemId) filter.problem = problemId;

  const skip = (page - 1) * limit;

  const [submissions, total] = await Promise.all([
    Submission.find(filter)
      .populate({ path: 'problem', select: 'title slug difficulty' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Submission.countDocuments(filter),
  ]);

  return {
    data: submissions.map((s) => ({
      _id:       s._id,
      verdict:   s.verdict,
      language:  s.language,
      runtimeMs: s.runtimeMs,
      memoryKb:  s.memoryKb,
      createdAt: s.createdAt,
      problem:   s.problem,   // populated
    })),
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
    },
  };
};

// ─────────────────────────────────────────────
// GET SINGLE SUBMISSION (Owner Only)
// ─────────────────────────────────────────────
const getSubmissionById = async ({ submissionId, userId }) => {
  const submission = await Submission.findOne({
    _id:  submissionId,
    user: userId,           // correct field name
  })
    .populate({ path: 'problem', select: 'title slug' })
    .lean();

  if (!submission) {
    const err = new Error('Submission not found or unauthorized');
    err.statusCode = 404;
    throw err;
  }

  return {
    _id:             submission._id,
    code:            submission.code,
    language:        submission.language,
    verdict:         submission.verdict,
    runtimeMs:       submission.runtimeMs,
    memoryKb:        submission.memoryKb,
    testResults:     submission.testResults || [],
    createdAt:       submission.createdAt,
    problem:         submission.problem,
  };
};

module.exports = { getUserSubmissions, getSubmissionById };
