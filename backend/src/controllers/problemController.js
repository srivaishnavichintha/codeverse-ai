const problemService = require('../services/problem.service');
const TestCase = require('../models/TestCase');

// ══════════════════════════════════════════════════════════
// GET /api/problems
// ── UPDATED ───────────────────────────────────────────────
// Now passes userId so solve-status can be attached to each problem.
// Unauthenticated users get req.user = null (via optionalAuth).
// ══════════════════════════════════════════════════════════
const getProblems = async (req, res) => {
  const { page, limit, difficulty, search, tag } = req.query;

  const result = await problemService.getProblems({
    userId:     req.user?.id || null,   // null = not logged in, all show unsolved
    page:       parseInt(page)  || 1,
    limit:      parseInt(limit) || 50,
    difficulty,
    search,
    tag,
  });

  res.json({
    success:  true,
    items:    result.data,
    total:    result.pagination.total,
    page:     result.pagination.page,
    pageSize: parseInt(req.query.limit) || 50,
    pages:    result.pagination.pages,
  });
};

// ══════════════════════════════════════════════════════════
// GET /api/problems/:slug
// ── UPDATED ───────────────────────────────────────────────
// Now returns starterCode, sampleTestCases, and isSolved.
// ══════════════════════════════════════════════════════════
const getProblem = async (req, res) => {
  const problem = await problemService.getProblemBySlug(
    req.params.slug,
    req.user?.id || null
  );
  res.json({ success: true, data: problem });
};

// ══════════════════════════════════════════════════════════
// POST /api/problems
// ── EXISTING (no change) ──────────────────────────────────
const createProblem = async (req, res) => {
  const problem = await problemService.createProblem(req.body);
  res.status(201).json({ success: true, data: problem });
};

// ══════════════════════════════════════════════════════════
// PATCH /api/problems/:id
// ── EXISTING (no change) ──────────────────────────────────
const updateProblem = async (req, res) => {
  const problem = await problemService.updateProblem(req.params.id, req.body);
  res.json({ success: true, data: problem });
};

// ══════════════════════════════════════════════════════════
// POST /api/problems/:id/testcases
// ── NEW ───────────────────────────────────────────────────
// Admin-only. Adds test cases to an existing problem.
// Body: { testCases: [{ input, expectedOutput, isHidden, order }] }
// ══════════════════════════════════════════════════════════
const addTestCases = async (req, res) => {
  const { testCases } = req.body;
  if (!Array.isArray(testCases) || !testCases.length) {
    return res.status(400).json({ success: false, message: 'testCases array is required' });
  }

  const docs = testCases.map((tc, i) => ({
    ...tc,
    problemId: req.params.id,
    order: tc.order ?? i,
  }));

  const inserted = await TestCase.insertMany(docs);
  res.status(201).json({ success: true, count: inserted.length });
};

module.exports = { getProblems, getProblem, createProblem, updateProblem, addTestCases };
