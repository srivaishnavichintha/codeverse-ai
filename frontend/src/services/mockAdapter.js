// ============================================================
// CodeVerse — Frontend Mock API Adapter
// All data is generated deterministically using seeded randomness.
// Replace window.__CV_API__ with your backend base URL to bypass.
// ============================================================

const TAGS = ["Array", "String", "Hash Table", "DP", "Greedy", "Tree", "Graph", "Binary Search", "Math", "Two Pointers", "Stack", "Heap", "Sorting", "Recursion"];
const COMPANIES = ["Google", "Meta", "Amazon", "Microsoft", "Apple", "Netflix", "Uber", "Stripe", "Airbnb", "Twitter"];

const PROBLEM_TITLES = [
  "Two Sum", "Add Two Numbers", "Longest Substring Without Repeating Characters",
  "Median of Two Sorted Arrays", "Longest Palindromic Substring", "Reverse Integer",
  "Container With Most Water", "3Sum", "Valid Parentheses", "Merge Two Sorted Lists",
  "Generate Parentheses", "Trapping Rain Water", "Group Anagrams", "Maximum Subarray",
  "Spiral Matrix", "Jump Game", "Merge Intervals", "Unique Paths", "Climbing Stairs",
  "Edit Distance", "Sort Colors", "Word Search", "Decode Ways", "Binary Tree Inorder Traversal",
  "Validate Binary Search Tree", "Symmetric Tree", "Maximum Depth of Binary Tree",
  "Best Time to Buy and Sell Stock", "Word Ladder", "LRU Cache", "Min Stack",
  "Number of Islands", "Course Schedule", "Implement Trie", "Kth Largest Element in Array",
  "Find Minimum in Rotated Sorted Array", "Search in Rotated Sorted Array",
  "Product of Array Except Self", "Maximum Product Subarray", "Coin Change",
  "Longest Common Subsequence", "Pacific Atlantic Water Flow", "Alien Dictionary",
  "Serialize and Deserialize Binary Tree", "Sliding Window Maximum",
];

function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

const DB_PROBLEMS = PROBLEM_TITLES.map((title, i) => {
  const r = seededRand(i + 7);
  const diffIdx = Math.floor(r() * 3);
  return {
    id: i + 1,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""),
    number: i + 1,
    title,
    difficulty: (["Easy", "Medium", "Hard"])[diffIdx],
    acceptance: parseFloat((35 + r() * 50).toFixed(1)),
    tags: TAGS.filter(() => r() > 0.7).slice(0, 3).concat([TAGS[i % TAGS.length]]).slice(0, 3),
    companies: COMPANIES.filter(() => r() > 0.6).slice(0, 3),
    solvedCount: Math.floor(2000 + r() * 80000),
    status: r() > 0.75 ? "solved" : r() > 0.55 ? "attempted" : "todo",
    premium: r() > 0.92,
    likes: Math.floor(500 + r() * 12000),
    dislikes: Math.floor(20 + r() * 600),
  };
});

const CODE_TEMPLATES = {
  cpp: `class Solution {
public:
    // Write your solution here
    vector<int> solve(vector<int>& nums) {
        
    }
};`,
  java: `class Solution {
    // Write your solution here
    public int[] solve(int[] nums) {
        
    }
}`,
  python: `class Solution:
    def solve(self, nums: List[int]) -> List[int]:
        # Write your solution here
        pass`,
  javascript: `/**
 * @param {number[]} nums
 * @return {number[]}
 */
var solve = function(nums) {
    // Write your solution here
};`,
};

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function ok(data) {
  return { data, status: 200, statusText: "OK", headers: {} };
}

export async function mockAdapter(config) {
  const url = (config.url || "").replace(/^[/]api/, "");
  const method = (config.method || "get").toLowerCase();
  const params = config.params || {};

  await wait(120 + Math.random() * 180);

  // ── Problems list ──
  if (method === "get" && url === "/problems") {
    let list = [...DB_PROBLEMS];
    if (params.search) {
      const q = String(params.search).toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q));
    }
    if (params.difficulty && params.difficulty !== "All") {
      list = list.filter((p) => p.difficulty === params.difficulty);
    }
    if (params.tag) {
      list = list.filter((p) => p.tags.includes(params.tag));
    }
    if (params.company) {
      list = list.filter((p) => p.companies.includes(params.company));
    }
    if (params.status && params.status !== "All") {
      list = list.filter((p) => p.status === String(params.status).toLowerCase());
    }
    if (params.sort === "acceptance") list.sort((a, b) => b.acceptance - a.acceptance);
    if (params.sort === "solved") list.sort((a, b) => b.solvedCount - a.solvedCount);

    const page = Number(params.page || 1);
    const pageSize = Number(params.pageSize || 15);
    const total = list.length;
    return ok({ items: list.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize });
  }

  // ── Single problem ──
  const detailMatch = url.match(/^[/]problems[/]([^/]+)(?:[/](.+))?$/);
  if (method === "get" && detailMatch) {
    const slug = detailMatch[1];
    const sub = detailMatch[2];
    const p = DB_PROBLEMS.find((x) => x.slug === slug || String(x.id) === slug);
    if (!p) return ok({ error: "not found" });

    if (!sub) {
      return ok({
        ...p,
        description: `Given an array of integers **nums** and an integer **target**, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.`,
        examples: [
          { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]." },
          { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
          { input: "nums = [3,3], target = 6", output: "[0,1]" },
        ],
        hints: [
          "A brute force approach is to iterate through all pairs.",
          "Try using a hash map to reduce to O(n) time.",
          "For each element, check if (target - element) is already in the map.",
        ],
      });
    }

    if (sub === "editorial") {
      return ok({
        html: `<h3>Approach 1: Brute Force — O(n²)</h3>
<p>Iterate through every pair of elements and check if they sum to target.</p>
<pre><code>for i in range(n):
  for j in range(i+1, n):
    if nums[i] + nums[j] == target:
      return [i, j]</code></pre>
<h3>Approach 2: Hash Map — O(n)</h3>
<p>Use a hash map to store each element and its index. For each element, check if (target - element) is already in the map.</p>
<pre><code>seen = {}
for i, num in enumerate(nums):
  complement = target - num
  if complement in seen:
    return [seen[complement], i]
  seen[num] = i</code></pre>
<p><strong>Time:</strong> O(n) &nbsp; <strong>Space:</strong> O(n)</p>`,
      });
    }
    if (sub === "solutions") {
      return ok({
        items: [
          { id: 1, author: "alice_dev", title: "Clean O(n) HashMap — beats 97%", votes: 1840, language: "cpp" },
          { id: 2, author: "byte_master", title: "Python one-liner with enumerate", votes: 942, language: "python" },
          { id: 3, author: "java_king", title: "Java HashMap solution", votes: 615, language: "java" },
        ],
      });
    }
    if (sub === "submissions") {
      return ok({
        items: [
          { id: 101, verdict: "Accepted", language: "cpp", runtime: "4 ms", memory: "9.1 MB", at: Date.now() - 3600_000 },
          { id: 100, verdict: "Wrong Answer", language: "cpp", runtime: "—", memory: "—", at: Date.now() - 7200_000 },
          { id: 99, verdict: "Accepted", language: "python", runtime: "56 ms", memory: "14.2 MB", at: Date.now() - 86400_000 },
        ],
      });
    }
    if (sub === "discussions") {
      return ok({
        items: [
          { id: 1, author: "curious_coder", title: "Why does HashMap approach work for negative numbers?", replies: 14, votes: 88 },
          { id: 2, author: "algo_nerd", title: "Edge case: all zeros array", replies: 6, votes: 34 },
          { id: 3, author: "newbie42", title: "Can we do it in O(1) space?", replies: 22, votes: 120 },
        ],
      });
    }
  }

  // ── Post-only endpoints ──
  if (method === "post" && /^[/]problems[/][^/]+[/](like|dislike|bookmark)$/.test(url)) {
    return ok({ ok: true });
  }

  // ── POTD ──
  if (method === "get" && url === "/potd") {
    const p = DB_PROBLEMS[new Date().getDate() % DB_PROBLEMS.length];
    return ok({ problem: p, streak: 12, lastSolvedAt: Date.now() - 86400_000 });
  }
  if (method === "post" && url === "/potd/submit") {
    return ok({ verdict: "Accepted", streak: 13 });
  }

  // ── User stats ──
  if (method === "get" && url === "/user/problem-stats") {
    return ok({
      solved: { easy: 84, medium: 56, hard: 12, total: 152 },
      weekly: { solved: 9, target: 14, accuracy: 78, runtimePercentile: 86 },
      consistency: Array.from({ length: 28 }, (_, i) => ({
        d: i,
        v: Math.random() > 0.35 ? Math.ceil(Math.random() * 4) : 0,
      })),
    });
  }

  // ── Daily challenge ──
  if (method === "get" && url === "/challenges/daily") {
    return ok({
      id: "ch_42",
      title: "Solve 3 Mediums in 60 minutes",
      xp: 250,
      expiresAt: Date.now() + 6 * 3600_000,
      joined: false,
    });
  }
  if (method === "post" && url === "/challenges/join") {
    return ok({ joined: true });
  }

  // ── Recent submissions ──
  if (method === "get" && url === "/submissions/recent") {
    return ok({
      items: [
        { id: 101, problem: "Two Sum", verdict: "Accepted", runtime: "4 ms", memory: "9.1 MB", language: "C++", at: Date.now() - 600_000 },
        { id: 100, problem: "3Sum", verdict: "Wrong Answer", runtime: "—", memory: "—", language: "Python", at: Date.now() - 3600_000 },
        { id: 99, problem: "LRU Cache", verdict: "Accepted", runtime: "120 ms", memory: "21 MB", language: "Java", at: Date.now() - 7200_000 },
        { id: 98, problem: "Word Ladder", verdict: "TLE", runtime: "—", memory: "—", language: "C++", at: Date.now() - 9000_000 },
        { id: 97, problem: "Trie", verdict: "Accepted", runtime: "44 ms", memory: "18 MB", language: "JS", at: Date.now() - 12000_000 },
      ],
    });
  }

  // ── Code templates ──
  if (method === "get" && url.startsWith("/code/template/")) {
    const lang = url.split("/").pop();
    return ok({ language: lang, code: CODE_TEMPLATES[lang] || "// start coding\n" });
  }

  // ── Code run/submit ──
  if (method === "post" && (url === "/code/run" || url === "/code/submit")) {
    await wait(800 + Math.random() * 600);
    const accepted = Math.random() > 0.3;
    return ok({
      verdict: accepted ? "Accepted" : "Wrong Answer",
      runtime: accepted ? `${Math.floor(4 + Math.random() * 80)} ms` : undefined,
      memory: accepted ? `${(9 + Math.random() * 12).toFixed(1)} MB` : undefined,
      passed: accepted ? 87 : Math.floor(Math.random() * 60),
      total: 87,
      cases: [
        { id: 1, status: accepted ? "accepted" : "failed", input: "nums = [2,7,11,15], target = 9", expected: "[0,1]", got: accepted ? "[0,1]" : "[1,2]" },
        { id: 2, status: "accepted", input: "nums = [3,2,4], target = 6", expected: "[1,2]", got: "[1,2]" },
      ],
    });
  }

  if (method === "post" && url === "/code/save-draft") {
    return ok({ savedAt: Date.now() });
  }
  if (method === "post" && url === "/code/reset") {
    return ok({ ok: true });
  }
  if (method === "post" && url === "/code/custom-testcase") {
    return ok({ output: "Result: [0, 1]", runtime: "12 ms" });
  }

  return null;
}
