/**
 * backend/routes/auth.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Maps to authController (1).js which uses the MongoDB/Mongoose User model.
 *
 * Route prefix: /api/auth  (set in your main app.js / server.js)
 *
 * POST /api/auth/register
 * POST /api/auth/login
 * GET  /api/auth/me       ← requires valid JWT
 */

'use strict';

const { Router }     = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = Router();

// Public
router.post('/register', authController.register);
router.post('/login',    authController.login);

// Protected
router.get('/me', authenticate, authController.getMe);

module.exports = router;
