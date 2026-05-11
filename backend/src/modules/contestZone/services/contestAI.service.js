'use strict';

/**
 * ContestAI Service
 *
 * Reuses the existing ai.service.js infrastructure (Groq / llama-3.1-8b-instant)
 * to generate contest problems on demand.
 *
 * Features:
 *  - difficulty-aware prompts
 *  - duplicate detection via content hashing
 *  - in-memory LRU cache to avoid redundant API calls
 *  - graceful fallback if AI generation fails
 */

const crypto  = require('crypto');
const axios   = require('axios');
const ContestProblem = require('../models/ContestProblem.model');

const AI_API_URL         = process.env.AI_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const AI_API_KEY         = process.env.AI_API_KEY;
const AI_MODEL           = process.env.AI_MODEL   || 'llama-3.1-8b-instant';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES        = 2;

// ─── Simple in-memory LRU cache (max 50 problems) ────────────────────────────
const CACHE_MAX = 50;
const problemCache = new Map();

function cacheSet(key, value) {
  if (problemCache.size >= CACHE_MAX) {
    const firstKey = problemCache.keys().next().value;
    problemCache.delete(firstKey);
  }
  problemCache.set(key, value);
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

const TC_RULES = {
  easy:   { totalMin: 8,  totalMax: 10, publicMin: 2, hiddenMin: 6  },
  medium: { totalMin: 10, totalMax: 12, publicMin: 2, hiddenMin: 8  },
  hard:   { totalMin: 12, totalMax: 14, publicMin: 2, hiddenMin: 10 },
};

function buildContestProblemPrompt(difficulty, existingTitles = []) {
  const r = TC_RULES[difficulty] || TC_RULES.medium;
  const avoidClause = existingTitles.length
    ? `\n\nAVOID duplicating these existing problem titles: ${existingTitles.join(', ')}.`
    : '';

  return `Generate 1 original ${difficulty} competitive programming problem for a timed online contest.${avoidClause}

QUALITY REQUIREMENTS:
- Requires genuine algorithmic thinking (not trivial)
- Must NOT be a known problem (no Two Sum, FizzBuzz, Fibonacci, etc.)
- Should be solvable in ${difficulty === 'easy' ? '10-15' : difficulty === 'medium' ? '20-30' : '35-45'} minutes

TEST CASES (${r.totalMin}-${r.totalMax} total):
- public: exactly 2 (simple, for contestants to verify logic)
- hidden: ${r.hiddenMin}+ covering edge cases, boundary values, large inputs, adversarial data
- No duplicate inputs. All outputs provably correct.

STARTER CODE: Provide function signatures in JavaScript, Python, Java, and C++.

RESPOND WITH ONLY VALID JSON. No markdown, no code fences, no explanation.

{
  "title": "string",
  "description": "string",
  "difficulty": "${difficulty}",
  "constraints": "string",
  "examples": "string (formatted as 'Input: ... Output: ... Explanation: ...')",
  "expectedComplexity": "string (e.g. O(n log n) time, O(n) space)",
  "timeLimit": 2000,
  "memoryLimit": 256,
  "starterCode": {
    "javascript": "string",
    "python": "string",
    "java": "string",
    "cpp": "string"
  },
  "testCases": [
    { "input": "string", "expectedOutput": "string", "isPublic": true },
    { "input": "string", "expectedOutput": "string", "isPublic": true },
    { "input": "string", "expectedOutput": "string", "isPublic": false }
  ]
}`;
}

// ─── AI call with retry ───────────────────────────────────────────────────────

async function callAI(prompt, attempt = 0) {
  try {
    const response = await axios.post(
      AI_API_URL,
      {
        model: AI_MODEL,
        max_tokens: 3000,
        temperature: 0.8,  // higher temperature = more unique problems
        messages: [
          {
            role: 'system',
            content: 'You are an expert competitive programming problem setter. You generate original, high-quality coding problems. Return ONLY valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: REQUEST_TIMEOUT_MS,
      }
    );

    const raw = response.data?.choices?.[0]?.message?.content || '';
    return raw.trim();
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      return callAI(prompt, attempt + 1);
    }
    throw err;
  }
}

// ─── Parse and validate AI response ──────────────────────────────────────────

function parseAIResponse(raw, difficulty) {
  // Strip code fences if AI misbehaves
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!parsed.title || !parsed.description || !Array.isArray(parsed.testCases)) {
    throw new Error('Invalid AI response structure');
  }

  if (parsed.testCases.length < 3) {
    throw new Error('Insufficient test cases from AI');
  }

  // Normalize
  parsed.difficulty = difficulty;
  parsed.timeLimit = parsed.timeLimit || 2000;
  parsed.memoryLimit = parsed.memoryLimit || 256;
  parsed.starterCode = parsed.starterCode || {};
  parsed.expectedComplexity = parsed.expectedComplexity || '';

  return parsed;
}

// ─── Fallback problem bank (used when AI fails) ───────────────────────────────

const FALLBACK_PROBLEMS = {
  easy: {
    title: 'Longest Consecutive Sequence',
    description: 'Given an array of integers, find the length of the longest consecutive sequence of integers. Elements need not be contiguous in the array.\n\nExample: [100, 4, 200, 1, 3, 2] → 4 (sequence: 1, 2, 3, 4)',
    difficulty: 'easy',
    constraints: '1 ≤ n ≤ 10^5, -10^9 ≤ nums[i] ≤ 10^9',
    examples: 'Input: [100,4,200,1,3,2]\nOutput: 4\nExplanation: [1,2,3,4] is the longest consecutive sequence',
    expectedComplexity: 'O(n) time, O(n) space',
    timeLimit: 2000,
    memoryLimit: 256,
    starterCode: {
      javascript: 'function longestConsecutive(nums) {\n  // your code here\n}',
      python: 'def longest_consecutive(nums):\n    # your code here\n    pass',
      java: 'class Solution {\n    public int longestConsecutive(int[] nums) {\n        // your code here\n    }\n}',
      cpp: 'int longestConsecutive(vector<int>& nums) {\n    // your code here\n}',
    },
    testCases: [
      { input: '[100,4,200,1,3,2]',   expectedOutput: '4', isPublic: true },
      { input: '[0,3,7,2,5,8,4,6,0,1]', expectedOutput: '9', isPublic: true },
      { input: '[]',                   expectedOutput: '0', isPublic: false },
      { input: '[1]',                  expectedOutput: '1', isPublic: false },
      { input: '[-1,0,1]',             expectedOutput: '3', isPublic: false },
    ],
  },
  medium: {
    title: 'Count Subarrays With Bounded Maximum',
    description: 'Given an integer array nums and two integers left and right, return the number of contiguous non-empty subarrays such that the value of the maximum array element in that subarray is in the range [left, right].',
    difficulty: 'medium',
    constraints: '1 ≤ nums.length ≤ 10^5, 0 ≤ nums[i] ≤ 10^9, 0 ≤ left ≤ right ≤ 10^9',
    examples: 'Input: nums=[2,1,4,3], left=2, right=3\nOutput: 3\nExplanation: Subarrays [2],[2,1],[3] have max in [2,3]',
    expectedComplexity: 'O(n) time, O(1) space',
    timeLimit: 2000,
    memoryLimit: 256,
    starterCode: {
      javascript: 'function numSubarrayBoundedMax(nums, left, right) {\n  // your code here\n}',
      python: 'def numSubarrayBoundedMax(nums, left, right):\n    pass',
      java: 'class Solution {\n    public int numSubarrayBoundedMax(int[] nums, int left, int right) {\n        // your code here\n    }\n}',
      cpp: 'int numSubarrayBoundedMax(vector<int>& nums, int left, int right) {\n    // your code here\n}',
    },
    testCases: [
      { input: 'nums=[2,1,4,3] left=2 right=3', expectedOutput: '3', isPublic: true },
      { input: 'nums=[2,9,2,5,6] left=2 right=8', expectedOutput: '7', isPublic: true },
      { input: 'nums=[1] left=1 right=1',          expectedOutput: '1', isPublic: false },
      { input: 'nums=[1,2,3] left=4 right=5',      expectedOutput: '0', isPublic: false },
    ],
  },
  hard: {
    title: 'Minimum Cost to Make Array Equal',
    description: 'You are given two 0-indexed arrays nums and cost consisting each of n positive integers. Return the minimum total cost such that all the elements in nums become equal.',
    difficulty: 'hard',
    constraints: 'n ≤ 10^5, nums[i], cost[i] ≤ 10^6',
    examples: 'Input: nums=[1,3,5,2], cost=[2,3,1,14]\nOutput: 8',
    expectedComplexity: 'O(n log n) time, O(n) space',
    timeLimit: 3000,
    memoryLimit: 256,
    starterCode: {
      javascript: 'function minCost(nums, cost) {\n  // your code here\n}',
      python: 'def min_cost(nums, cost):\n    pass',
      java: 'class Solution {\n    public long minCost(int[] nums, int[] cost) {\n        // your code here\n    }\n}',
      cpp: 'long long minCost(vector<int>& nums, vector<int>& cost) {\n    // your code here\n}',
    },
    testCases: [
      { input: 'nums=[1,3,5,2] cost=[2,3,1,14]',   expectedOutput: '8',  isPublic: true },
      { input: 'nums=[2,2,2,2,2] cost=[4,2,8,1,3]', expectedOutput: '0', isPublic: true },
      { input: 'nums=[1,2] cost=[1,1]',              expectedOutput: '1', isPublic: false },
    ],
  },
};

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * Generate contest problems for a given contest.
 *
 * @param {Object} opts
 * @param {string} opts.contestId
 * @param {string} opts.difficulty   'easy' | 'medium' | 'hard' | 'mixed'
 * @param {number} opts.count        number of problems to generate (1–5)
 * @returns {Promise<ContestProblem[]>}
 */
async function generateContestProblems({ contestId, difficulty, count = 1 }) {
  const diffList = buildDifficultyList(difficulty, count);
  const existingTitles = [];
  const savedProblems = [];

  for (const diff of diffList) {
    try {
      const problem = await generateOneProblem(contestId, diff, existingTitles);
      existingTitles.push(problem.title);
      savedProblems.push(problem);
    } catch (err) {
      console.error(`[ContestAI] Failed to generate ${diff} problem, using fallback:`, err.message);
      const fallback = await useFallbackProblem(contestId, diff);
      savedProblems.push(fallback);
    }
  }

  return savedProblems;
}

function buildDifficultyList(difficulty, count) {
  if (difficulty !== 'mixed') {
    return Array(count).fill(difficulty);
  }
  // mixed: distribute across easy/medium/hard
  const diffs = [];
  const options = ['easy', 'medium', 'hard'];
  for (let i = 0; i < count; i++) {
    diffs.push(options[i % options.length]);
  }
  return diffs;
}

async function generateOneProblem(contestId, difficulty, existingTitles) {
  const cacheKey = `${difficulty}:${existingTitles.join('|')}`;

  // Check cache
  if (problemCache.has(cacheKey)) {
    const cached = problemCache.get(cacheKey);
    return saveProblemToDb(contestId, cached, difficulty, 'cache');
  }

  const prompt = buildContestProblemPrompt(difficulty, existingTitles);
  const raw = await callAI(prompt);
  const parsed = parseAIResponse(raw, difficulty);

  // Compute hash for duplicate detection
  const hash = crypto
    .createHash('sha256')
    .update(parsed.title + parsed.description)
    .digest('hex')
    .slice(0, 16);

  // Check for existing problem with same hash
  const existing = await ContestProblem.findOne({ generationHash: hash });
  if (existing) {
    // Duplicate — regenerate without cache
    console.warn(`[ContestAI] Duplicate hash detected (${hash}), regenerating...`);
    return generateOneProblem(contestId, difficulty, [...existingTitles, parsed.title]);
  }

  cacheSet(cacheKey, { ...parsed, generationHash: hash });
  return saveProblemToDb(contestId, { ...parsed, generationHash: hash }, difficulty, AI_MODEL);
}

async function saveProblemToDb(contestId, data, difficulty, source) {
  const doc = await ContestProblem.create({
    contest:            contestId,
    title:              data.title,
    description:        data.description,
    difficulty,
    constraints:        data.constraints  || '',
    examples:           data.examples     || '',
    expectedComplexity: data.expectedComplexity || '',
    timeLimit:          data.timeLimit    || 2000,
    memoryLimit:        data.memoryLimit  || 256,
    starterCode:        data.starterCode  || {},
    testCases:          data.testCases    || [],
    generatedByAI:      true,
    aiModel:            source,
    generationHash:     data.generationHash || '',
    maxPoints:          difficulty === 'hard' ? 150 : difficulty === 'medium' ? 100 : 75,
  });
  return doc;
}

async function useFallbackProblem(contestId, difficulty) {
  const template = FALLBACK_PROBLEMS[difficulty] || FALLBACK_PROBLEMS.medium;
  // Mutate title slightly to avoid duplicate hash
  const data = {
    ...template,
    title: `${template.title} [Contest Edition]`,
    generationHash: crypto.createHash('sha256').update(contestId + difficulty + Date.now()).digest('hex').slice(0, 16),
  };
  return saveProblemToDb(contestId, data, difficulty, 'fallback');
}

module.exports = { generateContestProblems };
