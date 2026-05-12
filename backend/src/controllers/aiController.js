'use strict';

const AIService = require('../services/AIService');
const AIResponse = require('../models/AIResponse');
const InterviewSession = require('../models/InterviewSession');
const InterviewQuestion = require('../models/InterviewQuestion');
const { QueueService } = require('../services/QueueService');

/**
 * GET /api/ai/sessions/:sessionId/questions
 * Retrieve all AI-generated questions for a session.
 */
async function getQuestions(req, res) {
  const userId = req.user._id || req.user.id;
  const { sessionId } = req.params;

  const session = await InterviewSession.findOne({ _id: sessionId, user: userId }).lean();
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }

  const questions = await InterviewQuestion.find({ session: sessionId })
    .sort({ questionNumber: 1 })
    .lean();

  return res.status(200).json({
    success: true,
    data: { questions, total: questions.length },
  });
}

/**
 * POST /api/ai/sessions/:sessionId/questions/:questionId/adaptive
 * Manually trigger adaptive question generation based on a previous answer.
 */
async function generateAdaptive(req, res) {
  const userId = req.user._id || req.user.id;
  const { sessionId, questionId } = req.params;

  const session = await InterviewSession.findOne({ _id: sessionId, user: userId });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }
  if (session.status !== 'ai_phase') {
    return res.status(400).json({ success: false, message: 'Session is not in AI phase.' });
  }

  // Queue adaptive generation
  await QueueService.addAIAnalysisJob({
    sessionId,
    type: 'generate_adaptive',
    questionId,
  });

  return res.status(202).json({
    success: true,
    message: 'Adaptive question generation queued.',
  });
}

/**
 * GET /api/ai/sessions/:sessionId/report
 * Get the final AI interview report.
 */
async function getReport(req, res) {
  const userId = req.user._id || req.user.id;
  const { sessionId } = req.params;

  const session = await InterviewSession.findOne({ _id: sessionId, user: userId }).lean();
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }

  if (!session.finalReport?.generatedAt) {
    return res.status(202).json({
      success: false,
      message: 'Final report not yet generated.',
      data: { status: session.status, aiAnalysisStatus: session.aiAnalysisStatus },
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      report: session.finalReport,
      sessionStatus: session.status,
      solvedCount: session.solvedCount,
    },
  });
}

/**
 * POST /api/ai/sessions/:sessionId/report/generate
 * Admin/manual trigger to generate the final report immediately.
 */
async function triggerReport(req, res) {
  const userId = req.user._id || req.user.id;
  const { sessionId } = req.params;

  const session = await InterviewSession.findOne({ _id: sessionId, user: userId });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }
  if (!['ai_phase', 'completed'].includes(session.status)) {
    return res.status(400).json({
      success: false,
      message: 'Session must be in AI phase to generate report.',
    });
  }

  await QueueService.addAIAnalysisJob({ sessionId, type: 'final_report' });

  return res.status(202).json({
    success: true,
    message: 'Final report generation queued.',
  });
}

/**
 * GET /api/ai/sessions/:sessionId/logs
 * Get AI response logs for debugging (admin use).
 */
async function getAILogs(req, res) {
  const { sessionId } = req.params;

  const logs = await AIResponse.find({ session: sessionId })
    .sort({ createdAt: -1 })
    .select('-prompt -rawResponse') // omit large fields by default
    .lean();

  return res.status(200).json({
    success: true,
    data: { logs, total: logs.length },
  });
}

module.exports = {
  getQuestions,
  generateAdaptive,
  getReport,
  triggerReport,
  getAILogs,
};