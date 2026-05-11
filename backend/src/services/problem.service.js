'use strict';

const mongoose   = require('mongoose');
const Problem    = require('../models/Problem');
const Submission = require('../models/Submission');
const TestCase   = require('../models/TestCase');
const { generateRawProblems } = require('./ai.service');

// ─────────────────────────────────────────────
// Helper: Build Filters
// ─────────────────────────────────────────────
const buildFilters = ({ difficulty, search, tag }) => {
  const filter = { isActive: true };

  if (difficulty) {
    // Normalize: accept 'easy', 'Easy', 'EASY' — stored as 'Easy'
    const normalized =
      difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
    filter.difficulty = normalized;
  }

  if (tag) {
    filter.tags = tag;
  }

  if (search) {
    filter.title = { $regex: search, $options: 'i' };
  }

  return filter;
};

// ─────────────────────────────────────────────
// GET ALL PROBLEMS (with solved status)
// ─────────────────────────────────────────────
const getProblems = async ({ userId, page, limit, difficulty, search, tag }) => {
  const filter = buildFilters({ difficulty, search, tag });
  const skip   = (page - 1) * limit;

  // FIX: removed `acceptanceRate` from select — it's a virtual with broken ref.
  // Compute acceptance rate from the real stored counters instead.
  const problems = await Problem.find(filter)
    .select('title slug difficulty tags totalSubmissions totalAccepted')
    .sort({ order: 1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Problem.countDocuments(filter);

  let solvedSet = new Set();
  if (userId) {
    const solvedIds = await Submission.find({ user: userId, verdict: 'Accepted' })
      .distinct('problem');
    solvedSet = new Set(solvedIds.map((id) => id.toString()));
  }

  const enrichedProblems = problems.map((p) => {
    const acceptanceRate = p.totalSubmissions > 0
      ? parseFloat(((p.totalAccepted / p.totalSubmissions) * 100).toFixed(2))
      : 0;

    return {
      ...p,
      acceptanceRate,
      acceptance: acceptanceRate,   // alias for frontend compat
      isSolved: userId ? solvedSet.has(p._id.toString()) : false,
    };
  });

  return {
    data: enrichedProblems,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
    },
  };
};

// ─────────────────────────────────────────────
// GET SINGLE PROBLEM BY SLUG
// ─────────────────────────────────────────────
const getProblemBySlug = async (slug, userId) => {
  const problem = await Problem.findOne({ slug }).lean();

  if (!problem) {
    throw Object.assign(new Error('Problem not found'), { statusCode: 404 });
  }

  // Fetch only public (non-hidden) test cases
  const sampleTestCases = await TestCase.find({
    problem: problem._id,
    isHidden: false,
  })
    .select('input output')
    .sort({ order: 1 })
    .lean();

  let isSolved = false;
  if (userId) {
    const submission = await Submission.findOne({
      user: userId,
      problem: problem._id,
      verdict: 'Accepted',
    }).lean();
    isSolved = !!submission;
  }

  const acceptanceRate = problem.totalSubmissions > 0
    ? parseFloat(((problem.totalAccepted / problem.totalSubmissions) * 100).toFixed(2))
    : 0;

  return {
    ...problem,
    acceptanceRate,
    sampleTestCases,
    isSolved,
  };
};

// ─────────────────────────────────────────────
// CREATE PROBLEM
// ─────────────────────────────────────────────
const createProblem = async (data) => {
  const problem = await Problem.create(data);
  return problem;
};

// ─────────────────────────────────────────────
// UPDATE PROBLEM
// ─────────────────────────────────────────────
const updateProblem = async (id, data) => {
  const problem = await Problem.findByIdAndUpdate(
    id,
    data,
    { new: true, runValidators: true }
  );
  if (!problem) {
    throw Object.assign(new Error('Problem not found'), { statusCode: 404 });
  }
  return problem;
};

// ─────────────────────────────────────────────
// GENERATE AND STORE PROBLEMS  (used by interview.service.js)
//
// This function was missing from the codebase — it is called by
// interview.service.js but was never defined anywhere.
//
// Flow:
//   1. Call ai.service.generateRawProblems() to get raw AI-generated problem data
//   2. Persist each problem to the Problem collection
//   3. Persist its test cases to the TestCase collection
//   4. Build a Map<problemId, publicTestCases[]> for the interview controller
//
// @param {Array<{ difficulty: string, count: number }>} difficultyProfile
// @param {string} userId  — stored on the problem for attribution
// ─────────────────────────────────────────────
const generateAndStoreProblems = async (difficultyProfile, userId) => {
  // 1. Generate raw problems via AI (one API call per problem)
  const rawProblems = await generateRawProblems(difficultyProfile);

  if (!rawProblems || rawProblems.length === 0) {
    throw Object.assign(
      new Error('AI failed to generate any problems.'),
      { statusCode: 502 }
    );
  }

  const savedProblems      = [];
  const publicTestCasesMap = new Map(); // Map<problemId string, TestCase[]>

  for (const raw of rawProblems) {
    try {
      // ── Normalise difficulty to title-case (schema enum) ──────────────
      const diffNorm =
        raw.difficulty.charAt(0).toUpperCase() +
        raw.difficulty.slice(1).toLowerCase();

      // ── Derive a URL-safe slug ─────────────────────────────────────────
      const baseSlug = raw.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Make slug unique by appending a short timestamp token
      const slug = `${baseSlug}-${Date.now().toString(36)}`;

      // ── Persist problem ────────────────────────────────────────────────
      const problem = await Problem.create({
        title:         raw.title,
        slug,
        description:   raw.description,
        difficulty:    diffNorm,
        tags:          raw.tags || [],
        constraints:   Array.isArray(raw.constraints)
          ? raw.constraints
          : raw.constraints
            ? [raw.constraints]
            : [],
        examples:      raw.examples || [],
        hints:         raw.hints    || [],
        starterCode:   raw.starterCode || {},
        timeLimitMs:   raw.timeLimitMs   || 2000,
        memoryLimitMb: raw.memoryLimitMb || 256,
        isActive:      true,
      });

      // ── Persist test cases ─────────────────────────────────────────────
      const publicTCs  = (raw.testCases?.public  || []).map((tc, i) => ({
        problem:  problem._id,
        input:    tc.input,
        output:   tc.output,
        isHidden: false,
        isSample: true,
        order:    i,
      }));

      const hiddenTCs  = (raw.testCases?.hidden || []).map((tc, i) => ({
        problem:  problem._id,
        input:    tc.input,
        output:   tc.output,
        isHidden: true,
        isSample: false,
        order:    publicTCs.length + i,
      }));

      const allTCs = [...publicTCs, ...hiddenTCs];
      if (allTCs.length > 0) {
        await TestCase.insertMany(allTCs, { ordered: false });
      }

      savedProblems.push(problem);
      publicTestCasesMap.set(String(problem._id), publicTCs);
    } catch (err) {
      // Log individual failures but continue — one bad AI output shouldn't
      // abort the whole session.
      console.error('[problem.service] Failed to persist AI problem:', err.message);
    }
  }

  return { savedProblems, publicTestCasesMap };
};

module.exports = {
  getProblems,
  getProblemBySlug,
  createProblem,
  updateProblem,
  generateAndStoreProblems, // NEW: was missing, used by interview.service.js
};
