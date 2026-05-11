/**
 * ContestZonePage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Main ContestZone listing page (dashboard).
 * Shows Upcoming / Active / Past tabs with contest cards.
 * Features prominent "Create Contest" and "Join by Room ID" action cards
 * visible to ALL users (redirects to login if not authenticated).
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../../components/Icon/Icon.jsx';
import ContestCard from './components/ContestCard.jsx';
import CreateContestModal from './components/CreateContestModal.jsx';
import JoinByInviteModal from './components/JoinByInviteModal.jsx';
import ContestStatsBar from './components/ContestStatsBar.jsx';
import { listContests } from '../../services/contestZone.service.js';
import './ContestZone.css';

const STATUS_TABS = [
  { id: 'all',        label: 'All',      icon: 'list'     },
  { id: 'waiting',    label: 'Waiting',  icon: 'clock'    },
  { id: 'active',     label: 'Live',     icon: 'zap'      },
  { id: 'completed',  label: 'Ended',    icon: 'history'  },
];

const TYPE_FILTERS = ['all', 'public', 'private'];

export default function ContestZonePage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab]     = useState('all');
  const [typeFilter, setTypeFilter]   = useState('all');
  const [contests, setContests]       = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [showInvite, setShowInvite]   = useState(false);

  const fetchContests = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 12 };
      if (activeTab !== 'all') params.status = activeTab;
      if (typeFilter !== 'all') params.type = typeFilter;

      const data = await listContests(params);
      setContests(data?.contests || []);
      setTotal(data?.total || 0);
    } catch (err) {
      console.error('Failed to fetch contests:', err);
      setContests([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, typeFilter, page]);

  useEffect(() => {
    fetchContests();
  }, [fetchContests]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [activeTab, typeFilter]);

  const handleTabChange = (tab) => setActiveTab(tab);
  const handleCreated   = () => { setShowCreate(false); fetchContests(); };
  const handleJoined    = (contest) => { setShowInvite(false); navigate(`/contest-zone/${contest._id}`); };

  const handleCreateClick = () => {
    if (!isAuthenticated) { navigate('/login', { state: { from: '/contest-zone' } }); return; }
    setShowCreate(true);
  };

  const handleInviteClick = () => {
    if (!isAuthenticated) { navigate('/login', { state: { from: '/contest-zone' } }); return; }
    setShowInvite(true);
  };

  // Derive user level for display
  const userLevel = (() => {
    if (!user) return null;
    const solved = user.stats?.totalSolved ?? 0;
    if (user.role === 'admin' || user.role === 'moderator') return 'advanced';
    if (solved >= 50) return 'advanced';
    if (solved >= 15) return 'intermediate';
    return 'beginner';
  })();

  // Count by status for tab badges
  const counts = contests.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="cv-cz-layout">
      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="cv-cz-hero">
        <div>
          <div className="cv-cz-hero-badge">
            <span className="cv-pulse-dot" />
            ContestZone
          </div>
          <h1 className="cv-cz-hero-title">
            Compete. Code. <span>Conquer.</span>
          </h1>
          <p className="cv-cz-hero-sub">
            Join live coding contests, climb the leaderboard, and earn rewards.
          </p>
        </div>

        {/* Hero quick-access buttons — visible to everyone */}
        <div className="cv-cz-hero-actions">
          <button
            className="cv-btn cv-btn-ghost cv-cz-invite-btn"
            onClick={() => navigate('/contest-zone/history')}
            title="View your contest history"
          >
            <Icon name="history" size={14} />
            My History
          </button>
        </div>
      </div>

      {/* ── Action Cards — always visible ─────────────────────────────── */}
      <div className="cv-cz-action-row">
        {/* Create Contest Card */}
        <div className="cv-glass cv-cz-action-card cv-cz-action-card--create" onClick={handleCreateClick}>
          <div className="cv-cz-action-card__icon">🏆</div>
          <div className="cv-cz-action-card__body">
            <div className="cv-cz-action-card__title">Create a Contest</div>
            <div className="cv-cz-action-card__desc">
              Host your own coding contest — public or private. Set the rules, invite friends, and compete!
            </div>
            <div className="cv-cz-action-card__badges">
              <span className="cv-cz-action-badge cv-cz-action-badge--public">
                🔓 Public
                <span className="cv-cz-action-badge__hint">Advanced users only</span>
              </span>
              <span className="cv-cz-action-badge cv-cz-action-badge--private">
                🔒 Private
                <span className="cv-cz-action-badge__hint">All eligible users</span>
              </span>
            </div>
          </div>
          <button className="cv-btn cv-btn-primary cv-cz-action-card__btn">
            <Icon name="plus" size={14} />
            Create Contest
          </button>
        </div>

        {/* Join by Room ID Card */}
        <div className="cv-glass cv-cz-action-card cv-cz-action-card--join" onClick={handleInviteClick}>
          <div className="cv-cz-action-card__icon">🔑</div>
          <div className="cv-cz-action-card__body">
            <div className="cv-cz-action-card__title">Join by Room ID</div>
            <div className="cv-cz-action-card__desc">
              Have an invite code? Enter it to join a private contest room instantly.
            </div>
          </div>
          <button className="cv-btn cv-btn-ghost cv-cz-action-card__btn" style={{ borderColor: 'var(--teal-border)' }}>
            <Icon name="share" size={14} />
            Enter Code
          </button>
        </div>
      </div>

      {/* ── User level info (when authenticated) ─────────────────────── */}
      {isAuthenticated && userLevel && (
        <div className="cv-cz-level-bar">
          <div className="cv-cz-level-bar__left">
            <span style={{ fontSize: 14 }}>
              {userLevel === 'advanced' ? '⭐' : userLevel === 'intermediate' ? '🔵' : '🟢'}
            </span>
            <span>
              Your level: <strong style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>{userLevel}</strong>
            </span>
          </div>
          <div className="cv-cz-level-bar__right">
            {userLevel === 'advanced' ? (
              <span style={{ color: 'var(--easy)' }}>✓ You can create public & private contests</span>
            ) : (
              <span style={{ color: 'var(--text-dim)' }}>
                You can create private contests · Solve {userLevel === 'beginner' ? '50' : (50 - (user.stats?.totalSolved || 0))} more to unlock public
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Stats bar ────────────────────────────────────────────────── */}
      <ContestStatsBar contests={contests} total={total} />

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="cv-cz-filters">
        {/* Status tabs */}
        <div className="cv-tab-bar cv-cz-tab-bar">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.id}
              className={`cv-tab-btn${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <Icon name={tab.icon} size={13} />
              {tab.label}
              {tab.id !== 'all' && counts[tab.id] > 0 && (
                <span className="cv-tab-count">{counts[tab.id]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Type filter chips */}
        <div className="cv-cz-type-chips">
          {TYPE_FILTERS.map(t => (
            <button
              key={t}
              className={`cv-chip${typeFilter === t ? ' active' : ''}`}
              onClick={() => setTypeFilter(t)}
            >
              {t === 'all' ? '🌐 All' : t === 'public' ? '🔓 Public' : '🔒 Private'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contest grid ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="cv-cz-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="cv-skel cv-cz-card-skel" />
          ))}
        </div>
      ) : contests.length === 0 ? (
        <div className="cv-empty-state anim-fade-up">
          <span className="cv-empty-icon">🏆</span>
          <div className="cv-empty-title">No contests found</div>
          <div className="cv-empty-sub">
            {activeTab === 'active'
              ? 'No live contests right now. Check back soon!'
              : 'Be the first to create a contest!'}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              className="cv-btn cv-btn-primary"
              onClick={handleCreateClick}
            >
              <Icon name="plus" size={13} /> Create Contest
            </button>
            <button
              className="cv-btn cv-btn-ghost"
              onClick={handleInviteClick}
            >
              <Icon name="share" size={13} /> Join by Room ID
            </button>
          </div>
        </div>
      ) : (
        <div className="cv-cz-grid">
          {contests.map((contest, i) => (
            <ContestCard
              key={contest._id}
              contest={contest}
              onRefresh={fetchContests}
              style={{ animationDelay: `${i * 0.05}s` }}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {total > 12 && (
        <div className="cv-pagination">
          <button
            className="cv-btn cv-btn-ghost cv-btn-sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <Icon name="chevronLeft" size={13} /> Prev
          </button>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Page {page} of {Math.ceil(total / 12)}
          </span>
          <button
            className="cv-btn cv-btn-ghost cv-btn-sm"
            disabled={page >= Math.ceil(total / 12)}
            onClick={() => setPage(p => p + 1)}
          >
            Next <Icon name="chevronRight" size={13} />
          </button>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {showCreate && (
        <CreateContestModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          userLevel={userLevel}
        />
      )}
      {showInvite && (
        <JoinByInviteModal
          onClose={() => setShowInvite(false)}
          onJoined={handleJoined}
        />
      )}
    </div>
  );
}
