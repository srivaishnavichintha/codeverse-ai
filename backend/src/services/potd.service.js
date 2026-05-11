'use strict';

const POTD = require('../models/POTD');
const Problem = require('../models/Problem');

/**
 * Returns today's date as 'YYYY-MM-DD' in UTC.
 */
function todayString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Get the current Problem of the Day.
 * If no POTD exists for today, auto-selects one and stores it.
 *
 * @returns {Promise<{ potd: Object, problem: Object, isNew: boolean }>}
 */
async function getTodayPOTD() {
  const today = todayString();

  // Check if today's POTD already exists
  const existing = await POTD.findOne({ date: today }).populate('problem').lean();
  if (existing) {
    const prob = existing.problem;
  if (prob) {
    prob.acceptance = prob.totalSubmissions > 0
      ? parseFloat(((prob.totalAccepted / prob.totalSubmissions) * 100).toFixed(1))
      : 0;
    prob.acceptanceRate = prob.acceptance;
  }
  return { potd: existing, problem: prob, isNew: false };
  }

  // Auto-select a new problem for today
  const problem = await selectProblemForToday();

  const potd = await POTD.create({
    date: today,
    problem: problem._id,
    selectionMethod: 'auto',
  });

  const populated = await POTD.findById(potd._id).populate('problem').lean();

  const prob2 = populated.problem;
  if (prob2) {
    prob2.acceptance = prob2.totalSubmissions > 0
      ? parseFloat(((prob2.totalAccepted / prob2.totalSubmissions) * 100).toFixed(1))
      : 0;
    prob2.acceptanceRate = prob2.acceptance;
  }
  return { potd: populated, problem: prob2, isNew: true };
}

/**
 * Admin override: force a specific problem as today's POTD,
 * or regenerate today's POTD with a new auto-selection.
 *
 * @param {string|null} problemId  If provided, uses this problem. Otherwise auto-selects.
 * @param {string}      adminId    Admin user's ObjectId string (for audit trail).
 * @returns {Promise<{ potd: Object, problem: Object }>}
 */
async function regeneratePOTD(problemId, adminId) {
  const today = todayString();

  let problem;

  if (problemId) {
    problem = await Problem.findById(problemId).lean();
    if (!problem) {
      throw Object.assign(new Error('Problem not found.'), { statusCode: 404 });
    }
  } else {
    problem = await selectProblemForToday();
  }

  // Upsert: create or replace today's entry
  const potd = await POTD.findOneAndUpdate(
    { date: today },
    {
      problem: problem._id,
      selectionMethod: 'admin',
      selectedBy: adminId,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).populate('problem');

  return { potd: potd.toObject(), problem: potd.problem };
}

const AIService = require('./AIService');

/**
 * Generates a completely new problem using AI for today.
 *
 * @returns {Promise<Object>}  Lean Problem document
 */
async function selectProblemForToday() {
  const dateStr = todayString();
  const problem = await AIService.generatePOTD(dateStr);
  
  if (!problem) {
    throw Object.assign(
      new Error('Could not generate a problem for today.'),
      { statusCode: 500 }
    );
  }

  // Return lean version if needed, or just the document
  return problem;
}

/**
 * Returns the day-of-year (1-365/366) for today in UTC.
 */
function getDayOfYear() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 0));
  const diff = now - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get POTD history (past N days).
 *
 * @param {number} days  How many days of history to return (default 7)
 * @returns {Promise<Object[]>}
 */
async function getPOTDHistory(days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return POTD.find({ date: { $gte: cutoffStr } })
    .sort({ date: -1 })
    .populate('problem', 'title slug difficulty tags')
    .lean();
}

module.exports = {
  getTodayPOTD,
  regeneratePOTD,
  getPOTDHistory,
};
