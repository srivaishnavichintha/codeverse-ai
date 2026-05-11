'use strict';

const submissionService = require('../services/submission.service');
const Submission        = require('../models/Submission');

// GET /api/submissions  — paginated list (own)
const getSubmissions = async (req, res, next) => {
  try {
    const { problemId, page = 1, limit = 20 } = req.query;
    const result = await submissionService.getUserSubmissions({
      userId:    req.user.id,
      problemId: problemId || null,
      page:      parseInt(page),
      limit:     Math.min(parseInt(limit), 100),
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

// GET /api/submissions/recent  — last 10, used by frontend dashboard
const getRecentSubmissions = async (req, res, next) => {
  try {
    const submissions = await Submission.find({ user: req.user.id })
      .populate({ path: 'problem', select: 'title slug difficulty' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('-code -testResults')
      .lean();
    res.json({ success: true, data: submissions });
  } catch (err) { next(err); }
};

// GET /api/submissions/:id  — single submission (owner only)
const getSubmissionById = async (req, res, next) => {
  try {
    const result = await submissionService.getSubmissionById({
      submissionId: req.params.id,
      userId:       req.user.id,
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// GET /api/problems/:problemId/submissions
const getProblemSubmissions = async (req, res, next) => {
  try {
    const result = await submissionService.getUserSubmissions({
      userId:    req.user.id,
      problemId: req.params.problemId,
      page:      1,
      limit:     50,
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

module.exports = {
  getSubmissions,
  getRecentSubmissions,
  getSubmissionById,
  getProblemSubmissions,
};
