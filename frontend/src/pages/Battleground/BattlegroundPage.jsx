import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { api } from "../../services/apiClient.js";
import Icon from "../../components/Icon/Icon.jsx";
import "./Contests.css";



function formatContestDate(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatContestTime(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function Countdown({ target }) {
  const calcTime = () => {
    const diff = Math.max(0, new Date(target) - Date.now());
    return {
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff % 86400000) / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
    };
  };
  const [t, setT] = useState(calcTime);

  useEffect(() => {
    const interval = setInterval(() => setT(calcTime()), 1000);
    return () => clearInterval(interval);
  });

  if (t.d + t.h + t.m + t.s === 0)
    return <span style={{ color: "var(--easy)", fontWeight: 700 }}>Starting Soon</span>;

  return (
    <div className="cv-countdown">
      {t.d > 0 && (
        <>
          <div className="cv-countdown-unit">
            <span className="cv-countdown-value">{String(t.d).padStart(2, "0")}</span>
            <span className="cv-countdown-label">days</span>
          </div>
          <span className="cv-countdown-sep">:</span>
        </>
      )}
      <div className="cv-countdown-unit">
        <span className="cv-countdown-value">{String(t.h).padStart(2, "0")}</span>
        <span className="cv-countdown-label">hrs</span>
      </div>
      <span className="cv-countdown-sep">:</span>
      <div className="cv-countdown-unit">
        <span className="cv-countdown-value">{String(t.m).padStart(2, "0")}</span>
        <span className="cv-countdown-label">min</span>
      </div>
      <span className="cv-countdown-sep">:</span>
      <div className="cv-countdown-unit">
        <span className="cv-countdown-value">{String(t.s).padStart(2, "0")}</span>
        <span className="cv-countdown-label">sec</span>
      </div>
    </div>
  );
}

function ContestCard({ contest, currentUsername }) {
  const isOngoing = contest.status === "ongoing";
  const isUpcoming = contest.status === "upcoming";
  const isPast = contest.status === "past";

  const statusDotClass = isOngoing ? "live" : isUpcoming ? "upcoming" : "past";
  const statusLabel = isOngoing ? "LIVE NOW" : isUpcoming ? "UPCOMING" : "ENDED";

  return (
    <div className="cv-glass cv-contest-card anim-fade-up">
      <div className="cv-contest-card-header">
        <div>
          <div className="cv-contest-card-meta">
            <span className={`cv-contest-type-badge ${contest.type}`}>{contest.type}</span>
            <span className="cv-contest-status-dot" style={{}} data-type={statusDotClass} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.2,
                fontFamily: "var(--font-display)",
                color: isOngoing ? "var(--hard)" : isUpcoming ? "var(--medium)" : "var(--text-faint)",
              }}
            >
              {statusLabel}
            </span>
          </div>
          <div className="cv-contest-card-title">{contest.title}</div>
          <div className="cv-contest-desc">{contest.description}</div>
        </div>

        {isUpcoming && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 8 }}>Starts in</div>
            <Countdown target={contest.startTime} />
          </div>
        )}
      </div>

      <div className="cv-contest-info-row">
        <div className="cv-contest-info-item">
          <Icon name="calendar" size={13} color="var(--primary-teal)" />
          <span>{formatContestDate(contest.startTime)} at {formatContestTime(contest.startTime)}</span>
        </div>
        <div className="cv-contest-info-item">
          <Icon name="clock" size={13} color="var(--primary-teal)" />
          <span><strong>{contest.duration}</strong> min</span>
        </div>
        <div className="cv-contest-info-item">
          <Icon name="users" size={13} color="var(--primary-teal)" />
          <span>vs {contest.opponentName}</span>
        </div>
      </div>

      <div className="cv-contest-card-footer">
        <div className="cv-prize-pills">
          <span className="cv-prize-pill">{contest.originalStatus}</span>
        </div>

        <div className="cv-contest-card-actions">
          {isPast && contest.winner && (
            <div className={`cv-past-result ${contest.winner === currentUsername ? "win" : "loss"}`}>
              {contest.winner === currentUsername ? "🏆 Won" : "📉 Lost"}
            </div>
          )}
          {isOngoing ? (
            <button className="cv-btn cv-btn-primary cv-btn-sm">
              <Icon name="zap" size={12} /> Enter Battle
            </button>
          ) : isPast ? (
            <button className="cv-btn cv-btn-sm">
               View Result
            </button>
          ) : (
             <button className="cv-btn cv-btn-sm" disabled>
               Waiting
             </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BattlegroundPage() {
  const [tab, setTab] = useState("ongoing");
  const [challenges, setChallenges] = useState([]);
  const [stats, setStats] = useState({ wins: 0, participated: 0, globalRank: 0, rating: 0, ratingHistory: [] });
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user) return;
    const loadChallenges = async () => {
      try {
        const [incomingRes, outgoingRes, statsRes] = await Promise.all([
          api.get("/peers/incoming"),
          api.get("/peers/outgoing"),
          api.get("/users/me/stats")
        ]);
        
        const allChallenges = [
           ...(incomingRes.data?.challenges || []),
           ...(outgoingRes.data?.challenges || [])
        ];
        
        const mapped = allChallenges.map(c => {
           const isInitiator = c.challenger._id === user._id || c.challenger.username === user.username;
           const opponent = isInitiator ? c.opponent : c.challenger;
           
           let statusTab = "past";
           const now = Date.now();
           const scheduledTime = new Date(c.scheduledAt || c.createdAt).getTime();
           
           if (c.status === "pending" || c.status === "accepted") {
               if (scheduledTime > now) {
                   statusTab = "upcoming";
               } else {
                   // if it's within duration window, it's ongoing, else past
                   const durationMs = (c.durationMinutes || 30) * 60000;
                   if (now <= scheduledTime + durationMs) {
                       statusTab = "ongoing";
                   } else {
                       statusTab = "past";
                   }
               }
           } else if (c.status === "ongoing") {
               statusTab = "ongoing";
           } else {
               statusTab = "past";
           }
           
           return {
              id: c._id,
              status: statusTab,
              originalStatus: c.status,
              title: `1v1 vs ${opponent.username}`,
              description: `Peer Challenge against ${opponent.username}`,
              type: "1v1 Battle",
              opponentName: opponent.username,
              startTime: c.scheduledAt || c.createdAt,
              duration: c.durationMinutes || 30,
              winner: c.winner?.username,
           };
        });
        
        // Deduplicate
        const unique = Array.from(new Map(mapped.map(item => [item.id, item])).values());
        
        setChallenges(unique);
        
        const peerStats = statsRes.data?.data?.peerStats || {};
        setStats({
          wins: peerStats.contestWins || 0,
          participated: peerStats.contestsParticipated || 0,
          globalRank: peerStats.globalRank || user.rank || 0,
          rating: user.rating || 1200,
          ratingHistory: peerStats.ratingHistory || []
        });
      } catch (err) {
        console.error("Failed to load battleground data", err);
      }
    };
    
    loadChallenges();
  }, [user]);

    const filtered = challenges.filter((c) => c.status === tab);
  const upcomingForSidebar = challenges.filter((c) => c.status === "upcoming").slice(0, 3);

  const historyData = stats.ratingHistory && stats.ratingHistory.length > 0
    ? stats.ratingHistory
    : [{ label: "Start", score: 1200, win: true }, { label: "Now", score: stats.rating || 1200, win: true }];

  const maxRating = Math.max(...historyData.map((r) => r.score));
  const minRating = Math.min(...historyData.map((r) => r.score));
  const ratingRange = maxRating - minRating || 1;

  const latestRating = historyData[historyData.length - 1].score;
  const prevRating = historyData.length > 1 ? historyData[historyData.length - 2].score : latestRating;
  const ratingDelta = latestRating - prevRating;

  return (
    <div className="cv-contests-layout">
      {/* Hero */}
      <div className="cv-contests-hero">
        <div>
          <div className="cv-page-title">Battleground <span>Hub</span></div>
          <div className="cv-page-desc">Compete in 1v1 Peer Challenges · Climb the leaderboard</div>
        </div>
        <button className="cv-btn cv-btn-primary" onClick={() => window.location.href = '/peer-challenge'}>
          <Icon name="swords" size={14} /> Find Peers
        </button>
      </div>

      {/* Top stats */}
      <div className="cv-contest-top-stats">
        {[
          { emoji: "🏆", value: stats.wins, label: "Battles Won" },
          { emoji: "📊", value: latestRating, label: "Current Rating" },
          { emoji: "🏅", value: `#${stats.globalRank || '---'}`, label: "Global Rank" },
          { emoji: "⚡", value: stats.participated, label: "Participated" },
        ].map((s, i) => (
          <div
            key={s.label}
            className="cv-glass cv-cstat-card anim-fade-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="cv-cstat-emoji">{s.emoji}</div>
            <div>
              <div className="cv-cstat-value">{s.value}</div>
              <div className="cv-cstat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="cv-contests-main">
        {/* Main contest list */}
        <div>
          <div className="cv-contest-section-tabs">
            {[
              { id: "ongoing", label: "🔴 Live Now" },
              { id: "upcoming", label: "📅 Upcoming" },
              { id: "past", label: "📜 Past" },
            ].map((t) => (
              <button
                key={t.id}
                className={`cv-contest-section-tab${tab === t.id ? " active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    background: "var(--dark-bg-3)",
                    border: "1px solid var(--border-color)",
                    padding: "1px 5px",
                    borderRadius: 5,
                    color: "var(--text-faint)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {challenges.filter((c) => c.status === t.id).length}
                </span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="cv-glass" style={{ padding: "50px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "var(--text-primary)",
                }}
              >
                No {tab} battles
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
                Check back soon for new challenges.
              </div>
            </div>
          ) : (
            <div className="cv-contest-list">
              {filtered.map((c, i) => (
                <div key={c.id} style={{ animationDelay: `${i * 80}ms` }}>
                  <ContestCard contest={c} currentUsername={user?.username} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="cv-contest-sidebar">
          {/* Global rank */}
          <div className="cv-glass cv-rank-card">
            <div
              style={{
                fontSize: 11,
                color: "var(--text-faint)",
                textTransform: "uppercase",
                letterSpacing: 1.2,
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              Your Global Rank
            </div>
            <div className="cv-rank-num">#{stats.globalRank || '---'}</div>
            <div className="cv-rank-label">CodeVerse Leaderboard</div>
            <div className="cv-rank-meta">
              <div><strong>{stats.wins}</strong><br />Wins</div>
              <div><strong>{stats.participated}</strong><br />Battles</div>
            </div>
          </div>

          {/* Rating card */}
          <div className="cv-glass cv-rating-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 6,
              }}
            >
              <div>
                <div className="cv-rating-val">{latestRating}</div>
                <div
                  className={`cv-rating-change${ratingDelta < 0 ? " down" : ""}`}
                >
                  {ratingDelta > 0 ? `▲ +${ratingDelta}` : `▼ ${Math.abs(ratingDelta)}`} from last
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-faint)",
                  textAlign: "right",
                }}
              >
                Rating<br />History
              </div>
            </div>
            <div className="cv-rating-chart">
              {historyData.map((r, i) => {
                const h = Math.max(
                  12,
                  Math.round(((r.score - minRating) / ratingRange) * 64) + 8
                );
                return (
                  <div
                    key={r.label}
                    className={`cv-rating-bar ${r.win ? "win" : "loss"}`}
                    style={{ height: `${h}px` }}
                    title={`${r.label}: ${r.score}`}
                  />
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "var(--text-faint)",
                marginTop: 4,
                fontFamily: "var(--font-mono)",
              }}
            >
              <span>{historyData[0].label}</span>
              <span>{historyData[historyData.length - 1].label}</span>
            </div>
          </div>

          {/* History table */}
          <div className="cv-glass cv-history-card">
            <div
              style={{
                font: "700 13px var(--font-sans)",
                color: "var(--text-primary)",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Icon name="history" size={14} color="var(--primary-teal)" />
              Recent Results
            </div>
            <table className="cv-history-table">
              <thead>
                <tr>
                  <th>Opponent</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {challenges.filter((c) => c.status === "past").slice(0, 5).map((c) => {
                  const isWin = c.winner === user?.username;
                  return (
                  <tr key={c.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                      vs {c.opponentName}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: isWin ? "var(--easy)" : "var(--hard)",
                        }}
                      >
                        {isWin ? "▲ W" : "▼ L"}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </aside>
      </div>
    </div>
  );
}
