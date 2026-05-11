'use strict';

const InterviewService = require('../services/InterviewService');
const QueueService = require('../services/QueueService');

/**
 * POST /api/interview/start
 * Start a new interview session. Deducts credits.
 */
async function startInterview(req, res, next) {
  try {
    const userId = req.user._id || req.user.id;
    const idempotencyKey = req.headers['x-idempotency-key'] || null;

    const session = await InterviewService.startInterview(userId, idempotencyKey);

    return res.status(201).json({
      success: true,
      message: 'Interview session started.',
      data: session,
    });
  } catch (err) {
    if (err.statusCode === 402) {
      return res.status(402).json({
        success: false,
        message: err.message,
      });
    }
    return next ? next(err) : res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/interview/:sessionId/submit-code
 * Submit a Judge0 submission result for a problem in the session.
 * Body: { problemId, submissionId }
 */
async function submitCode(req, res) {
  const userId = req.user._id || req.user.id;
  const { sessionId } = req.params;
  const { problemId, submissionId } = req.body;

  if (!problemId || !submissionId) {
    return res.status(400).json({ success: false, message: 'problemId and submissionId are required.' });
  }

  const session = await InterviewService.submitCode(sessionId, userId, problemId, submissionId);

  return res.status(200).json({
    success: true,
    message: 'Code submission recorded.',
    data: {
      sessionId: session._id,
      solvedCount: session.solvedCount,
      assignedProblems: session.assignedProblems,
    },
  });
}

/**
 * POST /api/interview/:sessionId/qualify
 * Check if user solved enough problems to proceed to AI phase.
 */
async function checkQualification(req, res) {
  const userId = req.user._id || req.user.id;
  const { sessionId } = req.params;

  const { qualifies, session } = await InterviewService.checkQualification(sessionId, userId);

  return res.status(200).json({
    success: true,
    message: qualifies
      ? 'You qualified for the AI interview phase!'
      : 'You did not meet the minimum threshold. Session closed.',
    data: {
      qualifies,
      solvedCount: session.solvedCount,
      status: session.status,
      aiAnalysisStatus: session.aiAnalysisStatus,
    },
  });
}

/**
 * POST /api/interview/:sessionId/answer
 * Submit an answer to an AI-generated interview question.
 * Body: { questionId, answer }
 */
async function submitAnswer(req, res) {
  const userId = req.user._id || req.user.id;
  const { sessionId } = req.params;
  const { questionId, answer } = req.body;

  if (!questionId || !answer) {
    return res.status(400).json({ success: false, message: 'questionId and answer are required.' });
  }

  const question = await InterviewService.submitAnswer(sessionId, userId, questionId, answer);

  return res.status(200).json({
    success: true,
    message: 'Answer submitted. Evaluation queued.',
    data: { questionId: question._id, answeredAt: question.answeredAt },
  });
}

/**
 * GET /api/interview/:sessionId
 * Get current session state with assigned problems and questions.
 */
async function getSession(req, res) {
  const userId = req.user._id || req.user.id;
  const { sessionId } = req.params;

  const { session, questions } = await InterviewService.getSessionState(sessionId, userId);

  return res.status(200).json({
    success: true,
    data: { session, questions },
  });
}

/**
 * GET /api/interview/:sessionId/status
 * Lightweight status poll endpoint.
 */
async function getSessionStatus(req, res) {
  const userId = req.user._id || req.user.id;
  const { sessionId } = req.params;

  const { session } = await InterviewService.getSessionState(sessionId, userId);

  return res.status(200).json({
    success: true,
    data: {
      status: session.status,
      phase: session.phase,
      aiAnalysisStatus: session.aiAnalysisStatus,
      solvedCount: session.solvedCount,
      finalReport: session.finalReport?.generatedAt ? session.finalReport : null,
    },
  });
}

/**
 * GET /api/interview/:sessionId/job/:jobId
 * Check BullMQ job status.
 */
async function getJobStatus(req, res) {
  const { jobId } = req.params;
  const jobStatus = await QueueService.getJobStatus(jobId);

  if (!jobStatus) {
    return res.status(404).json({ success: false, message: 'Job not found.' });
  }

  return res.status(200).json({ success: true, data: jobStatus });
}

/**
 * POST /api/interview/:sessionId/terminate
 * Terminate session early (due to violations or user exit) and trigger report.
 */
async function terminateSession(req, res, next) {
  try {
    const userId = req.user._id || req.user.id;
    const { sessionId } = req.params;

    await InterviewService.terminateSession(sessionId, userId);

    // Queue report generation up to this point
    const job = await QueueService.addAIAnalysisJob({ sessionId, type: 'final_report' });
    if (!job) {
      const AIService = require('../services/AIService');
      AIService.generateFinalReport(sessionId).catch(console.error);
    }

    return res.status(200).json({ success: true, message: 'Session terminated.' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/interview/stats
 * Get aggregated dashboard statistics for the logged-in user.
 */
async function getDashboardStats(req, res, next) {
  try {
    const userId = req.user._id || req.user.id;
    const InterviewSession = require('../models/InterviewSession');

    const sessions = await InterviewSession.find({ user: userId, status: { $in: ['completed', 'failed'] } })
      .populate({ path: 'assignedProblems.problem', select: 'tags' })
      .sort({ createdAt: -1 })
      .lean();

    const totalInterviews = sessions.length;
    let totalScore = 0;
    let commScore = 0;
    let psScore = 0;
    let warnings = 0; // if we tracked warnings in DB, else 0

    const recentInterviews = [];
    const performanceHistory = []; // Basic map by month

    const monthScores = {};
    const tagStats = {};

    sessions.forEach(s => {
      if (s.finalReport) {
        totalScore += s.finalReport.overallScore || 0;
        commScore += s.finalReport.communicationScore || 0;
        psScore += s.finalReport.problemSolvingScore || 0;
      }

      if (recentInterviews.length < 5) {
        recentInterviews.push({
          id: s._id.toString().slice(-6).toUpperCase(),
          date: new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          type: 'Full Stack', // or infer from tags
          score: s.finalReport?.overallScore || 0,
          duration: s.completedAt ? Math.round((new Date(s.completedAt) - new Date(s.startedAt)) / 60000) + ' min' : 'N/A',
          status: s.status === 'completed' ? 'Completed' : 'Terminated'
        });
      }

      // monthly grouping for chart
      const month = new Date(s.createdAt).toLocaleString('default', { month: 'short' });
      if (!monthScores[month]) monthScores[month] = { count: 0, sum: 0, comm: 0, ps: 0 };
      monthScores[month].count++;
      monthScores[month].sum += s.finalReport?.overallScore || 0;
      monthScores[month].comm += s.finalReport?.communicationScore || 0;
      monthScores[month].ps += s.finalReport?.problemSolvingScore || 0;
      // tag aggregation for topics
      if (s.assignedProblems && Array.isArray(s.assignedProblems)) {
        s.assignedProblems.forEach(ap => {
          if (ap.problem && Array.isArray(ap.problem.tags)) {
            ap.problem.tags.forEach(tag => {
              if (!tagStats[tag]) tagStats[tag] = { solved: 0, total: 0 };
              tagStats[tag].total++;
              if (ap.solved) tagStats[tag].solved++;
            });
          }
        });
      }
    });

    let strongestTopic = 'N/A';
    let weakestTopic = 'N/A';

    const tagsArray = Object.keys(tagStats)
      .map(tag => ({
        tag,
        ratio: tagStats[tag].solved / tagStats[tag].total,
        total: tagStats[tag].total
      }));

    if (tagsArray.length > 0) {
      // sort by highest ratio, then highest total attempts
      tagsArray.sort((a, b) => b.ratio - a.ratio || b.total - a.total);
      strongestTopic = tagsArray[0].tag;
      
      // sort by lowest ratio, then highest total attempts
      tagsArray.sort((a, b) => a.ratio - b.ratio || b.total - a.total);
      weakestTopic = tagsArray[0].tag;
    }

    for (const [month, data] of Object.entries(monthScores)) {
      performanceHistory.push({
        month,
        score: Math.round(data.sum / data.count),
        comm: Math.round(data.comm / data.count),
        ps: Math.round(data.ps / data.count)
      });
    }

    performanceHistory.reverse();

    const avgScore = totalInterviews ? Math.round(totalScore / totalInterviews) : 0;
    const avgComm = totalInterviews ? Math.round(commScore / totalInterviews) : 0;
    const avgPs = totalInterviews ? Math.round(psScore / totalInterviews) : 0;

    // Check for active session to resume
    let activeSessionId = null;
    const activeSession = await InterviewSession.findOne({
      user: userId,
      status: { $in: ['coding', 'ai_phase'] }
    }).sort({ startedAt: -1 });

    if (activeSession) {
      // Allow resuming if within 60 minutes or coding deadline hasn't passed
      const minsSinceStart = (new Date() - new Date(activeSession.startedAt)) / 60000;
      const hasDeadlineRemaining = activeSession.codingDeadline && new Date() < new Date(activeSession.codingDeadline);
      
      if (minsSinceStart < 60 || hasDeadlineRemaining) {
        activeSessionId = activeSession._id;
      } else {
        // Mark as expired if time limit passed
        activeSession.status = 'expired';
        await activeSession.save();
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        activeSessionId,
        totalInterviews,
        avgScore,
        cheatingWarnings: warnings,
        communicationScore: avgComm,
        problemSolvingScore: avgPs,
        codeQualityScore: avgPs, // Using PS as fallback for code quality
        strongestTopic,
        weakestTopic,
        recentInterviews,
        performanceHistory
      }
    });

  } catch (err) {
    next(err);
  }
}


/**
 * GET /api/interview/coding-analytics
 * Broad coding practice analytics: per-tag performance, submission heatmap,
 * language distribution, difficulty breakdown, and weekly/monthly trends.
 */
async function getCodingPracticeAnalytics(req, res, next) {
  try {
    const userId = req.user._id || req.user.id;
    const Submission = require('../models/Submission');

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const submissions = await Submission.find({
      user: userId,
      createdAt: { $gte: sixMonthsAgo },
    })
      .populate({ path: 'problem', select: 'tags difficulty title slug' })
      .select('verdict language runtimeMs memoryKb createdAt sourceType problem')
      .lean();

    const tagMap = {};
    const langMap = {};
    const diffMap = { Easy: { solved: 0, attempted: 0 }, Medium: { solved: 0, attempted: 0 }, Hard: { solved: 0, attempted: 0 } };
    const weeklyMap = {};
    const monthlyMap = {};

    let totalAttempted = 0, totalSolved = 0, totalRuntime = 0, runtimeCount = 0;
    let currentStreak = 0, maxStreak = 0;
    const solvedDates = new Set();

    submissions.forEach(sub => {
      const isAC = sub.verdict === 'Accepted';
      const prob  = sub.problem;
      const date  = new Date(sub.createdAt);
      const day   = date.toISOString().split('T')[0];
      const week  = `${date.getFullYear()}-W${String(getWeekNumber(date)).padStart(2, '0')}`;
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      totalAttempted++;
      if (isAC) { totalSolved++; solvedDates.add(day); }

      if (sub.language) langMap[sub.language] = (langMap[sub.language] || 0) + 1;
      if (sub.runtimeMs != null && sub.runtimeMs >= 0) { totalRuntime += sub.runtimeMs; runtimeCount++; }

      if (prob && prob.difficulty && diffMap[prob.difficulty]) {
        diffMap[prob.difficulty].attempted++;
        if (isAC) diffMap[prob.difficulty].solved++;
      }

      if (prob && Array.isArray(prob.tags)) {
        prob.tags.forEach(tag => {
          if (!tagMap[tag]) tagMap[tag] = { solved: 0, attempted: 0, totalRuntime: 0, runtimeCount: 0 };
          tagMap[tag].attempted++;
          if (isAC) tagMap[tag].solved++;
          if (sub.runtimeMs != null && sub.runtimeMs >= 0) {
            tagMap[tag].totalRuntime += sub.runtimeMs;
            tagMap[tag].runtimeCount++;
          }
        });
      }

      if (!weeklyMap[week]) weeklyMap[week] = { week, attempted: 0, solved: 0 };
      weeklyMap[week].attempted++;
      if (isAC) weeklyMap[week].solved++;

      if (!monthlyMap[month]) monthlyMap[month] = { month, attempted: 0, solved: 0, totalRuntime: 0, runtimeCount: 0 };
      monthlyMap[month].attempted++;
      if (isAC) monthlyMap[month].solved++;
      if (sub.runtimeMs != null && sub.runtimeMs >= 0) {
        monthlyMap[month].totalRuntime += sub.runtimeMs;
        monthlyMap[month].runtimeCount++;
      }
    });

    // Streak calculation
    const sortedDays = Array.from(solvedDates).sort();
    if (sortedDays.length > 0) {
      let streak = 1;
      for (let i = 1; i < sortedDays.length; i++) {
        const diffDays = Math.round((new Date(sortedDays[i]) - new Date(sortedDays[i - 1])) / 86400000);
        if (diffDays === 1) { streak++; maxStreak = Math.max(maxStreak, streak); }
        else streak = 1;
      }
      const today     = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const lastDay   = sortedDays[sortedDays.length - 1];
      currentStreak   = (lastDay === today || lastDay === yesterday) ? streak : 0;
      maxStreak       = Math.max(maxStreak, currentStreak);
    }

    const tagPerformance = Object.entries(tagMap)
      .map(([tag, data]) => ({
        tag,
        attempted:    data.attempted,
        solved:       data.solved,
        successRate:  data.attempted ? Math.round((data.solved / data.attempted) * 100) : 0,
        avgRuntimeMs: data.runtimeCount ? Math.round(data.totalRuntime / data.runtimeCount) : null,
      }))
      .sort((a, b) => b.attempted - a.attempted)
      .slice(0, 20);

    const languageDistribution = Object.entries(langMap)
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count);

    const monthlyTrend = Object.values(monthlyMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        month:        m.month,
        attempted:    m.attempted,
        solved:       m.solved,
        successRate:  m.attempted ? Math.round((m.solved / m.attempted) * 100) : 0,
        avgRuntimeMs: m.runtimeCount ? Math.round(m.totalRuntime / m.runtimeCount) : null,
      }));

    const weeklyTrend = Object.values(weeklyMap)
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12)
      .map(w => ({
        week:        w.week,
        attempted:   w.attempted,
        solved:      w.solved,
        successRate: w.attempted ? Math.round((w.solved / w.attempted) * 100) : 0,
      }));

    const difficultyBreakdown = Object.entries(diffMap).map(([difficulty, data]) => ({
      difficulty,
      attempted:   data.attempted,
      solved:      data.solved,
      successRate: data.attempted ? Math.round((data.solved / data.attempted) * 100) : 0,
    }));

    const sourceMap = {};
    submissions.forEach(sub => {
      const src = sub.sourceType || 'practice';
      if (!sourceMap[src]) sourceMap[src] = { attempted: 0, solved: 0 };
      sourceMap[src].attempted++;
      if (sub.verdict === 'Accepted') sourceMap[src].solved++;
    });
    const sourceBreakdown = Object.entries(sourceMap).map(([source, data]) => ({ source, ...data }));

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalAttempted,
          totalSolved,
          overallSuccessRate: totalAttempted ? Math.round((totalSolved / totalAttempted) * 100) : 0,
          avgRuntimeMs:       runtimeCount ? Math.round(totalRuntime / runtimeCount) : null,
          currentStreak,
          maxStreak,
        },
        difficultyBreakdown,
        tagPerformance,
        languageDistribution,
        monthlyTrend,
        weeklyTrend,
        sourceBreakdown,
      },
    });
  } catch (err) {
    next(err);
  }
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

module.exports = {
  startInterview,
  submitCode,
  checkQualification,
  submitAnswer,
  getSession,
  getSessionStatus,
  getJobStatus,
  terminateSession,
  getDashboardStats,
  getCodingPracticeAnalytics,
};