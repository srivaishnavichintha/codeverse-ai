/**
 * ContestDetailPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contest detail / waiting room / live arena page.
 * Route: /contest-zone/:contestId
 *
 * Full lifecycle support:
 *   WAITING → FILLING → STARTING (15s countdown) → ACTIVE (arena) → COMPLETED
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../../components/Icon/Icon.jsx';
import ContestTimer from './components/ContestTimer.jsx';
import ContestLeaderboard from './components/ContestLeaderboard.jsx';
import ContestArena from './components/ContestArena.jsx';
import ContestRewards from './components/ContestRewards.jsx';
import useContestSocket from '../../hooks/useContestSocket.js';
import {
  getContest,
  joinContest,
  leaveContest,
  cancelContest,
  startContest,
} from '../../services/contestZone.service.js';
import './ContestZone.css';

const DIFF_CLASS = { easy: 'cv-badge-easy', medium: 'cv-badge-medium', hard: 'cv-badge-hard' };

export default function ContestDetailPage() {
  const { contestId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [contest, setContest]       = useState(null);
  const [problems, setProblems]     = useState([]);
  const [isParticipant, setIsParticipant] = useState(false);
  const [myRank, setMyRank]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]           = useState('');
  const [activeTab, setActiveTab]   = useState('overview');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [startingCountdown, setStartingCountdown] = useState(null);
  const prevStatusRef = useRef(null);

  // Socket integration — connects when user is a participant
  const socket = useContestSocket(isParticipant ? contestId : null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getContest(contestId);
      setContest(data.contest);
      setProblems(data.problems || []);
      setIsParticipant(data.isParticipant);
      setMyRank(data.myRank);
    } catch (err) {
      setError(err.response?.data?.message || 'Contest not found');
    } finally {
      setLoading(false);
    }
  }, [contestId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // Sync socket state back into local contest state
  useEffect(() => {
    if (socket.contestState) {
      const newStatus = socket.contestState.status;
      setContest(prev => prev ? {
        ...prev,
        status: newStatus,
        currentParticipants: socket.contestState.participants ?? prev.currentParticipants,
        startedAt: socket.contestState.startedAt || prev.startedAt,
        scheduledStartAt: socket.contestState.scheduledStartAt || prev.scheduledStartAt,
      } : prev);

      // Auto-switch to arena when contest becomes active
      if (newStatus === 'active' && prevStatusRef.current !== 'active') {
        setActiveTab('arena');
        // Re-fetch to get problems
        fetchDetail();
      }

      // Handle starting countdown
      if (newStatus === 'starting' && socket.contestState.scheduledStartAt) {
        const ms = new Date(socket.contestState.scheduledStartAt).getTime() - Date.now();
        setStartingCountdown(Math.max(0, Math.ceil(ms / 1000)));
      }

      prevStatusRef.current = newStatus;
    }
  }, [socket.contestState, fetchDetail]);

  // Starting countdown timer (15 second countdown to ACTIVE)
  useEffect(() => {
    if (startingCountdown === null || startingCountdown <= 0) return;
    const timer = setInterval(() => {
      setStartingCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [startingCountdown]);

  const handleJoin = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setActionLoading(true);
    setError('');
    try {
      await joinContest(contestId);
      setIsParticipant(true);
      await fetchDetail();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('Leave this contest? Your entry fee will be refunded.')) return;
    setActionLoading(true);
    try {
      await leaveContest(contestId);
      setIsParticipant(false);
      await fetchDetail();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to leave');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async () => {
    if (!window.confirm('Start this contest now? The 15-second countdown will begin.')) return;
    setActionLoading(true);
    setError('');
    try {
      await startContest(contestId);
      await fetchDetail();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this contest? All coins will be refunded.')) return;
    setActionLoading(true);
    try {
      await cancelContest(contestId);
      navigate('/contest-zone');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel');
      setActionLoading(false);
    }
  };

  const copyInvite = () => {
    const url = `${window.location.origin}/contest-zone/join/${contest?.inviteCode}`;
    navigator.clipboard.writeText(url);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  if (loading) return (
    <div className="cv-cz-layout">
      <div className="cv-skel" style={{ height: 220, borderRadius: 16, marginBottom: 24 }} />
      <div className="cv-cz-grid" style={{ gridTemplateColumns: '1fr 320px' }}>
        <div className="cv-skel" style={{ height: 400, borderRadius: 16 }} />
        <div className="cv-skel" style={{ height: 400, borderRadius: 16 }} />
      </div>
    </div>
  );

  if (error && !contest) return (
    <div className="cv-cz-layout">
      <div className="cv-empty-state">
        <span className="cv-empty-icon">⚠️</span>
        <div className="cv-empty-title">{error}</div>
        <button className="cv-btn cv-btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/contest-zone')}>
          Back to Contests
        </button>
      </div>
    </div>
  );

  const isLive      = contest?.status === 'active';
  const isStarting  = contest?.status === 'starting';
  const isCompleted = ['completed', 'cancelled', 'expired', 'refunded'].includes(contest?.status);
  const isWaiting   = ['waiting', 'filling'].includes(contest?.status);
  const canJoin     = isWaiting && isAuthenticated && !isParticipant;
  const isCreator   = contest?.createdBy?._id === user?._id || contest?.createdBy === user?._id;
  const participantCount = socket.participants || contest?.currentParticipants || 0;
  const hasMinParticipants = participantCount >= (contest?.minParticipants || 2);

  // Show arena tab when active, starting, or completed
  const showArenaTab = isLive || isStarting || isCompleted;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'target' },
    ...(showArenaTab ? [{ id: 'arena', label: isLive ? '🔥 Arena' : isStarting ? '⏳ Arena' : 'Problems', icon: 'code' }] : []),
    { id: 'leaderboard', label: 'Leaderboard', icon: 'trophy' },
    ...(isCompleted ? [{ id: 'rewards', label: 'Rewards', icon: 'star' }] : []),
  ];

  return (
    <div className="cv-cz-layout">
      {/* ── Starting Overlay ─────────────────────────────────────── */}
      {isStarting && startingCountdown !== null && startingCountdown > 0 && (
        <div className="cv-cz-starting-overlay">
          <div className="cv-cz-starting-overlay__content">
            <div className="cv-cz-starting-overlay__icon">🚀</div>
            <div className="cv-cz-starting-overlay__title">Contest Starting!</div>
            <div className="cv-cz-starting-overlay__countdown">{startingCountdown}</div>
            <div className="cv-cz-starting-overlay__sub">
              Get ready... problems are being generated
            </div>
          </div>
        </div>
      )}

      {/* ── Hero banner ─────────────────────────────────────────────── */}
      <div className={`cv-glass cv-cz-detail-hero${isLive ? ' cv-cz-detail-hero--live' : ''}${isStarting ? ' cv-cz-detail-hero--starting' : ''}`}>
        <div className="cv-cz-detail-hero__left">
          <div className="cv-cz-detail-hero__badges">
            <span className={`cv-badge ${DIFF_CLASS[contest?.difficulty] || 'cv-badge-medium'}`}>
              {contest?.difficulty}
            </span>
            <span className="cv-chip">
              {contest?.type === 'private' ? '🔒 Private' : '🔓 Public'}
            </span>
            {isLive && (
              <span className="cv-chip" style={{ color: 'var(--easy)', borderColor: 'var(--easy)' }}>
                <span className="cv-pulse-dot" style={{ width: 6, height: 6 }} /> LIVE
              </span>
            )}
            {isStarting && (
              <span className="cv-chip" style={{ color: 'var(--gold)', borderColor: 'var(--gold)' }}>
                ⚡ STARTING
              </span>
            )}
            {isCompleted && (
              <span className="cv-chip" style={{ color: 'var(--text-dim)' }}>
                ✅ {contest?.status?.toUpperCase()}
              </span>
            )}
          </div>
          <h1 className="cv-cz-detail-hero__title">{contest?.title}</h1>
          {contest?.description && (
            <p className="cv-cz-detail-hero__desc">{contest.description}</p>
          )}
          <div className="cv-cz-detail-hero__meta">
            <span><Icon name="users" size={13} /> {participantCount}/{contest?.maxParticipants} participants</span>
            <span><Icon name="code" size={13} /> {contest?.problemCount} problems</span>
            <span><Icon name="clock" size={13} /> {contest?.durationMinutes}m</span>
            {contest?.entryFee > 0 && <span>💎 {contest?.entryFee} coins entry</span>}
            {contest?.prizePool > 0 && <span>🏆 {contest?.prizePool} coins prize pool</span>}
          </div>
        </div>

        <div className="cv-cz-detail-hero__right">
          {/* Live timer — shows during active contest */}
          {isLive && contest?.startedAt && (
            <ContestTimer
              startedAt={contest.startedAt}
              durationMinutes={contest.durationMinutes}
              remainingMs={socket.remainingMs}
              onExpired={fetchDetail}
            />
          )}

          {/* Scheduled start time for waiting room */}
          {isWaiting && contest?.scheduledStartAt && (
            <div className="cv-cz-scheduled-box">
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                ⏰ Scheduled Start
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--light-teal)' }}>
                {new Date(contest.scheduledStartAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
          )}

          {/* Participant waiting room */}
          {(isWaiting || isStarting) && (
            <div className="cv-cz-waitroom">
              <div className="cv-cz-waitroom__count">
                {participantCount}/{contest?.maxParticipants}
              </div>
              <div className="cv-cz-waitroom__label">participants joined</div>
              <div className="cv-progress-track" style={{ marginTop: 10 }}>
                <div
                  className="cv-progress-fill"
                  style={{ width: `${(participantCount / contest?.maxParticipants) * 100}%` }}
                />
              </div>
              <div style={{ fontSize: 11, color: hasMinParticipants ? 'var(--easy)' : 'var(--text-dim)', marginTop: 6 }}>
                {hasMinParticipants
                  ? '✓ Minimum met — ready to start!'
                  : `Need ${contest?.minParticipants} min to start`}
              </div>
            </div>
          )}

          {/* My rank in completed */}
          {isCompleted && myRank && (
            <div className="cv-cz-my-rank">
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Your Final Rank</div>
              <div className="cv-cz-my-rank__value">#{myRank}</div>
            </div>
          )}

          {/* Action buttons */}
          <div className="cv-cz-detail-hero__actions">
            {error && <div className="cv-cz-modal-error">{error}</div>}

            {/* Join button */}
            {canJoin && (
              <button
                className="cv-btn cv-btn-primary"
                style={{ width: '100%' }}
                onClick={handleJoin}
                disabled={actionLoading}
              >
                <Icon name="zap" size={14} />
                {actionLoading ? 'Joining…' : `Join Contest${contest?.entryFee ? ` (${contest.entryFee} coins)` : ' (Free)'}`}
              </button>
            )}

            {/* START CONTEST — creator can trigger when min participants met */}
            {isCreator && isWaiting && hasMinParticipants && (
              <button
                className="cv-btn cv-cz-start-btn"
                style={{ width: '100%' }}
                onClick={handleStart}
                disabled={actionLoading}
              >
                <Icon name="play" size={14} />
                {actionLoading ? 'Starting…' : '🚀 Start Contest Now'}
              </button>
            )}

            {/* Enter Arena — for participants when contest is live */}
            {isParticipant && isLive && activeTab !== 'arena' && (
              <button
                className="cv-btn cv-btn-primary"
                style={{ width: '100%' }}
                onClick={() => setActiveTab('arena')}
              >
                <Icon name="play" size={14} /> Enter Arena
              </button>
            )}

            {/* Leave button */}
            {isParticipant && isWaiting && (
              <button
                className="cv-btn cv-btn-ghost"
                style={{ width: '100%' }}
                onClick={handleLeave}
                disabled={actionLoading}
              >
                {actionLoading ? 'Leaving…' : 'Leave Contest'}
              </button>
            )}

            {/* Cancel button (creator only) */}
            {isCreator && isWaiting && (
              <button
                className="cv-btn cv-btn-ghost"
                style={{ width: '100%', color: 'var(--rose)', borderColor: 'var(--rose)' }}
                onClick={handleCancel}
                disabled={actionLoading}
              >
                Cancel Contest
              </button>
            )}

            {/* Share invite code */}
            {contest?.type === 'private' && isParticipant && contest?.inviteCode && (
              <button
                className="cv-btn cv-btn-ghost"
                style={{ width: '100%', fontSize: 12 }}
                onClick={copyInvite}
              >
                <Icon name="share" size={12} />
                {inviteCopied ? '✓ Copied!' : `Share: ${contest.inviteCode}`}
              </button>
            )}

            {/* Socket connection indicator */}
            {isParticipant && (isWaiting || isLive || isStarting) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: socket.isConnected ? 'var(--easy)' : 'var(--rose)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: socket.isConnected ? 'var(--easy)' : 'var(--rose)' }} />
                {socket.isConnected ? 'Connected' : 'Reconnecting…'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div className="cv-tab-bar cv-cz-detail-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`cv-tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon name={tab.icon} size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}
      <div className="cv-cz-detail-content">
        {activeTab === 'overview' && (
          <ContestOverview
            contest={contest}
            problems={problems}
            isCompleted={isCompleted}
            isCreator={isCreator}
            user={user}
          />
        )}
        {activeTab === 'arena' && (
          <ContestArena
            contest={contest}
            problems={problems}
            isParticipant={isParticipant}
            socket={socket}
            onSubmitted={fetchDetail}
          />
        )}
        {activeTab === 'leaderboard' && (
          <ContestLeaderboard
            contestId={contestId}
            socket={socket}
            currentUserId={user?._id}
          />
        )}
        {activeTab === 'rewards' && (
          <ContestRewards contestId={contestId} />
        )}
      </div>
    </div>
  );
}

// ── Overview sub-component ────────────────────────────────────────────────────
function ContestOverview({ contest, problems, isCompleted, isCreator, user }) {
  return (
    <div className="cv-cz-overview">
      <div className="cv-cz-overview__main">
        {/* Problem list (visible when active/completed) */}
        {problems.length > 0 && (
          <div className="cv-glass cv-cz-section">
            <div className="cv-section-header">
              <h3 className="cv-section-title"><Icon name="code" size={16} /> Problems</h3>
            </div>
            <div className="cv-cz-problem-list">
              {problems.map((p, i) => (
                <div key={p._id} className="cv-cz-problem-item">
                  <span className="cv-cz-problem-num">#{i + 1}</span>
                  <div>
                    <div className="cv-cz-problem-title">{p.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{p.maxPoints || p.points} pts</div>
                  </div>
                  <span className={`cv-badge ${p.difficulty === 'easy' ? 'cv-badge-easy' : p.difficulty === 'hard' ? 'cv-badge-hard' : 'cv-badge-medium'}`}>
                    {p.difficulty}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Waiting info — show when no problems yet */}
        {problems.length === 0 && !isCompleted && (
          <div className="cv-glass cv-cz-section" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 8 }}>
              Waiting for Contest to Start
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
              Problems will be AI-generated when the contest begins.
              The creator can start the contest once the minimum number of participants have joined.
            </p>
          </div>
        )}

        {/* Contest info */}
        <div className="cv-glass cv-cz-section">
          <div className="cv-section-header">
            <h3 className="cv-section-title"><Icon name="target" size={16} /> Details</h3>
          </div>
          <div className="cv-cz-detail-grid">
            <div className="cv-cz-detail-item">
              <span className="cv-cz-detail-label">Status</span>
              <span className="cv-cz-detail-val" style={{ textTransform: 'capitalize' }}>{contest?.status}</span>
            </div>
            <div className="cv-cz-detail-item">
              <span className="cv-cz-detail-label">Created by</span>
              <span className="cv-cz-detail-val">{contest?.createdBy?.username || 'Unknown'}</span>
            </div>
            <div className="cv-cz-detail-item">
              <span className="cv-cz-detail-label">Duration</span>
              <span className="cv-cz-detail-val">{contest?.durationMinutes} minutes</span>
            </div>
            <div className="cv-cz-detail-item">
              <span className="cv-cz-detail-label">Difficulty</span>
              <span className="cv-cz-detail-val" style={{ textTransform: 'capitalize' }}>{contest?.difficulty}</span>
            </div>
            {contest?.scheduledStartAt && (
              <div className="cv-cz-detail-item">
                <span className="cv-cz-detail-label">Scheduled</span>
                <span className="cv-cz-detail-val">{new Date(contest.scheduledStartAt).toLocaleString()}</span>
              </div>
            )}
            {contest?.startedAt && (
              <div className="cv-cz-detail-item">
                <span className="cv-cz-detail-label">Started</span>
                <span className="cv-cz-detail-val">{new Date(contest.startedAt).toLocaleString()}</span>
              </div>
            )}
            {contest?.endedAt && (
              <div className="cv-cz-detail-item">
                <span className="cv-cz-detail-label">Ended</span>
                <span className="cv-cz-detail-val">{new Date(contest.endedAt).toLocaleString()}</span>
              </div>
            )}
            <div className="cv-cz-detail-item">
              <span className="cv-cz-detail-label">Platform Fee</span>
              <span className="cv-cz-detail-val">{contest?.platformFeePercent || 10}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
