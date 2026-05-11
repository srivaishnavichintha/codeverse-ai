/**
 * useContestSocket.js
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook for real-time contest updates via Socket.IO.
 *
 * Usage:
 *   const socket = useContestSocket(contestId);
 *   // socket.contestState, socket.participants, socket.leaderboard,
 *   // socket.remainingMs, socket.lastSubmissionResult, socket.isConnected,
 *   // socket.requestLeaderboard()
 *
 * Pass `null` to disconnect (e.g. when user is not a participant).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
  || import.meta.env.VITE_API_URL?.replace('/api', '')
  || 'http://localhost:5000';

export default function useContestSocket(contestId) {
  const [isConnected, setIsConnected]             = useState(false);
  const [contestState, setContestState]           = useState(null);
  const [participants, setParticipants]           = useState(0);
  const [leaderboard, setLeaderboard]             = useState([]);
  const [remainingMs, setRemainingMs]             = useState(null);
  const [lastSubmissionResult, setLastSubmissionResult] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!contestId) {
      // Disconnect if no contestId
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Get auth token
    const token = localStorage.getItem('auth_token');

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    // ── Connection lifecycle ──────────────────────────
    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('contest:join', { contestId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('[ContestSocket] Connection error:', err.message);
      setIsConnected(false);
    });

    // ── Contest state (sent on join) ──────────────────
    socket.on('contest:state', (data) => {
      setContestState(data);
      setParticipants(data.participants || 0);
      if (data.leaderboard) setLeaderboard(data.leaderboard);
    });

    // ── Participant events ───────────────────────────
    socket.on('contest:participant:joined', (data) => {
      setParticipants(data.participants || data.participantCount || 0);
    });

    socket.on('contest:participant:left', (data) => {
      setParticipants(data.participants || data.participantCount || 0);
    });

    // ── Leaderboard updates ──────────────────────────
    socket.on('contest:leaderboard:data', (data) => {
      if (data.leaderboard) setLeaderboard(data.leaderboard);
    });

    // ── Countdown / timer sync ───────────────────────
    socket.on('contest:countdown:data', (data) => {
      if (data.remainingMs !== undefined && data.remainingMs !== null) {
        setRemainingMs(data.remainingMs);
      }
    });

    // ── Submission results (personal) ────────────────
    socket.on('contest:submission:result', (data) => {
      setLastSubmissionResult(data);
    });

    // ── Contest status transitions ────────────────────
    socket.on('contest:starting', (data) => {
      setContestState(prev => prev
        ? { ...prev, status: 'starting', scheduledStartAt: data.scheduledStartAt, ...data }
        : { status: 'starting', ...data });
    });

    socket.on('contest:active', (data) => {
      setContestState(prev => prev
        ? { ...prev, status: 'active', startedAt: data.startedAt, endsAt: data.endsAt, ...data }
        : { status: 'active', ...data });
    });

    // Legacy alias (some backends may emit 'started' instead of 'active')
    socket.on('contest:started', (data) => {
      setContestState(prev => prev ? { ...prev, status: 'active', ...data } : data);
    });

    socket.on('contest:completed', (data) => {
      setContestState(prev => prev ? { ...prev, status: 'completed', ...data } : data);
    });

    socket.on('contest:expired', () => {
      setContestState(prev => prev ? { ...prev, status: 'expired' } : prev);
    });

    // ── Errors ───────────────────────────────────────
    socket.on('contest:error', (data) => {
      console.warn('[ContestSocket] Error:', data.message);
    });

    // ── Cleanup ──────────────────────────────────────
    return () => {
      socket.emit('contest:leave', { contestId });
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [contestId]);

  // Request leaderboard refresh
  const requestLeaderboard = useCallback(() => {
    if (socketRef.current?.connected && contestId) {
      socketRef.current.emit('contest:leaderboard:request', { contestId });
    }
  }, [contestId]);

  return {
    isConnected,
    contestState,
    participants,
    leaderboard,
    remainingMs,
    lastSubmissionResult,
    requestLeaderboard,
  };
}
