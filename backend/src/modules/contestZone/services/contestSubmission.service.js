'use strict';

/**
 * Contest Submission Service
 *
 * Handles code submission evaluation for Contest Zone.
 * Reuses the Judge0 integration pattern from existing JudgeService.
 */

const axios = require('axios');
const ContestSubmission = require('../models/ContestSubmission.model');
const ContestProblem    = require('../models/ContestProblem.model');
const ContestZone       = require('../models/ContestZone.model');
const { applySubmissionScore } = require('./leaderboard.service');
const { checkPlagiarism, checkSuspiciousSpeed } = require('./antiCheat.service');

const JUDGE0_URL = process.env.JUDGE0_URL;

const LANGUAGE_MAP = {
  javascript: 63,
  python:     71,
  java:       62,
  cpp:        54,
};

/**
 * Evaluate a contest submission against all test cases.
 * Updates leaderboard and emits socket events.
 *
 * @param {Object} opts
 * @param {string} opts.contestId
 * @param {string} opts.problemId
 * @param {string} opts.userId
 * @param {string} opts.code
 * @param {string} opts.language
 * @param {Object} opts.io  — Socket.IO server instance
 * @returns {ContestSubmission}
 */
async function evaluateContestSubmission({ contestId, problemId, userId, code, language, io }) {
  // Validate contest is ACTIVE
  const contest = await ContestZone.findById(contestId).lean();
  if (!contest || contest.status !== 'active') {
    throw new Error('Contest is not active');
  }

  // Fetch problem and test cases
  const problem = await ContestProblem.findById(problemId).lean();
  if (!problem || problem.contest.toString() !== contestId) {
    throw new Error('Problem not found in this contest');
  }

  // Count previous attempts
  const attemptNumber = await ContestSubmission.countDocuments({
    contest: contestId,
    problem: problemId,
    user:    userId,
  }) + 1;

  // Create submission record
  const submission = await ContestSubmission.create({
    contest:       contestId,
    problem:       problemId,
    user:          userId,
    code,
    language,
    verdict:       'Pending',
    attemptNumber,
  });

  // Emit "submission received" to room
  if (io) {
    io.to(`contest:${contestId}`).emit('contest:submission:received', {
      contestId,
      userId,
      problemId,
      submissionId: submission._id,
    });
  }

  // Run against test cases
  const testCases = problem.testCases || [];
  let passed      = 0;
  const results   = [];
  let maxRuntime  = 0;
  let maxMemory   = 0;
  let verdict     = 'Accepted';

  for (const tc of testCases) {
    try {
      const judgeRes = await axios.post(
        `${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`,
        {
          source_code: code,
          language_id: LANGUAGE_MAP[language],
          stdin:        tc.input,
          cpu_time_limit: (problem.timeLimit || 2000) / 1000,
          memory_limit:   (problem.memoryLimit || 256) * 1024,
        },
        { timeout: 15_000 }
      );

      const r = judgeRes.data;
      const statusId = r.status?.id;
      const isCorrect = r.stdout?.trim() === tc.expectedOutput.trim() && statusId === 3;

      if (isCorrect) passed++;
      else if (statusId === 5) { verdict = 'Time Limit Exceeded'; }
      else if (statusId === 6) { verdict = 'Compilation Error'; }
      else if ([7, 8, 9, 10, 11, 12].includes(statusId)) { verdict = 'Runtime Error'; }
      else if (!isCorrect && verdict === 'Accepted') { verdict = 'Wrong Answer'; }

      maxRuntime = Math.max(maxRuntime, parseFloat(r.time || 0) * 1000);
      maxMemory  = Math.max(maxMemory, r.memory || 0);

      results.push({
        testCaseId: tc._id,
        passed:     isCorrect,
        runtimeMs:  parseFloat(r.time || 0) * 1000,
        memoryKb:   r.memory || 0,
        stderr:     r.stderr || null,
      });

      if (!isCorrect && verdict !== 'Accepted') break; // short-circuit on hard error
    } catch (judgeErr) {
      results.push({
        testCaseId: tc._id,
        passed:     false,
        runtimeMs:  0,
        memoryKb:   0,
        stderr:     judgeErr.message,
      });
      verdict = 'Internal Error';
      break;
    }
  }

  const score = testCases.length > 0 ? Math.floor((passed / testCases.length) * 100) : 0;

  // Anti-cheat checks
  const { plagiarismScore, flagged: plagiarismFlagged } = await checkPlagiarism({
    contestId, problemId, userId, code,
  });

  const tooFast = await checkSuspiciousSpeed({ contestId, userId, submittedAt: new Date() });

  // Update submission document
  await ContestSubmission.findByIdAndUpdate(submission._id, {
    verdict,
    score,
    runtimeMs:        maxRuntime,
    memoryKb:         maxMemory,
    testResults:      results,
    plagiarismScore,
    flaggedForReview: plagiarismFlagged || tooFast,
    judgedAt:         new Date(),
  });

  // Update participant score and leaderboard
  if (score > 0) {
    const updatedLeaderboard = await applySubmissionScore({
      contestId,
      userId,
      problemId,
      score: score * (problem.maxPoints / 100),
      runtimeMs: maxRuntime,
    });

    // Broadcast leaderboard update
    if (io) {
      io.to(`contest:${contestId}`).emit('contest:leaderboard:update', {
        contestId,
        leaderboard: updatedLeaderboard,
      });
    }
  }

  // Emit submission result to contestant's personal room
  if (io) {
    io.to(`user:${userId}`).emit('contest:submission:result', {
      contestId,
      submissionId: submission._id,
      verdict,
      score,
      runtimeMs: maxRuntime,
      memoryKb:  maxMemory,
      passed,
      total:     testCases.length,
    });
  }

  return ContestSubmission.findById(submission._id).lean();
}

module.exports = { evaluateContestSubmission };
