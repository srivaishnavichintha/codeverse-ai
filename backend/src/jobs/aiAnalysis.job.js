const AIService = require('../services/AIService');
const InterviewSession = require('../models/InterviewSession');
const InterviewQuestion = require('../models/InterviewQuestion');

/**
 * Main job processor for AI analysis tasks.
 * Handles: analyze_session, evaluate_answer, generate_adaptive, final_report
 */
async function processAIAnalysisJob(job) {
  console.log('🔥 AI JOB PROCESSOR STARTED');
console.log(job.data);
  const { sessionId, type, questionId } = job.data;
  console.log(`[AIJob] Processing job ${job.id} | type=${type || 'analyze_session'} | session=${sessionId}`);

  switch (type) {
    case 'evaluate_answer': {
      if (!questionId) throw new Error('questionId required for evaluate_answer');
      const question = await AIService.evaluateAnswer(sessionId, questionId);

      // After evaluation, check if all questions are answered + evaluated
      await maybeGenerateReport(sessionId);
      return { questionId, evaluated: true };
    }

    case 'generate_adaptive': {
      if (!questionId) throw new Error('questionId required for generate_adaptive');
      const newQuestion = await AIService.generateAdaptiveQuestion(sessionId, questionId);
      return { newQuestionId: newQuestion?._id?.toString() || null };
    }

    case 'final_report': {
      const session = await AIService.generateFinalReport(sessionId);
      return { status: session.status, score: session.finalReport?.overallScore };
    }

    case 'analyze_session':
    default: {
      // Update session status
      await InterviewSession.findByIdAndUpdate(sessionId, { aiAnalysisStatus: 'processing' });

      const questions = await AIService.analyzeAndGenerateQuestions(sessionId);

      await InterviewSession.findByIdAndUpdate(sessionId, { aiAnalysisStatus: 'done' });

      console.log(`[AIJob] Generated ${questions.length} questions for session ${sessionId}`);
      return { questionsGenerated: questions.length };
    }
  }
}

/**
 * After each answer evaluation, check if all answered questions are evaluated.
 * If so, generate the final report.
 */
async function maybeGenerateReport(sessionId) {
  const questions = await InterviewQuestion.find({ session: sessionId }).lean();
  if (!questions.length) return;

  const allAnswered = questions.every((q) => q.userAnswer);
  const allEvaluated = questions.every((q) => q.evaluation?.score != null);

  if (allAnswered && allEvaluated) {
    const session = await InterviewSession.findById(sessionId);
    if (session && session.status === 'ai_phase' && session.phase === 'ai') {
      await AIService.generateFinalReport(sessionId);
    }
  }
}

module.exports = { processAIAnalysisJob };
