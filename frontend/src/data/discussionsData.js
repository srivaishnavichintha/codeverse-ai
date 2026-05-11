// ============================================================
// CodeVerse — Discussions mock data
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

export const MOCK_POSTS = [
  {
    id: "1",
    author: "alice_dev",
    avatar: "AD",
    rating: 2104,
    title: "Clean O(n) DP solution for Longest Increasing Subsequence",
    preview: "Most tutorials show the O(n²) DP first. Here's a clean patience sorting approach that runs in O(n log n) with detailed reasoning...",
    body: "Full writeup with code...",
    tags: ["Dynamic Programming", "Binary Search"],
    type: "problem",
    difficulty: "Medium",
    relatedProblem: "300. Longest Increasing Subsequence",
    upvotes: 482,
    downvotes: 12,
    comments: 56,
    timestamp: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
    solvedByUser: true,
  },
  {
    id: "2",
    author: "kostya_cf",
    avatar: "KC",
    rating: 2890,
    title: "Google L4 onsite — full interview experience (offer)",
    preview: "Sharing my recent Google onsite experience: 4 coding rounds + 1 system design. Questions, what worked, what didn't, and prep timeline...",
    body: "Full writeup...",
    tags: ["Graphs", "Trees"],
    type: "interview",
    upvotes: 1320,
    downvotes: 8,
    comments: 184,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: "3",
    author: "newbie_42",
    avatar: "N4",
    rating: 1102,
    title: "Why does my BFS TLE on this grid problem?",
    preview: "I'm using a standard BFS with a visited set but it keeps timing out on the last test case. Code inside, would appreciate a review.",
    body: "Code...",
    tags: ["Graphs", "Arrays"],
    type: "problem",
    difficulty: "Hard",
    relatedProblem: "1293. Shortest Path in a Grid",
    upvotes: 24,
    downvotes: 1,
    comments: 11,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
  },
  {
    id: "4",
    author: "ritika_codes",
    avatar: "RC",
    rating: 1876,
    title: "Weekly Contest 412 — editorial discussion",
    preview: "Let's discuss approaches for Q3 and Q4. I solved Q3 with segment tree, but I think there's a simpler two-pointer trick...",
    body: "Editorial...",
    tags: ["Greedy", "Math"],
    type: "general",
    upvotes: 312,
    downvotes: 4,
    comments: 78,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
  },
  {
    id: "5",
    author: "thomas_b",
    avatar: "TB",
    rating: 2455,
    title: "How I went from 1200 to 2000 in 6 months — complete roadmap",
    preview: "A practical, no-nonsense roadmap with topic order, problem counts, and how I structured my weeks. No paid courses needed.",
    body: "Roadmap...",
    tags: ["Recursion", "Dynamic Programming", "Graphs"],
    type: "general",
    upvotes: 2100,
    downvotes: 30,
    comments: 240,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
  },
  {
    id: "6",
    author: "dev_prime",
    avatar: "DP",
    rating: 1654,
    title: "Trie vs HashMap — when to use which?",
    preview: "After solving 50+ string problems, here's my mental model for deciding between Trie and HashMap approaches...",
    body: "Analysis...",
    tags: ["Strings", "Hash Table"],
    type: "problem",
    difficulty: "Medium",
    upvotes: 187,
    downvotes: 6,
    comments: 33,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
  {
    id: "7",
    author: "meta_swe",
    avatar: "MS",
    rating: 2231,
    title: "Meta E5 phone screen — system design component",
    preview: "Sharing my Meta E5 phone screen experience focusing on the SD portion. They asked me to design a URL shortener with analytics...",
    body: "Experience...",
    tags: ["Graphs", "Trees"],
    type: "interview",
    upvotes: 876,
    downvotes: 15,
    comments: 92,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
  },
  {
    id: "8",
    author: "code_wanderer",
    avatar: "CW",
    rating: 1432,
    title: "Greedy vs DP: my decision framework after 200 problems",
    preview: "I used to confuse greedy and DP approaches all the time. After deliberately solving 200 problems with this framework, it finally clicked...",
    body: "Framework...",
    tags: ["Greedy", "Dynamic Programming"],
    type: "problem",
    difficulty: "Medium",
    upvotes: 934,
    downvotes: 22,
    comments: 118,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 144).toISOString(),
  },
];

export const TRENDING_POSTS = [
  { id: "t1", title: "Editorial: Weekly Contest 412 Q4", comments: 132 },
  { id: "t2", title: "Meta E5 system design — full transcript", comments: 98 },
  { id: "t3", title: "Why segment trees finally clicked for me", comments: 74 },
  { id: "t4", title: "Mock interview swap — this week's thread", comments: 51 },
];

export const TOP_CONTRIBUTORS = [
  { name: "kostya_cf", rating: 2890, posts: 142, avatar: "KC" },
  { name: "thomas_b", rating: 2455, posts: 98, avatar: "TB" },
  { name: "alice_dev", rating: 2104, posts: 76, avatar: "AD" },
  { name: "ritika_codes", rating: 1876, posts: 63, avatar: "RC" },
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
