'use strict';

const express = require('express');
const router = express.Router();

// ─── Existing controllers ──────────────────────────────────────────────────────
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const problemController = require('../controllers/problemController');
const submissionController = require('../controllers/submissionController');
const discussionController = require('../controllers/discussionController');

// ─── New controllers ───────────────────────────────────────────────────────────
const interviewController = require('../controllers/interviewController');
const aiController = require('../controllers/aiController');
const creditController = require('../controllers/creditController');

const videoRoutes = require('./videoRoutes')

// ─── Middleware ────────────────────────────────────────────────────────────────
const { authenticate, authorize } = require('../middleware/auth');

// ════════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════════════════════════
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/logout', authenticate, authController.logout);
router.post('/auth/refresh', authController.refresh);

// ════════════════════════════════════════════════════════════════════════════════
// USER ROUTES
// ════════════════════════════════════════════════════════════════════════════════
router.get('/users/me', authenticate, userController.getProfile);
router.put('/users/me', authenticate, userController.updateProfile);
router.get('/users/:id', authenticate, userController.getUserById);

// ════════════════════════════════════════════════════════════════════════════════
// PROBLEM ROUTES
// ════════════════════════════════════════════════════════════════════════════════
router.get('/problems', authenticate, problemController.getProblems);
router.get('/problems/:id', authenticate, problemController.getProblemById);
router.post('/problems', authenticate, authorize('admin'), problemController.createProblem);
router.put('/problems/:id', authenticate, authorize('admin'), problemController.updateProblem);
router.delete('/problems/:id', authenticate, authorize('admin'), problemController.deleteProblem);

// ════════════════════════════════════════════════════════════════════════════════
// SUBMISSION ROUTES
// ════════════════════════════════════════════════════════════════════════════════
router.post('/submissions', authenticate, submissionController.createSubmission);
router.get('/submissions/:id', authenticate, submissionController.getSubmission);
router.get('/submissions', authenticate, submissionController.getUserSubmissions);

// ════════════════════════════════════════════════════════════════════════════════
// DISCUSSION ROUTES
// ════════════════════════════════════════════════════════════════════════════════
router.get('/discussions', authenticate, discussionController.getDiscussions);
router.post('/discussions', authenticate, discussionController.createDiscussion);
router.get('/discussions/:id', authenticate, discussionController.getDiscussionById);
router.put('/discussions/:id', authenticate, discussionController.updateDiscussion);
router.delete('/discussions/:id', authenticate, discussionController.deleteDiscussion);

// ════════════════════════════════════════════════════════════════════════════════
// INTERVIEW ROUTES  /api/interview/*
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST   /api/interview/start               Start a new interview (deducts credits)
 * GET    /api/interview/:sessionId          Get full session state + questions
 * GET    /api/interview/:sessionId/status   Lightweight status poll
 * POST   /api/interview/:sessionId/submit-code   Record a code submission for a problem
 * POST   /api/interview/:sessionId/qualify  Check if user qualifies for AI phase
 * POST   /api/interview/:sessionId/answer   Submit an answer to an AI question
 * GET    /api/interview/:sessionId/job/:jobId     Check BullMQ job status
 */
router.post('/interview/start', authenticate, interviewController.startInterview);
router.get('/interview/:sessionId', authenticate, interviewController.getSession);
router.get('/interview/:sessionId/status', authenticate, interviewController.getSessionStatus);
router.post('/interview/:sessionId/submit-code', authenticate, interviewController.submitCode);
router.post('/interview/:sessionId/qualify', authenticate, interviewController.checkQualification);
router.post('/interview/:sessionId/answer', authenticate, interviewController.submitAnswer);
router.get('/interview/:sessionId/job/:jobId', authenticate, interviewController.getJobStatus);

// ════════════════════════════════════════════════════════════════════════════════
// AI ROUTES  /api/ai/*
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET    /api/ai/sessions/:sessionId/questions                  List all questions
 * POST   /api/ai/sessions/:sessionId/questions/:questionId/adaptive  Generate adaptive follow-up
 * GET    /api/ai/sessions/:sessionId/report                     Get final report
 * POST   /api/ai/sessions/:sessionId/report/generate            Trigger report generation
 * GET    /api/ai/sessions/:sessionId/logs                       AI response logs (admin)
 */
router.get('/ai/sessions/:sessionId/questions', authenticate, aiController.getQuestions);
router.post(
  '/ai/sessions/:sessionId/questions/:questionId/adaptive',
  authenticate,
  aiController.generateAdaptive
);
router.get('/ai/sessions/:sessionId/report', authenticate, aiController.getReport);
router.post('/ai/sessions/:sessionId/report/generate', authenticate, aiController.triggerReport);
router.get(
  '/ai/sessions/:sessionId/logs',
  authenticate,
  authorize('admin'),
  aiController.getAILogs
);
 

router.use('/upload-interview-video', videoRoutes)

// ════════════════════════════════════════════════════════════════════════════════
// CREDIT ROUTES  /api/credits/*
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET    /api/credits/balance               Get current user's credit balance
 * GET    /api/credits/transactions          Paginated transaction history
 * POST   /api/credits/grant                 Admin: grant credits to a user
 * POST   /api/credits/deduct                Admin: deduct credits from a user
 */
router.get('/credits/balance', authenticate, creditController.getBalance);
router.get('/credits/transactions', authenticate, creditController.getTransactions);
router.post('/credits/grant', authenticate, authorize('admin'), creditController.grantCredits);
router.post('/credits/deduct', authenticate, authorize('admin'), creditController.deductCredits);

module.exports = router;
