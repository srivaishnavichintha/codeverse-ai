'use strict';

/**
 * AntiCheat Service
 *
 * Provides hooks for:
 *  - Duplicate/plagiarism code detection within a contest
 *  - Suspicious submission pattern monitoring (too-fast solves)
 *  - Contest validation before activation
 */

const crypto = require('crypto');
const ContestSubmission = require('../models/ContestSubmission.model');
const ContestParticipant = require('../models/ContestParticipant.model');
const ContestZone = require('../models/ContestZone.model');

// ─── Code similarity hash ─────────────────────────────────────────────────────

/**
 * Normalize code to remove variable names, whitespace, comments.
 * Produces a fingerprint for similarity comparison.
 */
function codeFingerprint(code) {
  return crypto
    .createHash('sha256')
    .update(
      code
        .replace(/\/\/.*$/gm, '')           // remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '')   // remove block comments
        .replace(/\s+/g, ' ')               // collapse whitespace
        .trim()
    )
    .digest('hex');
}

// ─── Check for plagiarism ─────────────────────────────────────────────────────

/**
 * Compare a new submission's code against all other submissions
 * for the same problem in the same contest.
 *
 * Returns a plagiarism score [0–1].
 */
async function checkPlagiarism({ contestId, problemId, userId, code }) {
  const fingerprint = codeFingerprint(code);

  const otherSubs = await ContestSubmission.find({
    contest: contestId,
    problem: problemId,
    user:    { $ne: userId },
    verdict: 'Accepted',
  })
    .select('code user')
    .lean();

  if (!otherSubs.length) return { plagiarismScore: 0, flagged: false };

  let maxSimilarity = 0;

  for (const sub of otherSubs) {
    const otherFp = codeFingerprint(sub.code);
    if (otherFp === fingerprint) {
      maxSimilarity = 1.0; // exact match after normalization
      break;
    }
    // Jaccard-like character n-gram similarity
    const similarity = ngramSimilarity(code, sub.code, 4);
    if (similarity > maxSimilarity) maxSimilarity = similarity;
  }

  const flagged = maxSimilarity >= 0.85;
  return { plagiarismScore: Math.round(maxSimilarity * 100) / 100, flagged };
}

/**
 * Simple n-gram character similarity [0–1].
 */
function ngramSimilarity(a, b, n) {
  const setA = new Set(getNgrams(a, n));
  const setB = new Set(getNgrams(b, n));
  if (!setA.size || !setB.size) return 0;

  let intersection = 0;
  for (const gram of setA) {
    if (setB.has(gram)) intersection++;
  }
  return (2 * intersection) / (setA.size + setB.size); // Dice coefficient
}

function getNgrams(str, n) {
  const normalized = str.replace(/\s+/g, ' ').trim();
  const grams = [];
  for (let i = 0; i <= normalized.length - n; i++) {
    grams.push(normalized.slice(i, i + n));
  }
  return grams;
}

// ─── Suspicious pattern detection ────────────────────────────────────────────

/**
 * Flag users who solve problems suspiciously fast (< 30s after contest starts).
 */
async function checkSuspiciousSpeed({ contestId, userId, submittedAt }) {
  const contest = await ContestZone.findById(contestId).select('startedAt').lean();
  if (!contest?.startedAt) return false;

  const secondsElapsed = (submittedAt - contest.startedAt) / 1000;
  return secondsElapsed < 30; // less than 30 seconds is suspicious
}

// ─── Validate contest before activation ──────────────────────────────────────

/**
 * Basic fake-contest prevention checks before going ACTIVE.
 * Returns { valid: boolean, reason: string? }
 */
async function validateContest(contestId) {
  const contest = await ContestZone.findById(contestId).populate('createdBy', 'username createdAt');
  if (!contest) return { valid: false, reason: 'Contest not found' };

  // Ensure creator account isn't very new (< 24 hours)
  const accountAgeDays = (Date.now() - contest.createdBy.createdAt) / (1000 * 60 * 60 * 24);
  if (accountAgeDays < 1) {
    return { valid: false, reason: 'Contest creator account too new' };
  }

  // Ensure entry fee is reasonable
  if (contest.entryFee > 10000) {
    return { valid: false, reason: 'Unreasonable entry fee' };
  }

  return { valid: true, reason: null };
}

// ─── Invalidate contest for cheating ─────────────────────────────────────────

async function invalidateContest(contestId, reason) {
  const { refundAllParticipants } = require('./coinLock.service');

  await ContestZone.findByIdAndUpdate(contestId, {
    flagged:     true,
    invalidated: true,
    flagReason:  reason,
    status:      'cancelled',
    endedAt:     new Date(),
  });

  await refundAllParticipants(contestId);

  console.warn(`[AntiCheat] Contest ${contestId} invalidated: ${reason}`);
}

module.exports = {
  checkPlagiarism,
  checkSuspiciousSpeed,
  validateContest,
  invalidateContest,
};
