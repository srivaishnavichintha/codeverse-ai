import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts'
import { useInterview } from '../../context/InterviewContext'
import { InterviewAPI } from '../../services/interviewService'
import './Dashboard.css'

function AnimatedNumber({ target, duration = 1500 }) {
  const [current, setCurrent] = useState(0)
  const start = useRef(null)

  useEffect(() => {
    const animate = (ts) => {
      if (!start.current) start.current = ts
      const progress = Math.min((ts - start.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [target, duration])

  return <span>{current}</span>
}

function CircularProgress({ value, size = 80, stroke = 4, label, color = 'var(--teal-primary)' }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ

  return (
    <div className="circ-progress" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="circ-label">
        <span className="circ-value">{value}</span>
        <span className="circ-sub">{label}</span>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="chart-tooltip">
        <p className="tooltip-label">{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const { startInterview, resumeSession } = useInterview()
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    
    InterviewAPI.getStats()
      .then(data => setStats(data))
      .catch(err => console.error("Failed to load dashboard stats", err))
      .finally(() => setLoading(false))

    return () => clearTimeout(t)
  }, [])

  if (loading || !stats) {
    return <div className="dashboard-page" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--teal-primary)'}}>Loading...</div>
  }

  const radarData = [
    { subject: 'Communication', A: stats.communicationScore },
    { subject: 'Problem Solving', A: stats.problemSolvingScore },
    { subject: 'Code Quality', A: stats.codeQualityScore },
    { subject: 'Overall', A: stats.avgScore },
  ]

  return (
    <div className="dashboard-page anim-fade-in">
      <div className="dash-back-nav">
        <button className="dash-back-btn" onClick={() => navigate('/problems')}>
          ← Back to CodeVerse
        </button>
      </div>

      <div className="dash-hero anim-fade-up">
        <div className="hero-left">
          <div className="section-label">Interview Intelligence</div>
          <h1 className="hero-title">
            Your Performance<br />
            <span className="hero-accent">At a Glance</span>
          </h1>
          <p className="hero-desc">AI-powered interview analysis across {stats.totalInterviews} sessions. Track growth, identify gaps, and benchmark against top companies.</p>
          <button className="start-btn" onClick={startInterview}>
            <span className="start-btn-icon">▶</span>
            Begin New Interview
          </button>
        </div>
        <div className="hero-right">
          <div className="hero-stat-grid">
            {[
              { label: 'Total Sessions', value: stats.totalInterviews, suffix: '' },
              { label: 'Avg Score', value: stats.avgScore, suffix: '%' },
              { label: 'Warnings', value: stats.cheatingWarnings, suffix: '' },
            ].map((s, i) => (
              <div key={s.label} className="hero-stat-card" style={{ animationDelay: `${i * 0.1}s` }}>
                <span className="hero-stat-value"><AnimatedNumber target={s.value} />{s.suffix}</span>
                <span className="hero-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dash-main">
        <div className="dash-left">

          <div className="card anim-fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="card-header">
              <span className="section-label">Performance Trend</span>
              <div className="chart-legend">
                <span style={{ color: 'var(--teal-primary)' }}>— Overall</span>
                <span style={{ color: 'var(--cyan)' }}>— Communication</span>
                <span style={{ color: 'var(--teal-light)' }}>— Problem Solving</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats.performanceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="score" name="Overall" stroke="var(--teal-primary)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'var(--teal-primary)' }} />
                <Line type="monotone" dataKey="comm" name="Communication" stroke="var(--cyan)" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                <Line type="monotone" dataKey="ps" name="Problem Solving" stroke="var(--teal-light)" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="score-row">
            {[
              { label: 'Communication', value: stats.communicationScore, color: 'var(--cyan)' },
              { label: 'Problem Solving', value: stats.problemSolvingScore, color: 'var(--teal-primary)' },
              { label: 'Code Quality', value: stats.codeQualityScore, color: 'var(--teal-light)' },
            ].map((s, i) => (
              <div key={s.label} className="score-card anim-fade-up" style={{ animationDelay: `${0.2 + i * 0.1}s` }}>
                <CircularProgress value={s.value} size={72} stroke={3} label={s.label} color={s.color} />
              </div>
            ))}
          </div>

          <div className="card anim-fade-up" style={{ animationDelay: '0.3s' }}>
            <div className="card-header">
              <span className="section-label">Skill Breakdown</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.06)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} />
                <Radar name="Score" dataKey="A" stroke="var(--teal-primary)" fill="var(--teal-primary)" fillOpacity={0.12} strokeWidth={1.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="card anim-fade-up" style={{ animationDelay: '0.4s' }}>
            <div className="card-header">
              <span className="section-label">Recent Interviews</span>
            </div>
            <table className="interview-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentInterviews.map((iv, i) => (
                  <tr key={iv.id} className="anim-fade-up" style={{ animationDelay: `${0.4 + i * 0.05}s` }}>
                    <td><span className="mono-text">{iv.id}</span></td>
                    <td>{iv.date}</td>
                    <td>
                      <span className={`score-pill ${iv.score >= 75 ? 'good' : iv.score >= 60 ? 'mid' : 'low'}`}>
                        {iv.score}
                      </span>
                    </td>
                    <td>{iv.duration}</td>
                    <td>
                      <span className={`badge ${iv.status === 'Completed' ? 'badge-green' : 'badge-red'}`}>
                        {iv.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {stats.recentInterviews.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>No past interviews found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dash-right">
          <div className="card anim-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="section-label">Profile Summary</div>
            <div className="profile-stats">
              <div className="profile-stat-item">
                <span className="psi-label">Strongest Topic</span>
                <span className="psi-value teal">{stats.strongestTopic}</span>
              </div>
              <div className="divider" />
              <div className="profile-stat-item">
                <span className="psi-label">Weakest Topic</span>
                <span className="psi-value red">{stats.weakestTopic}</span>
              </div>
              <div className="divider" />
              <div className="profile-stat-item">
                <span className="psi-label">Avg Score</span>
                <span className="psi-value">{stats.avgScore}%</span>
              </div>
              <div className="divider" />
              <div className="profile-stat-item">
                <span className="psi-label">Cheating Warnings</span>
                <span className="psi-value amber">{stats.cheatingWarnings}</span>
              </div>
            </div>
          </div>

          <div className="cta-card anim-fade-up" style={{ animationDelay: '0.3s' }}>
            <div className="cta-indicator">
              <span className="pulse-dot" />
              <span>System Ready</span>
            </div>
            <h3 className="cta-title">Ready to be evaluated?</h3>
            <p className="cta-desc">Your next session will be monitored by AI. Camera, microphone, and screen recording required.</p>
            <button className="start-btn-secondary" onClick={startInterview}>
              Start Interview Session →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
