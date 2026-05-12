/**
 * app.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Express application factory.
 *
 * Responsibilities:
 *   - Register global middleware (CORS, body parsing, security headers, logging)
 *   - Mount all API routes under /api
 *   - Attach a global error handler
 *
 * NOTE: Socket.IO is NOT attached here — it requires the raw http.Server,
 * which is only available in server.js. See server.js for socket setup.
 */

'use strict';

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');

const app = express();

// ── Security: HTTP headers ────────────────────────────────────────────────────
// helmet sets sensible defaults: X-Frame-Options, X-Content-Type-Options, etc.
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
// FIX: Previously `origin: true` allowed ALL origins — a security risk in
// production. Now locked to the CLIENT_URL env variable.
// In development, CLIENT_URL defaults to localhost:5173 (Vite dev server).
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({
  origin: allowedOrigin,
  credentials: true,              // required for cookies / Authorization header
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));       // reject oversized JSON payloads
app.use(express.urlencoded({ extended: false }));

// ── Request logging ───────────────────────────────────────────────────────────
// 'dev' format: colourised one-liner per request — ideal for development.
// Switch to 'combined' (Apache format) in production for log aggregators.
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Routes ────────────────────────────────────────────────────────────────────
// All endpoints live under /api to match the frontend's VITE_API_URL setting.
const rateLimiter = require('./middleware/rateLimiter');

// ── Routes ────────────────────────────────────────────────────────────────────
const apiRouter = require('./routes/index');
app.use('/api', rateLimiter);
app.use('/api', apiRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
// Catches any request that didn't match a route above.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
// Express identifies a 4-argument function as an error handler.
// All next(err) calls land here.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Log unexpected server errors (not operational 4xx errors)
  if (!err.statusCode || err.statusCode >= 500) {
    console.error('[ERROR]', err);
  }

  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;