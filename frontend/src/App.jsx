/**
 * App.jsx  (or main.jsx)
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows the correct provider nesting order.
 * Apply to your existing App.jsx / main.jsx entry point.
 *
 * Changes:
 *   1. Added <SignInModalProvider> wrapping everything
 *   2. Added <SignInModal /> inside the router (needs useNavigate)
 *   3. AuthProvider stays outermost (so SignInModal can read auth state)
 */

import { BrowserRouter } from 'react-router-dom';
import { AuthProvider }        from './context/AuthContext.jsx';
import { SignInModalProvider } from './context/SignInModalContext.jsx';
import SignInModal             from './components/auth/SignInModal.jsx';
import AppRoutes               from './routes/AppRoutes.jsx';


export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SignInModalProvider>
          {/* Global modal — rendered once, shown on demand */}
          <SignInModal />
          <AppRoutes />
        </SignInModalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
