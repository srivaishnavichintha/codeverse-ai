'use strict';

/**
 * Unit tests for InterviewService — session lifecycle.
 * All DB calls, credit operations, AI calls, and queue are mocked.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSessionSave = jest.fn().mockResolvedValue(undefined);
const mockQuestionSave = jest.fn().mockResolvedValue(undefined);

// Factory for a lean-style session object (returned by findOne/findById)
const makeSession = (overrides = {}) => ({
  _id: 'session1',
  user: 'user1',
  status: 'coding',
  phase: 'coding',
  assignedProblems: [],
  solvedCount: 0,
  qualifiedForAI: false,
  aiAnalysisStatus: 'not_started',
  aiJobId: null,
  codingDeadline: new Date(Date.now() + 90 * 60 * 1000), // 90 min from now
  startedAt: new Date(),
  completedAt: null,
  finalReport: {},
  idempotencyKey: null,
  creditTransaction: 'txn1',
  save: mockSessionSave,
  populate: jest.fn().mockImplementation(function () { return Promise.resolve(this); }),
  ...overrides,
});

const makeQuestion = (overrides = {}) => ({
  _id: 'q1',
  session: 'session1',
  userAnswer: null,
  answeredAt: null,
  save: mockQuestionSave,
  ...overrides,
});

const makeSubmission = (verdict = 'Accepted') => ({
  _id: 'sub1',
  verdict,
  status: verdict === 'Accepted' ? 'accepted' : 'wrong_answer',
});

const mockTransaction = { _id: 'txn1', session: null, save: jest.fn().mockResolvedValue(undefined) };

// Helper: creates a mock query object that is await-able AND supports .populate().lean().skip() chains
function makeQuery(resolveValue) {
  const q = {
    _value: resolveValue,
    populate: jest.fn().mockImplementation(function () { return this; }),
    lean: jest.fn().mockImplementation(function () { return Promise.resolve(this._value); }),
    skip: jest.fn().mockImplementation(function () { return this; }),
    then(resolve, reject) { return Promise.resolve(this._value).then(resolve, reject); },
    catch(reject) { return Promise.resolve(this._value).catch(reject); },
  };
  return q;
}

jest.mock('../src/models/InterviewSession', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../src/models/InterviewQuestion', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../src/models/Problem', () => ({
  countDocuments: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../src/models/Submission', () => ({
  findById: jest.fn(),
}));

jest.mock('../src/services/CreditService', () => ({
  debitCredits: jest.fn(),
  refundCredits: jest.fn(),
}));

jest.mock('../src/services/QueueService', () => ({
  QueueService: {
    addAIAnalysisJob: jest.fn().mockResolvedValue({ id: 'job1' }),
    getJobStatus: jest.fn(),
  },
}));

jest.mock('../src/services/AIService', () => ({
  generateCodingProblems: jest.fn(),
  generatePOTD: jest.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

const InterviewSession  = require('../src/models/InterviewSession');
const InterviewQuestion = require('../src/models/InterviewQuestion');
const Problem           = require('../src/models/Problem');
const Submission        = require('../src/models/Submission');
const CreditService     = require('../src/services/CreditService');
const { QueueService }  = require('../src/services/QueueService');
const AIService         = require('../src/services/AIService');
const InterviewService  = require('../src/services/InterviewService');

beforeEach(() => jest.clearAllMocks());

// ── startInterview ───────────────────────────────────────────────────────────

describe('InterviewService.startInterview', () => {
  it('returns existing session when idempotency key already used', async () => {
    const existing = makeSession();
    // idempotency findOne uses .populate() chain
    InterviewSession.findOne.mockReturnValueOnce(makeQuery(existing));

    const result = await InterviewService.startInterview('user1', 'idem-key-1');
    expect(result).toBe(existing);
    expect(CreditService.debitCredits).not.toHaveBeenCalled();
  });

  it('throws 409 when an active session already exists', async () => {
    // no idempotencyKey → first findOne is the active-session check
    InterviewSession.findOne.mockResolvedValueOnce(makeSession());

    await expect(
      InterviewService.startInterview('user1', null)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 402 when user has insufficient credits', async () => {
    InterviewSession.findOne.mockResolvedValue(null);
    CreditService.debitCredits.mockRejectedValueOnce(
      Object.assign(new Error('Insufficient credits.'), { statusCode: 402 })
    );

    await expect(
      InterviewService.startInterview('user1', null)
    ).rejects.toMatchObject({ statusCode: 402 });
  });

  it('creates a new session with AI-assigned problems on success', async () => {
    const problems = [{ _id: 'p1' }, { _id: 'p2' }, { _id: 'p3' }];
    InterviewSession.findOne.mockResolvedValue(null);  // no active session
    CreditService.debitCredits.mockResolvedValueOnce(mockTransaction);
    AIService.generateCodingProblems.mockResolvedValueOnce(problems);

    const session = makeSession({ assignedProblems: [], save: jest.fn().mockResolvedValue(undefined) });
    InterviewSession.create.mockResolvedValueOnce(session);

    await InterviewService.startInterview('user1', null);

    expect(CreditService.debitCredits).toHaveBeenCalled();
    expect(InterviewSession.create).toHaveBeenCalled();
    expect(AIService.generateCodingProblems).toHaveBeenCalledWith(session._id);
    expect(session.save).toHaveBeenCalled();
  });

  it('falls back to DB problem assignment when AI fails', async () => {
    InterviewSession.findOne.mockResolvedValue(null);
    CreditService.debitCredits.mockResolvedValueOnce(mockTransaction);
    AIService.generateCodingProblems.mockRejectedValueOnce(new Error('AI down'));

    const session = makeSession({ save: jest.fn().mockResolvedValue(undefined) });
    InterviewSession.create.mockResolvedValueOnce(session);

    // Stub assignProblems DB path — Problem.findOne uses .skip().lean() chain
    Problem.countDocuments.mockResolvedValue(5);
    Problem.findOne.mockReturnValue(makeQuery({ _id: 'pFallback' }));
    Problem.find.mockResolvedValue([]);

    await InterviewService.startInterview('user1', null);

    expect(session.save).toHaveBeenCalled();
    expect(Problem.countDocuments).toHaveBeenCalled();
  });

  it('assigns session id back to credit transaction', async () => {
    const txn = { _id: 'txn2', session: null, save: jest.fn().mockResolvedValue(undefined) };
    InterviewSession.findOne.mockResolvedValue(null);
    CreditService.debitCredits.mockResolvedValueOnce(txn);
    AIService.generateCodingProblems.mockResolvedValueOnce([]);

    const session = makeSession({ _id: 'newSession', save: jest.fn().mockResolvedValue(undefined) });
    InterviewSession.create.mockResolvedValueOnce(session);

    await InterviewService.startInterview('user1', null);

    expect(txn.session).toBe('newSession');
    expect(txn.save).toHaveBeenCalled();
  });
});

// ── submitCode ───────────────────────────────────────────────────────────────

describe('InterviewService.submitCode', () => {
  const buildSession = (extraProblems = []) => {
    const session = makeSession({
      assignedProblems: [
        { problem: { toString: () => 'p1' }, solved: false, submission: null },
        ...extraProblems,
      ],
    });
    session.save = jest.fn().mockResolvedValue(undefined);
    return session;
  };

  it('throws 404 when session is not found', async () => {
    InterviewSession.findOne.mockResolvedValueOnce(null);
    await expect(
      InterviewService.submitCode('s1', 'u1', 'p1', 'sub1')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when session is not in coding phase', async () => {
    InterviewSession.findOne.mockResolvedValueOnce(makeSession({ status: 'ai_phase' }));
    await expect(
      InterviewService.submitCode('s1', 'u1', 'p1', 'sub1')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 410 and marks session expired when coding deadline has passed', async () => {
    const session = makeSession({
      codingDeadline: new Date(Date.now() - 1000), // already past
      save: jest.fn().mockResolvedValue(undefined),
    });
    InterviewSession.findOne.mockResolvedValueOnce(session);

    await expect(
      InterviewService.submitCode('s1', 'u1', 'p1', 'sub1')
    ).rejects.toMatchObject({ statusCode: 410 });
    expect(session.status).toBe('expired');
    expect(session.save).toHaveBeenCalled();
  });

  it('throws 404 when submission is not found', async () => {
    InterviewSession.findOne.mockResolvedValueOnce(buildSession());
    Submission.findById.mockReturnValueOnce(makeQuery(null));

    await expect(
      InterviewService.submitCode('s1', 'u1', 'p1', 'sub1')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when problem is not assigned to session', async () => {
    InterviewSession.findOne.mockResolvedValueOnce(buildSession());
    Submission.findById.mockReturnValueOnce(makeQuery(makeSubmission()));

    await expect(
      InterviewService.submitCode('s1', 'u1', 'wrongProblem', 'sub1')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('marks problem as solved when submission verdict is Accepted', async () => {
    const session = buildSession();
    InterviewSession.findOne.mockResolvedValueOnce(session);
    Submission.findById.mockReturnValueOnce(makeQuery(makeSubmission('Accepted')));

    const result = await InterviewService.submitCode('s1', 'u1', 'p1', 'sub1');

    expect(result.assignedProblems[0].solved).toBe(true);
    expect(result.solvedCount).toBe(1);
    expect(session.save).toHaveBeenCalled();
  });

  it('does not mark problem as solved for Wrong Answer', async () => {
    const session = buildSession();
    InterviewSession.findOne.mockResolvedValueOnce(session);
    Submission.findById.mockReturnValueOnce(makeQuery(makeSubmission('Wrong Answer')));

    const result = await InterviewService.submitCode('s1', 'u1', 'p1', 'sub1');

    expect(result.assignedProblems[0].solved).toBe(false);
    expect(result.solvedCount).toBe(0);
  });

  it('is idempotent — preserves solved=true if already solved', async () => {
    const session = buildSession();
    session.assignedProblems[0].solved = true; // already marked solved
    InterviewSession.findOne.mockResolvedValueOnce(session);
    Submission.findById.mockReturnValueOnce(makeQuery(makeSubmission('Wrong Answer')));

    const result = await InterviewService.submitCode('s1', 'u1', 'p1', 'sub2');

    expect(result.assignedProblems[0].solved).toBe(true); // not degraded
  });

  it('increments solvedCount correctly for multiple problems', async () => {
    const session = buildSession([
      { problem: { toString: () => 'p2' }, solved: true, submission: 'oldSub' },
    ]);
    InterviewSession.findOne.mockResolvedValueOnce(session);
    Submission.findById.mockReturnValueOnce(makeQuery(makeSubmission('Accepted')));

    const result = await InterviewService.submitCode('s1', 'u1', 'p1', 'sub1');

    // p1 now solved + p2 already solved = 2
    expect(result.solvedCount).toBe(2);
  });
});

// ── checkQualification ───────────────────────────────────────────────────────

describe('InterviewService.checkQualification', () => {
  const qualifyingSession = () =>
    makeSession({ solvedCount: 2, save: jest.fn().mockResolvedValue(undefined) });

  const failingSession = () =>
    makeSession({ solvedCount: 1, save: jest.fn().mockResolvedValue(undefined) });

  it('throws 404 when session not found', async () => {
    InterviewSession.findOne.mockResolvedValueOnce(null);
    await expect(
      InterviewService.checkQualification('s1', 'u1')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when session is not in coding phase', async () => {
    InterviewSession.findOne.mockResolvedValueOnce(makeSession({ status: 'ai_phase' }));
    await expect(
      InterviewService.checkQualification('s1', 'u1')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('transitions to ai_phase when solved >= threshold (2)', async () => {
    const session = qualifyingSession();
    InterviewSession.findOne.mockResolvedValueOnce(session);

    const { qualifies } = await InterviewService.checkQualification('s1', 'u1');

    expect(qualifies).toBe(true);
    expect(session.status).toBe('ai_phase');
    expect(session.phase).toBe('ai');
    expect(session.save).toHaveBeenCalled();
    expect(QueueService.addAIAnalysisJob).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: expect.any(String) })
    );
  });

  it('marks session as failed and issues partial refund when below threshold', async () => {
    const session = failingSession();
    InterviewSession.findOne.mockResolvedValueOnce(session);
    CreditService.refundCredits.mockResolvedValueOnce(undefined);

    const { qualifies } = await InterviewService.checkQualification('s1', 'u1');

    expect(qualifies).toBe(false);
    expect(session.status).toBe('failed');
    expect(session.save).toHaveBeenCalled();
    expect(CreditService.refundCredits).toHaveBeenCalled();
    expect(QueueService.addAIAnalysisJob).not.toHaveBeenCalled();
  });

  it('does not re-queue AI if already queued (idempotency)', async () => {
    const session = qualifyingSession();
    session.aiAnalysisStatus = 'queued';
    InterviewSession.findOne.mockResolvedValueOnce(session);

    await InterviewService.checkQualification('s1', 'u1');

    expect(QueueService.addAIAnalysisJob).not.toHaveBeenCalled();
  });
});

// ── submitAnswer ─────────────────────────────────────────────────────────────

describe('InterviewService.submitAnswer', () => {
  it('throws 404 when session not found', async () => {
    InterviewSession.findOne.mockResolvedValueOnce(null);
    await expect(
      InterviewService.submitAnswer('s1', 'u1', 'q1', 'My answer')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when session is not in ai_phase', async () => {
    InterviewSession.findOne.mockResolvedValueOnce(makeSession({ status: 'coding' }));
    await expect(
      InterviewService.submitAnswer('s1', 'u1', 'q1', 'My answer')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 when question not found', async () => {
    InterviewSession.findOne.mockResolvedValueOnce(makeSession({ status: 'ai_phase' }));
    InterviewQuestion.findOne.mockResolvedValueOnce(null);

    await expect(
      InterviewService.submitAnswer('s1', 'u1', 'q1', 'My answer')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 409 when question already has an answer', async () => {
    InterviewSession.findOne.mockResolvedValueOnce(makeSession({ status: 'ai_phase' }));
    InterviewQuestion.findOne.mockResolvedValueOnce(
      makeQuestion({ userAnswer: 'Previous answer' })
    );

    await expect(
      InterviewService.submitAnswer('s1', 'u1', 'q1', 'New answer')
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('saves answer and queues evaluation job', async () => {
    const question = makeQuestion();
    InterviewSession.findOne.mockResolvedValueOnce(makeSession({ status: 'ai_phase' }));
    InterviewQuestion.findOne.mockResolvedValueOnce(question);

    const result = await InterviewService.submitAnswer('s1', 'u1', 'q1', 'Great answer');

    expect(result.userAnswer).toBe('Great answer');
    expect(result.answeredAt).toBeDefined();
    expect(mockQuestionSave).toHaveBeenCalled();
    expect(QueueService.addAIAnalysisJob).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'evaluate_answer',
        questionId: 'q1',
      })
    );
  });
});

// ── terminateSession ─────────────────────────────────────────────────────────

describe('InterviewService.terminateSession', () => {
  it('throws 404 when session not found', async () => {
    InterviewSession.findOne.mockResolvedValueOnce(null);
    await expect(
      InterviewService.terminateSession('s1', 'u1')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('sets status to failed, phase to done, and completedAt', async () => {
    const session = makeSession({ save: jest.fn().mockResolvedValue(undefined) });
    InterviewSession.findOne.mockResolvedValueOnce(session);

    await InterviewService.terminateSession('s1', 'u1');

    expect(session.status).toBe('failed');
    expect(session.phase).toBe('done');
    expect(session.completedAt).toBeInstanceOf(Date);
    expect(session.save).toHaveBeenCalled();
  });
});

// ── getSessionState ───────────────────────────────────────────────────────────

describe('InterviewService.getSessionState', () => {
  it('throws 404 when session not found', async () => {
    InterviewSession.findOne.mockReturnValueOnce(makeQuery(null));

    await expect(
      InterviewService.getSessionState('s1', 'u1')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns session and questions together', async () => {
    const session = { _id: 's1', status: 'ai_phase' };
    const questions = [{ _id: 'q1' }, { _id: 'q2' }];

    InterviewSession.findOne.mockReturnValueOnce(makeQuery(session));
    InterviewQuestion.find.mockReturnValueOnce(makeQuery(questions));

    const result = await InterviewService.getSessionState('s1', 'u1');

    expect(result.session).toBe(session);
    expect(result.questions).toEqual(questions);
  });
});