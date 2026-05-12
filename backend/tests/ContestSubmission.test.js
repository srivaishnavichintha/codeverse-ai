'use strict';

/**
 * Unit tests for contestSubmission.service — evaluateContestSubmission.
 * Judge0, DB calls, anti-cheat, and leaderboard are all mocked.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('axios');
jest.mock('../src/modules/contestZone/models/ContestSubmission.model');
jest.mock('../src/modules/contestZone/models/ContestProblem.model');
jest.mock('../src/modules/contestZone/models/ContestZone.model');
jest.mock('../src/modules/contestZone/services/leaderboard.service');
jest.mock('../src/modules/contestZone/services/antiCheat.service');

const axios             = require('axios');
const ContestSubmission = require('../src/modules/contestZone/models/ContestSubmission.model');
const ContestProblem    = require('../src/modules/contestZone/models/ContestProblem.model');
const ContestZone       = require('../src/modules/contestZone/models/ContestZone.model');
const { applySubmissionScore } = require('../src/modules/contestZone/services/leaderboard.service');
const { checkPlagiarism, checkSuspiciousSpeed } = require('../src/modules/contestZone/services/antiCheat.service');
const { evaluateContestSubmission } = require('../src/modules/contestZone/services/contestSubmission.service');

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeContest = (overrides = {}) => ({
  _id: 'contest1',
  status: 'active',
  startedAt: new Date(Date.now() - 60_000),
  ...overrides,
});

const makeProblem = (overrides = {}) => ({
  _id: 'prob1',
  contest: { toString: () => 'contest1' },
  testCases: [
    { _id: 'tc1', input: '1 2', expectedOutput: '3' },
    { _id: 'tc2', input: '5 6', expectedOutput: '11' },
  ],
  timeLimit: 2000,
  memoryLimit: 256,
  maxPoints: 100,
  ...overrides,
});

const makeJudgeResponse = (stdout, statusId = 3, time = '0.05', memory = 1024) => ({
  data: {
    stdout,
    status: { id: statusId },
    time,
    memory,
    stderr: null,
  },
});

const makePendingSubmission = () => ({
  _id: 'sub1',
  contest: 'contest1',
  problem: 'prob1',
  user: 'user1',
  verdict: 'Pending',
});

function setupDefaults({ contest, problem, attemptNumber = 1, submission } = {}) {
  ContestZone.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(contest ?? makeContest()) });
  ContestProblem.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(problem ?? makeProblem()) });
  ContestSubmission.countDocuments.mockResolvedValue(attemptNumber - 1);
  ContestSubmission.create.mockResolvedValue(submission ?? makePendingSubmission());
  ContestSubmission.findByIdAndUpdate.mockResolvedValue(undefined);
  ContestSubmission.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'sub1', verdict: 'Accepted' }) });
  checkPlagiarism.mockResolvedValue({ plagiarismScore: 0, flagged: false });
  checkSuspiciousSpeed.mockResolvedValue(false);
  applySubmissionScore.mockResolvedValue([]);
}

beforeEach(() => jest.clearAllMocks());

// ── Guard rails ───────────────────────────────────────────────────────────────

describe('evaluateContestSubmission — guard rails', () => {
  it('throws when contest is not found', async () => {
    ContestZone.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    await expect(
      evaluateContestSubmission({ contestId: 'c1', problemId: 'p1', userId: 'u1', code: 'x', language: 'python' })
    ).rejects.toThrow('Contest is not active');
  });

  it('throws when contest status is not "active"', async () => {
    ContestZone.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(makeContest({ status: 'ended' })) });

    await expect(
      evaluateContestSubmission({ contestId: 'c1', problemId: 'p1', userId: 'u1', code: 'x', language: 'python' })
    ).rejects.toThrow('Contest is not active');
  });

  it('throws when problem is not found', async () => {
    ContestZone.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(makeContest()) });
    ContestProblem.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    await expect(
      evaluateContestSubmission({ contestId: 'contest1', problemId: 'p1', userId: 'u1', code: 'x', language: 'python' })
    ).rejects.toThrow('Problem not found in this contest');
  });

  it('throws when problem belongs to a different contest', async () => {
    ContestZone.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(makeContest()) });
    ContestProblem.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(makeProblem({ contest: { toString: () => 'OTHER_CONTEST' } })),
    });

    await expect(
      evaluateContestSubmission({ contestId: 'contest1', problemId: 'p1', userId: 'u1', code: 'x', language: 'python' })
    ).rejects.toThrow('Problem not found in this contest');
  });
});

// ── Verdict mapping ───────────────────────────────────────────────────────────

describe('evaluateContestSubmission — verdict assignment', () => {
  it('returns Accepted when all test cases pass', async () => {
    setupDefaults();
    // tc1 expects '3', tc2 expects '11'
    axios.post
      .mockResolvedValueOnce(makeJudgeResponse('3\n', 3))
      .mockResolvedValueOnce(makeJudgeResponse('11\n', 3));

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'print(a+b)', language: 'python', io: null,
    });

    const [, updatePayload] = ContestSubmission.findByIdAndUpdate.mock.calls[0];
    expect(updatePayload.verdict).toBe('Accepted');
    expect(updatePayload.score).toBe(100);
  });

  it('assigns Wrong Answer when output does not match', async () => {
    setupDefaults();
    // stdout doesn't match expectedOutput '3'
    axios.post.mockResolvedValue(makeJudgeResponse('999\n', 3));

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'print(999)', language: 'python', io: null,
    });

    const [, updatePayload] = ContestSubmission.findByIdAndUpdate.mock.calls[0];
    expect(updatePayload.verdict).toBe('Wrong Answer');
    expect(updatePayload.score).toBe(0);
  });

  it('assigns Time Limit Exceeded when Judge0 returns status 5', async () => {
    setupDefaults();
    axios.post.mockResolvedValue(makeJudgeResponse(null, 5));

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'while True: pass', language: 'python', io: null,
    });

    const [, updatePayload] = ContestSubmission.findByIdAndUpdate.mock.calls[0];
    expect(updatePayload.verdict).toBe('Time Limit Exceeded');
  });

  it('assigns Compilation Error when Judge0 returns status 6', async () => {
    setupDefaults();
    axios.post.mockResolvedValue(makeJudgeResponse(null, 6));

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'def broken(', language: 'python', io: null,
    });

    const [, updatePayload] = ContestSubmission.findByIdAndUpdate.mock.calls[0];
    expect(updatePayload.verdict).toBe('Compilation Error');
  });

  it('assigns Runtime Error when Judge0 returns status 7-12', async () => {
    setupDefaults();
    axios.post.mockResolvedValue(makeJudgeResponse(null, 7));

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'raise Exception()', language: 'python', io: null,
    });

    const [, updatePayload] = ContestSubmission.findByIdAndUpdate.mock.calls[0];
    expect(updatePayload.verdict).toBe('Runtime Error');
  });

  it('assigns Internal Error and breaks early when Judge0 call throws', async () => {
    setupDefaults();
    axios.post.mockRejectedValue(new Error('Judge0 unreachable'));

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'print("hi")', language: 'python', io: null,
    });

    const [, updatePayload] = ContestSubmission.findByIdAndUpdate.mock.calls[0];
    expect(updatePayload.verdict).toBe('Internal Error');
    // Only one test result should be present (broke after first failure)
    expect(updatePayload.testResults).toHaveLength(1);
  });
});

// ── Score calculation ─────────────────────────────────────────────────────────

describe('evaluateContestSubmission — score calculation', () => {
  it('scores 50 when exactly half the test cases pass', async () => {
    setupDefaults();
    // tc1 passes (stdout='3', status=3), tc2 fails (wrong output)
    axios.post
      .mockResolvedValueOnce(makeJudgeResponse('3\n', 3))       // tc1 pass
      .mockResolvedValueOnce(makeJudgeResponse('999\n', 3));    // tc2 fail

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'partial', language: 'python', io: null,
    });

    const [, updatePayload] = ContestSubmission.findByIdAndUpdate.mock.calls[0];
    expect(updatePayload.score).toBe(50);
  });

  it('scores 0 when there are no test cases', async () => {
    setupDefaults({ problem: makeProblem({ testCases: [] }) });

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'print("hi")', language: 'python', io: null,
    });

    const [, updatePayload] = ContestSubmission.findByIdAndUpdate.mock.calls[0];
    expect(updatePayload.score).toBe(0);
  });

  it('short-circuits remaining test cases after a hard error (TLE/RTE)', async () => {
    setupDefaults();
    // First test case: Runtime Error
    axios.post.mockResolvedValueOnce(makeJudgeResponse(null, 7));

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'bad', language: 'python', io: null,
    });

    // Only 1 Judge0 call should be made (not 2)
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});

// ── Leaderboard update ────────────────────────────────────────────────────────

describe('evaluateContestSubmission — leaderboard update', () => {
  it('calls applySubmissionScore when score > 0', async () => {
    setupDefaults();
    axios.post.mockResolvedValueOnce(makeJudgeResponse('3\n', 3)).mockResolvedValueOnce(makeJudgeResponse('11\n', 3));

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'print(a+b)', language: 'python', io: null,
    });

    expect(applySubmissionScore).toHaveBeenCalledWith(
      expect.objectContaining({ contestId: 'contest1', userId: 'user1', problemId: 'prob1' })
    );
  });

  it('does NOT call applySubmissionScore when score is 0', async () => {
    setupDefaults();
    axios.post.mockResolvedValue(makeJudgeResponse('999\n', 3)); // wrong answer

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'bad', language: 'python', io: null,
    });

    expect(applySubmissionScore).not.toHaveBeenCalled();
  });
});

// ── Socket events ─────────────────────────────────────────────────────────────

describe('evaluateContestSubmission — socket emissions', () => {
  it('emits submission:received to the contest room', async () => {
    setupDefaults();
    axios.post.mockResolvedValueOnce(makeJudgeResponse('3\n', 3)).mockResolvedValueOnce(makeJudgeResponse('11\n', 3));

    const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'x', language: 'python', io,
    });

    expect(io.to).toHaveBeenCalledWith('contest:contest1');
    expect(io.emit).toHaveBeenCalledWith('contest:submission:received', expect.any(Object));
  });

  it('emits submission:result to the user room with verdict and score', async () => {
    setupDefaults();
    axios.post.mockResolvedValueOnce(makeJudgeResponse('3\n', 3)).mockResolvedValueOnce(makeJudgeResponse('11\n', 3));

    const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'x', language: 'python', io,
    });

    const resultCall = io.emit.mock.calls.find(([event]) => event === 'contest:submission:result');
    expect(resultCall).toBeDefined();
    const payload = resultCall[1];
    expect(payload).toMatchObject({ contestId: 'contest1', verdict: expect.any(String), score: expect.any(Number) });
  });

  it('emits leaderboard:update to the contest room when score > 0', async () => {
    setupDefaults();
    axios.post.mockResolvedValueOnce(makeJudgeResponse('3\n', 3)).mockResolvedValueOnce(makeJudgeResponse('11\n', 3));
    applySubmissionScore.mockResolvedValue([{ rank: 1, userId: 'user1' }]);

    const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'x', language: 'python', io,
    });

    const lbCall = io.emit.mock.calls.find(([event]) => event === 'contest:leaderboard:update');
    expect(lbCall).toBeDefined();
  });

  it('does not throw when io is null', async () => {
    setupDefaults();
    axios.post.mockResolvedValueOnce(makeJudgeResponse('3\n', 3)).mockResolvedValueOnce(makeJudgeResponse('11\n', 3));

    await expect(
      evaluateContestSubmission({
        contestId: 'contest1', problemId: 'prob1', userId: 'user1',
        code: 'x', language: 'python', io: null,
      })
    ).resolves.toBeDefined();
  });
});

// ── Anti-cheat integration ────────────────────────────────────────────────────

describe('evaluateContestSubmission — anti-cheat', () => {
  it('flags submission when plagiarism is detected', async () => {
    setupDefaults();
    axios.post.mockResolvedValueOnce(makeJudgeResponse('3\n', 3)).mockResolvedValueOnce(makeJudgeResponse('11\n', 3));
    checkPlagiarism.mockResolvedValue({ plagiarismScore: 0.95, flagged: true });
    checkSuspiciousSpeed.mockResolvedValue(false);

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'x', language: 'python', io: null,
    });

    const [, updatePayload] = ContestSubmission.findByIdAndUpdate.mock.calls[0];
    expect(updatePayload.flaggedForReview).toBe(true);
    expect(updatePayload.plagiarismScore).toBe(0.95);
  });

  it('flags submission when solve speed is suspicious', async () => {
    setupDefaults();
    axios.post.mockResolvedValueOnce(makeJudgeResponse('3\n', 3)).mockResolvedValueOnce(makeJudgeResponse('11\n', 3));
    checkPlagiarism.mockResolvedValue({ plagiarismScore: 0, flagged: false });
    checkSuspiciousSpeed.mockResolvedValue(true); // too fast

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'x', language: 'python', io: null,
    });

    const [, updatePayload] = ContestSubmission.findByIdAndUpdate.mock.calls[0];
    expect(updatePayload.flaggedForReview).toBe(true);
  });

  it('does not flag clean submission', async () => {
    setupDefaults();
    axios.post.mockResolvedValueOnce(makeJudgeResponse('3\n', 3)).mockResolvedValueOnce(makeJudgeResponse('11\n', 3));
    checkPlagiarism.mockResolvedValue({ plagiarismScore: 0.1, flagged: false });
    checkSuspiciousSpeed.mockResolvedValue(false);

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'x', language: 'python', io: null,
    });

    const [, updatePayload] = ContestSubmission.findByIdAndUpdate.mock.calls[0];
    expect(updatePayload.flaggedForReview).toBe(false);
  });
});

// ── Runtime metrics ───────────────────────────────────────────────────────────

describe('evaluateContestSubmission — runtime & memory tracking', () => {
  it('records the max runtime and memory across all test cases', async () => {
    setupDefaults();
    axios.post
      .mockResolvedValueOnce(makeJudgeResponse('3\n',  3, '0.10', 512))
      .mockResolvedValueOnce(makeJudgeResponse('11\n', 3, '0.25', 1024));

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'x', language: 'python', io: null,
    });

    const [, updatePayload] = ContestSubmission.findByIdAndUpdate.mock.calls[0];
    expect(updatePayload.runtimeMs).toBeCloseTo(250, 0); // 0.25 * 1000
    expect(updatePayload.memoryKb).toBe(1024);
  });

  it('increments attemptNumber based on previous submission count', async () => {
    setupDefaults({ attemptNumber: 4 }); // 3 prior submissions
    axios.post.mockResolvedValueOnce(makeJudgeResponse('3\n', 3)).mockResolvedValueOnce(makeJudgeResponse('11\n', 3));

    await evaluateContestSubmission({
      contestId: 'contest1', problemId: 'prob1', userId: 'user1',
      code: 'x', language: 'python', io: null,
    });

    expect(ContestSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({ attemptNumber: 4 })
    );
  });
});