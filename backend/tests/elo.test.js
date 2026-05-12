'use strict';

/**
 * Unit tests for the ELO rating system in BattleServices.
 * Pure-logic tests — no DB, no network, runs in milliseconds.
 */

const {
  getKFactor,
  expectedScore,
  computeEloUpdate,
} = require('../src/services/Peer/BattleServices');

describe('getKFactor', () => {
  it('returns 32 for ratings below 2100', () => {
    expect(getKFactor(800)).toBe(32);
    expect(getKFactor(1200)).toBe(32);
    expect(getKFactor(2099)).toBe(32);
  });

  it('returns 24 for ratings between 2100 and 2399', () => {
    expect(getKFactor(2100)).toBe(24);
    expect(getKFactor(2300)).toBe(24);
    expect(getKFactor(2399)).toBe(24);
  });

  it('returns 16 for ratings 2400 and above', () => {
    expect(getKFactor(2400)).toBe(16);
    expect(getKFactor(3000)).toBe(16);
  });
});

describe('expectedScore', () => {
  it('returns 0.5 when both players have the same rating', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 5);
  });

  it('returns > 0.5 when player A has a higher rating', () => {
    expect(expectedScore(1400, 1200)).toBeGreaterThan(0.5);
  });

  it('returns < 0.5 when player A has a lower rating', () => {
    expect(expectedScore(1200, 1400)).toBeLessThan(0.5);
  });

  it('expected scores for a pair sum to 1', () => {
    const eA = expectedScore(1500, 1300);
    const eB = expectedScore(1300, 1500);
    expect(eA + eB).toBeCloseTo(1, 5);
  });

  it('a 400-point gap gives roughly 90% win probability', () => {
    expect(expectedScore(1600, 1200)).toBeCloseTo(0.909, 2);
  });
});

describe('computeEloUpdate', () => {
  it('winner gains rating and loser loses rating', () => {
    const { deltaA, deltaB } = computeEloUpdate(1200, 1200, 1);
    expect(deltaA).toBeGreaterThan(0);
    expect(deltaB).toBeLessThan(0);
  });

  it('loser loses rating when score is 0', () => {
    const { deltaA, deltaB } = computeEloUpdate(1200, 1200, 0);
    expect(deltaA).toBeLessThan(0);
    expect(deltaB).toBeGreaterThan(0);
  });

  it('draw gives zero adjustment when ratings are equal', () => {
    const { deltaA, deltaB } = computeEloUpdate(1200, 1200, 0.5);
    expect(deltaA).toBe(0);
    expect(deltaB).toBe(0);
  });

  it('upset win gives bigger gain than expected win', () => {
    const normal = computeEloUpdate(1400, 1200, 1); // favourite wins
    const upset  = computeEloUpdate(1200, 1400, 1); // underdog wins
    expect(upset.deltaA).toBeGreaterThan(normal.deltaA);
  });

  it('rating floor is 100 — never goes below', () => {
    const { newRatingA } = computeEloUpdate(100, 3000, 0);
    expect(newRatingA).toBeGreaterThanOrEqual(100);
  });

  it('new ratings correctly reflect deltas', () => {
    const rA = 1500, rB = 1500;
    const { newRatingA, newRatingB, deltaA, deltaB } = computeEloUpdate(rA, rB, 1);
    expect(newRatingA).toBe(rA + deltaA);
    expect(newRatingB).toBe(rB + deltaB);
  });

  it('high-rated players have smaller rating swings (lower K)', () => {
    const low  = computeEloUpdate(1200, 1200, 1); // K=32
    const high = computeEloUpdate(2400, 2400, 1); // K=16
    expect(Math.abs(high.deltaA)).toBeLessThan(Math.abs(low.deltaA));
  });

  it('total rating change is zero-sum for equal-K players', () => {
    const { deltaA, deltaB } = computeEloUpdate(1200, 1200, 1);
    expect(deltaA + deltaB).toBe(0);
  });
});