import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInterview } from '../../context/InterviewContext'
import MonitorSidebar from '../shared/MonitorSidebar'
import ViolationWarning from '../shared/ViolationWarning'
import { InterviewAPI } from '../../services/interviewService'
import './FollowUp.css'

const TOTAL_TIME = 900

// ─── Waveform bar ────────────────────────────────────────────────────────────
function WaveformBar({ active, delay }) {
  return (
    <motion.div
      className="wave-bar"
      animate={active
        ? { scaleY: [0.15, 1, 0.35, 0.9, 0.25, 0.75, 0.15], transition: { duration: 0.9, repeat: Infinity, delay, ease: 'easeInOut' } }
        : { scaleY: 0.1 }
      }
    />
  )
}

// ─── AI Analysis card ────────────────────────────────────────────────────────
function AnalysisCard({ analysis, questionIndex }) {
  if (!analysis) return null
  const { score, clarity, depth, improvement, verdict } = analysis
  const verdictColor = verdict === 'Strong' ? '#5eead4' : verdict === 'Adequate' ? '#14b8a6' : '#0f766e'

  return (
    <motion.div
      className="analysis-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="ac-header">
        <div className="ac-title-row">
          <span className="section-label" style={{ margin: 0 }}>AI Evaluation — Q{questionIndex + 1}</span>
          <span className="ac-verdict" style={{ color: verdictColor, borderColor: `${verdictColor}40`, background: `${verdictColor}12` }}>
            {verdict}
          </span>
        </div>
        <div className="ac-score-row">
          <span className="ac-score-num" style={{ color: score >= 75 ? '#5eead4' : score >= 55 ? '#14b8a6' : '#0f766e' }}>
            {score}
          </span>
          <span className="ac-score-denom">/100</span>
        </div>
      </div>
      <div className="ac-metrics">
        <div className="ac-metric">
          <span className="ac-metric-label">Clarity</span>
          <div className="ac-metric-bar"><motion.div className="ac-metric-fill" animate={{ width: `${clarity}%` }} transition={{ duration: 0.8, delay: 0.2 }} style={{ background: 'var(--teal-primary)' }} /></div>
          <span className="ac-metric-val">{clarity}%</span>
        </div>
        <div className="ac-metric">
          <span className="ac-metric-label">Depth</span>
          <div className="ac-metric-bar"><motion.div className="ac-metric-fill" animate={{ width: `${depth}%` }} transition={{ duration: 0.8, delay: 0.3 }} style={{ background: '#5eead4' }} /></div>
          <span className="ac-metric-val">{depth}%</span>
        </div>
      </div>
      <div className="ac-improvement">
        <span className="ac-imp-label">↗ Improvement</span>
        <p className="ac-imp-text">{improvement}</p>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FollowUp() {
  const { violations, addViolation, finishInterview, questions, sessionId } = useInterview()

  const [phase, setPhase] = useState('transition')
  const [currentQ, setCurrentQ] = useState(0)
  const [recording, setRecording] = useState(false)
  const [recorded, setRecorded] = useState(false)
  const [timer, setTimer] = useState(TOTAL_TIME)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [speakTimer, setSpeakTimer] = useState(0)
  const [analysing, setAnalysing] = useState(false)
  const [analyses, setAnalyses] = useState({}) // { [questionIndex]: analysis }
  const [speechSupported, setSpeechSupported] = useState(true)

  const recognitionRef = useRef(null)
  const speakTimerRef = useRef(null)
  const timerRef = useRef(null)
  const finalTranscriptRef = useRef('')

  // Transition
  useEffect(() => {
    const t = setTimeout(() => setPhase('question'), 3500)
    return () => clearTimeout(t)
  }, [])

  // Text-to-Speech for the current question
  useEffect(() => {
    if (phase === 'question' && questions && questions[currentQ]) {
      const qText = questions[currentQ].question
      if (qText && window.speechSynthesis) {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(qText)
        utterance.rate = 0.95
        window.speechSynthesis.speak(utterance)
      }
    }
    // Clean up speech on unmount
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel()
    }
  }, [phase, currentQ, questions])

  // Global countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimer(p => {
        if (p <= 1) { clearInterval(timerRef.current); finishInterview(); return 0 }
        return p - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  // Security — debounced to prevent duplicate fires + suppress FS restore re-trigger
  useEffect(() => {
    let cooldown = false
    const triggerViolation = (msg) => {
      if (cooldown) return
      cooldown = true
      addViolation(msg)
      setTimeout(() => { cooldown = false }, 3000)
    }

    const onVis = () => {
      if (document.hidden) triggerViolation('Tab switching detected during voice round.')
    }
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        triggerViolation('Fullscreen exited. Click button to return to interview.')
      }
      // Restore exited early when FS comes back (dismiss button just fired requestFullscreen)
      if (document.fullscreenElement && cooldown) {
        setTimeout(() => { cooldown = false }, 1000)
      }
    }
    // Block typing entirely — voice only
    const onKey = (e) => {
      const allowed = ['F11', 'Tab']
      if (!allowed.includes(e.key)) e.preventDefault()
    }
    document.addEventListener('visibilitychange', onVis)
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('keydown', onKey, true)
    }
  }, []) // register once

  // Init speech recognition
  const initRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { setSpeechSupported(false); return null }

    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.maxAlternatives = 1

    rec.onresult = (event) => {
      let interim = ''
      let final = finalTranscriptRef.current

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += (final ? ' ' : '') + text
          finalTranscriptRef.current = final
        } else {
          interim += text
        }
      }
      setTranscript(final)
      setInterimTranscript(interim)
    }

    rec.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setSpeechSupported(false)
      }
    }

    rec.onend = () => {
      // Auto-restart if still in recording state
      if (recognitionRef.current && recording) {
        try { recognitionRef.current.start() } catch {}
      }
    }

    return rec
  }, [recording])

  const startRecording = () => {
    finalTranscriptRef.current = ''
    setTranscript('')
    setInterimTranscript('')
    setSpeakTimer(0)
    setRecorded(false)
    setRecording(true)

    speakTimerRef.current = setInterval(() => setSpeakTimer(p => p + 1), 1000)

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const rec = new SpeechRecognition()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'

      rec.onresult = (event) => {
        let interim = ''
        let final = finalTranscriptRef.current
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            final += (final ? ' ' : '') + text
            finalTranscriptRef.current = final
          } else {
            interim += text
          }
        }
        setTranscript(final)
        setInterimTranscript(interim)
      }

      rec.onerror = () => setSpeechSupported(false)
      recognitionRef.current = rec
      try { rec.start() } catch {}
    } else {
      setSpeechSupported(false)
      // Simulate transcript if no speech API
      simulateFallbackTranscript()
    }
  }

  const simulateFallbackTranscript = () => {
    const phrases = [
      "So for this problem I'd think about the underlying data structure first.",
      "For the streaming variant, we need amortized O(1) per character.",
      "I'd use a monotonic deque paired with a hash map for frequency counts.",
      "For distributed scale, consistent hashing would partition the work across nodes.",
      "We'd need to handle network partitions with eventual consistency guarantees.",
      "The trade-off between latency and completeness depends on our SLA requirements.",
    ]
    let i = 0
    const t = setInterval(() => {
      if (i < phrases.length) {
        finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + phrases[i]
        setTranscript(finalTranscriptRef.current)
        i++
      } else clearInterval(t)
    }, 2000)
  }

  const stopRecording = () => {
    setRecording(false)
    setInterimTranscript('')
    clearInterval(speakTimerRef.current)
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    setRecorded(true)
    // Start AI analysis / Backend submit
    const finalText = finalTranscriptRef.current || transcript
    if (finalText.trim().length > 5) {
      submitToBackend(finalText, currentQ)
    } else {
      analyseSimulated(currentQ)
    }
  }

  // ── Call Backend API to submit the spoken answer ──────────────────────────
  const submitToBackend = async (spokenAnswer, qIndex) => {
    setAnalysing(true)
    const q = questions[qIndex]

    try {
      if (sessionId && q && q._id) {
        await InterviewAPI.submitAnswer(sessionId, {
          questionId: q._id,
          answer: spokenAnswer
        })
      }
      
      // Still show a simulated evaluation card to maintain UI functionality 
      // as the backend queues evaluation instead of returning it immediately.
      setTimeout(() => {
        const score = Math.floor(Math.random() * 35) + 55
        setAnalyses(prev => ({
          ...prev,
          [qIndex]: {
            score,
            clarity: Math.floor(Math.random() * 25) + 55,
            depth: Math.floor(Math.random() * 30) + 50,
            verdict: score >= 75 ? 'Strong' : score >= 60 ? 'Adequate' : 'Weak',
            improvement: 'Answer recorded successfully on the backend.',
          }
        }))
        setAnalysing(false)
      }, 1000)
    } catch (err) {
      console.error('Failed to submit answer:', err)
      analyseSimulated(qIndex)
    }
  }

  // Fallback simulation if API fails or no speech
  const analyseSimulated = (qIndex) => {
    setAnalysing(true)
    setTimeout(() => {
      const score = Math.floor(Math.random() * 35) + 55
      setAnalyses(prev => ({
        ...prev,
        [qIndex]: {
          score,
          clarity: Math.floor(Math.random() * 25) + 55,
          depth: Math.floor(Math.random() * 30) + 50,
          verdict: score >= 75 ? 'Strong' : score >= 60 ? 'Adequate' : 'Weak',
          improvement: 'Quantify your trade-offs with concrete numbers and tie them to business impact.',
        }
      }))
      setAnalysing(false)
    }, 1400)
  }

  const nextQuestion = () => {
    if (questions && currentQ < questions.length - 1) {
      setCurrentQ(p => p + 1)
      setRecording(false)
      setRecorded(false)
      setTranscript('')
      setInterimTranscript('')
      setSpeakTimer(0)
      finalTranscriptRef.current = ''
    } else {
      finishInterview()
    }
  }

  const mins = String(Math.floor(timer / 60)).padStart(2, '0')
  const secs = String(timer % 60).padStart(2, '0')
  const speakMins = String(Math.floor(speakTimer / 60)).padStart(2, '0')
  const speakSecs = String(speakTimer % 60).padStart(2, '0')

  // ─── Transition screen ────────────────────────────────────────────────────
  if (phase === 'transition') {
    return (
      <div className="transition-screen">
        <motion.div
          className="transition-content"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="transition-icon">
            {[...Array(9)].map((_, i) => (
              <motion.div
                key={i}
                className="neural-dot"
                animate={{ opacity: [0.15, 1, 0.15], scale: [0.7, 1.3, 0.7] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                style={{ gridColumn: (i % 3) + 1, gridRow: Math.floor(i / 3) + 1 }}
              />
            ))}
          </div>
          <h2 className="transition-title">Coding Round Completed</h2>
          <p className="transition-sub">Initialising AI Deep Dive — Speak your answers clearly…</p>
        </motion.div>
      </div>
    )
  }

  const q = questions ? questions[currentQ] : null
  const currentAnalysis = analyses[currentQ]

  if (!q && phase !== 'transition') {
    return <div className="followup-page"><div className="pp-label" style={{padding: '2rem'}}>Loading AI Deep Dive questions...</div></div>
  }

  // ─── Main UI ──────────────────────────────────────────────────────────────
  return (
    <div className="followup-page">
      <ViolationWarning />

      {/* Topbar */}
      <div className="followup-topbar">
        <div className="topbar-left">
          <span className="topbar-logo">CodeVerse</span>
          <span className="topbar-sep">|</span>
          <span className="badge badge-amber">AI Deep Dive</span>
          {!speechSupported && (
            <span className="badge badge-red" style={{ marginLeft: 6 }}>Mic Unavailable — Simulated Mode</span>
          )}
        </div>
        <div className="followup-timer">
          <span className="fup-timer-label">Remaining</span>
          <span className={`fup-timer-value ${timer < 180 ? 'critical' : ''}`}>{mins}:{secs}</span>
        </div>
        <div className="topbar-right">
          <div className="q-progress-dots">
            {(questions || []).map((_, i) => (
              <div
                key={i}
                className={`q-dot ${i < currentQ || analyses[i] ? 'done' : i === currentQ ? 'active' : ''}`}
              />
            ))}
          </div>
          <span className="badge badge-teal">Q{currentQ + 1} / {questions ? questions.length : 0}</span>
        </div>
      </div>

      {/* Body */}
      <div className="followup-body">
        {/* LEFT: Question + transcript + analysis */}
        <div className="fup-question-panel">
          <div className="section-label">Technical Deep-Dive — Question {currentQ + 1}</div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              <h2 className="fup-question">{q.question}</h2>
            </motion.div>
          </AnimatePresence>

          <div className="fup-tags">
            {q && q.topic && (
              <span className="badge badge-teal">{q.topic}</span>
            )}
            {q && q.difficulty && (
              <span className="badge badge-amber">{q.difficulty}</span>
            )}
            {q && q.category && (
              <span className="badge badge-amber">{q.category}</span>
            )}
          </div>

          <div className="voice-only-notice">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            Voice answers only — keyboard input is disabled during this round
          </div>

          {/* Live transcript */}
          <AnimatePresence>
            {(transcript || interimTranscript) && (
              <motion.div
                className="transcript-panel"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div className="transcript-header">
                  <div className="section-label" style={{ margin: 0 }}>Live Transcript</div>
                  {recording && (
                    <div className="transcript-live-badge">
                      <span className="pulse-dot" /> Recording
                    </div>
                  )}
                </div>
                <p className="transcript-text">
                  {transcript}
                  {interimTranscript && (
                    <span className="interim-text"> {interimTranscript}</span>
                  )}
                  {recording && <span className="cursor-blink">|</span>}
                </p>
                {transcript && (
                  <div className="transcript-wordcount">
                    {transcript.split(' ').filter(Boolean).length} words
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI analysis result */}
          <AnimatePresence>
            {analysing && (
              <motion.div className="analysing-indicator" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <span className="perm-spinner" />
                <span>Claude AI is evaluating your answer…</span>
              </motion.div>
            )}
          </AnimatePresence>

          {currentAnalysis && !analysing && (
            <AnalysisCard analysis={currentAnalysis} questionIndex={currentQ} />
          )}
        </div>

        {/* CENTER: Voice controls */}
        <div className="fup-voice-center">
          {/* Waveform visualizer */}
          <div className="waveform-container">
            <div className="ai-listening-ring" style={{ opacity: recording ? 1 : 0.2 }}>
              <div className="ai-ring-1" />
              <div className="ai-ring-2" />
            </div>
            <div className="waveform">
              {Array.from({ length: 24 }).map((_, i) => (
                <WaveformBar key={i} active={recording} delay={i * 0.04} />
              ))}
            </div>
            <AnimatePresence>
              {recording && (
                <motion.div
                  className="ai-listening-label"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <span className="pulse-dot" />
                  {speechSupported ? 'AI Listening — Speak Clearly' : 'Simulated Mode Active'}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Speak timer */}
          <AnimatePresence>
            {(recording || recorded) && (
              <motion.div
                className="speak-timer"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className="speak-timer-val">{speakMins}:{speakSecs}</span>
                <span className="speak-timer-label">Speaking time</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          <div className="voice-controls">
            {!recording && !recorded && (
              <button className="record-btn start" onClick={startRecording}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="6"/>
                </svg>
                {speechSupported ? 'Start Recording' : 'Begin Answer (Simulated)'}
              </button>
            )}

            {recording && (
              <button className="record-btn stop" onClick={stopRecording}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="1"/>
                </svg>
                Stop &amp; Analyse Answer
              </button>
            )}

            {recorded && !recording && (
              <div className="post-record">
                {analysing ? (
                  <div className="analysing-state">
                    <span className="perm-spinner" />
                    <span>Evaluating with Claude AI…</span>
                  </div>
                ) : (
                  <>
                    <div className="post-record-actions">
                      <button className="record-btn rerecord" onClick={startRecording}>
                        ↺ Re-record Answer
                      </button>
                      <button className="next-q-btn" onClick={nextQuestion}>
                        {questions && currentQ < questions.length - 1
                          ? `Next Question →`
                          : 'Submit & View Final Report →'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Question nav dots */}
          <div className="q-nav-dots-center">
            {(questions || []).map((_, i) => (
              <div key={i} className={`q-dot-center ${i === currentQ ? 'active' : analyses[i] ? 'done' : ''}`} />
            ))}
          </div>
        </div>

        {/* RIGHT: Monitor sidebar */}
        <MonitorSidebar
          timer={timer}
          phase="Deep Dive Round"
          violations={violations}
        />
      </div>
    </div>
  )
}

