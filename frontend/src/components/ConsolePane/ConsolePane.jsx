import React, { useState } from "react";
import Icon from "../Icon/Icon";
import "./ConsolePane.css";

export default function ConsolePane({
  problem,
  runResult,
  submitResult,
  activeCase,
  setActiveCase,
  customCases,
  setCustomCases,
  section,
  setSection,
  language,
  code,
  isOpen,
  setIsOpen
}) {
  const exampleCases = (problem?.sampleTestCases?.length ? problem.sampleTestCases : problem?.examples) || [];
  const allCases = [
    ...exampleCases.map((e, i) => ({ id: i, input: e.input })),
    ...customCases.map((c, i) => ({ id: 100 + i, input: c.input, custom: true })),
  ];

  const addCase = () => setCustomCases((cs) => [...cs, { input: "" }]);
  const updateCase = (i, input) =>
    setCustomCases((cs) => cs.map((c, idx) => (idx === i ? { input } : c)));

  const result = submitResult || runResult;
  const [resultCase, setResultCase] = useState(0);

  return (
    <div className={`cv-console ${isOpen ? "is-open" : "is-closed"}`}>
      <div className="cv-console-head">
        <button
          className={`cv-solve-tab${section === "cases" ? " active" : ""}`}
          onClick={() => {
            setSection("cases");
            if (!isOpen && setIsOpen) setIsOpen(true);
          }}
          style={{ padding: "6px 12px", fontSize: 12 }}
        >
          Testcases
        </button>
        <button
          className={`cv-solve-tab${section === "result" ? " active" : ""}`}
          onClick={() => {
            setSection("result");
            if (!isOpen && setIsOpen) setIsOpen(true);
          }}
          style={{ padding: "6px 12px", fontSize: 12 }}
        >
          Result
        </button>
        
        {setIsOpen && (
          <button 
            style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: "4px" }} 
            onClick={() => setIsOpen(!isOpen)}
          >
            <Icon name={isOpen ? "chevronDown" : "chevronUp"} size={14} />
          </button>
        )}
      </div>

      <div className="cv-console-body">
        {section === "cases" && (
          <>
            <div className="cv-case-tabs">
              {allCases.map((c, i) => (
                <button
                  key={c.id}
                  className={`cv-case-tab${activeCase === i ? " active" : ""}`}
                  onClick={() => setActiveCase(i)}
                >
                  Case {i + 1}{c.custom ? " ✎" : ""}
                </button>
              ))}
              <button className="cv-case-tab" onClick={addCase}>
                <Icon name="plus" size={10} /> Add
              </button>
            </div>

            {allCases[activeCase] ? (
              allCases[activeCase].custom ? (
                <div>
                  <textarea
                    className="cv-input"
                    style={{ paddingLeft: 12, minHeight: 80, fontFamily: "var(--font-mono)", fontSize: 13, width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: "4px" }}
                    value={customCases[activeCase - exampleCases.length]?.input ?? ""}
                    onChange={(e) => updateCase(activeCase - exampleCases.length, e.target.value)}
                    placeholder="Enter custom input…"
                  />
                </div>
              ) : (
                <div className="cv-case-detail">
                  <label>Input</label>
                  <div className="cv-val">{allCases[activeCase].input}</div>
                </div>
              )
            ) : (
              <div style={{ color: "var(--text-faint)", fontSize: 13 }}>No testcase selected.</div>
            )}
          </>
        )}

        {section === "result" && (
          !result ? (
            <div style={{ color: "var(--text-faint)", fontSize: 13 }}>
              Run or submit to see results.
            </div>
          ) : (
            <div className="anim-fade-up">
              <div className="cv-result-card">
                <span className={`cv-result-verdict ${result.verdict.replace(/\s+/g, "")}`}>
                  {result.verdict}
                </span>
                {result.runtime && (
                  <span className="cv-result-stat">
                    <span>{result.runtime}</span> runtime
                  </span>
                )}
                {result.memory && (
                  <span className="cv-result-stat">
                    <span>{result.memory}</span> memory
                  </span>
                )}
                {typeof result.passed === "number" && (
                  <span className="cv-result-stat">
                    <span>{result.passed}/{result.total}</span> cases
                  </span>
                )}
              </div>
              {result.cases && (
                <div className="cv-case-tabs">
                  {result.cases.map((c, i) => (
                    <button
                      key={c.id}
                      className={`cv-case-tab ${c.status} ${resultCase === i ? " active" : ""}`}
                      onClick={() => setResultCase(i)}
                    >
                      Case {i + 1}
                    </button>
                  ))}
                </div>
              )}
              {result.cases?.[resultCase] && (
                <div className="cv-case-detail" style={{ marginTop: 10 }}>
                  <label>Input</label>
                  <div className="cv-val">{result.cases[resultCase].input || 'Hidden'}</div>
                  <label>Expected</label>
                  <div className="cv-val">{result.cases[resultCase].expected || 'Hidden'}</div>
                  <label>Got</label>
                  <div className={`cv-val ${result.cases[resultCase].status === 'failed' ? 'cv-val-error' : ''}`}>{result.cases[resultCase].got || 'Hidden'}</div>
                </div>
              )}
              {!result.cases && (
                <div className="cv-case-detail" style={{ marginTop: 10 }}>
                  <label>Output</label>
                  <div className="cv-val">{result.output || result.error || 'No output'}</div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
