/**
 * ContestArena.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Live contest coding interface.
 * Shows problem list + code editor + submission status.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import Icon from '../../../components/Icon/Icon.jsx';
import SubmissionPanel from './SubmissionPanel.jsx';
import { submitSolution, getMySubmissions } from '../../../services/contestZone.service.js';
import './ContestArena.css';

const LANGUAGES = ['javascript', 'python', 'java', 'cpp'];

const STARTERS = {
  javascript: '// JavaScript solution\nfunction solve(input) {\n  // your code here\n  return null;\n}\n',
  python:     '# Python solution\ndef solve(input):\n    # your code here\n    pass\n',
  java:       '// Java solution\nimport java.util.*;\npublic class Solution {\n    public static void main(String[] args) {\n        // your code here\n    }\n}\n',
  cpp:        '// C++ solution\n#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    // your code here\n    return 0;\n}\n',
};

export default function ContestArena({
  contest,
  problems,
  isParticipant,
  socket,
  onSubmitted,
}) {
  const { user } = useAuth();
  const [selectedProblem, setSelectedProblem] = useState(problems[0] || null);
  const [code, setCode] = useState(STARTERS.javascript);
  const [language, setLanguage] = useState('javascript');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [showSubmissions, setShowSubmissions] = useState(false);

  useEffect(() => {
    setCode(STARTERS[language]);
  }, [language]);

  useEffect(() => {
    if (selectedProblem && contest?._id) {
      fetchMySubmissions();
    }
  }, [selectedProblem, contest?._id]);

  // Socket: listen for personal submission result
  useEffect(() => {
    if (socket.lastSubmissionResult) {
      setLastResult(socket.lastSubmissionResult);
      fetchMySubmissions();
    }
  }, [socket.lastSubmissionResult]);

  const fetchMySubmissions = async () => {
    try {
      const data = await getMySubmissions(contest._id);
      setSubmissions(Array.isArray(data) ? data : []);
    } catch {}
  };

  const handleSubmit = async () => {
    if (!selectedProblem || !code.trim() || !isParticipant) return;
    setSubmitting(true);
    setLastResult(null);
    try {
      const result = await submitSolution(contest._id, {
        problemId: selectedProblem._id,
        code,
        language,
      });
      setLastResult(result);
      fetchMySubmissions();
      onSubmitted?.();
    } catch (err) {
      setLastResult({ error: err.response?.data?.message || 'Submission failed' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isParticipant) {
    return (
      <div className="cv-empty-state">
        <span className="cv-empty-icon">🔒</span>
        <div className="cv-empty-title">Join to participate</div>
        <div className="cv-empty-sub">You must be a registered participant to access the arena.</div>
      </div>
    );
  }

  if (problems.length === 0) {
    return (
      <div className="cv-empty-state">
        <span className="cv-empty-icon">⏳</span>
        <div className="cv-empty-title">Problems loading...</div>
        <div className="cv-empty-sub">Problems will appear when the contest starts.</div>
      </div>
    );
  }

  return (
    <div className="cv-cz-arena">
      {/* ── Problem selector ──────────────────────────────────────── */}
      <div className="cv-cz-arena__sidebar">
        <div className="cv-glass cv-cz-arena__prob-list">
          <div className="cv-section-header" style={{ marginBottom: 12 }}>
            <h3 className="cv-section-title" style={{ fontSize: 14 }}>
              <Icon name="list" size={14} /> Problems
            </h3>
            <button
              className="cv-btn cv-btn-ghost cv-btn-sm"
              onClick={() => setShowSubmissions(!showSubmissions)}
            >
              <Icon name="history" size={12} />
              My Submissions
            </button>
          </div>
          {problems.map((p, i) => {
            const solved = submissions.some(
              s => (s.problem === p._id) && (s.verdict === 'accepted' || s.verdict === 'Accepted')
            );
            return (
              <div
                key={p._id}
                className={`cv-cz-arena__prob-item${selectedProblem?._id === p._id ? ' active' : ''}${solved ? ' solved' : ''}`}
                onClick={() => setSelectedProblem(p)}
              >
                <span className="cv-cz-arena__prob-num">#{i + 1}</span>
                <div className="cv-cz-arena__prob-info">
                  <div className="cv-cz-arena__prob-title">{p.title}</div>
                  <div className="cv-cz-arena__prob-pts">{p.maxPoints || p.points} pts</div>
                </div>
                {solved && <Icon name="checkCircle" size={14} style={{ color: 'var(--easy)', flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>

        {/* My submissions panel */}
        {showSubmissions && (
          <SubmissionPanel
            submissions={submissions.filter(s => s.problem === selectedProblem?._id)}
            onClose={() => setShowSubmissions(false)}
          />
        )}
      </div>

      {/* ── Main editor area ───────────────────────────────────────── */}
      <div className="cv-cz-arena__main">
        {selectedProblem && (
          <>
            {/* Problem statement */}
            <div className="cv-glass cv-cz-arena__problem">
              <div className="cv-cz-arena__prob-header">
                <h2 className="cv-cz-arena__prob-name">{selectedProblem.title}</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`cv-badge ${selectedProblem.difficulty === 'easy' ? 'cv-badge-easy' : selectedProblem.difficulty === 'hard' ? 'cv-badge-hard' : 'cv-badge-medium'}`}>
                    {selectedProblem.difficulty}
                  </span>
                  <span className="cv-chip">⭐ {selectedProblem.maxPoints || selectedProblem.points} pts</span>
                </div>
              </div>
              <div className="cv-cz-arena__prob-body">
                {selectedProblem.description}
              </div>
              {Array.isArray(selectedProblem.examples) && selectedProblem.examples.map((ex, i) => (
                <div key={i} className="cv-cz-arena__example">
                  <div className="cv-cz-arena__example-label">Example {i + 1}</div>
                  <div className="cv-cz-arena__example-io">
                    <div><strong>Input:</strong> <code>{typeof ex === 'string' ? ex : ex.input}</code></div>
                    {ex.output !== undefined && <div><strong>Output:</strong> <code>{ex.output}</code></div>}
                    {ex.explanation && <div><strong>Note:</strong> {ex.explanation}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Code editor */}
            <div className="cv-glass cv-cz-arena__editor">
              <div className="cv-cz-arena__editor-toolbar">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Icon name="code" size={14} style={{ color: 'var(--primary-teal)' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Solution
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="cv-select"
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                  >
                    {LANGUAGES.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  <button
                    className="cv-btn cv-btn-ghost cv-btn-sm"
                    onClick={() => setCode(STARTERS[language])}
                    title="Reset code"
                  >
                    <Icon name="rotateLeft" size={12} />
                  </button>
                </div>
              </div>
              <textarea
                className="cv-cz-arena__code"
                value={code}
                onChange={e => setCode(e.target.value)}
                spellCheck={false}
                placeholder={`Write your ${language} solution here...`}
              />

              {/* Result panel */}
              {lastResult && (
                <div className={`cv-cz-arena__result ${lastResult.error ? 'error' : (lastResult.verdict === 'accepted' || lastResult.verdict === 'Accepted') ? 'accepted' : 'rejected'}`}>
                  {lastResult.error ? (
                    <><Icon name="x" size={14} /> {lastResult.error}</>
                  ) : (lastResult.verdict === 'accepted' || lastResult.verdict === 'Accepted') ? (
                    <><Icon name="checkCircle" size={14} /> Accepted! +{lastResult.score || lastResult.pointsEarned || 0} pts · {lastResult.runtimeMs || lastResult.executionTime}ms</>
                  ) : (
                    <><Icon name="x" size={14} /> {lastResult.verdict} — {lastResult.failedAt || ''}</>
                  )}
                </div>
              )}

              <div className="cv-cz-arena__editor-footer">
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  {code.split('\n').length} lines · {code.length} chars
                </span>
                <button
                  className="cv-btn cv-btn-primary"
                  onClick={handleSubmit}
                  disabled={submitting || !code.trim()}
                >
                  {submitting ? (
                    <><span className="cv-spin-icon" /> Evaluating…</>
                  ) : (
                    <><Icon name="send" size={13} /> Submit Solution</>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
