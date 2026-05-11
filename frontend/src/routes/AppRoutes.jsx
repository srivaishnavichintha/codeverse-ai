/**
 * AppRoutes.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from original:
 *   1. Added <ProtectedRoute> wrapper for routes that require login
 *      (contests, peer-challenge).
 *   2. Problem pages (/problems/:slug) remain PUBLIC — guests can read the
 *      problem statement. The editor/submit controls are locked at the
 *      component level (SolvePage renders <LockedEditor> for guests).
 *   3. /login and /register redirect to /problems if user is already logged in.
 *   4. All "guest-ok" routes stay accessible without auth.
 *   5. Added ContestZone routes: /contest-zone, /contest-zone/:contestId,
 *      /contest-zone/history, /contest-zone/join/:inviteCode
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

import MainLayout       from '../layouts/MainLayout.jsx';
import ProblemsPage     from '../pages/Problems/ProblemsPage.jsx';
import SolvePage        from '../pages/Solve/SolvePage.jsx';
import PeerChallengePage from '../pages/PeerChallenge/PeerChallengePage.jsx';
import BattlegroundPage from '../pages/Battleground/BattlegroundPage.jsx';
import NotFoundPage     from '../pages/NotFound/NotFoundPage.jsx';
import InterviewPage    from '../pages/Interview/InterviewPage.jsx';
import AuthPage         from '../pages/Auth/AuthPage.jsx';
import DiscussionDetailPage from '../pages/Discussions/DiscussionDetailPage.jsx';
import DiscussionsPage from '../pages/Discussions/DiscussionsPage.jsx';
import LeaderboardPage from '../pages/Leaderboard/LeaderboardPage.jsx';

// ── Contest Zone pages ────────────────────────────────────────
import ContestZonePage    from '../pages/ContestZone/ContestZonePage.jsx';
import ContestDetailPage  from '../pages/ContestZone/ContestDetailPage.jsx';
import ContestHistoryPage from '../pages/ContestZone/ContestHistoryPage.jsx';

/**
 * ProtectedRoute
 * Redirects to /login if the user is not authenticated.
 * Passes `from` in location state so AuthPage can redirect back after login.
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null; // or a spinner

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  }

  return children;
}

/**
 * GuestOnlyRoute
 * Redirects logged-in users away from /login and /register.
 */
function GuestOnlyRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null;

  if (isAuthenticated) {
    return <Navigate to="/problems" replace />;
  }

  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/problems" replace />} />

      {/* Auth pages — redirect to /problems if already logged in */}
      <Route path="/login"    element={<GuestOnlyRoute><AuthPage /></GuestOnlyRoute>} />
      <Route path="/register" element={<GuestOnlyRoute><AuthPage /></GuestOnlyRoute>} />

      {/* ── Main layout (Navbar included) ────────────────────────────── */}
      <Route element={<MainLayout />}>

        {/* PUBLIC — guests can browse and read */}
        <Route path="/discussions"    element={<DiscussionsPage />} />
        <Route path="/problems"       element={<ProblemsPage />} />
        <Route path="/leaderboard"    element={<LeaderboardPage />} />
        <Route path="/problems/:slug" element={<SolvePage />} />
        <Route
          path="/discussions/:discussionId"
          element={<DiscussionDetailPage />}
        />

        {/* ── Contest Zone ───────────────────────────────────────────── */}
        <Route path="/contest-zone" element={<ContestZonePage />} />
        <Route path="/contest-zone/:contestId" element={<ContestDetailPage />} />
        <Route
          path="/contest-zone/history"
          element={
            <ProtectedRoute>
              <ContestHistoryPage />
            </ProtectedRoute>
          }
        />
        {/* Invite code join — redirect to the contest page after joining */}
        <Route
          path="/contest-zone/join/:inviteCode"
          element={
            <ProtectedRoute>
              <ContestDetailPage />
            </ProtectedRoute>
          }
        />

        {/* PROTECTED — must be logged in */}
        <Route
          path="/peer-challenge"
          element={
            <ProtectedRoute>
              <PeerChallengePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/battleground"
          element={
            <ProtectedRoute>
              <BattlegroundPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Interview — full-screen, own layout, protected */}
      <Route
        path="/interview"
        element={
          <ProtectedRoute>
            <InterviewPage />
          </ProtectedRoute>
        }
      />
      

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
