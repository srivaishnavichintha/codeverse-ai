const { evaluateBattle } = require('./EvalutionService');

async function checkAndEvaluateBattle(battle) {
  const now = new Date();

  // ⏱ If time is over and not completed
  if (now >= battle.endsAt && battle.status !== 'completed') {

    //  AUTO SUBMIT (if needed)
    await autoSubmitIfNeeded(battle);

    //  Evaluate
    const result = await evaluateBattle(battle._id);

    battle.status = 'completed';
    battle.winnerId = result.winnerId;
    battle.resultReason = result.reason;
    battle.completedAt = new Date();

    await battle.save();

    return true;
  }

  return false;
}

module.exports={
  checkAndEvaluateBattle
}