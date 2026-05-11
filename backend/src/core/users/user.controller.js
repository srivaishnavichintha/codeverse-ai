const userService = require('./user.service');
const { parsePagination, paginatedResponse, successResponse } = require('../../utils/pagination');

async function register(req, res) {
  const user = await userService.register(req.body);
  successResponse(res, user, 201);
}

async function login(req, res) {
  const result = await userService.login(req.body);
  successResponse(res, result);
}

async function refreshToken(req, res) {
  const result = await userService.refresh(req.body.refreshToken);
  successResponse(res, result);
}

async function logout(req, res) {
  await userService.logout(req.body.refreshToken);
  successResponse(res, { message: 'Logged out successfully' });
}

async function getMe(req, res) {
  const user = await userService.getProfile(req.user.id);
  successResponse(res, user);
}

async function getProfile(req, res) {
  const user = await userService.getProfile(req.params.userId);
  successResponse(res, user);
}

async function updateProfile(req, res) {
  const updated = await userService.updateProfile(req.user.id, req.body);
  successResponse(res, updated);
}

async function getStats(req, res) {
  const userId = req.params.userId || req.user.id;
  const stats  = await userService.getStats(userId);
  successResponse(res, stats);
}

async function getSolvedProblems(req, res) {
  const userId = req.params.userId || req.user.id;
  const pg = parsePagination(req.query);
  const { rows, total } = await userService.getSolvedProblems(userId, pg);
  paginatedResponse(res, { data: rows, total, ...pg });
}

async function getActivity(req, res) {
  const userId = req.params.userId || req.user.id;
  const days   = parseInt(req.query.days || '365');
  const data   = await userService.getActivity(userId, days);
  successResponse(res, data);
}

async function getLeaderboard(req, res) {
  const pg = parsePagination(req.query);
  const { rows, total } = await userService.getLeaderboard(pg);
  paginatedResponse(res, { data: rows, total, ...pg });
}

module.exports = {
  register, login, refreshToken, logout,
  getMe, getProfile, updateProfile,
  getStats, getSolvedProblems, getActivity, getLeaderboard,
};
