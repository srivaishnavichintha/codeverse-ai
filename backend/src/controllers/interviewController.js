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
};
