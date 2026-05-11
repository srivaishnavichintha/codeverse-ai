import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/apiClient.js";
import Icon from "../../components/Icon/Icon.jsx";
import "./Leaderboard.css";

export default function LeaderboardPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await api.get("/users/leaderboard?limit=100");
        if (res.data && res.data.success) {
          setUsers(res.data.data.users);
        }
      } catch (err) {
        console.error("Failed to fetch leaderboard", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="cv-page cv-leaderboard-page">
      <div className="cv-container">
        <div className="cv-header-bar">
          <h1 className="cv-title">
            <Icon name="award" size={24} style={{ color: "var(--primary)" }} />
            Global Leaderboard
          </h1>
          <p style={{ color: "var(--text-faint)" }}>
            Top ranked developers based on rating, battle wins, and problem solving.
          </p>
        </div>

        {loading ? (
          <div className="cv-skel" style={{ height: 400 }} />
        ) : (
          <div className="cv-table-wrapper cv-glass">
            <table className="cv-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Rank</th>
                  <th>Developer</th>
                  <th style={{ textAlign: "right" }}>Rating</th>
                  <th style={{ textAlign: "center" }}>Level</th>
                  <th style={{ textAlign: "center" }}>Wins</th>
                  <th style={{ textAlign: "center" }}>Losses</th>
                  <th style={{ textAlign: "center" }}>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const wins = u.wins || u.contestWins || 0;
                  const losses = u.losses || 0;
                  const total = wins + losses;
                  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
                  
                  return (
                    <tr key={u._id} className="anim-fade-up" style={{ animationDelay: `${i * 20}ms` }}>
                      <td style={{ fontWeight: 600, color: i < 3 ? "var(--primary)" : "inherit" }}>
                        #{i + 1}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div className="cv-avatar-sm">
                            {u.avatar ? (
                              <img src={u.avatar} alt="avatar" />
                            ) : (
                              <span style={{ fontSize: 11 }}>
                                {(u.displayName || u.username).slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{u.displayName || u.username}</div>
                            <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                              @{u.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: "var(--primary-teal)" }}>
                        {u.rating}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="cv-level-badge">Lvl {u.level || 1}</span>
                      </td>
                      <td style={{ textAlign: "center", color: "var(--easy)" }}>{wins}</td>
                      <td style={{ textAlign: "center", color: "var(--hard)" }}>{losses}</td>
                      <td style={{ textAlign: "center" }}>
                        {total > 0 ? (
                           <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                             <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                               <div style={{ width: `${winRate}%`, height: "100%", background: winRate > 50 ? "var(--easy)" : "var(--primary-orange)" }} />
                             </div>
                             <span style={{ fontSize: 12, width: 32 }}>{winRate}%</span>
                           </div>
                        ) : (
                          <span style={{ color: "var(--text-faint)", fontSize: 12 }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: 40, color: "var(--text-faint)" }}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
