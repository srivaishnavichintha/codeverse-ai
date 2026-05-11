import { Link } from "react-router-dom";
import "./NotFound.css";

export default function NotFoundPage() {
  return (
    <div className="cv-404-page">
      <div className="cv-404-bg" aria-hidden="true">
        <span className="cv-404-orb cv-404-orb-1" />
        <span className="cv-404-orb cv-404-orb-2" />
      </div>

      <div className="cv-404-content anim-fade-up">
        <div className="cv-404-code">
          <span className="cv-404-digit">4</span>
          <span className="cv-404-zero">
            <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="32" fill="none" stroke="var(--primary-teal)" strokeWidth="6" />
              <circle cx="40" cy="40" r="16" fill="none" stroke="var(--secondary-teal)" strokeWidth="3" opacity="0.5" />
              <circle cx="40" cy="40" r="5" fill="var(--light-teal)" />
            </svg>
          </span>
          <span className="cv-404-digit">4</span>
        </div>

        <div className="cv-404-glitch" data-text="Page Not Found">
          Page Not Found
        </div>

        <p className="cv-404-desc">
          Looks like this URL got lost in recursion. The page you're looking for doesn't exist
          or may have been moved.
        </p>

        <div className="cv-404-code-block">
          <span className="cv-404-comment">{"// Error trace"}</span>
          <br />
          <span className="cv-404-keyword">throw new</span>{" "}
          <span className="cv-404-fn">NotFoundError</span>
          <span className="cv-404-paren">(</span>
          <span className="cv-404-str">"route: {window.location.pathname}"</span>
          <span className="cv-404-paren">)</span>
          <span className="cv-404-semi">;</span>
        </div>

        <div className="cv-404-actions">
          <Link to="/problems" className="cv-btn cv-btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9,22 9,12 15,12 15,22" />
            </svg>
            Back to Problems
          </Link>
          <button
            className="cv-btn cv-btn-ghost"
            onClick={() => window.history.back()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Go Back
          </button>
        </div>

        <div className="cv-404-suggestions">
          <div className="cv-404-sug-label">Quick links:</div>
          <div className="cv-404-sug-links">
            {[
              { to: "/problems", label: "Problems" },
              { to: "/discussions", label: "Discussions" },
              { to: "/peer-challenge", label: "Peer Challenge" },
              { to: "/contests", label: "Contests" },
            ].map((l) => (
              <Link key={l.to} to={l.to} className="cv-404-sug-link">
                {l.label} →
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
