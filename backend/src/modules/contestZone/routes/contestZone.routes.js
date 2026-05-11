'use strict';

/**
 * Contest Zone — Routes
 *
 * All routes require authentication unless noted.
 * Admin-only routes noted in comments.
 *
 * Base: /api/contest-zone
 */

const express = require('express');
const router  = express.Router();
const rateLimit = require('express-rate-limit');

const { authenticate: protect, optionalAuth, authorize } = require('../../../middleware/auth');
const ctrl = require('../controllers/contestZone.controller');

// ── Rate limiters ─────────────────────────────────────────
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  { success: false, message: 'Too many contest creation requests' },
});

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      30,
  message:  { success: false, message: 'Too many submission requests' },
});

// ── History (MUST come before /:contestId to avoid route collision) ──
router.get('/user/history', protect, ctrl.getHistory);

// ── Contest CRUD ──────────────────────────────────────────
router.post(  '/',             protect, createLimiter, ctrl.createContest);
router.get(   '/',             optionalAuth, ctrl.listContests);
router.get(   '/:contestId',  optionalAuth, ctrl.getContest);

// ── Join / Leave ──────────────────────────────────────────
router.post('/:contestId/join',  protect, ctrl.joinContest);
router.post('/:contestId/leave', protect, ctrl.leaveContest);
router.post('/:contestId/start', protect, ctrl.startContest);
router.post('/invite/:inviteCode', protect, ctrl.joinByInvite);

// ── Leaderboard ───────────────────────────────────────────
router.get('/:contestId/leaderboard', optionalAuth, ctrl.getLeaderboard);

// ── Submission ────────────────────────────────────────────
router.post('/:contestId/submit',           protect, submitLimiter, ctrl.submitSolution);
router.get( '/:contestId/my-submissions',   protect, ctrl.getMySubmissions);

// ── Reward logs ───────────────────────────────────────────
router.get('/:contestId/rewards', optionalAuth, ctrl.getRewardLogs);

// ── Cancel ────────────────────────────────────────────────
router.delete('/:contestId', protect, ctrl.cancelContest);

// ── Admin endpoints ───────────────────────────────────────
router.post('/:contestId/force-complete',  protect, authorize('admin'), ctrl.forceComplete);
router.post('/:contestId/invalidate',      protect, authorize('admin'), ctrl.invalidateContest);

module.exports = router;
