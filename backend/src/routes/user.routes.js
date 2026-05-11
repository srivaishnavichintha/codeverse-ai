const { Router } = require('express');
const ctrl       = require('../core/users/user.controller');
const schemas    = require('../core/users/user.validation');
const { authenticate, authorize } = require('../middleware/auth');
const validate   = require('../middleware/validate');

// ── /api/v1/auth ─────────────────────────────────────────────────────────────
const auth = Router();

auth.post('/register', validate(schemas.register),      ctrl.register);
auth.post('/login',    validate(schemas.login),         ctrl.login);
auth.post('/refresh',  validate(schemas.refreshToken),  ctrl.refreshToken);
auth.post('/logout',   validate(schemas.refreshToken),  ctrl.logout);

// ── /api/v1/users ─────────────────────────────────────────────────────────────
const users = Router();

users.get('/leaderboard',                                          ctrl.getLeaderboard);
users.get('/me',            authenticate,                          ctrl.getMe);
users.patch('/me',          authenticate, validate(schemas.updateProfile), ctrl.updateProfile);
users.get('/me/activity',   authenticate,                          ctrl.getActivity);
users.get('/me/solved',     authenticate,                          ctrl.getSolvedProblems);

users.get('/:userId',                                              ctrl.getProfile);
users.get('/:userId/stats',                                        ctrl.getStats);
users.get('/:userId/solved',                                       ctrl.getSolvedProblems);
users.get('/:userId/activity',                                     ctrl.getActivity);

module.exports = { auth, users };
