import { useEffect, useState, useMemo } from "react";
import {
  INITIAL_SENT_INVITES, INITIAL_RECEIVED_INVITES,
  getAvatarColor, CHALLENGE_PROBLEMS,
} from "../../data/peerContestsData.js";
import Icon from "../../components/Icon/Icon.jsx";
import "./PeerChallenge.css";
import { useAuth } from "../../context/AuthContext.jsx";
import { api } from "../../services/apiClient.js";

export default function PeerChallengePage() {
  const { user } = useAuth();
  
  const [showInvites, setShowInvites] = useState(false);
  const [sentInvites, setSentInvites] = useState(INITIAL_SENT_INVITES);
  const [receivedInvites, setReceivedInvites] = useState(INITIAL_RECEIVED_INVITES);
  const [challenged, setChallenged] = useState(null);
  const [inMatch, setInMatch] = useState(false);
  const [matchProgress, setMatchProgress] = useState(0);
  const [showWinner, setShowWinner] = useState(false);
  const [winner, setWinner] = useState(null);
  
  const [leaderboard, setLeaderboard] = useState([]);
  const [peers, setPeers] = useState([]);
  const [myStats, setMyStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [lbRes, statsRes, incomingRes, outgoingRes] = await Promise.all([
        api.get("/users/leaderboard?limit=20"),
        api.get("/users/me/stats"),
        api.get("/peers/incoming"),
        api.get("/peers/outgoing")
      ]);

      const lbData = lbRes.data?.data?.users || [];
      const statsData = statsRes.data?.data || {};

      const mappedLeaderboard = lbData.map(u => ({
        id: u._id,
        rank: u.rank,
        username: u.username,
        name: u.displayName || u.username,
        avatar: u.avatar || u.username.slice(0, 2).toUpperCase(),
        level: u.level || 1,
        problemsSolved: u.stats?.totalSolved || 0,
        points: u.rating || 0,
        accuracy: u.stats?.totalSubmissions ? Math.round((u.stats.totalSolved / u.stats.totalSubmissions) * 100) : 0,
        contestWins: u.contestWins || 0,
        streak: u.streak || 0,
        status: ["online", "offline", "in-contest"][Math.floor(Math.random() * 3)],
      }));

      setLeaderboard(mappedLeaderboard);
      setPeers(mappedLeaderboard.filter(u => u.username !== user.username));
      setMyStats(statsData.peerStats);

      // Map incoming invites
      const incoming = (incomingRes.data?.challenges || []).map(inv => ({
        id: inv._id,
        from: {
          id: inv.challenger._id,
          username: inv.challenger.username,
          name: inv.challenger.username,
          avatar: inv.challenger.username.slice(0, 2).toUpperCase(),
          level: inv.challenger.level || 1,
          status: "online"
        },
        problem: inv.problemTitle,
        status: inv.status,
        sentAt: new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        scheduledAt: inv.scheduledAt,
        expiresAt: inv.expiresAt
      }));

      // Map outgoing invites
      const outgoing = (outgoingRes.data?.challenges || []).map(inv => ({
        id: inv._id,
        to: {
          id: inv.opponent._id,
          username: inv.opponent.username,
          name: inv.opponent.username,
          avatar: inv.opponent.username.slice(0, 2).toUpperCase(),
        },
        problem: inv.problemTitle,
        status: inv.status,
        sentAt: new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        scheduledAt: inv.scheduledAt,
        expiresAt: inv.expiresAt
      }));

      setReceivedInvites(incoming);
      setSentInvites(outgoing);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [visible, setVisible] = useState([]);
  useEffect(() => {
    if (peers.length > 0) {
      peers.forEach((_, i) => {
        setTimeout(() => setVisible((v) => [...new Set([...v, i])]), i * 80);
      });
    }
  }, [peers]);

  const pendingReceived = receivedInvites.filter((i) => i.status === "pending").length;

  const [challengeTarget, setChallengeTarget] = useState(null);

  const handleChallengeClick = (peer) => {
    setChallengeTarget(peer);
  };

  const submitChallenge = async (e) => {
    e.preventDefault();
    if (!challengeTarget) return;

    const formData = new FormData(e.target);
    const scheduledAtValue = formData.get('scheduledAt');
    const scheduledAt = new Date(scheduledAtValue).toISOString();
    const durationMinutes = parseInt(formData.get('durationMinutes') || '30', 10);
    const numberOfProblems = parseInt(formData.get('numberOfProblems') || '1', 10);

    try {
      await api.post('/peers/challenge', {
        opponentId: challengeTarget.id,
        scheduledAt,
        durationMinutes,
        numberOfProblems
      });
      // Show brief notification
      const el = document.createElement("div");
      el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--primary-teal);color:#fff;padding:12px 24px;border-radius:12px;font-size:14px;z-index:9999;animation:fadeUp 0.3s ease;box-shadow:0 10px 25px rgba(0,0,0,0.5);`;
      el.textContent = `Challenge sent to ${challengeTarget.name}!`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3000);

      // Refresh data
      setChallengeTarget(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to send challenge");
    }
  };

  const handleAccept = async (id) => {
    try {
      await api.post(`/peers/${id}/respond`, { action: 'accept' });
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to accept challenge");
    }
  };

  const handleDecline = async (id) => {
    try {
      await api.post(`/peers/${id}/respond`, { action: 'reject' });
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to decline challenge");
    }
  };

  const winRate = (myStats?.contestsParticipated > 0) ? Math.round((myStats.contestWins / myStats.contestsParticipated) * 100) : 0;

  if (loading || !user || !myStats) {
    return <div style={{ padding: 40, color: "var(--text-faint)" }}>Loading Arena...</div>;
  }

  const currentUserData = {
    username: user.username,
    name: user.displayName || user.username,
    avatar: user.avatar || user.username.slice(0, 2).toUpperCase(),
    level: myStats.level || 1,
    streak: myStats.streak || 0,
    problemsSolved: user.stats?.totalSolved || 0,
    contestWins: myStats.contestWins || 0,
    contestsParticipated: myStats.contestsParticipated || 0,
    rank: user.rating || 0,
    points: user.rating || 0,
    nextLevelPoints: (myStats.level || 1) * 1000,
  };

  return (
    <div className="cv-peer-layout">
      {/* Match overlay */}
      {inMatch && challenged && (
        <MatchOverlay peer={challenged} progress={matchProgress} currentUserData={currentUserData} />
      )}

      {/* Winner */}
      {showWinner && (
        <WinnerScreen peer={winner} onClose={() => { setShowWinner(false); setWinner(null); }} />
      )}

      {/* Invitation panel */}
      {showInvites && (
        <InvitationPanel
          onClose={() => setShowInvites(false)}
          sentInvites={sentInvites}
          receivedInvites={receivedInvites}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />
      )}

      {/* Hero */}
      <div className="cv-peer-hero">
        <div>
          <div className="cv-page-title">Peer <span>Challenge</span></div>
          <div className="cv-page-desc">
            Challenge coders at your level · Climb the leaderboard · Prove your skills
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <button
            className={`cv-invite-trigger${pendingReceived > 0 ? " has-pending" : ""}`}
            onClick={() => setShowInvites(true)}
          >
            <Icon name="inbox" size={14} />
            Challenge Inbox
          </button>
          {pendingReceived > 0 && (
            <span className="cv-notif-badge">{pendingReceived}</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="cv-stat-grid">
        {[
          { label: "Win Rate", value: `${winRate}%`, cls: "gold", emoji: "🏆" },
          { label: "Current Streak", value: `${currentUserData.streak}d`, cls: "rose", emoji: "🔥" },
          { label: "Problems Solved", value: currentUserData.problemsSolved, cls: "teal", emoji: "🎯" },
          { label: "Contest Wins", value: currentUserData.contestWins, cls: "purple", emoji: "⭐" },
        ].map((s, i) => (
          <div key={s.label} className="cv-glass cv-stat-card anim-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
            <div className={`cv-stat-icon ${s.cls}`}>{s.emoji}</div>
            <div>
              <div className="cv-stat-value">{s.value}</div>
              <div className="cv-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="cv-two-col">
        {/* Peers list */}
        <div>
          <div className="cv-section-header" style={{ marginBottom: 18 }}>
            <div>
              <div className="cv-section-title">Peers at Your Level</div>
              <div className="cv-section-sub">Matched within ±2 levels of you</div>
            </div>
            <span className="cv-chip active">Level {currentUserData.level} ±2</span>
          </div>

          <div className="cv-peer-list">
            {peers.map((peer, i) => (
              <div
                key={peer.id}
                className="cv-glass cv-peer-card"
                style={{
                  opacity: visible.includes(i) ? 1 : 0,
                  transform: visible.includes(i) ? "none" : "translateX(-10px)",
                  transition: `all 0.4s ease ${i * 80}ms`,
                }}
              >
                <div className="cv-peer-avatar-wrap">
                  <div className={`cv-avatar cv-avatar-lg ${getAvatarColor(peer.id)}`}>
                    {peer.avatar}
                  </div>
                  <span className={`cv-peer-status-dot ${peer.status}`} />
                </div>

                <div className="cv-peer-info">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div className="cv-peer-name">{peer.name}</div>
                    <span style={{ fontSize: 11, color: "var(--secondary-teal)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                      Lv.{peer.level}
                    </span>
                    <span className={`cv-status-chip ${peer.status}`}>
                      {peer.status === "online" ? "● Online" : peer.status === "in-contest" ? "🏆 In Contest" : "○ Offline"}
                    </span>
                  </div>
                  <div className="cv-peer-username">@{peer.username}</div>
                  <div className="cv-peer-stats">
                    <span className="cv-peer-stat">🎯 {peer.accuracy}%</span>
                    <span className="cv-peer-stat">📈 {peer.problemsSolved}</span>
                    <span className="cv-peer-stat">🏆 {peer.contestWins} wins</span>
                    <span className="cv-peer-stat">⚡ {peer.streak}d</span>
                  </div>
                </div>

                <button
                  className={`cv-btn${peer.status === "offline" || inMatch ? "" : " cv-btn-primary"} cv-btn-sm`}
                  onClick={() => handleChallengeClick(peer)}
                  disabled={inMatch || peer.status === "offline"}
                  style={{ flexShrink: 0 }}
                >
                  <Icon name="swords" size={12} />
                  {peer.status === "offline" ? "Offline" : "Challenge"}
                </button>
              </div>
            ))}
            {peers.length === 0 && (
              <div style={{ color: "var(--text-faint)", padding: 20 }}>No peers found on the leaderboard.</div>
            )}
          </div>
          
          {/* Challenge Modal */}
          {challengeTarget && (
            <div className="cv-invite-overlay" onClick={() => setChallengeTarget(null)}>
              <div className="cv-glass cv-invite-panel" style={{ padding: '24px', maxWidth: '400px', margin: 'auto' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "var(--text-primary)" }}>
                    Challenge {challengeTarget.name}
                  </div>
                  <button className="cv-iconbtn" onClick={() => setChallengeTarget(null)}>
                    <Icon name="close" size={15} />
                  </button>
                </div>
                <form onSubmit={submitChallenge}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>Schedule Time</label>
                    <input 
                      type="datetime-local" 
                      name="scheduledAt" 
                      required
                      defaultValue={new Date(Date.now() + 5 * 60000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16)}
                      min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'var(--dark-bg-3)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>Duration (minutes)</label>
                    <input 
                      type="number" 
                      name="durationMinutes" 
                      required
                      defaultValue={30}
                      min={5}
                      max={180}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'var(--dark-bg-3)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>Number of Problems</label>
                    <input 
                      type="number" 
                      name="numberOfProblems" 
                      required
                      defaultValue={1}
                      min={1}
                      max={5}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'var(--dark-bg-3)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                  <button type="submit" className="cv-btn cv-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    Send Challenge
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Leaderboard */}
          <div>
            <div className="cv-section-header" style={{ marginBottom: 12 }}>
              <div className="cv-section-title">Leaderboard</div>
            </div>
            <div className="cv-glass cv-lb-card">
              <div className="cv-lb-header">
                <Icon name="crown" size={15} color="#fbbf24" />
                <span className="cv-lb-header-title">Top Performers</span>
              </div>
              {leaderboard.map((u, i) => (
                <div
                  key={u.rank}
                  className={`cv-lb-row${u.username === currentUserData.username ? " me" : ""}`}
                >
                  <div className={`cv-lb-rank ${i === 0 ? "r1" : i === 1 ? "r2" : i === 2 ? "r3" : "rn"}`}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : u.rank}
                  </div>
                  <div className={`cv-avatar cv-avatar-sm ${getAvatarColor(u.username)}`} style={{ borderRadius: "50%" }}>
                    {u.avatar}
                  </div>
                  <div className="cv-lb-info">
                    <div className={`cv-lb-name${u.username === currentUserData.username ? " me" : ""}`}>
                      {u.name.split(" ")[0]}
                      {u.username === currentUserData.username && (
                        <span style={{ color: "var(--text-faint)", fontWeight: 400, fontSize: 11, marginLeft: 4 }}>(you)</span>
                      )}
                    </div>
                    <div className="cv-lb-detail">{u.problemsSolved} solved · Lv.{u.level}</div>
                  </div>
                  <div className="cv-lb-pts">{u.points.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Battle stats */}
          <div className="cv-battle-card">
            <div className="cv-battle-title">⚔️ Your Battle Stats</div>
            {[
              { label: "Win Rate", value: `${winRate}%` },
              { label: "Avg Score", value: "9.8 pts" },
              { label: "Best Streak", value: `${currentUserData.streak} wins`, gold: true },
              { label: "Peer Rank", value: `#${currentUserData.rank}` },
              { label: "Total Battles", value: currentUserData.contestsParticipated },
            ].map((row) => (
              <div key={row.label} className="cv-battle-row">
                <span className="cv-battle-label">{row.label}</span>
                <span className={`cv-battle-val${row.gold ? " gold" : ""}`}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Profile mini */}
          <div className="cv-glass cv-profile-mini">
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div className={`cv-avatar cv-avatar-lg cv-avatar-teal`}>{currentUserData.avatar}</div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
                  {currentUserData.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                  @{currentUserData.username}
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className="cv-rank-badge">🥇 {currentUserData.rank}</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              <span>Level Progress</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--secondary-teal)" }}>
                {currentUserData.points} / {currentUserData.nextLevelPoints}
              </span>
            </div>
            <div className="cv-progress-track">
              <div
                className="cv-progress-fill"
                style={{ width: `${Math.min((currentUserData.points / currentUserData.nextLevelPoints) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Match Overlay ──
function MatchOverlay({ peer, progress, currentUserData }) {
  return (
    <div className="cv-match-overlay">
      <div className="cv-match-card">
        <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)", marginBottom: 20, letterSpacing: 1 }}>
          MATCH IN PROGRESS
        </div>
        <div className="cv-match-combatants">
          <div className="cv-combatant">
            <div className="cv-avatar cv-avatar-xl cv-avatar-teal float-anim">{currentUserData.avatar}</div>
            <div className="cv-combatant-name">{currentUserData.name.split(" ")[0]}</div>
            <div style={{ fontSize: 11, color: "var(--secondary-teal)" }}>Lv.{currentUserData.level}</div>
          </div>
          <div className="cv-vs-ring">⚔️</div>
          <div className="cv-combatant">
            <div className={`cv-avatar cv-avatar-xl ${getAvatarColor(peer.id)} float-anim`} style={{ animationDelay: "0.7s" }}>
              {peer.avatar}
            </div>
            <div className="cv-combatant-name">{peer.name.split(" ")[0]}</div>
            <div style={{ fontSize: 11, color: "var(--hard)" }}>Lv.{peer.level}</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
          Solving the same problem simultaneously…
        </div>
        <div className="cv-progress-track" style={{ marginBottom: 8 }}>
          <div className="cv-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>{Math.round(progress)}%</span>
          <span style={{ color: "var(--text-faint)" }}>Judging...</span>
        </div>
      </div>
    </div>
  );
}

// ── Winner Screen ──
function WinnerScreen({ peer, onClose }) {
  const pieces = Array.from({ length: 22 }, (_, i) => ({
    color: ["#0d9488", "#06b6d4", "#f59e0b", "#8b5cf6", "#f43f5e", "#10b981"][i % 6],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 2}s`,
  }));

  return (
    <div className="cv-match-overlay" onClick={onClose}>
      <div className="cv-match-card cv-winner-card" onClick={(e) => e.stopPropagation()}>
        {pieces.map((p, i) => (
          <div
            key={i}
            className="cv-confetti-piece"
            style={{ background: p.color, left: p.left, animationDelay: p.delay, animationDuration: p.duration }}
          />
        ))}
        <span className="cv-winner-emoji">🏆</span>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: "var(--text-primary)", marginBottom: 8 }}>
          Victory!
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
          You defeated {peer?.name}!
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 }}>
          {[{ v: "+50", l: "XP" }, { v: "+1", l: "Win" }, { v: "🔥", l: "Streak" }].map((s, i) => (
            <div
              key={s.v}
              style={{
                background: "var(--teal-soft)", border: "1px solid var(--teal-border)",
                borderRadius: 12, padding: "10px 16px", textAlign: "center",
                animation: `fadeUp 0.4s ${i * 0.1}s ease both`,
              }}
            >
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "var(--gold)" }}>{s.v}</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <button className="cv-btn cv-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={onClose}>
          Continue →
        </button>
      </div>
    </div>
  );
}

// ── Invitation Panel ──
function InvitationPanel({ onClose, sentInvites, receivedInvites, onAccept, onDecline }) {
  const [activeTab, setActiveTab] = useState("received");
  const pendingReceived = receivedInvites.filter((i) => i.status === "pending").length;

  return (
    <div className="cv-invite-overlay" onClick={onClose}>
      <div className="cv-invite-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cv-invite-panel-header">
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "var(--text-primary)" }}>
              Challenge Inbox
            </div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 3 }}>
              {pendingReceived > 0 ? `${pendingReceived} pending invite${pendingReceived > 1 ? "s" : ""} awaiting` : "All caught up!"}
            </div>
          </div>
          <button className="cv-iconbtn" onClick={onClose}>
            <Icon name="close" size={15} />
          </button>
        </div>

        <div className="cv-invite-panel-tabs">
          <button
            className={`cv-invite-tab${activeTab === "received" ? " active" : ""}`}
            onClick={() => setActiveTab("received")}
          >
            <Icon name="inbox" size={12} />
            Received
            <span className="cv-invite-tab-count">{receivedInvites.length}</span>
          </button>
          <button
            className={`cv-invite-tab${activeTab === "sent" ? " active" : ""}`}
            onClick={() => setActiveTab("sent")}
          >
            <Icon name="send" size={12} />
            Sent
            <span className="cv-invite-tab-count">{sentInvites.length}</span>
          </button>
        </div>

        <div className="cv-invite-list">
          {activeTab === "received" && (
            receivedInvites.length === 0 ? (
              <div className="cv-invite-empty">
                <span className="cv-invite-empty-icon">📭</span>
                <div className="cv-invite-empty-title">No invitations yet</div>
                <div className="cv-invite-empty-sub">When peers challenge you, they'll appear here</div>
              </div>
            ) : receivedInvites.map((inv, i) => (
              <div key={inv.id} className={`cv-invite-item ${inv.status}`} style={{ animationDelay: `${i * 60}ms` }}>
                <div className="cv-invite-item-header">
                  <div className="cv-peer-avatar-wrap">
                    <div className={`cv-avatar cv-avatar-lg ${getAvatarColor(inv.from.id)}`}>{inv.from.avatar}</div>
                    <span className={`cv-peer-status-dot ${inv.from.status}`} />
                  </div>
                  <div className="cv-invite-item-info">
                    <div className="cv-invite-item-name">{inv.from.name}</div>
                    <div className="cv-invite-item-username">@{inv.from.username} · Lv.{inv.from.level}</div>
                  </div>
                </div>
                <div className="cv-invite-problem">
                  <Icon name="code" size={11} color="var(--secondary-teal)" />
                  {inv.problem}
                </div>
                <div className="cv-invite-footer">
                  <span className="cv-invite-time">⏱ {inv.sentAt}</span>
                  {inv.status === "pending" ? (
                    new Date() > new Date(inv.scheduledAt) || new Date() > new Date(inv.expiresAt) ? (
                      <span className="cv-invite-status-badge expired">
                        Expired
                      </span>
                    ) : (
                      <div className="cv-invite-actions">
                        <button className="cv-btn cv-btn-sm" style={{ background: "var(--easy)", border: "none", color: "#fff" }} onClick={() => onAccept(inv.id)}>
                          <Icon name="check" size={11} /> Accept
                        </button>
                        <button className="cv-btn cv-btn-ghost cv-btn-sm" onClick={() => onDecline(inv.id)}>
                          <Icon name="x" size={11} /> Decline
                        </button>
                      </div>
                    )
                  ) : (
                    <span className={`cv-invite-status-badge ${inv.status}`}>
                      {inv.status === "accepted" ? "✓ Accepted" : "✗ Declined"}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}

          {activeTab === "sent" && (
            sentInvites.length === 0 ? (
              <div className="cv-invite-empty">
                <span className="cv-invite-empty-icon">📤</span>
                <div className="cv-invite-empty-title">No sent challenges</div>
                <div className="cv-invite-empty-sub">Challenge a peer from the list</div>
              </div>
            ) : sentInvites.map((inv, i) => (
              <div key={inv.id} className={`cv-invite-item ${inv.status}`} style={{ animationDelay: `${i * 60}ms` }}>
                <div className="cv-invite-item-header">
                  <div className={`cv-avatar cv-avatar-lg ${getAvatarColor(inv.to.id)}`}>{inv.to.avatar}</div>
                  <div className="cv-invite-item-info">
                    <div className="cv-invite-item-name">{inv.to.name}</div>
                    <div className="cv-invite-item-username">@{inv.to.username}</div>
                  </div>
                  <span className={`cv-invite-status-badge ${inv.status}`}>
                    {inv.status === "accepted" 
                      ? "✓ Accepted" 
                      : inv.status === "pending" 
                        ? (new Date() > new Date(inv.scheduledAt) || new Date() > new Date(inv.expiresAt) ? "Expired" : "⏳ Pending") 
                        : "✗ Rejected"}
                  </span>
                </div>
                <div className="cv-invite-problem">
                  <Icon name="code" size={11} color="var(--secondary-teal)" />
                  {inv.problem}
                </div>
                <div className="cv-invite-footer">
                  <span className="cv-invite-time">Sent {inv.sentAt}</span>
                  {inv.status === "accepted" && (
                    <button className="cv-btn cv-btn-primary cv-btn-sm">
                      <Icon name="zap" size={11} /> Play Now
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
