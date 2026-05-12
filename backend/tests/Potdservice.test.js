'use strict';

/**
 * Unit tests for potd.service — Problem of the Day generation.
 * All DB calls and AI service are mocked.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockProblem = {
  _id: 'prob1',
  title: 'Two Sum',
  slug: 'two-sum',
  difficulty: 'Easy',
  tags: ['Array', 'Hash Table'],
  totalSubmissions: 100,
  totalAccepted: 60,
};

const makePotdDoc = (overrides = {}) => ({
  _id: 'potd1',
  date: '2026-05-12',
  problem: mockProblem,
  selectionMethod: 'auto',
  selectedBy: null,
  toObject: jest.fn().mockReturnValue({ _id: 'potd1', date: '2026-05-12', problem: mockProblem }),
  ...overrides,
});

// Helper: chainable mock query (supports .populate().lean(), .findById().lean(), etc.)
function makeQuery(resolveValue) {
  const q = {
    _value: resolveValue,
    populate: jest.fn().mockImplementation(function () { return this; }),
    lean: jest.fn().mockImplementation(function () { return Promise.resolve(this._value); }),
    then(resolve, reject) { return Promise.resolve(this._value).then(resolve, reject); },
    catch(reject) { return Promise.resolve(this._value).catch(reject); },
  };
  return q;
}

jest.mock('../src/models/POTD', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../src/models/Problem', () => ({
  findById: jest.fn(),
}));

jest.mock('../src/services/AIService', () => ({
  generatePOTD: jest.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

const POTD    = require('../src/models/POTD');
const Problem = require('../src/models/Problem');
const AIService = require('../src/services/AIService');
const { getTodayPOTD, regeneratePOTD, getPOTDHistory } = require('../src/services/potd.service');

beforeEach(() => jest.clearAllMocks());

// ── Helper ────────────────────────────────────────────────────────────────────

/** Returns today's date string in UTC — mirrors the service's todayString() */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── getTodayPOTD ──────────────────────────────────────────────────────────────

describe('getTodayPOTD', () => {
  it('returns existing POTD without hitting AI when one already exists for today', async () => {
    const existing = makePotdDoc({ date: todayStr() });
    POTD.findOne.mockReturnValueOnce(makeQuery(existing));

    const result = await getTodayPOTD();

    expect(result.isNew).toBe(false);
    expect(result.potd).toBe(existing);
    expect(AIService.generatePOTD).not.toHaveBeenCalled();
    expect(POTD.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('computes acceptance rate on the existing problem', async () => {
    const existing = makePotdDoc({
      problem: { ...mockProblem, totalSubmissions: 200, totalAccepted: 50 },
    });
    POTD.findOne.mockReturnValueOnce(makeQuery(existing));

    const result = await getTodayPOTD();

    expect(result.problem.acceptance).toBeCloseTo(25.0, 1);
    expect(result.problem.acceptanceRate).toBeCloseTo(25.0, 1);
  });

  it('sets acceptance to 0 when totalSubmissions is 0', async () => {
    const existing = makePotdDoc({
      problem: { ...mockProblem, totalSubmissions: 0, totalAccepted: 0 },
    });
    POTD.findOne.mockReturnValueOnce(makeQuery(existing));

    const result = await getTodayPOTD();

    expect(result.problem.acceptance).toBe(0);
  });

  it('generates a new POTD via AI when none exists for today', async () => {
    POTD.findOne.mockReturnValueOnce(makeQuery(null)); // no existing POTD
    AIService.generatePOTD.mockResolvedValueOnce(mockProblem);

    const upsertedPotd = makePotdDoc();
    POTD.findOneAndUpdate.mockResolvedValueOnce(upsertedPotd);

    const populated = makePotdDoc();
    POTD.findById.mockReturnValueOnce(makeQuery(populated));

    const result = await getTodayPOTD();

    expect(AIService.generatePOTD).toHaveBeenCalledWith(todayStr());
    expect(POTD.findOneAndUpdate).toHaveBeenCalledWith(
      { date: todayStr() },
      expect.objectContaining({ $setOnInsert: { problem: mockProblem._id, selectionMethod: 'auto' } }),
      expect.objectContaining({ upsert: true, new: true })
    );
    expect(result.isNew).toBe(true);
  });

  it('uses upsert (setOnInsert) to handle concurrent race conditions', async () => {
    POTD.findOne.mockReturnValueOnce(makeQuery(null));
    AIService.generatePOTD.mockResolvedValueOnce(mockProblem);
    const upserted = makePotdDoc();
    POTD.findOneAndUpdate.mockResolvedValueOnce(upserted);
    POTD.findById.mockReturnValueOnce(makeQuery(makePotdDoc()));

    await getTodayPOTD();

    const [, updateDoc, options] = POTD.findOneAndUpdate.mock.calls[0];
    expect(updateDoc).toHaveProperty('$setOnInsert');
    expect(updateDoc).not.toHaveProperty('$set');
    expect(options.upsert).toBe(true);
  });

  it('throws 500 when AI generation returns null/undefined', async () => {
    POTD.findOne.mockReturnValueOnce(makeQuery(null));
    AIService.generatePOTD.mockResolvedValueOnce(null);

    await expect(getTodayPOTD()).rejects.toMatchObject({ statusCode: 500 });
  });
});

// ── regeneratePOTD ────────────────────────────────────────────────────────────

describe('regeneratePOTD', () => {
  it('uses the specific problem when problemId is provided', async () => {
    Problem.findById.mockReturnValueOnce(makeQuery(mockProblem));

    const potdResult = {
      ...makePotdDoc({ selectionMethod: 'admin' }),
      problem: mockProblem,
      toObject: jest.fn().mockReturnValue({}),
    };
    POTD.findOneAndUpdate.mockReturnValueOnce(makeQuery(potdResult));

    const result = await regeneratePOTD('prob1', 'admin1');

    expect(Problem.findById).toHaveBeenCalledWith('prob1');
    expect(AIService.generatePOTD).not.toHaveBeenCalled();
    expect(POTD.findOneAndUpdate).toHaveBeenCalledWith(
      { date: todayStr() },
      expect.objectContaining({ problem: mockProblem._id, selectionMethod: 'admin', selectedBy: 'admin1' }),
      expect.objectContaining({ upsert: true, new: true })
    );
    expect(result.potd).toBeDefined();
  });

  it('throws 404 when specified problemId does not exist', async () => {
    Problem.findById.mockReturnValueOnce(makeQuery(null));

    await expect(
      regeneratePOTD('nonexistent', 'admin1')
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(POTD.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('auto-generates via AI when no problemId is given', async () => {
    AIService.generatePOTD.mockResolvedValueOnce(mockProblem);

    const potdResult = {
      ...makePotdDoc({ selectionMethod: 'admin' }),
      problem: mockProblem,
      toObject: jest.fn().mockReturnValue({}),
    };
    POTD.findOneAndUpdate.mockReturnValueOnce(makeQuery(potdResult));

    await regeneratePOTD(null, 'admin1');

    expect(AIService.generatePOTD).toHaveBeenCalled();
    expect(Problem.findById).not.toHaveBeenCalled();
  });

  it('records selectionMethod as "admin" regardless of how problem was chosen', async () => {
    Problem.findById.mockReturnValueOnce(makeQuery(mockProblem));
    const potdResult = {
      ...makePotdDoc(),
      problem: mockProblem,
      toObject: jest.fn().mockReturnValue({}),
    };
    POTD.findOneAndUpdate.mockReturnValueOnce(makeQuery(potdResult));

    await regeneratePOTD('prob1', 'admin1');

    expect(POTD.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ selectionMethod: 'admin' }),
      expect.anything()
    );
  });
});

// ── getPOTDHistory ─────────────────────────────────────────────────────────────

describe('getPOTDHistory', () => {
  function makeFindChain(result) {
    const q = {
      _value: result,
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockImplementation(function () { return Promise.resolve(this._value); }),
    };
    return q;
  }

  it('returns entries sorted by date descending', async () => {
    const history = [
      { date: '2026-05-12', problem: mockProblem },
      { date: '2026-05-11', problem: mockProblem },
    ];
    POTD.find.mockReturnValueOnce(makeFindChain(history));

    const result = await getPOTDHistory(7);

    expect(result).toEqual(history);
    expect(POTD.find).toHaveBeenCalledWith(
      expect.objectContaining({ date: expect.objectContaining({ $gte: expect.any(String) }) })
    );
  });

  it('defaults to 7 days of history when no argument is given', async () => {
    POTD.find.mockReturnValueOnce(makeFindChain([]));

    await getPOTDHistory();

    const [[filter]] = POTD.find.mock.calls;
    const cutoffStr = filter.date.$gte;
    const cutoffDate = new Date(cutoffStr);
    const daysDiff = Math.abs((new Date() - cutoffDate) / 86400000);
    expect(daysDiff).toBeCloseTo(7, 0);
  });

  it('accepts a custom days argument', async () => {
    POTD.find.mockReturnValueOnce(makeFindChain([]));

    await getPOTDHistory(30);

    const [[filter]] = POTD.find.mock.calls;
    const cutoffDate = new Date(filter.date.$gte);
    const daysDiff = Math.abs((new Date() - cutoffDate) / 86400000);
    expect(daysDiff).toBeCloseTo(30, 0);
  });
});