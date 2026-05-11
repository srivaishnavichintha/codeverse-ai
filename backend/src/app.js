/**
 * app.js  (or server.js)
 * ─────────────────────────────────────────────────────────────────────────────
 * Route mounting reference.
 * Apply this to your existing app.js / server.js — only the router.use()
 * calls and the import lines need to be added/adjusted.
 *
 * All routes are under /api to match the frontend's VITE_API_URL = .../api
 */

'use strict';

const express  = require('express');
const cors     = require('cors');
const app      = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
// Consolidated router — all endpoints defined in routes/index.js
const apiRouter = require('./routes/index');

// Mount all under /api
app.use('/api', apiRouter);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;
