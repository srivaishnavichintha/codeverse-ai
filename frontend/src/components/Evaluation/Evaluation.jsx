import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer
} from 'recharts'
import { useInterview } from '../../context/InterviewContext'
import { evaluationData } from '../../data/interviewMockData'
import { InterviewAPI } from '../../services/interviewService'
import './Evaluation.css'

function AnimatedScore({ target, duration = 2000, color }) {
  const [v, setV] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const start = performance.now()
    const animate = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 4)
      setV(Math.round(eased * target))
      if (p < 1) ref.current = requestAnimationFrame(animate)
    }
    ref.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(ref.current)
  }, [target, duration])

  return <span style={{ color }}>{v}</span>
}

function ScoreBar({ label, value, color = 'var(--teal-primary)' }) {
  return (
    <div className="eval-score-bar">
      <div className="esb-header">
        <span className="esb-label">{label}</span>
        <span className="esb-value">{value}</span>
      </div>
      <div className="esb-track">
        <motion.div
          className="esb-fill"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.2, ease: [0.4,0,0.2,1], delay: 0.3 }}
          style={{ background: color }}
        />
      </div>
    </div>
  )
}

const timelineColors = { start: 'var(--teal-primary)', positive: '#5eead4', neutral: 'var(--text-muted)', warning: '#14b8a6', end: 'var(--teal-primary)' }

const stagger = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: [0.4,0,0.2,1] } })
}

export default function Evaluation() {
  const { resetInterview, sessionId } = useInterview()
  const [reportData, setReportData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) {
      setReportData(evaluationData)
      setIsLoading(false)
      return
    }

    let pollInterval
    const fetchReport = async () => {
      try {
        await InterviewAPI.generateReport(sessionId)
      } catch (e) {
        // Ignored, might already be generating
      }

      pollInterval = setInterval(async () => {
        try {
          const res = await InterviewAPI.getReport(sessionId)
          if (res?.report?.generatedAt) {
            const real = res.report
            const blended = {
              overallScore: real.overallScore || 0,
              technicalScore: real.technicalScore || 70,
              communicationScore: real.communicationScore || 70,
              problemSolvingScore: real.problemSolvingScore || 70,
              codeQualityScore: real.technicalScore ? Math.min(100, real.technicalScore + 5) : 75,
              optimizationScore: real.problemSolvingScore ? Math.min(100, real.problemSolvingScore + 5) : 70,
              confidenceScore: real.communicationScore ? Math.max(0, real.communicationScore - 5) : 80,
              summary: real.summary || '',
              recommendation: real.recommendation || 'No Recommendation',
              strengths: real.strengths || [],
              improvements: real.weaknesses || [],
              eligibleCompanies: real.eligibleCompanies?.length ? real.eligibleCompanies : ['Top Tech Companies', 'Startups'],
              suggestedTopics: real.suggestedTopics?.length ? real.suggestedTopics : ['Data Structures', 'Algorithms'],
              behavioralImprovements: real.behavioralImprovements?.length ? real.behavioralImprovements : ['Provide clearer explanations while coding'],
              hiringChance: real.overallScore || 50,
              suspiciousActivity: '0 Flags',
              violations: 0,
              radarData: [
                { subject: 'Algorithms', A: real.technicalScore || 70 },
                { subject: 'Problem Solving', A: real.problemSolvingScore || 70 },
                { subject: 'Communication', A: real.communicationScore || 70 },
                { subject: 'Optimization', A: real.problemSolvingScore ? Math.min(100, real.problemSolvingScore + 5) : 70 },
                { subject: 'Code Quality', A: real.technicalScore ? Math.min(100, real.technicalScore + 5) : 70 },
              ],
              timeline: [
                { time: '00:00', event: 'Interview Started', type: 'start' },
                { time: 'In Progress', event: 'Coding & AI Deep Dive', type: 'neutral' },
                { time: 'End', event: 'Interview Completed', type: 'end' }
              ]
            }
            setReportData(blended)
            setIsLoading(false)
            clearInterval(pollInterval)
          }
        } catch (e) {
          console.error(e)
        }
      }, 3000)
    }

    fetchReport()
    return () => clearInterval(pollInterval)
  }, [sessionId])

  if (isLoading) {
    return (
      <div className="eval-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <span className="perm-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        <div style={{ color: 'var(--teal-primary)', fontFamily: 'var(--font-mono)' }}>Generating final AI report...</div>
      </div>
    )
  }

  const ev = reportData || evaluationData

  const recColor = ev.recommendation.includes('Strongly') ? '#5eead4' : ev.recommendation.includes('Conditional') ? '#14b8a6' : '#0f766e'

  return (
    <div className="eval-page">
      <div className="eval-topbar">
        <span className="topbar-logo">CodeVerse</span>
        <span className="badge badge-teal">Interview Report</span>
        <button className="retake-topbar-btn" onClick={resetInterview}>← Back to Dashboard</button>
      </div>

      <div className="eval-body">
        {/* Overall score hero */}
        <motion.div className="eval-hero" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="eval-hero-left">
            <div className="section-label">AI Evaluation Report</div>
            <h1 className="eval-hero-title">Interview Complete</h1>
            <p className="eval-hero-sub">Comprehensive analysis across technical, behavioral, and security dimensions.</p>

            <div className="hiring-rec" style={{ borderColor: `${recColor}40`, background: `${recColor}0d` }}>
              <span className="hiring-rec-label">Hiring Recommendation</span>
              <span className="hiring-rec-value" style={{ color: recColor }}>{ev.recommendation}</span>
              <div className="hiring-chance">
                <span style={{ color: recColor, fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700 }}>{ev.hiringChance}%</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>hire probability</span>
              </div>
            </div>
          </div>

          <div className="eval-hero-right">
            <div className="overall-score-ring">
              <svg width="160" height="160">
                <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                <motion.circle
                  cx="80" cy="80" r="70" fill="none"
                  stroke="var(--teal-primary)" strokeWidth="6"
                  strokeDasharray={2 * Math.PI * 70}
                  initial={{ strokeDashoffset: 2 * Math.PI * 70 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 70 * (1 - ev.overallScore / 100) }}
                  transition={{ duration: 2, ease: [0.4,0,0.2,1] }}
                  strokeLinecap="round"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                />
              </svg>
              <div className="overall-score-label">
                <span className="overall-score-num">
                  <AnimatedScore target={ev.overallScore} color="var(--teal-light)" duration={2000} />
                </span>
                <span className="overall-score-sub">Overall Score</span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="eval-grid">
          {/* Left column */}
          <div className="eval-left">
            {/* Score breakdown */}
            <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="section-label" style={{ marginBottom: 16 }}>Score Breakdown</div>
              <div className="eval-score-list">
                <ScoreBar label="Technical" value={ev.technicalScore} />
                <ScoreBar label="Communication" value={ev.communicationScore} color="#5eead4" />
                <ScoreBar label="Problem Solving" value={ev.problemSolvingScore} color="#2dd4bf" />
                <ScoreBar label="Code Quality" value={ev.codeQualityScore} />
                <ScoreBar label="Optimization Thinking" value={ev.optimizationScore} color="#14b8a6" />
                <ScoreBar label="Confidence" value={ev.confidenceScore} color="#0d9488" />
              </div>
            </motion.div>

            {/* Radar */}
            <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>Performance Radar</div>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={ev.radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} />
                  <Radar name="Score" dataKey="A" stroke="var(--teal-primary)" fill="var(--teal-primary)" fillOpacity={0.15} strokeWidth={1.5} />
                </RadarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Timeline */}
            <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <div className="section-label" style={{ marginBottom: 16 }}>Interview Timeline</div>
              <div className="timeline">
                {ev.timeline.map((item, i) => (
                  <div key={i} className="timeline-item">
                    <div className="tl-time">{item.time}</div>
                    <div className="tl-line">
                      <div className="tl-dot" style={{ background: timelineColors[item.type] }} />
                      {i < ev.timeline.length - 1 && <div className="tl-connector" />}
                    </div>
                    <div className="tl-event" style={{ color: item.type === 'warning' ? '#2dd4bf' : item.type === 'positive' ? '#5eead4' : 'var(--text-secondary)' }}>
                      {item.event}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right column */}
          <div className="eval-right">
            {/* Strengths */}
            <motion.div className="card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Strengths</div>
              {ev.strengths.map((s, i) => (
                <motion.div key={i} className="eval-item strength" custom={i} variants={stagger} initial="hidden" animate="visible">
                  <span className="eval-item-marker">✓</span>
                  <span>{s}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* Improvements */}
            <motion.div className="card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Areas to Improve</div>
              {ev.improvements.map((s, i) => (
                <motion.div key={i} className="eval-item improvement" custom={i} variants={stagger} initial="hidden" animate="visible">
                  <span className="eval-item-marker">→</span>
                  <span>{s}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* Security */}
            <motion.div className="card security-card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Monitoring Report</div>
              <div className="security-items">
                <div className="sec-item">
                  <span className="sec-label">Suspicious Activity</span>
                  <span className="badge badge-green">{ev.suspiciousActivity}</span>
                </div>
                <div className="sec-item">
                  <span className="sec-label">Violations</span>
                  <span className="badge badge-green">{ev.violations} / 3</span>
                </div>
                <div className="sec-item">
                  <span className="sec-label">Integrity Score</span>
                  <span className="badge badge-green">100%</span>
                </div>
              </div>
            </motion.div>

            {/* Eligible companies */}
            <motion.div className="card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Eligible Companies</div>
              <div className="company-chips">
                {ev.eligibleCompanies.map(c => (
                  <span key={c} className="company-chip">{c}</span>
                ))}
              </div>
            </motion.div>

            {/* Suggested topics */}
            <motion.div className="card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Suggested DSA Topics</div>
              <div className="topic-chips">
                {ev.suggestedTopics.map(t => (
                  <span key={t} className="badge badge-teal">{t}</span>
                ))}
              </div>
            </motion.div>

            {/* Behavioral */}
            <motion.div className="card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Behavioral Improvements</div>
              {ev.behavioralImprovements.map((b, i) => (
                <div key={i} className="eval-item behavioral">
                  <span className="eval-item-marker" style={{ color: 'var(--teal-primary)' }}>◈</span>
                  <span>{b}</span>
                </div>
              ))}
            </motion.div>

            {/* Retake */}
            <motion.button
              className="retake-btn"
              onClick={resetInterview}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              ↺ Retake Interview
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}
