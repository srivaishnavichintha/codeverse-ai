import React, { useRef, useEffect, useState } from 'react'
import './MonitorSidebar.css'

export default function MonitorSidebar({ timer, phase, violations, maxViolations = 3 }) {
  const videoRef = useRef(null)
  const [streaming, setStreaming] = useState(false)
  const [confidence, setConfidence] = useState(87)
  const [emotion, setEmotion] = useState('Focused')

  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) videoRef.current.srcObject = stream
        setStreaming(true)
      })
      .catch(() => setStreaming(false))
  }, [])

  // Simulate slight fluctuations
  useEffect(() => {
    const t = setInterval(() => {
      setConfidence(prev => Math.max(60, Math.min(98, prev + (Math.random() - 0.5) * 4)))
      const emotions = ['Focused', 'Thinking', 'Confident', 'Focused', 'Analyzing']
      if (Math.random() > 0.85) setEmotion(emotions[Math.floor(Math.random() * emotions.length)])
    }, 3000)
    return () => clearInterval(t)
  }, [])

  const mins = String(Math.floor(timer / 60)).padStart(2, '0')
  const secs = String(timer % 60).padStart(2, '0')
  const timerCritical = timer < 300

  return (
    <div className="monitor-sidebar">
      {/* Timer */}
      <div className={`timer-block ${timerCritical ? 'critical' : ''}`}>
        <span className="timer-label">{phase}</span>
        <span className="timer-display">{mins}:{secs}</span>
        <span className="timer-sub">remaining</span>
      </div>

      {/* Webcam */}
      <div className="monitor-cam">
        {streaming ? (
          <video ref={videoRef} autoPlay muted playsInline className="monitor-video" />
        ) : (
          <div className="monitor-cam-placeholder">
            <span>Camera</span>
          </div>
        )}
        <div className="cam-status-bar">
          <span className="pulse-dot" />
          <span>Live</span>
        </div>
      </div>

      {/* AI Indicators */}
      <div className="ai-indicators">
        <div className="section-label">AI Monitoring</div>

        <div className="ai-indicator-item">
          <span className="ai-ind-label">Confidence</span>
          <div className="ai-ind-bar">
            <div className="ai-ind-fill" style={{ width: `${confidence}%`, background: confidence > 75 ? 'var(--teal-primary)' : 'var(--teal-primary)' }} />
          </div>
          <span className="ai-ind-value">{Math.round(confidence)}%</span>
        </div>

        <div className="ai-indicator-item">
          <span className="ai-ind-label">Emotion</span>
          <span className="ai-ind-tag">{emotion}</span>
        </div>

        <div className="monitor-badges">
          <div className="monitor-badge active">
            <span className="pulse-dot" />
            AI Monitoring
          </div>
          <div className="monitor-badge">
            <span className="teal-dot" />
            Voice Analysis
          </div>
          <div className="monitor-badge">
            <span className="teal-dot" />
            Screen Recording
          </div>
        </div>
      </div>

      {/* Violations */}
      <div className="violations-block">
        <span className="section-label">Violations</span>
        <div className="vio-pips">
          {Array.from({ length: maxViolations }).map((_, i) => (
            <div key={i} className={`vio-pip ${i < violations ? 'active' : ''}`} />
          ))}
        </div>
        <span className="vio-count">{violations} / {maxViolations}</span>
      </div>
    </div>
  )
}
