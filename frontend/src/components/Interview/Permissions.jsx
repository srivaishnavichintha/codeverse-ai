import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInterview } from '../../context/InterviewContext'
import './Permissions.css'

const rules = [
  'Fullscreen mode is mandatory throughout the interview',
  'Tab switching will be detected and penalized',
  'Copy, paste, and right-click are disabled',
  'Voice answers are required for follow-up questions',
  'Maximum 3 violations before automatic termination',
  'Screen recording will be active during the session',
  'DevTools access is monitored and restricted',
]

const checks = [
  { id: 'mic', label: 'Microphone Access', icon: '◈' },
  { id: 'screen', label: 'Screen Recording', icon: '▦' },
]

export default function Permissions() {

  const {
    beginCoding,
    isLoading,
    initError,
    resetInterview
  } = useInterview()

  const [permStatus, setPermStatus] = useState({
    mic: 'pending',
    screen: 'pending',
  })

  const [checklist, setChecklist] = useState(
    rules.map(() => false)
  )

  useEffect(() => {

    // Stagger checklist reveal
    rules.forEach((_, i) => {
      setTimeout(() => {
        setChecklist(prev => {
          const next = [...prev]
          next[i] = true
          return next
        })
      }, 300 + i * 200)
    })

    // Request ONLY microphone access
    setTimeout(() => {
      navigator.mediaDevices?.getUserMedia({
        audio: true
      })
        .then(stream => {

          // stop tracks immediately after permission granted
          stream.getTracks().forEach(track => track.stop())

          setPermStatus(prev => ({
            ...prev,
            mic: 'granted'
          }))
        })
        .catch(() => {
          setPermStatus(prev => ({
            ...prev,
            mic: 'denied'
          }))
        })
    }, 800)

    // Simulated screen recording permission
    setTimeout(() => {
      setPermStatus(prev => ({
        ...prev,
        screen: 'granted'
      }))
    }, 1800)

  }, [])

  const allGranted = Object.values(permStatus)
    .every(v => v !== 'pending')

  const handleBegin = () => {
    document.documentElement
      .requestFullscreen?.()
      .catch(() => {})

    beginCoding()
  }

  const statusIcon = (s) => {
    if (s === 'pending') {
      return <span className="perm-spinner" />
    }

    if (s === 'granted') {
      return <span className="perm-check">✓</span>
    }

    return <span className="perm-x">✕</span>
  }

  return (
    <div className="perms-page">

      <motion.div
        className="perms-container"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: 0.5,
          ease: [0.4, 0, 0.2, 1]
        }}
      >

        {/* Left */}
        <div className="perms-left">

          <div className="perm-checks">
            {checks.map(c => (
              <div
                key={c.id}
                className={`perm-item ${permStatus[c.id]}`}
              >
                <span className="perm-icon">{c.icon}</span>

                <span className="perm-label">
                  {c.label}
                </span>

                <div className="perm-status">
                  {statusIcon(permStatus[c.id])}
                </div>
              </div>
            ))}
          </div>

          <div className="perms-security-note">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>

            <span>
              Audio access is used only for voice-based interview responses.
            </span>
          </div>

        </div>

        {/* Right */}
        <div className="perms-right">

          <div className="section-label">
            Pre-Interview Check
          </div>

          <h2 className="perms-title">
            Interview Protocol
          </h2>

          <p className="perms-subtitle">
            Review and confirm all rules before proceeding.
          </p>

          <div className="rules-list">

            {rules.map((rule, i) => (
              <AnimatePresence key={i}>
                {checklist[i] && (
                  <motion.div
                    className="rule-item"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.3,
                      ease: [0.4, 0, 0.2, 1]
                    }}
                  >
                    <span className="rule-marker">—</span>
                    <span>{rule}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            ))}

          </div>

          <motion.button
            className={`begin-btn ${(allGranted && !isLoading)
              ? 'ready'
              : 'waiting'
            }`}
            onClick={
              (allGranted && !isLoading)
                ? handleBegin
                : undefined
            }
            whileHover={
              (allGranted && !isLoading)
                ? { scale: 1.01 }
                : {}
            }
            whileTap={
              (allGranted && !isLoading)
                ? { scale: 0.99 }
                : {}
            }
          >

            {isLoading ? (
              <>
                <span
                  className="perm-spinner"
                  style={{
                    marginRight: 8,
                    display: 'inline-block',
                    width: 14,
                    height: 14,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}
                />
                Starting Session…
              </>

            ) : allGranted ? (

              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
                </svg>

                Enable Fullscreen & Begin Interview
              </>

            ) : (
              <>Waiting for permissions…</>
            )}

          </motion.button>

          <AnimatePresence>
            {initError && (
              <motion.div
                className="init-error-banner"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                style={{
                  marginTop: '16px',
                  padding: '12px',
                  background: 'rgba(20, 184, 166, 0.1)',
                  border: '1px solid rgba(20, 184, 166, 0.3)',
                  borderRadius: '6px',
                  color: '#5eead4',
                  fontSize: '0.85rem'
                }}
              >
                <div
                  style={{
                    marginBottom: '8px',
                    fontWeight: 500
                  }}
                >
                  ⚠️ {initError}
                </div>

                <button
                  onClick={resetInterview}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '0.8rem'
                  }}
                >
                  Return to Dashboard
                </button>

              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </motion.div>

    </div>
  )
}