const { evaluateBattle } = require('./EvalutionService');
const { applyEloUpdate } = require('./BattleServices');

async function checkAndEvaluateBattle(battle) {
  const now = new Date();

  if (now >= battle.endsAt && battle.status !== 'completed') {

    await autoSubmitIfNeeded(battle);

    const result = await evaluateBattle(battle._id);

    battle.status = 'completed';
    battle.winnerId = result.winnerId;
    battle.resultReason = result.reason;
    battle.completedAt = new Date();

    await battle.save();

    // ── Apply Elo rating update ──────────────────────────────
    let outcome = 'draw';
    if (result.winnerId) {
      const p1 = battle.player1Id.toString();
      const winner = result.winnerId.toString();
      outcome = winner === p1 ? 'player1' : 'player2';
    }

    try {
      const eloResult = await applyEloUpdate(battle._id, outcome);
      battle.eloDeltas = {
        player1Delta: eloResult.deltaA,
        player2Delta: eloResult.deltaB,
        player1NewRating: eloResult.newRatingA,
        player2NewRating: eloResult.newRatingB,
      };
    } catch (eloErr) {
      // Non-fatal: log but don't fail the lifecycle
      console.error('[BattleLifecycle] Elo update failed:', eloErr.message);
    }

    return true;
  }

  return false;
}

module.exports = {
  checkAndEvaluateBattle
};