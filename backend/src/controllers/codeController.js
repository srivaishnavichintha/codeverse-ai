'use strict';

const axios = require('axios');
const Submission = require('../models/Submission');
const Problem    = require('../models/Problem');
const TestCase   = require('../models/TestCase');
const User       = require('../models/User');

// ─────────────────────────────────────────────
// CONFIG (Judge0)
// ─────────────────────────────────────────────
const JUDGE0_URL = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_KEY = process.env.JUDGE0_API_KEY || '';

// Map language → Judge0 language ID
const LANGUAGE_MAP = {
  javascript: 63,
  python:     71,
  java:       62,
  cpp:        54,
  typescript: 74,
  go:         60,
};

function judge0Headers() {
  const apiKey = (process.env.JUDGE0_API_KEY || '').trim();
  return {
    'Content-Type': 'application/json',
    'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
    'X-RapidAPI-Key': apiKey,
  };
}

async function runOnJudge0(sourceCode, languageId, stdin) {
  try {
    const res = await axios.post(
      `${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`,
      {
        source_code: sourceCode,
        language_id: languageId,
        stdin: stdin || '',
        cpu_time_limit:    process.env.JUDGE0_CPU_TIME_LIMIT    || 2,
        memory_limit:      process.env.JUDGE0_MEMORY_LIMIT      || 262144,
      },
      { headers: judge0Headers(), timeout: 30000 }
    );
    return res.data;
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    console.error('Judge0 API Error:', errMsg);
    return {
      stdout: null,
      time: null,
      memory: null,
      stderr: 'Compiler API Error: ' + errMsg + '\n\nPlease verify your RapidAPI subscription or API limits.',
      compile_output: null,
      message: null,
      status: {
        id: 13,
        description: 'API Error'
      }
    };
  }
}

// ─────────────────────────────────────────────
// POST /api/code/run  — run code, don't save
// ─────────────────────────────────────────────
const runCode = async (req, res, next) => {
  try {
    const { code, language, input, testcases } = req.body;

    if (!code || !language) {
      return res.status(400).json({ success: false, message: 'code and language are required' });
    }

    const langId = LANGUAGE_MAP[language.toLowerCase()];
    if (!langId) {
      return res.status(400).json({ success: false, message: `Unsupported language: ${language}` });
    }

    if (testcases && Array.isArray(testcases)) {
      const results = [];
      for (let i = 0; i < testcases.length; i++) {
        const tc = testcases[i];
        const result = await runOnJudge0(code, langId, tc.input || '');
        const actualOutput = (result.stdout || '').trim();
        const expectedOutput = (tc.expected || '').trim();
        
        const isError = result.status?.id !== 3; // 3 is Accepted
        let passed = !isError;
        if (tc.expected !== undefined && tc.expected !== '') {
          passed = actualOutput === expectedOutput && !isError;
        }

        const errorStr = [
          result.compile_output ? Buffer.from(result.compile_output, 'base64').toString('utf-8') : '', // just in case
          result.stderr,
          result.message
        ].filter(Boolean).join('\n').trim();

        const finalErrorStr = errorStr || (result.compile_output || '');

        results.push({
          id: tc.id ?? i,
          status: passed ? 'accepted' : 'failed',
          input: tc.input || '',
          expected: tc.expected || '',
          got: result.stdout || '',
          error: finalErrorStr,
          verdict: result.status?.description || 'Unknown'
        });
      }

      const firstError = results.find(r => r.status === 'failed');
      const overallVerdict = firstError ? (firstError.error ? firstError.verdict : 'Wrong Answer') : 'Accepted';

      return res.json({
        success: true,
        data: {
          verdict: overallVerdict,
          cases: results,
        },
      });
    }

    const result = await runOnJudge0(code, langId, input || '');

    const errorStr = [
      result.compile_output ? Buffer.from(result.compile_output, 'base64').toString('utf-8') : '',
      result.stderr,
      result.message
    ].filter(Boolean).join('\n').trim();

    const finalErrorStr = errorStr || (result.compile_output || '');

    return res.json({
      success: true,
      data: {
        output:     result.stdout   || '',
        error:      finalErrorStr,
        status:     result.status?.description || 'Unknown',
        runtimeMs:  result.time ? Math.round(parseFloat(result.time) * 1000) : null,
        memoryKb:   result.memory || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/code/submit — run all test cases + save submission
// ─────────────────────────────────────────────
const submitCode = async (req, res, next) => {
  try {
    const { code, language, problemId } = req.body;
    const userId = req.user.id;

    if (!code || !language || !problemId) {
      return res.status(400).json({ success: false, message: 'code, language, and problemId are required' });
    }

    const langId = LANGUAGE_MAP[language.toLowerCase()];
    if (!langId) {
      return res.status(400).json({ success: false, message: `Unsupported language: ${language}` });
    }

    // Fetch test cases (both visible and hidden)
    const testCases = await TestCase.find({ problem: problemId }).sort({ order: 1 }).lean();

    if (!testCases.length) {
      return res.status(400).json({ success: false, message: 'No test cases found for this problem' });
    }

    let verdict     = 'Accepted';
    let maxRuntimeMs = 0;
    let maxMemoryKb  = 0;
    const testResults = [];

    for (const tc of testCases) {
      const result = await runOnJudge0(code, langId, tc.input);

      const runtimeMs = result.time ? Math.round(parseFloat(result.time) * 1000) : 0;
      const memoryKb  = result.memory || 0;

      maxRuntimeMs = Math.max(maxRuntimeMs, runtimeMs);
      maxMemoryKb  = Math.max(maxMemoryKb, memoryKb);

      const actualOutput   = (result.stdout || '').trim();
      const expectedOutput = (tc.output || '').trim();
      const passed         = actualOutput === expectedOutput && result.status?.id === 3;

      const errorStr = [
        result.compile_output ? Buffer.from(result.compile_output, 'base64').toString('utf-8') : '', // just in case
        result.stderr,
        result.message
      ].filter(Boolean).join('\\n').trim();

      const finalErrorStr = errorStr || (result.compile_output || '');

      testResults.push({
        testCaseId:     tc._id,
        passed,
        runtimeMs,
        memoryKb,
        input:          tc.input || '',
        actualOutput,
        expectedOutput,
        error:          finalErrorStr,
        isHidden:       tc.isHidden,
      });

      if (!passed && verdict === 'Accepted') {
        // Map Judge0 status to our verdict
        const statusId = result.status?.id;
        if (statusId === 5)      verdict = 'Time Limit Exceeded';
        else if (statusId === 6) verdict = 'Compilation Error';
        else if (statusId >= 7 && statusId <= 12) verdict = 'Runtime Error';
        else                     verdict = 'Wrong Answer';
      }
    }

    // Save submission using correct field names (user, problem, verdict, runtimeMs, memoryKb)
    const submission = await Submission.create({
      user:        userId,
      problem:     problemId,
      code,
      language:    language.toLowerCase(),
      verdict,
      runtimeMs:   maxRuntimeMs,
      memoryKb:    maxMemoryKb,
      testResults,
      sourceType: 'practice',
    });

    // Update problem submission counters atomically
    const accepted = verdict === 'Accepted';
    await Problem.findByIdAndUpdate(problemId, {
      $inc: {
        totalSubmissions: 1,
        ...(accepted ? { totalAccepted: 1 } : {}),
      },
    });

    // Update user stats atomically
    await User.findByIdAndUpdate(userId, {
      $inc: {
        'stats.totalSubmissions': 1,
        ...(accepted ? { 'stats.totalSolved': 1 } : {}),
      },
    });

    return res.json({
      success: true,
      data: {
        _id:        submission._id,
        verdict,
        runtimeMs:  maxRuntimeMs,
        memoryKb:   maxMemoryKb,
        testResults: testResults.map(tr => ({
          passed:   tr.passed,
          isHidden: tr.isHidden,
          runtimeMs: tr.runtimeMs,
          input:    tr.input,
          expected: tr.expectedOutput,
          got:      tr.actualOutput,
          error:    tr.error,
        })),
        passedCount: testResults.filter(t => t.passed).length,
        totalCount:  testResults.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/code/save-draft
// ─────────────────────────────────────────────
const saveDraft = async (req, res, next) => {
  try {
    // In a full implementation, we would save req.body.code to a UserDraft model
    // For now, we just return success to satisfy the frontend auto-save loop
    return res.json({ success: true, message: 'Draft saved locally' });
  } catch (err) {
    next(err);
  }
};

module.exports = { runCode, submitCode, saveDraft };
