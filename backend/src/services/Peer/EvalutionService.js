const Submission = require('../../models/Submission');
const { aiDecision } = require('./AIService');

async function evaluateBattle(battleId) {
  const submissions = await Submission.find({
    sourceType: 'challenge',
    sourceId: battleId,
  });

  const playerSubs = {};

  submissions.forEach(sub => {
    const userId = sub.user.toString();
    if (!playerSubs[userId]) playerSubs[userId] = [];
    playerSubs[userId].push(sub);
  });

  const users = Object.keys(playerSubs);
  if (users.length < 2) {
    return { error: 'Both players must submit' };
  }

  const [user1, user2] = users;

  const best1 = getBestSubmission(playerSubs[user1]);
  const best2 = getBestSubmission(playerSubs[user2]);

  // 🥇 Case 1: Accepted vs Not
  if (best1.verdict === 'Accepted' && best2.verdict !== 'Accepted') {
    return { winnerId: user1, reason: 'first_ac' };
  }

  if (best2.verdict === 'Accepted' && best1.verdict !== 'Accepted') {
    return { winnerId: user2, reason: 'first_ac' };
  }

  // 🥈 Case 2: Both accepted
  if (best1.verdict === 'Accepted' && best2.verdict === 'Accepted') {
    if (best1.runtimeMs < best2.runtimeMs) {
      return { winnerId: user1, reason: 'faster_runtime' };
    }

    if (best2.runtimeMs < best1.runtimeMs) {
      return { winnerId: user2, reason: 'faster_runtime' };
    }

    // Tie → AI
    return await aiDecision(best1, best2);
  }

  // 🥉 Case 3: Compare score
  if (best1.score > best2.score) {
    return { winnerId: user1, reason: 'more_testcases' };
  }

  if (best2.score > best1.score) {
    return { winnerId: user2, reason: 'more_testcases' };
  }

  //  Final fallback → AI
  return await aiDecision(best1, best2);
}


// HELPER FUNCTION
function getBestSubmission(submissions) {
  return submissions.reduce((best, curr) => {
    if (!best) return curr;

    // Prefer Accepted
    if (curr.verdict === 'Accepted' && best.verdict !== 'Accepted') {
      return curr;
    }

    // Same verdict → compare runtime
    if (
      curr.verdict === best.verdict &&
      curr.runtimeMs !== null &&
      best.runtimeMs !== null &&
      curr.runtimeMs < best.runtimeMs
    ) {
      return curr;
    }

    // fallback: higher score
    if (curr.score > best.score) {
      return curr;
    }

    return best;
  }, null);
}

module.exports = { evaluateBattle };