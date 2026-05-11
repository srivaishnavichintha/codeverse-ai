/**
 * backend/routes/potd.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  /api/potd         — public (frontend calls /api/potd)
 * GET  /api/potd/history — public
 * POST /api/potd/regenerate — admin only
 *
 * KEY FIX: The frontend (problemsService.js) calls GET /potd (no /today suffix).
 * The original potdController exposed getTodayPOTD — we map it to GET /
 * so the URLs match.
 */

'use strict';

const { Router }  = require('express');
const ctrl        = require('../controllers/potdController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.get('/',          ctrl.getTodayPOTD);
router.get('/history',   ctrl.getPOTDHistory);
router.post('/regenerate', authenticate, authorize('admin'), ctrl.regeneratePOTD);

module.exports = router;
