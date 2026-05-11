const axios = require('axios');
const TestCase = require('../../models/TestCase');
const Notification = require('../../models/Notification');

const JUDGE0_URL = process.env.JUDGE0_URL;

const LANGUAGE_MAP = {
  javascript: 63,
  python: 71,
  java: 62,
  cpp: 54,
};

async function executeSubmission(submission) {
  try {
    const testCases = await TestCase.find({
      problem: submission.problem,
    });

    let passed = 0;
    let results = [];

    let maxRuntime = 0;
    let maxMemory = 0;

    for (const tc of testCases) {
      const response = await axios.post(
        `${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`,
        {
          source_code: submission.code,
          language_id: LANGUAGE_MAP[submission.language],
          stdin: tc.input,
        }
      );

      const result = response.data;

      const isCorrect =
        result.stdout?.trim() === tc.expectedOutput.trim();

      if (isCorrect) passed++;

      maxRuntime = Math.max(maxRuntime, result.time || 0);
      maxMemory = Math.max(maxMemory, result.memory || 0);

      results.push({
        testCaseId: tc._id,
        passed: isCorrect,
        runtimeMs: result.time || 0,
        memoryKb: result.memory || 0,
        stderr: result.stderr || null,
      });

      if (!isCorrect) break;
    }

    //  FINAL VERDICT
    let verdict = 'Accepted';
    if (passed !== testCases.length) {
      verdict = 'Wrong Answer';
    }

    //  UPDATE SUBMISSION
    submission.verdict = verdict;
    submission.runtimeMs = maxRuntime;
    submission.memoryKb = maxMemory;
    submission.testResults = results;
    submission.score = Math.floor((passed / testCases.length) * 100);
    submission.judgedAt = new Date();

    await submission.save();

    if (verdict === 'Accepted') {
      await Notification.create({
        user: submission.user,
        type: 'submission_accepted',
        title: 'Submission Accepted',
        message: 'Your code passed all test cases!'
      });
    }

    return submission;

  } catch (err) {
    console.error('Judge Error:', err.message);

    submission.verdict = 'Internal Error';
    submission.errorMessage = err.message;

    await submission.save();

    return submission;
  }
}

module.exports = { executeSubmission };