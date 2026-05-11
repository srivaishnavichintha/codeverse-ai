/**
 * backend/middleware/auth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Two middleware variants:
 *
 *   authenticate    — Hard guard. Returns 401 if no valid token. Use on all
 *                     routes that require a logged-in user (submit, run code,
 *                     profile, etc.).
 *
 *   optionalAuth    — Soft guard. Attaches req.user if a valid token is
 *                     present, but lets the request through as a guest if not.
 *                     Use on routes that are PUBLIC but benefit from knowing
 *                     who the user is (e.g. GET /problems — to show isSolved).
 *
 *   authorize(...roles) — Role check. Must come AFTER authenticate.
 *
 * This file works with the existing authController.js (MongoDB/Mongoose stack).
 * JWT_SECRET must be set in .env.
 */

'use strict';

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ─── Shared token extractor ───────────────────────────────────────────────────
function extractToken(req) {
  const header = req.headers['authorization'] || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

// ─── authenticate — HARD guard ────────────────────────────────────────────────
async function authenticate(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Support both { id } (authController) and { sub } (user.service) shapes
    const userId = decoded.id ?? decoded.sub;

    const user = await User.findById(userId).select('-password').lean();
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    req.user = { id: String(user._id), role: user.role || 'user', ...user };
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Session expired. Please sign in again.'
      : 'Invalid token. Please sign in again.';
    return res.status(401).json({ success: false, message: msg });
  }
}

// ─── optionalAuth — SOFT guard ────────────────────────────────────────────────
async function optionalAuth(req, _res, next) {
  const token = extractToken(req);

  if (!token) {
    req.user = null; // explicitly null — controllers check req.user?.id
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId  = decoded.id ?? decoded.sub;
    const user    = await User.findById(userId).select('-password').lean();
    req.user = user ? { id: String(user._id), role: user.role || 'user', ...user } : null;
  } catch {
    req.user = null; // expired / invalid token — treat as guest, don't error
  }

  next();
}

// ─── authorize — role guard ───────────────────────────────────────────────────
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
    }
    next();
  };
}

module.exports = { authenticate, optionalAuth, authorize };
