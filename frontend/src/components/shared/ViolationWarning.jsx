import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInterview } from '../../context/InterviewContext'
import './ViolationWarning.css'

export default function ViolationWarning() {
  const { showViolationWarning, violationMessage, violations, dismissWarning, terminated } = useInterview()

  // Prevent ANY key from closing the dialog or doing anything while warning is up
  useEffect(() => {
    if (!showViolationWarning) return

    const blockAll = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }

    // Block keyboard entirely while warning is visible
    window.addEventListener('keydown', blockAll, true)
    window.addEventListener('keyup', blockAll, true)
    window.addEventListener('keypress', blockAll, true)

    return () => {
      window.removeEventListener('keydown', blockAll, true)
      window.removeEventListener('keyup', blockAll, true)
      window.removeEventListener('keypress', blockAll, true)
    }
  }, [showViolationWarning])

  // The ONLY way to dismiss is clicking the button — this is a real user gesture
  // so requestFullscreen() will actually work
  const handleResume = async () => {
    try {
      // Must be called inside a click handler (user gesture) for browsers to allow it
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // Some browsers may deny even on click (e.g. certain iframe contexts) — still dismiss
    }
    dismissWarning()
  }

  const remaining = 3 - violations

  return (
    <AnimatePresence>
      {showViolationWarning && (
        <motion.div
          className="violation-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          // Block clicks from passing through to the interview behind
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            className="violation-popup"
            initial={{ opacity: 0, scale: 0.92, y: -24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -12 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Header */}
            <div className="vp-header">
              <div className="vp-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <div className="vp-title">Security Violation Detected</div>
                <div className="vp-subtitle">{violationMessage}</div>
              </div>
            </div>

            {/* Violation counters */}
            <div className="vp-count-info">
              <div className="vp-count-item">
                <span
                  className="vp-count-num"
                  style={{ color: violations >= 2 ? '#0f766e' : '#14b8a6' }}
                >
                  {violations}
                </span>
                <span className="vp-count-label">Violations</span>
              </div>
              <div className="vp-divider" />
              <div className="vp-count-item">
                <span
                  className="vp-count-num"
                  style={{ color: remaining <= 1 ? '#0f766e' : '#14b8a6' }}
                >
                  {remaining}
                </span>
                <span className="vp-count-label">Remaining</span>
              </div>
              <div className="vp-divider" />
              <div className="vp-count-item">
                <span className="vp-count-num" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  Manual
                </span>
                <span className="vp-count-label">Dismiss Only</span>
              </div>
            </div>

            {/* Severity escalation */}
            {violations === 1 && (
              <div className="vp-severity-block warn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>First violation. You have 2 chances remaining.</span>
              </div>
            )}
            {violations === 2 && (
              <div className="vp-severity-block danger">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span>⚠ Final warning — one more violation will immediately terminate this interview.</span>
              </div>
            )}

            {/* Violation pip track */}
            <div className="vp-pip-track">
              {[0, 1, 2].map(i => (
                <div key={i} className={`vp-pip ${i < violations ? 'filled' : ''} ${i === violations - 1 ? 'latest' : ''}`} />
              ))}
            </div>

            {/* What happened explanation */}
            <div className="vp-rule-reminder">
              <div className="vp-rule-title">Interview rules require:</div>
              <ul className="vp-rule-list">
                <li>Stay in fullscreen at all times</li>
                <li>Do not switch tabs or windows</li>
                <li>Do not open DevTools</li>
                <li>Do not copy or paste text</li>
              </ul>
            </div>

            {/* Fullscreen restore notice */}
            <div className="vp-fs-notice">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
              </svg>
              Clicking the button below will re-enter fullscreen and resume your session.
            </div>

            {/* THE ONLY DISMISS — requires genuine click */}
            <button className="vp-dismiss" onClick={handleResume}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
              </svg>
              I Understand — Re-enter Fullscreen &amp; Resume
            </button>

            <p className="vp-no-auto-dismiss">
              This dialog will not close automatically. You must click the button above.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
