const Battle = require('../../models/Peer/Battle');
const User = require('../../models/User');
const Problem = require('../../models/Problem');
const { generateAndStoreProblems } = require('../problem.service');

// ─────────────────────────────────────────────────────────────────
// ELO RATING SYSTEM
// Standard Elo formula used by FIDE, Codeforces, etc.
// K-factor: 32 for ratings < 2100, 24 for < 2400, 16 for >= 2400
// ─────────────────────────────────────────────────────────────────

function getKFactor(rating) {
  if (rating < 2100) return 32;
  if (rating < 2400) return 24;
  return 16;
}

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function computeEloUpdate(ratingA, ratingB, scoreA) {
  const scoreB = 1 - scoreA;
  const expectedA = expectedScore(ratingA, ratingB);
  const expectedB = expectedScore(ratingB, ratingA);
  const kA = getKFactor(ratingA);
  const kB = getKFactor(ratingB);
  const deltaA = Math.round(kA * (scoreA - expectedA));
  const deltaB = Math.round(kB * (scoreB - expectedB));
  return {
    newRatingA: Math.max(100, ratingA + deltaA),
    newRatingB: Math.max(100, ratingB + deltaB),
    deltaA,
    deltaB,
  };
}

function ratingToDifficulty(avgRating) {
  if (avgRating < 1200) return ['Easy'];
  if (avgRating < 1600) return ['Easy', 'Medium'];
  if (avgRating < 2000) return ['Medium'];
  if (avgRating < 2400) return ['Medium', 'Hard'];
  return ['Hard'];
}

async function createBattleFromChallenge(challenge) {
  const [user1, user2] = await Promise.all([
    User.findById(challenge.challenger).select('rating username'),
    User.findById(challenge.opponent).select('rating username'),
  ]);

  const rating1 = user1.rating || 1200;
  const rating2 = user2.rating || 1200;

  const avgRating = Math.round((rating1 + rating2) / 2);
  const allowedDifficulties = ratingToDifficulty(avgRating);
  const targetDifficulty =
    allowedDifficulties[Math.floor(Math.random() * allowedDifficulties.length)] || 'Medium';

  const difficultyProfile = [{ difficulty: targetDifficulty, count: challenge.numberOfProblems || 1 }];

  const { savedProblems } = await generateAndStoreProblems(
    difficultyProfile,
    challenge.challenger
  );

  if (!savedProblems || savedProblems.length === 0) {
    throw new Error('AI failed to generate problems for the battle');
  }

  const problemIds = savedProblems.map(p => p._id);

  const battle = await Battle.create({
    challengeId: challenge._id,
    player1Id: challenge.challenger,
    player2Id: challenge.opponent,
    problemIds,
    scheduledAt: challenge.scheduledAt,
    durationMinutes: challenge.durationMinutes,
    player1RatingAtStart: rating1,
    player2RatingAtStart: rating2,
  });

  return battle;
}

async function applyEloUpdate(battleId, outcome) {
  const battle = await Battle.findById(battleId);
  if (!battle) throw new Error(`Battle ${battleId} not found`);

  const ratingA = battle.player1RatingAtStart || 1200;
  const ratingB = battle.player2RatingAtStart || 1200;

  let scoreA;
  if (outcome === 'player1')      scoreA = 1;
  else if (outcome === 'player2') scoreA = 0;
  else                            scoreA = 0.5;

  const { newRatingA, newRatingB, deltaA, deltaB } = computeEloUpdate(ratingA, ratingB, scoreA);

  await Promise.all([
    User.findByIdAndUpdate(battle.player1Id, {
      $set:  { rating: newRatingA },
      $push: {
        ratingHistory: {
          label: `B${battle._id.toString().slice(-4).toUpperCase()}`,
          score: newRatingA,
          win:   outcome === 'player1',
        },
      },
      $inc: {
        ...(outcome === 'player1' && { wins: 1 }),
        ...(outcome === 'player2' && { losses: 1 }),
      },
    }),
    User.findByIdAndUpdate(battle.player2Id, {
      $set:  { rating: newRatingB },
      $push: {
        ratingHistory: {
          label: `B${battle._id.toString().slice(-4).toUpperCase()}`,
          score: newRatingB,
          win:   outcome === 'player2',
        },
      },
      $inc: {
        ...(outcome === 'player2' && { wins: 1 }),
        ...(outcome === 'player1' && { losses: 1 }),
      },
    }),
  ]);

  return { deltaA, deltaB, newRatingA, newRatingB };
}

module.exports = {
  createBattleFromChallenge,
  applyEloUpdate,
  computeEloUpdate,
  expectedScore,
  getKFactor,
};