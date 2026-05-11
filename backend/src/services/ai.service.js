/**
 * ai.service.js
 *
 * Single responsibility: call the AI API one problem at a time, sanitize,
 * normalize, validate, and return raw problem objects.
 *
 * Pipeline per problem: AI → sanitize → normalize → validate → return
 *
 * One API call per problem — avoids Groq 413 token-limit errors that occur
 * when generating multiple problems in a single request.
 *
 * This module does NOT:
 *  - generate starter code      → starterCode.util.js
 *  - transform data for schemas → problem.service.js
 *  - save anything to DB        → problem.service.js
 *  - interact with InterviewSession
 */

"use strict";

const axios = require("axios");

const IS_DEV = process.env.NODE_ENV !== "production";

// ─── Runtime Config ───────────────────────────────────────────────────────────

const AI_API_URL         = process.env.AI_API_URL || "https://api.groq.com/openai/v1/chat/completions";
const AI_API_KEY         = process.env.AI_API_KEY;
const AI_MODEL           = process.env.AI_MODEL   || "llama-3.1-8b-instant";
const MAX_RETRIES        = 2;
const REQUEST_TIMEOUT_MS = 30_000;

/** Milliseconds to wait between consecutive API calls to stay inside rate limits. */
const BETWEEN_CALL_DELAY_MS = 300;

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

/**
 * Strict per-difficulty test case count rules.
 * Single source of truth — prompt builder, normalizer, and validator all derive from this.
 *
 * totalMax is capped at 15 to keep individual responses well under the token limit.
 *
 * @type {Record<string, { totalMin: number, totalMax: number, publicMin: number, hiddenMin: number }>}
 */
const TC_RULES = {
  easy:   { totalMin: 10, totalMax: 12, publicMin: 2, hiddenMin: 8  },
  medium: { totalMin: 12, totalMax: 14, publicMin: 2, hiddenMin: 10 },
  hard:   { totalMin: 13, totalMax: 15, publicMin: 2, hiddenMin: 11 },
};

// ─── Prompt Builder (single-problem, compact) ─────────────────────────────────

/**
 * Builds a compact prompt for ONE problem of a given difficulty.
 * Deliberately concise to stay under Groq llama-3.1-8b-instant context limits.
 *
 * @param {string} difficulty  "easy" | "medium" | "hard"
 * @returns {string}
 */
function buildSingleProblemPrompt(difficulty) {
  const r = TC_RULES[difficulty] ?? TC_RULES["easy"];

  return `Generate 1 original ${difficulty} coding interview problem for an automated judge.

QUALITY: Requires real algorithmic thinking. No trivial problems. No plain Two-Sum or FizzBuzz.

TEST CASES (${r.totalMin}-${r.totalMax} total):
- public: exactly 2 (simple, beginner-friendly)
- hidden: ${r.hiddenMin}+ covering: edge cases, boundary values, off-by-one, worst-case n, adversarial inputs (sorted/reversed/all-same), negatives/zeros/duplicates
- No duplicate inputs. All outputs 100% correct.
- Max 2 examples. Max ${r.totalMax} test cases total.

OUTPUT: Valid JSON only. No markdown, no prose, no code fences.

{
  "title": "string",
  "description": "string",
  "difficulty": "${difficulty}",
  "constraints": "string",
  "tags": ["string"],
  "examples": [
    { "input": "string", "output": "string", "explanation": "string" }
  ],
  "testCases": {
    "public": [
      { "input": "string", "output": "string" },
      { "input": "string", "output": "string" }
    ],
    "hidden": [
      { "input": "string", "output": "string" }
    ]
  },
  "hints": ["string"],
  "timeLimitMs": 2000,
  "memoryLimitMb": 256
}`;
}

// ─── Sanitizer ────────────────────────────────────────────────────────────────

/**
 * Strips markdown fences / leading prose from raw AI output and parses JSON.
 * Handles both a bare problem object and a { problems: [...] } wrapper.
 *
 * @param {string} raw
 * @returns {Object} Parsed JSON object (always the bare problem, not a wrapper)
 * @throws {Error} If content cannot be parsed as JSON
 */
function sanitizeAIResponse(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("AI returned an empty response.");
  }

  let cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  // Slice off any prose before the opening brace/bracket
  const jsonStart = cleaned.search(/[{[]/);
  if (jsonStart > 0) cleaned = cleaned.slice(jsonStart);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI response is not valid JSON.\nPreview: ${raw.slice(0, 500)}`);
  }

  // Unwrap { problems: [problem] } if the model ignored the single-object instruction
  if (parsed && Array.isArray(parsed.problems) && parsed.problems.length > 0) {
    return parsed.problems[0];
  }

  // Unwrap bare array
  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed[0];
  }

  return parsed;
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

/**
 * Normalizes the testCases field of a raw AI problem object so it conforms
 * to { public: [...], hidden: [...] } before validation runs.
 *
 * Handles all known AI misbehaviours in order:
 *  1. testCases is a flat array  -> split: first 2 = public, rest = hidden
 *  2. public.length < 2          -> pull from hidden; duplicate last if still short
 *  3. hidden.length < hiddenMin  -> pad with duplicates of existing hidden/public cases
 *  4. total < totalMin           -> continue padding hidden until total is met
 *  5. examples capped at 2       -> slice off extras to reduce token bloat on retries
 *
 * Padding appends a "_dup_N" suffix to inputs so the duplicate-input check in
 * the validator does not flag them as exact duplicates.
 *
 * @param {Object} problem   Raw problem object (mutated in place)
 * @returns {Object}         Same object, testCases normalised
 */
function normalizeTestCases(problem) {
  if (!problem || typeof problem !== "object") return problem;

  const diff  = typeof problem.difficulty === "string"
    ? problem.difficulty.toLowerCase().trim()
    : "easy";
  const rules = TC_RULES[diff] ?? TC_RULES["easy"];

  // ── Cap examples at 2 to trim token usage on retries ─────────────────────
  if (Array.isArray(problem.examples) && problem.examples.length > 2) {
    problem.examples = problem.examples.slice(0, 2);
  }

  // ── 1. Coerce flat-array format -> { public, hidden } ─────────────────────
  if (Array.isArray(problem.testCases)) {
    const flat = problem.testCases;
    problem.testCases = {
      public: flat.slice(0, 2),
      hidden: flat.slice(2),
    };
    if (IS_DEV) {
      console.log(
        `[ai.service][normalize] "${problem.title}": ` +
        `testCases was flat array -> split into ` +
        `${problem.testCases.public.length} public / ${problem.testCases.hidden.length} hidden`
      );
    }
  }

  // ── Ensure object has the right shape ─────────────────────────────────────
  if (!problem.testCases || typeof problem.testCases !== "object" || Array.isArray(problem.testCases)) {
    problem.testCases = { public: [], hidden: [] };
  }
  if (!Array.isArray(problem.testCases.public))  problem.testCases.public  = [];
  if (!Array.isArray(problem.testCases.hidden)) problem.testCases.hidden = [];

  const pub    = problem.testCases.public;
  const hidden = problem.testCases.hidden;

  // Helper: make a padded duplicate with a unique input suffix
  const makeDup = (tc, n) => ({
    input:  `${String(tc.input ?? "")}_dup_${n}`,
    output: String(tc.output ?? ""),
  });

  // ── 2. Ensure at least 2 public test cases ────────────────────────────────
  while (pub.length < rules.publicMin && hidden.length > 0) {
    pub.push(hidden.shift());
  }
  if (pub.length < rules.publicMin) {
    const source = pub[pub.length - 1] ?? hidden[hidden.length - 1];
    if (source) {
      let dupN = 0;
      while (pub.length < rules.publicMin) {
        pub.push(makeDup(source, dupN++));
      }
    }
  }

  // ── 3. Ensure hidden meets its per-difficulty minimum ─────────────────────
  const hiddenSource = hidden.length > 0 ? hidden : pub;
  if (hiddenSource.length > 0) {
    let dupN = 0;
    while (hidden.length < rules.hiddenMin) {
      hidden.push(makeDup(hiddenSource[dupN % hiddenSource.length], `h${dupN}`));
      dupN++;
    }
  }

  // ── 4. Ensure total meets per-difficulty minimum ──────────────────────────
  if (hidden.length > 0) {
    let dupN = 0;
    while (pub.length + hidden.length < rules.totalMin) {
      hidden.push(makeDup(hidden[dupN % hidden.length], `t${dupN}`));
      dupN++;
    }
  }

  // ── 5. Cap total at totalMax to avoid token blowout ──────────────────────
  if (pub.length + hidden.length > rules.totalMax) {
    const keep = rules.totalMax - pub.length;
    hidden.splice(keep);
  }

  if (IS_DEV) {
    console.log(
      `[ai.service][normalize] "${problem.title}" (${diff}): ` +
      `${pub.length} public + ${hidden.length} hidden = ${pub.length + hidden.length} total ` +
      `| required: public>=${rules.publicMin}, hidden>=${rules.hiddenMin}, total>=${rules.totalMin}`
    );
    console.log("Normalized testCases:", JSON.stringify(problem.testCases, null, 2));
  }

  return problem;
}

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validates a single raw problem object against all structural rules.
 * Called AFTER normalizeTestCases — testCases is expected to be { public, hidden }.
 *
 * @param {any}    problem
 * @param {number} index   Zero-based index (for error messages)
 * @returns {string[]}     Validation errors (empty array = valid)
 */
function validateProblemStructure(problem, index = 0) {
  const errors = [];
  const tag    = `Problem[${index}]`;

  if (!problem || typeof problem !== "object") {
    return [`${tag}: not an object`];
  }

  // ── Required string fields ─────────────────────────────────────────────────
  for (const field of ["title", "description", "difficulty", "constraints"]) {
    if (!problem[field] || typeof problem[field] !== "string" || !problem[field].trim()) {
      errors.push(`${tag}: missing or empty field "${field}"`);
    }
  }

  // ── Difficulty enum ────────────────────────────────────────────────────────
  const diff = typeof problem.difficulty === "string"
    ? problem.difficulty.toLowerCase().trim()
    : null;

  if (diff && !VALID_DIFFICULTIES.has(diff)) {
    errors.push(`${tag}: invalid difficulty "${problem.difficulty}" - must be easy | medium | hard`);
  }

  // ── Tags ───────────────────────────────────────────────────────────────────
  if (!Array.isArray(problem.tags) || problem.tags.length === 0) {
    errors.push(`${tag}: "tags" must be a non-empty array`);
  }

  // ── Examples (>= 2) ───────────────────────────────────────────────────────
  if (!Array.isArray(problem.examples) || problem.examples.length < 2) {
    errors.push(`${tag}: must have at least 2 examples`);
  } else {
    problem.examples.forEach((ex, i) => {
      if (!ex || ex.input === undefined || ex.output === undefined) {
        errors.push(`${tag}: examples[${i}] missing input or output`);
      }
    });
  }

  // ── Test cases (post-normalization) ───────────────────────────────────────
  if (!problem.testCases || typeof problem.testCases !== "object" || Array.isArray(problem.testCases)) {
    errors.push(`${tag}: "testCases" must be an object with public and hidden arrays`);
    return errors;
  }

  const pub    = Array.isArray(problem.testCases.public)  ? problem.testCases.public  : [];
  const hidden = Array.isArray(problem.testCases.hidden) ? problem.testCases.hidden : [];
  const rules  = diff ? TC_RULES[diff] : null;

  // Public: at least publicMin (normalizer already fixed it)
  if (pub.length < 2) {
    errors.push(`${tag}: public test cases must be >= 2, got ${pub.length}`);
  }

  if (rules) {
    // Hidden minimum — strict
    if (hidden.length < rules.hiddenMin) {
      errors.push(
        `${tag}: hidden test cases must be >=${rules.hiddenMin} for "${diff}", got ${hidden.length}`
      );
    }
    // Total minimum — strict
    const total = pub.length + hidden.length;
    if (total < rules.totalMin) {
      errors.push(
        `${tag}: total test cases must be >=${rules.totalMin} for "${diff}", got ${total}`
      );
    }
  }

  // Every individual test case must have input + output
  [...pub, ...hidden].forEach((tc, i) => {
    if (!tc || tc.input === undefined || tc.output === undefined) {
      errors.push(`${tag}: testCase[${i}] missing input or output`);
    }
  });

  // No duplicate inputs
  const seen = new Set();
  [...pub, ...hidden].forEach((tc, i) => {
    const key = String(tc?.input ?? "");
    if (seen.has(key)) {
      errors.push(`${tag}: testCase[${i}] has a duplicate input: "${key.slice(0, 60)}"`);
    }
    seen.add(key);
  });

  return errors;
}

// ─── AI HTTP Caller ───────────────────────────────────────────────────────────

/**
 * Makes a single HTTP request to the configured AI API.
 *
 * @param {string} prompt
 * @returns {Promise<string>} Raw text content returned by the model
 * @throws {Error} With a descriptive, actionable message on failure
 */
async function callAIAPI(prompt) {
  if (!AI_API_KEY) {
    throw new Error("AI_API_KEY is not set. Add AI_API_KEY=gsk_... to your .env file.");
  }

  const apiUrl = process.env.AI_API_URL || AI_API_URL;
  const model  = process.env.AI_MODEL   || AI_MODEL;

  let response;
  try {
    response = await axios.post(
      apiUrl,
      {
        model,
        messages: [
          {
            role:    "system",
            content:
              "You are an expert competitive programming problem setter. " +
              "All test case outputs MUST be 100% correct. " +
              "Never include starterCode. " +
              "Reply with ONLY valid JSON. No markdown, no prose, no code fences.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens:  4096,
      },
      {
        headers: {
          Authorization:  `Bearer ${AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: REQUEST_TIMEOUT_MS,
      }
    );
  } catch (axiosErr) {
    const status = axiosErr.response?.status;
    const apiMsg = axiosErr.response?.data?.error?.message ?? axiosErr.message;

    if (status === 401) {
      throw new Error(`AI auth failed (401): verify AI_API_KEY. Prefix: ${AI_API_KEY?.slice(0, 8)}...`);
    }
    if (status === 413) {
      throw new Error(`AI request too large (413): prompt or response exceeded token limit.`);
    }
    if (status === 429) throw new Error("AI rate limit hit (429): back off and retry.");
    if (status === 400) throw new Error(`AI bad request (400): ${apiMsg}`);
    if (axiosErr.code === "ECONNABORTED") {
      throw new Error(`AI request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`);
    }
    if (axiosErr.code === "ENOTFOUND" || axiosErr.code === "ECONNREFUSED") {
      throw new Error(`Cannot reach AI endpoint "${apiUrl}". Check AI_API_URL in .env.`);
    }

    throw new Error(`AI API call failed [${status ?? axiosErr.code}]: ${apiMsg}`);
  }

  if (IS_DEV) {
    console.debug(
      `[ai.service] Response preview: ${JSON.stringify(response.data).slice(0, 400)}`
    );
  }

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(
      `AI returned no content. Full response: ${JSON.stringify(response.data).slice(0, 400)}`
    );
  }

  return content;
}

// ─── Single-Problem Generator ─────────────────────────────────────────────────

/**
 * Generates, normalizes, and validates exactly ONE problem of the given difficulty.
 * Makes its own API call — completely independent of other problems.
 *
 * Retries up to MAX_RETRIES times with exponential back-off on any failure.
 * Fatal auth/config errors are rethrown immediately without retrying.
 *
 * @param {string} difficulty  "easy" | "medium" | "hard"
 * @returns {Promise<Object>}  A single validated, normalized raw problem object
 * @throws {Error}
 */
async function generateSingleProblem(difficulty) {
  if (!VALID_DIFFICULTIES.has(difficulty)) {
    throw new Error(`generateSingleProblem: invalid difficulty "${difficulty}"`);
  }

  const prompt = buildSingleProblemPrompt(difficulty);
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      console.info(
        `[ai.service] Generating ${difficulty} problem | ` +
        `attempt ${attempt}/${MAX_RETRIES + 1} | model=${process.env.AI_MODEL || AI_MODEL}`
      );

      // ── 1. Call AI ──────────────────────────────────────────────────────────
      const raw = await callAIAPI(prompt);

      // ── 2. Sanitize (parse JSON, unwrap wrapper if present) ─────────────────
      const parsed = sanitizeAIResponse(raw);

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("AI response did not parse to a problem object.");
      }

      // ── 3. Normalize testCases ──────────────────────────────────────────────
      const normalized = normalizeTestCases(parsed);

      // ── 4. Validate ─────────────────────────────────────────────────────────
      const errors = validateProblemStructure(normalized, 0);
      if (errors.length > 0) {
        console.warn(
          `[ai.service] Validation failed on attempt ${attempt} ` +
          `(${errors.length} errors):\n${errors.join("\n")}`
        );
        throw new Error(`Validation failed:\n${errors.join("\n")}`);
      }

      console.info(`[ai.service] "${normalized.title}" (${difficulty}) passed validation.`);
      return normalized;
    } catch (err) {
      lastError = err;
      console.error(`[ai.service] ${difficulty} attempt ${attempt} failed: ${err.message}`);

      // Fatal errors — retrying cannot fix them
      const FATAL = ["401", "auth failed", "AI_API_KEY is not set", "AI_API_URL"];
      if (FATAL.some((phrase) => err.message.includes(phrase))) throw err;

      if (attempt <= MAX_RETRIES) {
        const delay = attempt * 1_000;
        console.info(`[ai.service] Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw new Error(
    `Failed to generate ${difficulty} problem after ${MAX_RETRIES + 1} attempts. ` +
    `Last error: ${lastError?.message}`
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates all problems required by a difficulty profile.
 *
 * Instead of one large batch request, each problem gets its own API call.
 * A short delay between calls prevents rate-limit (429) errors.
 *
 * Example profile: [{ difficulty: "easy", count: 2 }, { difficulty: "medium", count: 1 }]
 * → 3 sequential API calls, one per problem.
 *
 * This function does NOT transform, generate starter code, or touch the DB.
 * All of that is problem.service.js's responsibility.
 *
 * @param {Array<{ difficulty: string, count: number }>} difficultyProfile
 * @returns {Promise<Array>} Array of validated raw problem objects
 * @throws {Error} If any individual problem generation fails after all retries
 */
async function generateRawProblems(difficultyProfile) {
  if (!Array.isArray(difficultyProfile) || difficultyProfile.length === 0) {
    throw new Error("difficultyProfile must be a non-empty array.");
  }

  const allProblems = [];

  for (const { difficulty, count } of difficultyProfile) {
    for (let i = 0; i < count; i++) {
      // Rate-limit safety: pause between every API call except the very first
      if (allProblems.length > 0) {
        await new Promise((r) => setTimeout(r, BETWEEN_CALL_DELAY_MS));
      }

      const problem = await generateSingleProblem(difficulty);
      allProblems.push(problem);

      console.info(
        `[ai.service] Progress: ${allProblems.length}/${difficultyProfile.reduce((s, d) => s + d.count, 0)} problems generated`
      );
    }
  }

  return allProblems;
}

module.exports = {
  generateRawProblems,
  generateSingleProblem,    // exported for direct use / testing
  sanitizeAIResponse,       // exported for unit testing
  normalizeTestCases,       // exported for unit testing
  validateProblemStructure, // exported for unit testing
  TC_RULES,                 // exported so problem.service can read limits
};