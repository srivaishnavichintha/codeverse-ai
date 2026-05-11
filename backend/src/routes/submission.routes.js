/**
 * backend/routes/submission.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All submission routes require authentication — guests cannot submit.
 *
 * Route prefix: /api/submissions
 *
 * Key fix vs original:
 *   - GET /me  added (frontend SubmissionsAPI.mine() calls this)
 *   - GET /recent  added (frontend dashboard uses this)
 *   - Route ordering fixed: /me and /recent BEFORE /:id to avoid
 *     "me" being treated as a submissionId param.
 */

'use strict';

const { Router }  = require('express');
const ctrl        = require('../controllers/submissionController');
const { authenticate } = require('../middleware/auth');

const router = Router();

// All routes require auth
router.use(authenticate);

// Fixed ordering: specific paths BEFORE params
router.get('/me',     ctrl.getRecentSubmissions ?? ctrl.getSubmissions);
router.get('/recent', ctrl.getRecentSubmissions ?? ctrl.getSubmissions);

router.get('/',           ctrl.getSubmissions);
router.get('/:id',        ctrl.getSubmissionById);

router.get('/problem/:problemId', ctrl.getProblemSubmissions);

module.exports = router;
