'use strict';

/**
 * Unit tests for evaluateBattleController.
 * All DB calls are mocked — no real database needed.
 */

const mockBattleSave = jest.fn().mockResolvedValue(undefined);
const mockWinnerSave = jest.fn().mockResolvedValue(undefined);
const mockLoserSave  = jest.fn().mockResolvedValue(undefined);

const makeBattle = (overrides = {}) => ({
  _id:          'battle123',
  status:       'ongoing',
  player1Id:    { toString: () => 'player1id' },
  player2Id:    { toString: () => 'player2id' },
  resultReason: null,
  winnerId:     null,
  completedAt:  null,
  save:         mockBattleSave,
  ...overrides,
});

const makeUser = (id, rating = 1200, saveFn) => ({
  _id:           id,
  rating,
  wins:          0,
  losses:        0,
  ratingHistory: [],
  save:          saveFn,
});

jest.mock('../../src/models/Peer/Battle',      () => ({ findById: jest.fn() }));
jest.mock('../../src/models/Submission',        () => ({}));
jest.mock('../../src/services/Peer/EvalutionService', () => ({ evaluateBattle: jest.fn() }));
jest.mock('../../src/services/Peer/BattlelifecycleService', () => ({ checkAndEvaluateBattle: jest.fn().mockResolvedValue(false) }));
jest.mock('../../src/services/Peer/JudgeService', () => ({ executeSubmission: jest.fn() }));
jest.mock('../../src/models/Notification',      () => ({ create: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/models/User',              () => ({ findById: jest.fn() }));

const Battle       = require('../../src/models/Peer/Battle');
const User         = require('../../src/models/User');
const Notification = require('../../src/models/Notification');
const { evaluateBattle } = require('../../src/services/Peer/EvalutionService');
const { evaluateBattleController } = require('../../src/controllers/Peer/Battlecontroller');

function makeReqRes(params = {}) {
  const req  = { params, body: {}, user: { id: 'admin' } };
  const res  = {
    _status: null, _json: null,
    status(code) { this._status = code; return this; },
    json(data)   { this._json   = data; return this; },
  };
  const next = jest.fn();
  return { req, res, next };
}

beforeEach(() => jest.clearAllMocks());

describe('evaluateBattleController', () => {
  it('returns 404 when battle is not found', async () => {
    Battle.findById.mockResolvedValue(null);
    const { req, res, next } = makeReqRes({ battleId: 'nonexistent' });
    await evaluateBattleController(req, res, next);
    expect(res._status).toBe(404);
    expect(res._json.message).toMatch(/not found/i);
  });

  it('returns 400 when battle is already completed', async () => {
    Battle.findById.mockResolvedValue(makeBattle({ status: 'completed' }));
    const { req, res, next } = makeReqRes({ battleId: 'battle123' });
    await evaluateBattleController(req, res, next);
    expect(res._status).toBe(400);
    expect(res._json.message).toMatch(/already evaluated/i);
  });

  it('returns 400 when evaluateBattle returns an error', async () => {
    Battle.findById.mockResolvedValue(makeBattle());
    evaluateBattle.mockResolvedValue({ error: 'No submissions found' });
    const { req, res, next } = makeReqRes({ battleId: 'battle123' });
    await evaluateBattleController(req, res, next);
    expect(res._status).toBe(400);
  });

  it('updates winner rating and creates notification on win', async () => {
    const winner = makeUser('player1id', 1200, mockWinnerSave);
    const loser  = makeUser('player2id', 1200, mockLoserSave);
    Battle.findById.mockResolvedValue(makeBattle());
    evaluateBattle.mockResolvedValue({ winnerId: 'player1id', reason: 'first_ac' });
    User.findById.mockImplementation(id =>
      Promise.resolve(id.toString() === 'player1id' ? winner : loser)
    );
    const { req, res, next } = makeReqRes({ battleId: 'battle123' });
    await evaluateBattleController(req, res, next);

    expect(winner.rating).toBeGreaterThan(1200);
    expect(winner.wins).toBe(1);
    expect(mockWinnerSave).toHaveBeenCalled();
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ user: winner._id })
    );
  });

  it('loser is NOT undefined — regression test for the runtime bug', async () => {
    const winner = makeUser('player1id', 1200, mockWinnerSave);
    const loser  = makeUser('player2id', 1200, mockLoserSave);
    Battle.findById.mockResolvedValue(makeBattle());
    evaluateBattle.mockResolvedValue({ winnerId: 'player1id', reason: 'faster_time' });
    User.findById.mockImplementation(id =>
      Promise.resolve(id.toString() === 'player1id' ? winner : loser)
    );
    const { req, res, next } = makeReqRes({ battleId: 'battle123' });

    // Must NOT throw ReferenceError: loser is not defined
    await expect(evaluateBattleController(req, res, next)).resolves.toBeUndefined();

    expect(loser.losses).toBe(1);
    expect(mockLoserSave).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('marks battle as completed and saves', async () => {
    const battle = makeBattle();
    const winner = makeUser('player1id', 1200, mockWinnerSave);
    const loser  = makeUser('player2id', 1200, mockLoserSave);
    Battle.findById.mockResolvedValue(battle);
    evaluateBattle.mockResolvedValue({ winnerId: 'player1id', reason: 'first_ac' });
    User.findById.mockImplementation(id =>
      Promise.resolve(id.toString() === 'player1id' ? winner : loser)
    );
    const { req, res, next } = makeReqRes({ battleId: 'battle123' });
    await evaluateBattleController(req, res, next);

    expect(battle.status).toBe('completed');
    expect(mockBattleSave).toHaveBeenCalled();
    expect(res._status).toBe(200);
  });

  it('calls next(err) when an unexpected error is thrown', async () => {
    Battle.findById.mockRejectedValue(new Error('DB crashed'));
    const { req, res, next } = makeReqRes({ battleId: 'battle123' });
    await evaluateBattleController(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});