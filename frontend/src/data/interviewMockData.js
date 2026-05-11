export const dashboardStats = {
  totalInterviews: 12,
  avgScore: 74,
  communicationScore: 68,
  problemSolvingScore: 81,
  codeQualityScore: 77,
  cheatingWarnings: 2,
  strongestTopic: 'Dynamic Programming',
  weakestTopic: 'System Design',
}

export const performanceHistory = [
  { month: 'Oct', score: 52, comm: 48, ps: 58 },
  { month: 'Nov', score: 61, comm: 55, ps: 67 },
  { month: 'Dec', score: 58, comm: 53, ps: 63 },
  { month: 'Jan', score: 67, comm: 62, ps: 72 },
  { month: 'Feb', score: 71, comm: 65, ps: 78 },
  { month: 'Mar', score: 74, comm: 68, ps: 81 },
]

export const recentInterviews = [
  { id: 'IV-0012', date: 'Mar 28, 2025', type: 'Full Stack', score: 74, status: 'Completed', duration: '62 min', warnings: 0 },
  { id: 'IV-0011', date: 'Mar 15, 2025', type: 'DSA Focus', score: 81, status: 'Completed', duration: '58 min', warnings: 0 },
  { id: 'IV-0010', date: 'Mar 02, 2025', type: 'System Design', score: 61, status: 'Completed', duration: '71 min', warnings: 1 },
  { id: 'IV-0009', date: 'Feb 18, 2025', type: 'Full Stack', score: 69, status: 'Completed', duration: '65 min', warnings: 0 },
  { id: 'IV-0008', date: 'Feb 04, 2025', type: 'DSA Focus', score: 58, status: 'Terminated', duration: '31 min', warnings: 3 },
]

export const radarData = [
  { subject: 'Algorithms', A: 82, fullMark: 100 },
  { subject: 'System Design', A: 55, fullMark: 100 },
  { subject: 'Communication', A: 68, fullMark: 100 },
  { subject: 'Code Quality', A: 77, fullMark: 100 },
  { subject: 'Optimization', A: 71, fullMark: 100 },
  { subject: 'Data Structures', A: 85, fullMark: 100 },
]

export const aiRecommendations = [
  {
    icon: '⬡',
    title: 'Strengthen System Design',
    desc: 'Your system design answers lack depth in scalability considerations. Practice designing distributed systems with 1M+ users.',
    priority: 'High',
  },
  {
    icon: '◈',
    title: 'Optimize Communication Clarity',
    desc: 'Responses tend to be technically accurate but verbose. Practice the STAR method for structured, concise answers.',
    priority: 'Medium',
  },
  {
    icon: '▲',
    title: 'Edge Case Coverage',
    desc: 'You miss edge cases in ~30% of problems. Build a mental checklist: null inputs, overflow, empty arrays, single elements.',
    priority: 'Medium',
  },
]

export const companyReadiness = [
  { company: 'Google', readiness: 71 },
  { company: 'Meta', readiness: 78 },
  { company: 'Amazon', readiness: 83 },
  { company: 'Microsoft', readiness: 86 },
  { company: 'Stripe', readiness: 74 },
  { company: 'Uber', readiness: 80 },
]

export const codingProblems = [
  {
    id: 1,
    title: 'Minimum Window Substring',
    difficulty: 'Hard',
    company: 'Google',
    topic: 'Sliding Window',
    description: `Given two strings s and t of lengths m and n respectively, return the minimum window substring of s such that every character in t (including duplicates) is included in the window. If there is no such substring, return the empty string "".

The testcases will be generated such that the answer is unique.`,
    constraints: [
      'm == s.length',
      'n == t.length',
      '1 ≤ m, n ≤ 10⁵',
      's and t consist of uppercase and lowercase English letters.',
    ],
    examples: [
      { input: 's = "ADOBECODEBANC", t = "ABC"', output: '"BANC"', explanation: 'The minimum window substring "BANC" includes \'A\', \'B\', and \'C\' from string t.' },
      { input: 's = "a", t = "a"', output: '"a"', explanation: 'The entire string s is the minimum window.' },
      { input: 's = "a", t = "aa"', output: '""', explanation: 'Both a\'s from t must be included in the window. Since the largest window of s only has one \'a\', return "".' },
    ],
    starterCode: `/**
 * @param {string} s
 * @param {string} t
 * @return {string}
 */
function minWindow(s, t) {
  // Your solution here
  
};`,
  },
  {
    id: 2,
    title: 'Word Ladder II',
    difficulty: 'Hard',
    company: 'Amazon',
    topic: 'BFS / Graph',
    description: `A transformation sequence from word beginWord to word endWord using a dictionary wordList is a sequence of words beginWord → s₁ → s₂ → ... → sₖ such that:

— Every adjacent pair of words differs by exactly one letter.
— Every sᵢ for 1 ≤ i ≤ k is in wordList. Note that beginWord does not need to be in wordList.
— sₖ == endWord

Given two words, beginWord and endWord, and a dictionary wordList, return all the shortest transformation sequences from beginWord to endWord, or an empty list if no such sequence exists. Each sequence should be returned as a list of the words [beginWord, s₁, s₂, ..., sₖ].`,
    constraints: [
      '1 ≤ beginWord.length ≤ 5',
      'endWord.length == beginWord.length',
      '1 ≤ wordList.length ≤ 500',
      'wordList[i].length == beginWord.length',
      'All words consist of lowercase English letters.',
      'All words in wordList are unique.',
    ],
    examples: [
      { input: 'beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log","cog"]', output: '[["hit","hot","dot","dog","cog"],["hit","hot","lot","log","cog"]]', explanation: 'Both sequences have length 5, the minimum.' },
    ],
    starterCode: `/**
 * @param {string} beginWord
 * @param {string} endWord
 * @param {string[]} wordList
 * @return {string[][]}
 */
function findLadders(beginWord, endWord, wordList) {
  // BFS + backtracking approach
  
};`,
  },
]

export const followUpQuestions = [
  {
    id: 1,
    question: "Your Minimum Window Substring solution runs in O(m+n) time. However, imagine the input string s is being streamed in real-time — characters arrive one by one and you must report the minimum window at each step. How would you redesign your approach? Discuss the data structures you'd choose, the amortized time complexity, and how you'd handle memory constraints if the stream is infinite.",
    tags: ['Streaming Algorithms', 'Amortized Complexity', 'Real-world Scale'],
  },
  {
    id: 2,
    question: "In Word Ladder II, you used BFS. Now imagine this problem at Google Search scale — you have 50 billion words in your dictionary, distributed across 10,000 servers. How would you design a distributed BFS? Consider: partitioning strategy, network round-trips, handling stragglers, and what trade-offs you'd make between latency and completeness of results.",
    tags: ['Distributed Systems', 'System Design', 'Trade-offs'],
  },
  {
    id: 3,
    question: "Both problems you solved have worst-case exponential solution space. In a production interview platform like CodeVerse itself, users run code concurrently. How would you design a sandboxed code execution system that prevents resource exhaustion, handles infinite loops, enforces memory limits, and scales to 100,000 concurrent executions? Walk me through the architecture from kernel-level isolation to the API layer.",
    tags: ['OS Concepts', 'Containerization', 'API Design'],
  },
]

export const evaluationData = {
  overallScore: 74,
  technicalScore: 79,
  communicationScore: 68,
  problemSolvingScore: 81,
  codeQualityScore: 77,
  optimizationScore: 71,
  confidenceScore: 65,
  suspiciousActivity: 'None Detected',
  violations: 0,
  recommendation: 'Conditionally Recommended',
  hiringChance: 72,

  strengths: [
    'Strong algorithmic intuition — identified sliding window approach in under 3 minutes',
    'Clean variable naming and consistent coding style throughout',
    'Handled multiple edge cases without prompting',
    'Time complexity analysis was accurate and articulated well',
  ],
  improvements: [
    'System-level thinking needs significant depth — answers stayed surface-level',
    'Communication hesitancy under pressure — consider structured response frameworks',
    'Follow-up question on distributed BFS was incomplete',
    'Confidence dipped noticeably during the follow-up round',
  ],
  suggestedTopics: [
    'Distributed Systems Design', 'OS Internals', 'Database Internals',
    'Network Protocols', 'Concurrency & Parallelism', 'Graph Algorithms Advanced',
  ],
  eligibleCompanies: ['Amazon SDE-1', 'Flipkart SDE-1', 'Walmart Labs', 'Atlassian', 'Adobe', 'Intuit'],
  behavioralImprovements: [
    'Pause 3 seconds before answering complex questions',
    'Use "Let me think through this..." to buy thinking time naturally',
    'Enumerate trade-offs explicitly even when not asked',
  ],

  radarData: [
    { subject: 'Technical', A: 79, fullMark: 100 },
    { subject: 'Communication', A: 68, fullMark: 100 },
    { subject: 'Problem Solving', A: 81, fullMark: 100 },
    { subject: 'Code Quality', A: 77, fullMark: 100 },
    { subject: 'Optimization', A: 71, fullMark: 100 },
    { subject: 'Confidence', A: 65, fullMark: 100 },
  ],

  timeline: [
    { time: '0:00', event: 'Interview started', type: 'start' },
    { time: '3:12', event: 'Problem 1 approach identified', type: 'positive' },
    { time: '14:38', event: 'Problem 1 submitted — accepted', type: 'positive' },
    { time: '15:00', event: 'Problem 2 opened', type: 'neutral' },
    { time: '22:05', event: 'First approach incorrect — self-corrected', type: 'neutral' },
    { time: '41:17', event: 'Problem 2 submitted — accepted', type: 'positive' },
    { time: '60:00', event: 'Coding round completed', type: 'neutral' },
    { time: '61:30', event: 'Follow-up Q1 answered — strong', type: 'positive' },
    { time: '69:44', event: 'Follow-up Q2 — incomplete answer', type: 'warning' },
    { time: '75:00', event: 'Interview completed', type: 'end' },
  ],
}
