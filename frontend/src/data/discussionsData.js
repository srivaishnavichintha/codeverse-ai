// ============================================================
// CodeVerse — Discussions common data and utilities
// ============================================================

export const DISCUSSION_TAGS = [
  "Arrays", "Dynamic Programming", "Graphs", "Trees",
  "Strings", "Greedy", "Math", "Binary Search",
  "Hash Table", "Recursion",
];

export const CATEGORIES = [
  { id: "all", label: "All Discussions" },
  { id: "problem", label: "Problem Discussions" },
  { id: "interview", label: "Interview Experiences" },
  { id: "contest", label: "Contest Discussions" },
  { id: "career", label: "Career Guidance" },
];

export function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export const POST_TYPE_MAP = {
  all: null,
  problem: "problem",
  interview: "interview",
  contest: "general",
  career: "general",
};
