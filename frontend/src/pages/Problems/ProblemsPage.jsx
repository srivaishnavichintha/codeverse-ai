import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ProblemsAPI, POTDAPI, StatsAPI} from "../../services/problemsService.js";
import { useDebounce } from "../../hooks/useDebounce.js";
import Icon from "../../components/Icon/Icon.jsx";
import "./Problems.css";

const TAGS = ["Array", "String", "Hash Table", "DP", "Greedy", "Tree", "Graph", "Binary Search", "Two Pointers"];
const DIFFS = ["All", "Easy", "Medium", "Hard"];
const STATUSES = ["All", "Solved", "Attempted", "Todo"];
const SORTS = [
  { v: "default", l: "Sort: Default" },
  { v: "acceptance", l: "Acceptance ↓" },
  { v: "solved", l: "Most Solved" },
];

export default function ProblemsPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [difficulty, setDifficulty] = useState("All");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState("default");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const debouncedSearch = useDebounce(search, 300);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Reset to page 1 on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, difficulty, tag, status, sort]);

  // Fetch problems
  useEffect(() => {
    let active = true;
    setLoading(true);
    ProblemsAPI.list({
      search: debouncedSearch || undefined,
      difficulty: difficulty === "All" ? undefined : difficulty,
      tag: tag || undefined,
      status: status === "All" ? undefined : status,
      sort: sort === "default" ? undefined : sort,
      page,
      pageSize,
    })
      .then((d) => { if (active) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [debouncedSearch, difficulty, tag, status, sort, page]);

  // Fetch stats
  useEffect(() => {
    StatsAPI.problemStats().then(setStats).catch(() => {});
  }, []);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data?.total || 0) / pageSize)), [data]);

  return (
    <div className="cv-problems-layout">
      {/* Main content */}
      <main>
        {/* Header */}
        <div className="cv-glass cv-problems-header">
          <div className="cv-problems-title-row">
            <div>
              <h1 className="cv-problems-title">
                Problem<span>s</span>
              </h1>
              <div className="cv-stats-row">
                <div className="cv-prob-stat">
                  <span className="cv-prob-stat__label">Solved</span>
                  <span className="cv-prob-stat__value">{stats?.solved?.total ?? "—"}</span>
                </div>
                <div className="cv-prob-stat">
                  <span className="cv-prob-stat__label">Easy</span>
                  <span className="cv-prob-stat__value diff-easy">{stats?.solved?.easy ?? "—"}</span>
                </div>
                <div className="cv-prob-stat">
                  <span className="cv-prob-stat__label">Medium</span>
                  <span className="cv-prob-stat__value diff-medium">{stats?.solved?.medium ?? "—"}</span>
                </div>
                <div className="cv-prob-stat">
                  <span className="cv-prob-stat__label">Hard</span>
                  <span className="cv-prob-stat__value diff-hard">{stats?.solved?.hard ?? "—"}</span>
                </div>
              </div>
            </div>
            <div>

              <div className="cv-consistency">
                {stats?.consistency
                  ? stats.consistency.map((d, i) => (
                      <span key={i} className={`l${Math.min(4, d.v)}`} />
                    ))
                  : Array.from({ length: 28 }).map((_, i) => <span key={i} />)}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="cv-prob-search">
            <Icon name="search" size={15} />
            <input
              className="cv-input"
              placeholder="Search problems by title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>⌘K</kbd>
          </div>
        </div>

        {/* Filters */}
        <div className="cv-glass cv-filters-bar">
          <span className="cv-filters-label">
            <Icon name="filter" size={13} />
            Filters
          </span>
          <select className="cv-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {DIFFS.map((d) => (
              <option key={d} value={d}>{d === "All" ? "Difficulty: All" : d}</option>
            ))}
          </select>
          <select className="cv-select" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Tags: All</option>
            {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="cv-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === "All" ? "Status: All" : s}</option>
            ))}
          </select>
          <select className="cv-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="cv-glass cv-table-wrap">
          <table className="cv-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Status</th>
                <th>Title</th>
                <th style={{ width: 100 }}>Difficulty</th>
                <th style={{ width: 110 }}>Acceptance</th>
                <th>Tags</th>
                <th style={{ width: 110 }}>Solved</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td colSpan={7}>
                      <div className="cv-skel" style={{ height: 18, margin: "4px 0" }} />
                    </td>
                  </tr>
                ))}
              {!loading && (!data || data?.items?.length === 0) && (
                <tr>
                  <td colSpan={7}>
                    <div className="cv-empty-state">
                      <span className="cv-empty-icon">🔍</span>
                      <div className="cv-empty-title">No problems match</div>
                      <div className="cv-empty-sub">Try adjusting your filters</div>
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                data?.items?.map((p) => <ProblemRow key={p._id || p.id} p={p} />)}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="cv-pagination">
          <button
            className="cv-btn cv-btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <Icon name="chevronLeft" size={13} /> Prev
          </button>
          <span className="cv-chip" style={{ padding: "6px 14px", fontSize: 12 }}>
            {page} / {totalPages}
          </span>
          <button
            className="cv-btn cv-btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <Icon name="chevronRight" size={13} />
          </button>
        </div>
      </main>

      {/* Sidebar */}
      <aside className="cv-problems-sidebar">
        <PotdWidget />
        <WeeklyWidget stats={stats} />
        {/* <DailyChallengeWidget /> */}
        <RecentSubmissionsWidget />
      </aside>
    </div>
  );
}

// ── Problem row ──
function ProblemRow({ p }) {
  return (
    <tr className={`cv-prob-row ${p.status === "solved" ? "is-solved" : ""}`}>
      <td>
        <span className={`status-dot ${p.status}`} title={p.status} />
      </td>
      <td>
        {p.premium ? (
          <span className="cv-prob-locked">
            <Icon name="lock" size={12} />
            <span className="cv-prob-num">{p.number}.</span>
            {p.title}
          </span>
        ) : (
          <Link to={`/problems/${p.slug}`} className="cv-prob-link">
            <span className="cv-prob-num">{p.number}.</span>
            {p.title}
          </Link>
        )}
      </td>
      <td className={`diff-${(p.difficulty || "medium").toLowerCase()}`} style={{ fontWeight: 600, fontSize: 12 }}>
        {p.difficulty}
      </td>
      <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)", fontSize: 13 }}>
        {parseFloat(p.acceptance ?? p.acceptanceRate ?? 0).toFixed(1)}%
      </td>
      <td>
        <div className="cv-tags">
          {(p.tags || []).slice(0, 2).map((t) => (
            <span key={t} className="cv-chip">{t}</span>
          ))}
        </div>
      </td>
      <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)", fontSize: 13 }}>
        {(p.solvedCount ?? 0).toLocaleString()}
      </td>
    </tr>
  );
}

// ── POTD Widget ──
function PotdWidget() {
  const [potd, setPotd] = useState(null);
  useEffect(() => {
    POTDAPI.get().then(setPotd).catch(() => {});
  }, []);

  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  
  const lastSolvedDate = potd?.lastSolvedAt ? new Date(potd.lastSolvedAt).getDate() : -1;
  const streak = potd?.streak || 0;
  
  const isSolved = (day) => {
    if (day === currentDay && lastSolvedDate === currentDay) return true;
    if (day < currentDay && day >= currentDay - streak) return true;
    return false;
  };

  return (
    <div className="cv-glass cv-widget cv-potd-widget">
      <div className="cv-widget-header">
        <div className="cv-widget-title">
          <Icon name="flame" size={14} color="var(--primary-teal)" />
          Problem of the Day
        </div>
        <span className="cv-potd-badge">
          <span className="cv-potd-dot" />
          {potd?.streak ?? 0}d streak
        </span>
      </div>
      
      {/* Calendar View */}
      <div className="cv-potd-calendar">
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const solved = isSolved(day);
          const isToday = day === currentDay;
          return (
            <div 
              key={day} 
              className={`cv-cal-day ${solved ? 'solved' : ''} ${isToday ? 'today' : ''} ${day > currentDay ? 'future' : ''}`}
            >
              {solved ? <Icon name="check" size={10} strokeWidth={3} /> : day}
            </div>
          );
        })}
      </div>

      {!potd || !potd.problem ? (
        <div className="cv-skel" style={{ height: 40, marginTop: 16 }} />
      ) : (
        <div style={{ marginTop: 16 }}>
          <div className="cv-potd-title">{potd.problem.title}</div>
          <div className={`cv-potd-diff diff-${(potd.problem.difficulty || "medium").toLowerCase()}`}>
            {potd.problem.difficulty} &bull; {parseFloat(potd.problem.acceptance ?? potd.problem.acceptanceRate ?? 0).toFixed(1)}% acceptance
          </div>
          <Link
            to={`/problems/${potd.problem.slug}`}
            className="cv-btn cv-btn-primary"
            style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
          >
            {lastSolvedDate === currentDay ? "Review →" : "Solve Now →"}
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Weekly Widget ──
function WeeklyWidget({ stats }) {
  const w = stats?.weekly;
  const pct = w ? Math.min(100, (w.solved / w.target) * 100) : 0;
  const C = 2 * Math.PI * 36;

  return (
    <div className="cv-glass cv-widget">
      <div className="cv-widget-header">
        <div className="cv-widget-title">
          <Icon name="trophy" size={14} color="var(--gold)" />
          Weekly Progress
        </div>
      </div>
      <div className="cv-ring-wrap">
        <div className="cv-ring-svg-wrap">
          <svg className="cv-ring-svg" viewBox="0 0 88 88">
            <circle className="bg" cx="44" cy="44" r="36" />
            <circle
              className="fg"
              cx="44"
              cy="44"
              r="36"
              strokeDasharray={C}
              strokeDashoffset={C - (C * pct) / 100}
            />
          </svg>
          <div className="cv-ring-num">{w ? `${w.solved}/${w.target}` : "—"}</div>
        </div>
        <div className="cv-ring-meta">
          <div><b>{w?.accuracy ?? "—"}%</b> accuracy</div>
          <div><b>{w?.runtimePercentile ?? "—"}%</b> runtime%ile</div>
          <div style={{ color: "var(--text-faint)" }}>This week</div>
        </div>
      </div>
    </div>
  );
}

// ── Daily Challenge Widget ──
function DailyChallengeWidget() {
  const [c, setC] = useState(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    ChallengesAPI.daily().then(setC).catch(() => {});
  }, []);

  const remaining = c ? Math.max(0, c.expiresAt - Date.now()) : 0;
  const hrs = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);

  const join = async () => {
    if (!c) return;
    setJoining(true);
    try {
      await ChallengesAPI.join(c.id);
      setC({ ...c, joined: true });
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="cv-glass cv-widget">
      <div className="cv-widget-header">
        <div className="cv-widget-title">
          <Icon name="zap" size={14} color="var(--primary-teal)" />
          Daily Challenge
        </div>
      </div>
      {!c ? (
        <div className="cv-skel" style={{ height: 50 }} />
      ) : (
        <>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: "var(--text-primary)" }}>
            {c.title}
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
            <span style={{ color: "var(--secondary-teal)", fontWeight: 600 }}>+{c.xp} XP</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Icon name="clock" size={11} /> {hrs}h {mins}m left
            </span>
          </div>
          <button
            className={`cv-btn ${c.joined ? "" : "cv-btn-primary"}`}
            disabled={c.joined || joining}
            onClick={join}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {c.joined ? "✓ Joined" : joining ? "Joining…" : "Join Challenge"}
          </button>
        </>
      )}
    </div>
  );
}

// ── Recent Submissions Widget ──
function RecentSubmissionsWidget() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    StatsAPI.recentSubmissions()
      .then((d) => setItems(d.items))
      .catch(() => {});
  }, []);

  return (
    <div className="cv-glass cv-widget">
      <div className="cv-widget-header">
        <div className="cv-widget-title">Recent Submissions</div>
        <span className="cv-widget-sub">last 5</span>
      </div>
      <div className="cv-subs-list">
        {!items
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="cv-skel" style={{ height: 44 }} />
            ))
          : items.map((s) => {
              const v = s.verdict === "Accepted" ? "Accepted" : s.verdict === "TLE" ? "TLE" : "Wrong";
              return (
                <div key={s._id || s.id} className="cv-sub-item">
                  <div className="cv-sub-title">
                    {typeof s.problem === 'object' ? (s.problem?.title || '—') : (s.problem || '—')}
                  </div>
                  <div className="cv-sub-meta">
                    {(s.runtime || (s.runtimeMs != null ? `${s.runtimeMs} ms` : null) || '—') !== '—'
                      ? (s.runtime || `${s.runtimeMs} ms`) + ' · ' : ''}
                    {s.language}
                  </div>
                  <span className={`cv-verdict-badge ${v}`}>{s.verdict}</span>
                </div>
              );
            })}
      </div>
    </div>
  );
}
