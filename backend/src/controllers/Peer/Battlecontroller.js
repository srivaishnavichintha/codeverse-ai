const Battle = require('../../models/Peer/Battle');
const Submission = require('../../models/Submission');
const { evaluateBattle } = require('../../services/Peer/EvalutionService');
const {checkAndEvaluateBattle}=require('../../services/Peer/BattlelifecycleService');
const { executeSubmission } = require('../../services/Peer/JudgeService');
const Notification = require('../../models/Notification');

// GET /api/v1/battles/user/me
exports.getMyBattles = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const query = {
      $or: [
        { player1Id: userId },
        { player2Id: userId },
      ],
    };

    if (status === 'active') {
      query.status = { $in: ['pending', 'ongoing', 'evaluating'] };
    } else if (status === 'completed') {
      query.status = 'completed';
    }

    const battles = await Battle.find(query)
      .populate('player1Id', 'username rating')
      .populate('player2Id', 'username rating')
      .populate('problemIds', 'title difficulty')
      .sort({ createdAt: -1 });

    for (const battle of battles) {
      await checkAndEvaluateBattle(battle);
    }

    const formatted = battles.map((battle) => {
      const isPlayer1 = battle.player1Id._id.toString() === userId;
      const opponent = isPlayer1 ? battle.player2Id : battle.player1Id;

      return {
        battleId: battle._id,
        status: battle.status,
        problem: battle.problemIds?.[0],
        problemIds: battle.problemIds,
        opponent,
        scheduledAt: battle.scheduledAt,
        endsAt: battle.endsAt,
        remainingSeconds: battle.remainingSeconds(),
        isCompleted: battle.status === 'completed',
      };
    });

    res.status(200).json({
      count: formatted.length,
      battles: formatted,
    });

  } catch (err) {
    next(err);
  }
};


exports.submitBattleCode = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { battleId, code, language, problemId } = req.body;

    if (!battleId || !code || !language) {
      return res.status(400).json({ message: 'Missing fields' });
    }

    const battle = await Battle.findById(battleId);

    if (!battle) {
      return res.status(404).json({ message: 'Battle not found' });
    }

    if (!battle.hasPlayer(userId)) {
      return res.status(403).json({ message: 'Not part of this battle' });
    }

    if (!['pending', 'ongoing'].includes(battle.status)) {
      return res.status(400).json({ message: 'Battle is not active' });
    }

    if (battle.isExpired()) {
      battle.status = 'expired';
      await battle.save();
      return res.status(400).json({ message: 'Battle time expired' });
    }

    await checkAndEvaluateBattle(battle);

    const targetProblemId = problemId || battle.problemIds[0];

    const submission = await Submission.create({
      user: userId,
      problem: targetProblemId,
      code,
      language,
      sourceType: 'challenge',
      sourceId: battleId,
      verdict: 'Pending',
    });

    await executeSubmission(submission);

    const playerStat = battle.playerStats.find(
      (p) => p.user.toString() === userId
    );

    if (playerStat) {
      playerStat.attempts += 1;
      playerStat.submissionId = submission._id;
    } else {
      battle.playerStats.push({
        user: userId,
        submissionId: submission._id,
        attempts: 1,
      });
    }

    if (battle.status === 'pending') {
      battle.status = 'ongoing';
    }

    await battle.save();

    res.status(201).json({
      message: 'Submission executed successfully',
      submission,
    });

  } catch (err) {
    next(err);
  }
};


exports.getBattleStartInfo = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { battleId } = req.params;

    const battle = await Battle.findById(battleId);
    if (!battle) {
      return res.status(404).json({ message: 'Battle not found' });
    }

    if (!battle.hasPlayer(userId)) {
      return res.status(403).json({ message: 'Not part of this battle' });
    }

    const now = new Date();
    await checkAndEvaluateBattle(battle);

    const timeToStartMs = battle.scheduledAt - now;
    const timeToStart = timeToStartMs > 0 ? Math.floor(timeToStartMs / 1000) : 0;

    const timeToEndMs = battle.endsAt - now;
    const timeToEnd = timeToEndMs > 0 ? Math.floor(timeToEndMs / 1000) : 0;

    const showProblem = now >= battle.scheduledAt;

    res.status(200).json({
      battleId: battle._id,
      status: battle.status,
      problemId: showProblem ? battle.problemIds[0] : null,
      problemIds: showProblem ? battle.problemIds : [],
      scheduledAt: battle.scheduledAt,
      endsAt: battle.endsAt,
      timeToStart,
      timeToEnd,
      showProblem,
    });

  } catch (err) {
    next(err);
  }
};


exports.evaluateBattleController = async (req, res, next) => {
  try {
    const { battleId } = req.params;

    const battle = await Battle.findById(battleId);

    if (!battle) {
      return res.status(404).json({ message: 'Battle not found' });
    }

    if (battle.status === 'completed') {
      return res.status(400).json({ message: 'Already evaluated' });
    }

    const result = await evaluateBattle(battleId);

    if (result.error) {
      return res.status(400).json(result);
    }

    battle.status = 'completed';
    battle.winnerId = result.winnerId;
    battle.resultReason = result.reason;
    battle.completedAt = new Date();

    if (result.winnerId) {
      const User = require('../../models/User');

      // Derive loserId from player1Id / player2Id (the correct schema fields)
      // NOTE: challengerId / opponentId do NOT exist on the Battle schema
      const loserId = battle.player1Id.toString() === result.winnerId.toString()
        ? battle.player2Id
        : battle.player1Id;

      // Fetch both users together BEFORE using either — fixes the
      // "ReferenceError: loser is not defined" runtime bug
      const [winner, loser] = await Promise.all([
        User.findById(result.winnerId),
        User.findById(loserId),
      ]);

      const BATTLE_GAIN = 10;

      if (winner) {
        winner.rating = (winner.rating || 1200) + BATTLE_GAIN;
        winner.wins = (winner.wins || 0) + 1;
        winner.ratingHistory.push({
          label: `B${battle._id.toString().slice(-4).toUpperCase()}`,
          score: winner.rating,
          win: true,
        });
        await winner.save();

        await Notification.create({
          user: winner._id,
          type: 'points_transaction',
          title: 'Battle Won!',
          message: `You won the battle and earned ${BATTLE_GAIN} points.`,
        });
      }

      if (loser) {
        loser.rating = Math.max(0, (loser.rating ?? 1200) - BATTLE_GAIN);
        loser.losses = (loser.losses || 0) + 1;
        loser.ratingHistory.push({
          label: `B${battle._id.toString().slice(-4).toUpperCase()}`,
          score: loser.rating,
          win: false,
        });
        await loser.save();
      }
    }

    await battle.save();

    res.status(200).json({
      message: 'Battle evaluated successfully',
      result,
    });

  } catch (err) {
    next(err);
  }
};