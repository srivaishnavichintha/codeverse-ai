/**
 * backend/routes/code.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/code/run    — requires auth (guests cannot run code)
 * POST /api/code/submit — requires auth
 */

'use strict';

const { Router }  = require('express');
const ctrl        = require('../controllers/codeController');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.post('/run',    authenticate, ctrl.runCode);
router.post('/submit', authenticate, ctrl.submitCode);
router.post('/save-draft', authenticate, ctrl.saveDraft);

module.exports = router;
