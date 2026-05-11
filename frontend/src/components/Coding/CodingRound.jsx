import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Editor from '@monaco-editor/react'
import { useInterview } from '../../context/InterviewContext'
import MonitorSidebar from '../shared/MonitorSidebar'
import ViolationWarning from '../shared/ViolationWarning'
import { CodeAPI } from '../../services/problemsService'
import { InterviewAPI } from '../../services/interviewService'
import ConsolePane from '../ConsolePane/ConsolePane'
import './CodingRound.css'

const TOTAL_TIME = 3600

const DEFAULT_TEMPLATES = {
  cpp: '#include <iostream>\n\nint main() {\n    // Write C++ code here\n \n\n    return 0;\n}',
  java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write Java code here\n        \n    }\n}',
  python: 'def solve():\n    # Write Python code here\n    pass\n\nif __name__ == "__main__":\n    solve()',
  javascript: 'function solve() {\n    // Write JavaScript code here\n    \n}\n\nsolve();'
};

const getTemplate = (p, l) => {
  if (!p) return DEFAULT_TEMPLATES[l] || '';
  const sc = p.starterCode;
  if (sc && typeof sc === 'object' && sc[l]) return sc[l];
  if (sc && typeof sc === 'string' && l === 'javascript') return sc;
  return DEFAULT_TEMPLATES[l] || '';
}

export default function CodingRound() {
  const { violations, addViolation, beginFollowUp, finishInterview, currentProblem, setCurrentProblem, problems, sessionId } = useInterview()
  const [timer, setTimer] = useState(TOTAL_TIME)
  const [codes, setCodes] = useState(() => {
    const initial = {}
    ;(problems || []).forEach(p => {
      initial[p._id] = {}
      ;['javascript', 'python', 'cpp', 'java'].forEach(l => {
        initial[p._id][l] = getTemplate(p, l)
      })
    })
    return initial
  })
  const [lang, setLang] = useState('javascript')
  const [runResults, setRunResults] = useState({})
  const [submitResults, setSubmitResults] = useState({})
  const [customCases, setCustomCases] = useState([])
  const [activeCase, setActiveCase] = useState(0)
  const [consoleSection, setConsoleSection] = useState('cases')
  const [consoleOpen, setConsoleOpen] = useState(true)

  const [running, setRunning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submittedProblems, setSubmittedProblems] = useState(new Set())
  const [autoSaving, setAutoSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('problem')
  const [showProceed, setShowProceed] = useState(false)
  const timerRef = useRef(null)

  const problem = problems?.[currentProblem]
  const runResult = problem ? runResults[problem._id] || null : null
  const submitResult = problem ? submitResults[problem._id] || null : null
  const allSubmitted = problems && problems.length > 0 && problems.every(p => submittedProblems.has(p._id))

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimer(p => {
        if (p <= 1) { clearInterval(timerRef.current); beginFollowUp(); return 0 }
        return p - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  // Show proceed banner when all problems submitted
  useEffect(() => {
    if (allSubmitted) setShowProceed(true)
  }, [allSubmitted])

  // Security hooks
  useEffect(() => {
    // Single cooldown flag — prevents duplicate violations from rapid events
    // Also suppresses re-trigger when fullscreen is RESTORED by the dismiss button
    let cooldown = false
    const triggerViolation = (msg) => {
      if (cooldown) return          // already showing a warning or in cooldown
      cooldown = true
      addViolation(msg)
      // Hold cooldown for 3 s — long enough to cover the dismiss + re-enter FS cycle
      setTimeout(() => { cooldown = false }, 3000)
    }

    const onVis = () => {
      if (document.hidden) triggerViolation('Tab switching detected — stay on the interview tab.')
    }
    const onFsChange = () => {
      // Fire violation ONLY on exit (no fullscreenElement).
      // When the dismiss button calls requestFullscreen() this event fires again
      // with fullscreenElement SET — that branch is ignored so no double-violation.
      if (!document.fullscreenElement) {
        triggerViolation('Fullscreen mode was exited. Click the button to return.')
      }
      // If fullscreen was just RESTORED, lift the cooldown early so future
      // accidental exits can still be caught (after 1 s grace period)
      if (document.fullscreenElement && cooldown) {
        setTimeout(() => { cooldown = false }, 1000)
      }
    }
    const onKeyDown = (e) => {
      if (e.ctrlKey && ['c', 'v', 'a', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault()
        triggerViolation('Keyboard shortcut restriction triggered.')
      }
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault()
        triggerViolation('DevTools access attempt detected.')
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        triggerViolation('Escape key press detected. Exiting fullscreen is not permitted.')
      }
    }
    const onCopy = (e) => { e.preventDefault(); triggerViolation('Copy operation is not permitted during interviews.') }
    const onContextMenu = (e) => e.preventDefault()

    document.addEventListener('visibilitychange', onVis)
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('copy', onCopy)
    document.addEventListener('contextmenu', onContextMenu)

    return () => {
      document.removeEventListener('visibilitychange', onVis)
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('contextmenu', onContextMenu)
    }
  }, []) // empty deps — register once, addViolation is stable

  // Auto-save
  useEffect(() => {
    const t = setInterval(() => {
      setAutoSaving(true)
      setTimeout(() => setAutoSaving(false), 1200)
    }, 15000)
    return () => clearInterval(t)
  }, [])

  const handleCodeChange = (val) => {
    if (!problem) return
    setCodes(prev => ({
      ...prev,
      [problem._id]: {
        ...prev[problem._id],
        [lang]: val
      }
    }))
    setAutoSaving(true)
    setTimeout(() => setAutoSaving(false), 800)
  }

  const handleRun = async () => {
    if (!problem) return
    setRunning(true)
    setSubmitResults(prev => ({ ...prev, [problem._id]: null }))
    setRunResults(prev => ({ ...prev, [problem._id]: null }))
    setConsoleSection("result")
    setConsoleOpen(true)
    try {
      const exampleCases = (problem?.sampleTestCases?.length ? problem.sampleTestCases : problem?.examples) || []
      const allCases = [
        ...exampleCases.map((e, i) => ({ id: i, input: e.input, expected: e.output })),
        ...customCases.map((c, i) => ({ id: 100 + i, input: c.input, custom: true }))
      ]

      const result = await CodeAPI.run({
        problemId: problem._id,
        language: lang,
        code: codes[problem._id]?.[lang],
        testcases: allCases
      })

      setRunResults(prev => ({ ...prev, [problem._id]: result }))
    } catch (err) {
      console.error(err)
      setRunResults(prev => ({ ...prev, [problem._id]: { verdict: 'Error', error: 'Failed to run code' } }))
    } finally {
      setRunning(false)
    }
  }

  const handleSubmit = async () => {
    if (!problem) return
    setSubmitting(true)
    setSubmitResults(prev => ({ ...prev, [problem._id]: null }))
    setRunResults(prev => ({ ...prev, [problem._id]: null }))
    setConsoleSection("result")
    setConsoleOpen(true)
    try {
      const result = await CodeAPI.submit({
        problemId: problem._id,
        language: lang,
        code: codes[problem._id]?.[lang]
      })
      
      if (result._id) {
        await InterviewAPI.submitCode(sessionId, {
          problemId: problem._id,
          submissionId: result._id
        })
      }

      setSubmitResults(prev => ({ ...prev, [problem._id]: result }))
      setSubmittedProblems(prev => new Set([...prev, problem._id]))

      const nextUnsolved = problems.findIndex(
        (p, i) => i > currentProblem && !submittedProblems.has(p._id) && p._id !== problem._id
      )
      if (nextUnsolved !== -1) {
        setTimeout(() => {
          setCurrentProblem(nextUnsolved)
          setActiveTab('problem')
        }, 1200)
      }
    } catch (err) {
      console.error(err)
      setSubmitResults(prev => ({ ...prev, [problem._id]: { verdict: 'Error', error: 'Failed to submit code' } }))
    } finally {
      setSubmitting(false)
    }
  }


  const handleProceedToDeepDive = () => {
    clearInterval(timerRef.current)
    beginFollowUp()
  }

  const handleEndTest = () => {
    clearInterval(timerRef.current)
    finishInterview()
  }

  const isSubmitted = problem ? submittedProblems.has(problem._id) : false

  if (!problem) return <div className="coding-page"><div className="pp-label" style={{padding: '2rem'}}>Loading problems...</div></div>

  return (
    <div className="coding-page">
      <ViolationWarning />

      {/* Proceed to Deep Dive banner */}
      <AnimatePresence>
        {showProceed && (
          <motion.div
            className="proceed-banner"
            initial={{ y: -64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -64, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="proceed-banner-left">
              <span className="proceed-check">✓</span>
              <div>
                <div className="proceed-title">All Problems Submitted</div>
                <div className="proceed-sub">Ready to proceed to the AI Deep Dive round — voice-based technical interview</div>
              </div>
            </div>
            <button className="proceed-btn" onClick={handleProceedToDeepDive}>
              Proceed to Deep Dive Interview →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="coding-topbar">
        <div className="topbar-left">
          <span className="topbar-logo">CodeVerse</span>
          <span className="topbar-sep">|</span>
          <span className="badge badge-teal">Coding Round</span>
          <span className="badge badge-green" style={{ marginLeft: 6 }}>
            <span className="pulse-dot" />
            AI Active
          </span>
        </div>

        <div className="topbar-center">
          <div className="problem-tabs">
            {problems.map((p, i) => (
              <button
                key={p._id}
                className={`prob-tab ${i === currentProblem ? 'active' : ''} ${submittedProblems.has(p._id) ? 'done' : ''}`}
                onClick={() => { setCurrentProblem(i); setActiveTab('problem') }}
              >
                {submittedProblems.has(p._id) ? (
                  <span className="prob-tab-check">✓</span>
                ) : (
                  <span className={`diff-dot ${p.difficulty ? p.difficulty.toLowerCase() : 'medium'}`} />
                )}
                P{i + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="topbar-right">
          <AnimatePresence>
            {autoSaving && (
              <motion.span
                className="autosave-indicator"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                ↻ Saving…
              </motion.span>
            )}
          </AnimatePresence>
          <select className="lang-select" value={lang} onChange={e => setLang(e.target.value)}>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
          </select>
        </div>
      </div>

      {/* Main content */}
      <div className="coding-body">
        {/* Problem panel */}
        <div className="problem-panel">
          <div className="panel-tabs">
            <button className={`panel-tab ${activeTab === 'problem' ? 'active' : ''}`} onClick={() => setActiveTab('problem')}>Problem</button>
            <button className={`panel-tab ${activeTab === 'examples' ? 'active' : ''}`} onClick={() => setActiveTab('examples')}>Examples</button>
            <button className={`panel-tab ${activeTab === 'constraints' ? 'active' : ''}`} onClick={() => setActiveTab('constraints')}>Constraints</button>
          </div>

          <div className="problem-content">
            <div className="problem-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <h2 className="problem-title">{problem.title}</h2>
                {isSubmitted && <span className="submitted-badge">Submitted ✓</span>}
              </div>
              <div className="problem-meta">
                <span className={`badge ${problem.difficulty === 'Hard' ? 'badge-red' : 'badge-amber'}`}>{problem.difficulty}</span>
                {problem.tags && problem.tags.length > 0 && <span className="badge badge-teal">{problem.tags[0]}</span>}
                {problem.company && <span className="company-tag">{problem.company}</span>}
              </div>
            </div>

            {activeTab === 'problem' && (
              <p className="problem-desc">{problem.description}</p>
            )}

            {activeTab === 'examples' && (
              <div className="examples-list">
                {(problem.examples || []).map((ex, i) => (
                  <div key={i} className="example-block">
                    <div className="example-label">Example {i + 1}</div>
                    <div className="code-block"><strong>Input:</strong> {ex.input}</div>
                    <div className="code-block"><strong>Output:</strong> {ex.output}</div>
                    {ex.explanation && <div className="example-exp">↳ {ex.explanation}</div>}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'constraints' && (
              <div className="constraints-list">
                {(problem.constraints || []).map((c, i) => (
                  <div key={i} className="constraint-item">
                    <span className="constraint-bullet">·</span>
                    <code>{c}</code>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Progress tracker */}
          <div className="problems-progress">
            <div className="pp-label">
              <span className="section-label" style={{ margin: 0 }}>Progress</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                {submittedProblems.size} / {problems.length} submitted
              </span>
            </div>
            <div className="pp-bar">
              <motion.div
                className="pp-fill"
                animate={{ width: `${(submittedProblems.size / problems.length) * 100}%` }}
                transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="editor-panel">
          <div className="editor-area">
            <Editor
              height="100%"
              language={lang}
              value={codes[problem._id]?.[lang] || ''}
              onChange={handleCodeChange}
              theme="vs-dark"
              options={{
                fontSize: 13,
                fontFamily: "'DM Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderLineHighlight: 'line',
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                padding: { top: 16, bottom: 16 },
                contextmenu: false,
                readOnly: isSubmitted,
              }}
            />
          </div>

          <ConsolePane
            problem={problem}
            runResult={runResult}
            submitResult={submitResult}
            activeCase={activeCase}
            setActiveCase={setActiveCase}
            customCases={customCases}
            setCustomCases={setCustomCases}
            section={consoleSection}
            setSection={setConsoleSection}
            language={lang}
            code={codes[problem._id]?.[lang]}
            isOpen={consoleOpen}
            setIsOpen={setConsoleOpen}
          />
          
          {/* Next problem navigation after submit */}
          {submitResult && (
            <div className="post-submit-nav" style={{ padding: '0 16px 12px', background: 'var(--bg-dark)' }}>
              {problems.map((p, i) => {
                if (p._id === problem._id) return null
                return (
                  <button
                    key={p._id}
                    className={`next-prob-btn ${submittedProblems.has(p._id) ? 'done' : ''}`}
                    onClick={() => { setCurrentProblem(i); setActiveTab('problem') }}
                  >
                    {submittedProblems.has(p._id) ? '✓' : '→'} Problem {i + 1}: {p.title}
                  </button>
                )
              })}
              {allSubmitted && (
                <button className="deepdive-inline-btn" onClick={handleProceedToDeepDive}>
                  All done — Proceed to Deep Dive Interview →
                </button>
              )}
            </div>
          )}

          <div className="editor-footer">
            <div className="editor-actions">
              {!isSubmitted ? (
                <>
                  <button className="run-btn" onClick={handleRun} disabled={running}>
                    {running ? <><span className="perm-spinner" /> Running…</> : '▶ Run Code'}
                  </button>
                  <button className="submit-btn" onClick={handleSubmit} disabled={running}>
                    Submit Solution
                  </button>
                  {!allSubmitted && submittedProblems.size > 0 && (
                    <span className="submit-hint">
                      {problems.length - submittedProblems.size} problem{problems.length - submittedProblems.size !== 1 ? 's' : ''} remaining
                    </span>
                  )}
                  <button 
                    className="run-btn" 
                    style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid var(--hard)', color: 'var(--hard)' }} 
                    onClick={() => {
                      if(window.confirm('Are you sure you want to end the test early and generate the evaluation report?')) {
                        handleEndTest();
                      }
                    }}
                  >
                    End Test
                  </button>
                </>
              ) : (
                <div className="submitted-state">
                  <span className="badge badge-green">✓ Problem Submitted</span>
                  {!allSubmitted && (
                    <span className="submitted-hint">
                      Move to the next problem using the tabs above or the links below
                    </span>
                  )}
                  {allSubmitted && (
                    <button className="proceed-inline-btn" onClick={handleProceedToDeepDive}>
                      All Problems Done — Start Deep Dive →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Monitor sidebar */}
        <MonitorSidebar
          timer={timer}
          phase="Coding Round"
          violations={violations}
        />
      </div>
    </div>
  )
}

