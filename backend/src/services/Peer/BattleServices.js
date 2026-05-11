const Battle = require('../../models/Peer/Battle');
const User = require('../../models/User');
const Problem = require('../../models/Problem');
const { generateAndStoreProblems } = require('../problem.service');

async function createBattleFromChallenge(challenge) {
  // 1. Get users
  const [user1, user2] = await Promise.all([
    User.findById(challenge.challenger),
    User.findById(challenge.opponent),
  ]);

  // 2. Determine difficulty
  const levelToDifficulty = {
    Newbie: ['Easy'],
    Pupil: ['Easy'],
    Specialist: ['Easy', 'Medium'],
    Expert: ['Medium', 'Hard'],
    'Candidate Master': ['Medium', 'Hard'],
    Master: ['Hard'],
    Grandmaster: ['Hard'],
  };

  const d1 = levelToDifficulty[user1.level] || ['Easy'];
  const d2 = levelToDifficulty[user2.level] || ['Easy'];

  const allowedDifficulties = [...new Set([...d1, ...d2])];
  const targetDifficulty = allowedDifficulties[Math.floor(Math.random() * allowedDifficulties.length)] || 'Easy';

  // 3. Generate problems using AI
  const difficultyProfile = [{ difficulty: targetDifficulty, count: challenge.numberOfProblems || 1 }];
  
  const { savedProblems } = await generateAndStoreProblems(
    difficultyProfile,
    challenge.challenger // attributing the problem generation to the challenger
  );

  if (!savedProblems || savedProblems.length === 0) {
    throw new Error('AI failed to generate problems for the battle');
  }

  const problemIds = savedProblems.map(p => p._id);

  // 4. Create battle
  const battle = await Battle.create({
    challengeId: challenge._id,
    player1Id: challenge.challenger,
    player2Id: challenge.opponent,
    problemIds,
    scheduledAt: challenge.scheduledAt,
    durationMinutes: challenge.durationMinutes,
  });

  return battle;
}

module.exports = {
  createBattleFromChallenge,
};