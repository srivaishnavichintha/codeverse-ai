import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CodeEditor from "../../components/CodeEditor/CodeEditor.jsx";
import { ProblemsAPI, CodeAPI, SubmissionsAPI } from "../../services/problemsService.js";
import Icon from "../../components/Icon/Icon.jsx";
import ConsolePane from "../../components/ConsolePane/ConsolePane.jsx";
import "./Solve.css";

const LANGS = [
  { v: "cpp", l: "C++" },
  { v: "java", l: "Java" },
  { v: "python", l: "Python" },
  { v: "javascript", l: "JavaScript" },
];

const TABS = ["Description", "Editorial", "Submissions", "Discussions"];

export default function SolvePage() {
  const { slug } = useParams();
  const [problem, setProblem] = useState(null);
  const [activeTab, setActiveTab] = useState("Description");
  const [tabData, setTabData] = useState({});
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const [language, setLanguage] = useState("cpp");
  const [code, setCode] = useState("");
  const [fontSize, setFontSize] = useState(14);
  const [fullscreen, setFullscreen] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [activeCase, setActiveCase] = useState(0);
  const [customCases, setCustomCases] = useState([]);
  const [consoleSection, setConsoleSection] = useState("cases");
  const [consoleOpen, setConsoleOpen] = useState(true);

  const leftRef = useRef(null);
  const dragRef = useRef(false);

  // Load problem detail
  useEffect(() => {
    setProblem(null);
    ProblemsAPI.detail(slug).then(setProblem).catch(() => {});
  }, [slug]);

  // Fetch tab data lazily
  useEffect(() => {
    if (activeTab === "Description" || tabData[activeTab]) return;
    const fns = {
      Submissions: () => SubmissionsAPI.byProblem(problem._id || problem.id),
      Discussions: () => ProblemsAPI.discussions(problem._id || problem.id),
    };
    fns[activeTab]?.()
      .then((d) => setTabData((prev) => ({ ...prev, [activeTab]: d })))
      .catch(() => {});
  }, [activeTab, slug, tabData]);

  // Load template / draft
  useEffect(() => {
    const draftKey = `cv_draft_${slug}_${language}`;
    const draft = localStorage.getItem(draftKey);
    if (draft && draft.trim() !== "" && draft.trim() !== "// start coding") { 
      setCode(draft); 
      return; 
    }
    CodeAPI.template(language, slug)
      .then((d) => setCode(d?.code ?? d ?? "// start coding\n"))
      .catch(() => setCode("// start coding\n"));
  }, [slug, language]);

  // Auto-save
  useEffect(() => {
    if (!problem || !code) return;
    const t = setTimeout(async () => {
      try {
        await CodeAPI.saveDraft({ code, language, problemId: problem._id || problem.id });
        setSavedAt(Date.now());
        localStorage.setItem(`cv_draft_${slug}_${language}`, code);
      } catch { /* silent */ }
    }, 1200);
    return () => clearTimeout(t);
  }, [code, language, problem, slug]);

  // Resizable panels
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current || !leftRef.current) return;
      const parent = leftRef.current.parentElement;
      const rect = parent.getBoundingClientRect();
      const w = Math.min(Math.max(e.clientX - rect.left, 280), rect.width - 280);
      leftRef.current.style.flex = `0 0 ${w}px`;
    };
    const onUp = () => {
      dragRef.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleRun = async () => {
    if (!problem) return;
    setConsoleSection("result");
    setRunning(true);
    setRunResult(null);
    try {
      const exampleCases = (problem?.sampleTestCases?.length ? problem.sampleTestCases : problem?.examples) || [];
      const allCases = [
        ...exampleCases.map((e, i) => ({ id: i, input: e.input, expected: e.output })),
        ...customCases.map((c, i) => ({ id: exampleCases.length + i, input: c.input }))
      ];
        
      const r = await CodeAPI.run({ 
        code, 
        language, 
        problemId: problem._id || problem.id, 
        testcases: allCases
      });
      
      setRunResult(r);
    } finally { setRunning(false); }
  };

  const handleSubmit = async () => {
    if (!problem) return;
    setConsoleSection("result");
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const r = await CodeAPI.submit({ code, language, problemId: problem._id || problem.id });
      setSubmitResult(r);
      setActiveTab("Submissions");
      SubmissionsAPI.byProblem(problem._id || problem.id).then((d) => setTabData((prev) => ({ ...prev, Submissions: d })));
    } finally { setSubmitting(false); }
  };

  const handleReset = async () => {
    if (!problem || !window.confirm("Reset code to default template?")) return;
    await CodeAPI.reset({ problemId: problem._id || problem.id, language }).catch(() => {});
    const d = await CodeAPI.template(language, slug).catch(() => ({ code: "" }));
    setCode(d.code);
    localStorage.removeItem(`cv_draft_${slug}_${language}`);
  };

  const toggleLike = async () => {
    setLiked((v) => !v);
    setDisliked(false);
    await ProblemsAPI.like(slug).catch(() => {});
  };
  const toggleDislike = async () => {
    setDisliked((v) => !v);
    setLiked(false);
    await ProblemsAPI.dislike(slug).catch(() => {});
  };
  const toggleBookmark = async () => {
    setBookmarked((v) => !v);
    await ProblemsAPI.bookmark(slug).catch(() => {});
  };

  return (
    <div className={`cv-solve-page${fullscreen ? " is-fullscreen" : ""}`}>
      <div className="cv-solve-panels">
        {/* ── LEFT panel ── */}
        <div className="cv-solve-left" ref={leftRef}>
          <div className="cv-solve-tabs">
            {TABS.map((t) => (
              <button
                key={t}
                className={`cv-solve-tab${activeTab === t ? " active" : ""}`}
                onClick={() => setActiveTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="cv-solve-pane">
            {!problem ? (
              <div>
                <div className="cv-skel" style={{ height: 28, marginBottom: 10, width: "60%" }} />
                <div className="cv-skel" style={{ height: 16, marginBottom: 8, width: "40%" }} />
                <div className="cv-skel" style={{ height: 120, marginBottom: 12 }} />
                <div className="cv-skel" style={{ height: 80 }} />
              </div>
            ) : (
              <div key={activeTab} className="anim-fade-in">
                {activeTab === "Description" && (
                  <DescriptionTab
                    problem={problem}
                    liked={liked}
                    disliked={disliked}
                    bookmarked={bookmarked}
                    onLike={toggleLike}
                    onDislike={toggleDislike}
                    onBookmark={toggleBookmark}
                  />
                )}
                {activeTab === "Editorial" && (
                  problem?.editorial
                    ? <div className="cv-editorial" dangerouslySetInnerHTML={{ __html: problem.editorial }} />
                    : <div style={{ color: 'var(--text-faint)', padding: '20px' }}>No editorial available for this problem yet.</div>
                )}

                {activeTab === "Submissions" && (
                  <SubmissionsTab data={tabData.Submissions} />
                )}
                {activeTab === "Discussions" && (
                  <DiscussionsTab data={tabData.Discussions} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Drag handle */}
        <div
          className="cv-resizer"
          onMouseDown={() => {
            dragRef.current = true;
            document.body.style.cursor = "col-resize";
          }}
        />

        {/* ── RIGHT panel ── */}
        <div className="cv-solve-right">
          <div className="cv-editor-toolbar">
            <select
              className="cv-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGS.map((l) => (
                <option key={l.v} value={l.v}>{l.l}</option>
              ))}
            </select>
            <select
              className="cv-select"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            >
              {[12, 13, 14, 16, 18].map((s) => (
                <option key={s} value={s}>{s}px</option>
              ))}
            </select>
            <span className="cv-autosave-label">
              {savedAt ? (
                <><Icon name="save" size={11} /> Saved {new Date(savedAt).toLocaleTimeString()}</>
              ) : "Auto-saving…"}
            </span>
            <div className="cv-toolbar-spacer" />
            <button className="cv-iconbtn" onClick={() => setFullscreen((v) => !v)} title="Fullscreen">
              <Icon name="maximize" size={13} />
            </button>
            <button className="cv-iconbtn" onClick={handleReset} title="Reset code">
              <Icon name="rotateLeft" size={13} /> Reset
            </button>
            <div style={{ display: "flex", gap: "8px", flexWrap: "nowrap" }}>
              <button
                className="cv-btn cv-btn-sm"
                onClick={handleRun}
                disabled={running || submitting || !problem}
              >
                <Icon name="play" size={12} />
                {running ? "Running…" : "Run"}
              </button>
              <button
                className="cv-btn cv-btn-primary cv-btn-sm"
                onClick={handleSubmit}
                disabled={submitting || running || !problem}
              >
                <Icon name="checkCircle" size={12} />
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>

          <div className="cv-editor-host">
            <CodeEditor
              value={code}
              onChange={setCode}
              language={language}
              fontSize={fontSize}
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
            language={language}
            code={code}
            isOpen={consoleOpen}
            setIsOpen={setConsoleOpen}
          />
        </div>
      </div>
    </div>
  );
}

// ── Description Tab ──
function DescriptionTab({ problem, liked, disliked, bookmarked, onLike, onDislike, onBookmark }) {
  return (
    <>
      <div className="cv-prob-head">
        <div>
          <Link to="/problems" className="cv-prob-back">
            <Icon name="arrowLeft" size={12} /> All Problems
          </Link>
          <h1 className="cv-prob-detail-title">
            {problem.number}. {problem.title}
          </h1>
          <div className="cv-prob-meta-row">
            <span className={`cv-badge cv-badge-${problem.difficulty.toLowerCase()}`}>
              {problem.difficulty}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
              {problem.acceptance.toFixed(1)}% acceptance
            </span>
            {problem.tags.map((t) => (
              <span key={t} className="cv-chip">{t}</span>
            ))}
          </div>
        </div>
        <div className="cv-prob-actions">
          <button className={`cv-iconbtn${liked ? " active" : ""}`} onClick={onLike}>
            <Icon name="thumbsUp" size={12} /> {problem.likes}
          </button>
          <button className={`cv-iconbtn${disliked ? " active" : ""}`} onClick={onDislike}>
            <Icon name="thumbsDown" size={12} />
          </button>
          <button className={`cv-iconbtn${bookmarked ? " active" : ""}`} onClick={onBookmark}>
            <Icon name="bookmark" size={12} />
          </button>
        </div>
      </div>

      <div className="cv-prob-body">
        <p>{problem.description}</p>

        <h3>Examples</h3>
        {problem.examples?.map((ex, i) => (
          <div key={i} className="cv-example-block">
            <button
              className="cv-iconbtn cv-example-copy"
              style={{ fontSize: 11, padding: "4px 8px" }}
              onClick={() => navigator.clipboard.writeText(`${ex.input}\n${ex.output}`)}
            >
              <Icon name="copy" size={11} /> Copy
            </button>
            <span className="cv-example-label">Input</span>
            <pre>{ex.input}</pre>
            <span className="cv-example-label">Output</span>
            <pre>{ex.output}</pre>
            {ex.explanation && (
              <>
                <span className="cv-example-label">Explanation</span>
                <pre>{ex.explanation}</pre>
              </>
            )}
          </div>
        ))}

        <div className="cv-hints">
          <h3>Hints</h3>
          {problem.hints?.map((h, i) => (
            <details key={i}>
              <summary>Hint {i + 1}</summary>
              <div>{h}</div>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}



// ── Submissions Tab ──
function SubmissionsTab({ data }) {
  if (!data) return <div className="cv-skel" style={{ height: 80 }} />;
  const items = Array.isArray(data) ? data : data?.items || [];
  return (
    <ul className="cv-content-list">
      {items.length === 0 ? <li style={{color: 'var(--text-faint)'}}>No submissions yet.</li> : null}
      {items.map((s) => {
        const runtime  = s.runtime  || (s.runtimeMs  != null ? `${s.runtimeMs} ms`  : '—');
        const memory   = s.memory   || (s.memoryKb   != null ? `${(s.memoryKb/1024).toFixed(1)} MB` : '—');
        const dateStr  = s.at       || s.createdAt;
        return (
          <li key={s._id || s.id}>
            <b style={{ color: s.verdict === 'Accepted' ? 'var(--easy)' : 'var(--hard)' }}>
              {s.verdict}
            </b>
            <span> · {s.language} · {runtime} · {memory} · {dateStr ? new Date(dateStr).toLocaleString() : '—'}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ── Discussions Tab ──
function DiscussionsTab({ data }) {
  if (!data) return <div className="cv-skel" style={{ height: 80 }} />;
  const items = Array.isArray(data) ? data : data?.items || [];
  return (
    <ul className="cv-content-list">
      {items.length === 0 ? <li style={{color: 'var(--text-faint)'}}>No discussions yet. Start one!</li> : null}
      {items.map((d) => (
        <li key={d._id || d.id}>
          <b>{d.title}</b>
          <span> · {d.author} · {d.replies} replies · ▲ {d.votes}</span>
        </li>
      ))}
    </ul>
  );
}


