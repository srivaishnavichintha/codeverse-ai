/**
 * contestZone.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All API calls for the ContestZone module.
 * Uses the existing `api` axios instance from apiClient.js — no new axios setup.
 *
 * Base route: /api/contest-zone
 */

import { api } from './apiClient.js';

const BASE = '/contest-zone';

// ─── Response unwrapper ───────────────────────────────────────────────────────
// Strips { success, data } wrapper that the backend always returns.
function unwrap(res) {
  return res?.data?.data ?? res?.data ?? res;
}

// ─── Contest CRUD ─────────────────────────────────────────────────────────────

/** List contests with optional filters: type, status, page, limit */
export async function listContests(params = {}) {
  const res = await api.get(BASE, { params });
  return unwrap(res); // { contests, total, page, pages }
}

/** Get single contest details (includes problems if active/completed) */
export async function getContest(contestId) {
  const res = await api.get(`${BASE}/${contestId}`);
  return unwrap(res); // { contest, problems, isParticipant, myRank }
}

/**
 * Create a new contest.
 * @param {object} payload – { title, description, type, difficulty, problemCount,
 *                             minParticipants, maxParticipants, entryFee, durationMinutes }
 */
export async function createContest(payload) {
  const res = await api.post(BASE, payload);
  return unwrap(res); // { contest, inviteLink }
}

/** Cancel a contest (creator or admin only) */
export async function cancelContest(contestId) {
  const res = await api.delete(`${BASE}/${contestId}`);
  return unwrap(res);
}

// ─── Participation ────────────────────────────────────────────────────────────

/** Join a contest by ID */
export async function joinContest(contestId) {
  const res = await api.post(`${BASE}/${contestId}/join`);
  return unwrap(res);
}

/** Leave a contest */
export async function leaveContest(contestId) {
  const res = await api.post(`${BASE}/${contestId}/leave`);
  return unwrap(res);
}

/** Join a private contest using invite code */
export async function joinByInvite(inviteCode) {
  const res = await api.post(`${BASE}/invite/${inviteCode}`);
  return unwrap(res);
}

/** Start a contest (creator triggers the starting countdown) */
export async function startContest(contestId) {
  const res = await api.post(`${BASE}/${contestId}/start`);
  return unwrap(res);
}

// ─── Submissions ──────────────────────────────────────────────────────────────

/**
 * Submit a solution in a contest.
 * @param {string} contestId
 * @param {object} payload – { problemId, code, language }
 */
export async function submitSolution(contestId, payload) {
  const res = await api.post(`${BASE}/${contestId}/submit`, payload);
  return unwrap(res);
}

/** Get the current user's submissions in a contest */
export async function getMySubmissions(contestId) {
  const res = await api.get(`${BASE}/${contestId}/my-submissions`);
  return unwrap(res);
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

/** Get the leaderboard for a contest */
export async function getLeaderboard(contestId) {
  const res = await api.get(`${BASE}/${contestId}/leaderboard`);
  return unwrap(res); // { contestId, leaderboard: [...] }
}

// ─── History ─────────────────────────────────────────────────────────────────

/** Get the current user's contest participation history */
export async function getContestHistory(params = {}) {
  const res = await api.get(`${BASE}/user/history`, { params });
  return unwrap(res);
}

// ─── Reward logs ─────────────────────────────────────────────────────────────

/** Get reward distribution logs for a completed contest */
export async function getRewardLogs(contestId) {
  const res = await api.get(`${BASE}/${contestId}/rewards`);
  return unwrap(res);
}

// ─── Admin controls ───────────────────────────────────────────────────────────

export async function forceCompleteContest(contestId) {
  const res = await api.post(`${BASE}/${contestId}/force-complete`);
  return unwrap(res);
}

export async function invalidateContest(contestId, reason) {
  const res = await api.post(`${BASE}/${contestId}/invalidate`, { reason });
  return unwrap(res);
}
