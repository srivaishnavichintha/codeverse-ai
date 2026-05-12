'use strict';

const express = require('express');
const router  = express.Router();

const { authenticate: protect, optionalAuth, authorize } = require('../middleware/auth');
const PeerRoutes = require('./Peer');
const notificationRoutes = require('./notificationRoutes');
const contestZoneRoutes = require('../modules/contestZone/routes/contestZone.routes');

// ── Controllers ────────────────────────────────────────────
const authController               = require('../controllers/authController');
const userController               = require('../controllers/userController');
const problemController            = require('../controllers/problemController');
const submissionController         = require('../controllers/submissionController');
const discussionController         = require('../controllers/discussionController');
const interviewController          = require('../controllers/interviewController');
const aiController                 = require('../controllers/aiController');
const creditController             = require('../controllers/creditController');
const codeController               = require('../controllers/codeController');
const potdController               = require('../controllers/potdController');
const interviewQuestionsController = require('../controllers/interviewQuestionsController');

// ══════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════
router.post('/auth/register', authController.register);
router.post('/auth/login',    authController.login);
router.get( '/auth/me',       protect, authController.getMe);

// ══════════════════════════════════════════════════════════
// USERS
// ══════════════════════════════════════════════════════════
router.get(   '/users/leaderboard',           userController.getLeaderboard);
router.get(   '/users/me/stats',              protect, userController.getMyStats);
router.patch( '/users/me',                    protect, userController.updateProfile);
router.get(   '/users/:username',             userController.getProfile);
router.get(   '/users/:username/activity',    userController.getActivity);
router.get(   '/users/:username/submissions', protect, userController.getSubmissions);

// ══════════════════════════════════════════════════════════
// PROBLEMS
// ══════════════════════════════════════════════════════════
router.get(   '/problems',               optionalAuth, problemController.getProblems);
router.get(   '/problems/:slug',         optionalAuth, problemController.getProblem);
router.post(  '/problems',               protect, authorize('admin', 'moderator'), problemController.createProblem);
router.patch( '/problems/:id',           protect, authorize('admin', 'moderator'), problemController.updateProblem);
router.post(  '/problems/:id/testcases', protect, authorize('admin'), problemController.addTestCases);

// Engagement actions (like/dislike/bookmark) — store per user in future
router.post('/problems/:slug/like',     protect, (req, res) => res.json({ success: true }));
router.post('/problems/:slug/dislike',  protect, (req, res) => res.json({ success: true }));
router.post('/problems/:slug/bookmark', protect, (req, res) => res.json({ success: true }));

// ══════════════════════════════════════════════════════════
// SUBMISSIONS
// ══════════════════════════════════════════════════════════
router.get('/submissions',                     protect, submissionController.getSubmissions);
router.get('/submissions/recent',              protect, submissionController.getRecentSubmissions);
router.get('/submissions/:id',                 protect, submissionController.getSubmissionById);
router.get('/problems/:problemId/submissions', protect, submissionController.getProblemSubmissions);

// ══════════════════════════════════════════════════════════
// CODE EXECUTION
// ══════════════════════════════════════════════════════════
router.post('/code/run',        protect, codeController.runCode);
router.post('/code/submit',     protect, codeController.submitCode);
router.post('/code/save-draft', protect, codeController.saveDraft);

// ══════════════════════════════════════════════════════════
// PEER CHALLENGES
// ══════════════════════════════════════════════════════════
router.use('/peers', PeerRoutes);

// ══════════════════════════════════════════════════════════
// DISCUSSIONS
// ══════════════════════════════════════════════════════════
// Frontend calls /problems/:slug/discussions — we accept both slug and id
router.get( '/problems/:problemId/discussions', optionalAuth, discussionController.getDiscussions);
router.post('/problems/:problemId/discussions', protect,      discussionController.createDiscussion);

// Top-level discussion routes — frontend DiscussionsPage calls GET /api/discussions
router.post('/discussions',                     protect,      discussionController.createDiscussion);
router.get( '/discussions/stats/trending',      optionalAuth, discussionController.getTrending);
router.get( '/discussions/stats/contributors',  optionalAuth, discussionController.getTopContributors);
router.get( '/discussions',                     optionalAuth, discussionController.getAllDiscussions);
router.get( '/discussions/:id',                 optionalAuth, discussionController.getDiscussion);
router.delete('/discussions/:id',               protect,      discussionController.deleteDiscussion);
router.post('/discussions/:id/pin',             protect,      discussionController.pinDiscussion);
router.get( '/discussions/:id/comments',        optionalAuth, discussionController.getComments);
router.post('/discussions/:id/comments',        protect,      discussionController.addComment);
router.post('/discussions/:id/vote',            protect,      discussionController.voteDiscussion);
router.post('/comments/:id/vote',               protect,      discussionController.voteComment);

// ══════════════════════════════════════════════════════════
// INTERVIEW
// ══════════════════════════════════════════════════════════
router.post('/interview/start',                  protect, interviewController.startInterview);
router.get( '/interview/stats',            protect, interviewController.getDashboardStats);
router.get( '/interview/coding-analytics', protect, interviewController.getCodingPracticeAnalytics); // ← NEW
router.get( '/interview/:sessionId',             protect, interviewController.getSession);
router.get( '/interview/:sessionId/status',      protect, interviewController.getSessionStatus);
router.post('/interview/:sessionId/submit-code', protect, interviewController.submitCode);
router.post('/interview/:sessionId/qualify',     protect, interviewController.checkQualification);
router.post('/interview/:sessionId/answer',      protect, interviewController.submitAnswer);
router.post('/interview/:sessionId/terminate',   protect, interviewController.terminateSession);
router.get( '/interview/:sessionId/job/:jobId',  protect, interviewController.getJobStatus);
router.post('/interview/:sessionId/violation',   protect, interviewController.reportViolation);

// ══════════════════════════════════════════════════════════
// INTERVIEW QUESTIONS  (question bank)
// ══════════════════════════════════════════════════════════
router.post(  '/interview-questions',     protect, interviewQuestionsController.saveQuestions);
router.get(   '/interview-questions',     protect, interviewQuestionsController.getUserQuestions);
router.get(   '/interview-questions/:id', protect, interviewQuestionsController.getQuestionById);
router.delete('/interview-questions/:id', protect, interviewQuestionsController.deleteQuestion);

// ══════════════════════════════════════════════════════════
// AI
// ══════════════════════════════════════════════════════════
router.get( '/ai/sessions/:sessionId/questions',                      protect, aiController.getQuestions);
router.post('/ai/sessions/:sessionId/questions/:questionId/adaptive', protect, aiController.generateAdaptive);
router.get( '/ai/sessions/:sessionId/report',                         protect, aiController.getReport);
router.post('/ai/sessions/:sessionId/report/generate',                protect, aiController.triggerReport);
router.get( '/ai/sessions/:sessionId/logs',                           protect, authorize('admin'), aiController.getAILogs);

// ══════════════════════════════════════════════════════════
// CREDITS
// ══════════════════════════════════════════════════════════
router.get( '/credits/balance',       protect, creditController.getBalance);
router.get( '/credits/transactions',  protect, creditController.getTransactions);
router.post('/credits/grant',         protect, authorize('admin'), creditController.grantCredits);
router.post('/credits/deduct',        protect, authorize('admin'), creditController.deductCredits);

// ══════════════════════════════════════════════════════════
// PROBLEM OF THE DAY
// ══════════════════════════════════════════════════════════
router.get( '/potd',            potdController.getTodayPOTD);
router.get( '/potd/history',    potdController.getPOTDHistory);
router.post('/potd/submit',     protect, (req, res) => res.json({ success: true, data: { streak: 1 } })); // stub
router.post('/potd/regenerate', protect, authorize('admin'), potdController.regeneratePOTD);

// ══════════════════════════════════════════════════════════
// USER STATS (convenience endpoint for frontend dashboard)
// ══════════════════════════════════════════════════════════
router.get('/user/problem-stats', protect, userController.getMyStats);

// ══════════════════════════════════════════════════════════
// CONTEST ZONE
// ══════════════════════════════════════════════════════════
router.use('/contest-zone', contestZoneRoutes);

// ══════════════════════════════════════════════════════════
// PEER-TO-PEER
// ══════════════════════════════════════════════════════════
router.use('/PeertoPeer', protect, PeerRoutes);

// ══════════════════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════════════════
router.use('/notifications', notificationRoutes);

module.exports = router;