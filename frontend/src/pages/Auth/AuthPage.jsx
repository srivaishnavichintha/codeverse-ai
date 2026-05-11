import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import "./Auth.css";

export default function AuthPage() {
  const [mode, setMode]         = useState("login");
  const [email, setEmail]       = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const { login, register }     = useAuth();
  const navigate                = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(username, email, password);
      }
      navigate("/problems");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/problems" className="auth-brand">
          <span className="auth-logo">{"<>"}</span>
          <span>Code<b>Verse</b></span>
        </Link>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => { setMode("login"); setError(""); }}>Sign In</button>
          <button className={`auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => { setMode("register"); setError(""); }}>Register</button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <div className="auth-field">
              <label>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="your_username" required minLength={3} maxLength={30} />
            </div>
          )}
          <div className="auth-field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required minLength={6} />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-submit cv-btn cv-btn-primary" disabled={loading}>
            {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="auth-footer">
          {mode === "login"
            ? <>No account? <button className="auth-link" onClick={() => setMode("register")}>Register</button></>
            : <>Have an account? <button className="auth-link" onClick={() => setMode("login")}>Sign in</button></>}
        </p>
      </div>
    </div>
  );
}
