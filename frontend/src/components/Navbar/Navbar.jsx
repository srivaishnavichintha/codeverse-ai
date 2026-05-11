import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext.jsx";
import "./Navbar.css";
import { api } from "../../services/apiClient.js";

const NAV_ITEMS = [
  { to: "/problems",       label: "Problems",       icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> },
  { to: "/discussions",    label: "Discussions",    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { to: "/peer-challenge",  label: "Peer Arena",     icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/><path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/></svg> },
  { to: "/battleground",   label: "Battleground",   icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { to: "/interview",      label: "Interview",      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
  { to: "/leaderboard",    label: "Leaderboard",    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
];

const getNotifEmoji = (type) => {
  switch (type) {
    case 'challenge_received':  return '⚡';
    case 'challenge_accepted':  return '⚔️';
    case 'challenge_rejected':  return '❌';
    case 'points_transaction':  return '💎';
    case 'submission_accepted': return '✅';
    default: return '🔔';
  }
};

function getInitials(user) {
  if (!user) return "?";
  const name = user.displayName || user.username || "User";
  return name.slice(0, 2).toUpperCase();
}

function getLevelLabel(user) {
  if (!user) return "";
  const solved = user.stats?.totalSolved ?? 0;
  if (solved >= 50) return "Advanced";
  if (solved >= 15) return "Intermediate";
  return "Beginner";
}

export default function Navbar() {
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [search,      setSearch]      = useState("");
  const [notifications,  setNotifications]  = useState([]);
  const [unreadCount,    setUnreadCount]    = useState(0);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data?.success) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  const handleNotifClick = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next && unreadCount > 0) {
      try {
        await api.put('/notifications/read-all');
        setUnreadCount(0);
        setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      } catch (err) {
        console.error("Failed to mark notifications read", err);
      }
    }
  };

  const handleSearchKey = (e) => {
    if (e.key === "Enter" && search.trim()) {
      navigate(`/problems?search=${encodeURIComponent(search.trim())}`);
      setSearch("");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/problems");
  };

  const displayName = user?.displayName || user?.username || "Guest";
  const initials    = getInitials(user);
  const levelLabel  = getLevelLabel(user);

  return (
    <nav className="navbar">
      <div className="nav-inner">
        {/* Logo */}
        <NavLink to="/problems" className="nav-logo">
          <span className="logo-bracket">&lt;</span>
          <span className="logo-text">Code</span>
          <span className="logo-accent">Verse</span>
          <span className="logo-bracket">/&gt;</span>
        </NavLink>

        {/* Desktop nav links */}
        <ul className="nav-links">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              >
                {({ isActive }) => (
                  <>
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                    {isActive && (
                      <motion.span
                        className="nav-underline"
                        layoutId="nav-underline"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Right side */}
        <div className="nav-right">
          {/* Search */}
          {/* <div className="nav-search-wrap">
            <span className="nav-search-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </span>
            <input
              className="nav-search"
              placeholder="Search problems…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKey}
            />
          </div> */}

          {/* Notification bell */}
          <div className="notif-wrap">
            <button className="notif-btn" onClick={handleNotifClick} aria-label="Notifications">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && <span className="notif-count">{unreadCount}</span>}
            </button>

            <AnimatePresence>
              {notifOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setNotifOpen(false)} />
                  <motion.div
                    className="notif-dropdown"
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="notif-header">
                      <span>Notifications</span>
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: "20px 16px", color: "var(--text-faint)", fontSize: 13, textAlign: "center" }}>
                        No new notifications
                      </div>
                    ) : (
                      notifications.map((n, i) => (
                        <div key={n._id || i} className={`notif-item${n.isRead ? " read" : ""}`}>
                          <span className="notif-icon">{getNotifEmoji(n.type)}</span>
                          <div className="notif-body">
                            <div className="notif-title" style={{ fontWeight: n.isRead ? 500 : 700 }}>{n.title}</div>
                            <div className="notif-msg">{n.message}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* User chip */}
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <NavLink to="/profile" className="nav-user-chip">
                <div className="nav-avatar">{initials}</div>
                <div className="nav-user-info">
                  <span className="nav-user-name">{displayName.split(" ")[0]}</span>
                  <span className="nav-user-level">{levelLabel}</span>
                </div>
              </NavLink>
              <button className="btn-ghost-icon" onClick={handleLogout} title="Sign out" aria-label="Sign out">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          ) : (
            <button className="btn-primary" onClick={() => navigate("/login")}>Sign In</button>
          )}

          {/* Mobile toggle */}
          <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
            {mobileOpen
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
            }
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => "mobile-link" + (isActive ? " active" : "")}
                onClick={() => setMobileOpen(false)}
              >
                <span className="mobile-link-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
            {user && (
              <button
                className="mobile-link"
                onClick={() => { handleLogout(); setMobileOpen(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "var(--rose)" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign Out
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
