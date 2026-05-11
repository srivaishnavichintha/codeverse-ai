'use strict';

const InterviewSession  = require('../models/InterviewSession');
const InterviewQuestion = require('../models/InterviewQuestion');
const Problem           = require('../models/Problem');
const Submission        = require('../models/Submission');
const CreditService     = require('./CreditService');
const QueueService      = require('./QueueService');

const INTERVIEW_CREDIT_COST    = parseInt(process.env.INTERVIEW_CREDIT_COST    || '10', 10);
const CODING_DEADLINE_MINUTES  = parseInt(process.env.CODING_DEADLINE_MINUTES  || '90', 10);
const PROBLEMS_TO_ASSIGN       = 3;
const QUALIFY_THRESHOLD        = 2;

/**
 * Problem.difficulty uses title-case enum: 'Easy' | 'Medium' | 'Hard'
 * This mapping converts from any-case input to the correct DB value.
 */
const DIFFICULTY_MAP = {
  easy:   'Easy',
  medium: 'Medium',
  hard:   'Hard',
};

class InterviewService {
  /**
   * Start a new interview session for a user. Idempotent via idempotencyKey.
   */
  static async startInterview(userId, idempotencyKey) {
    // Idempotency check
    if (idempotencyKey) {
      const existing = await InterviewSession.findOne({ idempotencyKey }).populate('assignedProblems.problem');
      if (existing) return existing;
    }

    // Check for active session
    const active = await InterviewSession.findOne({
      user: userId,
      status: { $in: ['pending', 'coding', 'ai_phase'] },
    });
    if (active) {
      throw Object.assign(new Error('You already have an active interview session.'), {
        statusCode: 409,
      });
    }

    // Deduct credits
    const transaction = await CreditService.debitCredits(
      userId,
      INTERVIEW_CREDIT_COST,
      'interview_start',
      null,
      idempotencyKey ? `credit-${idempotencyKey}` : undefined
    );

    const deadline = new Date(Date.now() + CODING_DEADLINE_MINUTES * 60 * 1000);

    let session = await InterviewSession.create({
      user: userId,
      status: 'coding',
      phase: 'coding',
      assignedProblems: [],
      creditTransaction: transaction._id,
      startedAt: new Date(),
      codingDeadline: deadline,
      idempotencyKey: idempotencyKey || undefined,
    });

    transaction.session = session._id;
    await transaction.save();

    const AIService = require('./AIService');
    let problems;
    try {
      problems = await AIService.generateCodingProblems(session._id);
    } catch (err) {
      console.error('Failed to generate AI problems, falling back to DB:', err);
      problems = await InterviewService.assignProblems();
    }

    session.assignedProblems = problems.map((p) => ({ problem: p._id, solved: false }));
    await session.save();

    return session.populate('assignedProblems.problem');
  }

  /**
   * Randomly assign problems of varied difficulty.
   * FIX: Problem.difficulty stores title-case ('Easy','Medium','Hard') not lowercase.
   */
  static async assignProblems() {
    const difficulties = ['Easy', 'Medium', 'Hard']; // FIXED: match schema enum
    const selected = [];

    for (const diff of difficulties) {
      const count = await Problem.countDocuments({ difficulty: diff, isActive: true });
      if (count === 0) continue;
      const skip = Math.floor(Math.random() * count);
      const problem = await Problem.findOne({ difficulty: diff, isActive: true }).skip(skip).lean();
      if (problem) selected.push(problem);
    }

    // Fallback: fill up to PROBLEMS_TO_ASSIGN from any difficulty
    if (selected.length < PROBLEMS_TO_ASSIGN) {
      const ids = selected.map((p) => p._id);
      const extra = await Problem.find({ _id: { $nin: ids }, isActive: true })
        .limit(PROBLEMS_TO_ASSIGN - selected.length)
        .lean();
      selected.push(...extra);
    }

    return selected.slice(0, PROBLEMS_TO_ASSIGN);
  }

  /**
   * Record a submission for a problem in a session.
   */
  static async submitCode(sessionId, userId, problemId, submissionId) {
    const session = await InterviewSession.findOne({ _id: sessionId, user: userId });
    if (!session) throw Object.assign(new Error('Session not found.'), { statusCode: 404 });
    if (session.status !== 'coding')
      throw Object.assign(new Error('Session is not in coding phase.'), { statusCode: 400 });
    if (new Date() > session.codingDeadline) {
      session.status = 'expired';
      await session.save();
      throw Object.assign(new Error('Coding deadline has passed.'), { statusCode: 410 });
    }

    const submission = await Submission.findById(submissionId).lean();
    if (!submission) throw Object.assign(new Error('Submission not found.'), { statusCode: 404 });

    const problemEntry = session.assignedProblems.find(
      (p) => p.problem.toString() === problemId
    );
    if (!problemEntry)
      throw Object.assign(new Error('Problem not assigned to this session.'), { statusCode: 400 });

    // Idempotent: allow re-submission but only upgrade solved status
    const solved =
      submission.status === 'accepted' ||
      submission.verdict === 'Accepted' ||
      problemEntry.solved;

    problemEntry.submission = submissionId;
    problemEntry.solved = solved;

    session.solvedCount = session.assignedProblems.filter((p) => p.solved).length;
    await session.save();

    return session;
  }

  /**
   * Check if user qualifies for AI phase. If so, trigger AI async job.
   */
  static async checkQualification(sessionId, userId) {
    const session = await InterviewSession.findOne({ _id: sessionId, user: userId });
    if (!session) throw Object.assign(new Error('Session not found.'), { statusCode: 404 });
    if (session.status !== 'coding')
      throw Object.assign(new Error('Session is not in coding phase.'), { statusCode: 400 });

    const qualifies = session.solvedCount >= QUALIFY_THRESHOLD;
    session.qualifiedForAI = qualifies;

    if (qualifies) {
      session.status = 'ai_phase';
      session.phase = 'ai';
      await session.save();
      await InterviewService.triggerAI(session);
    } else {
      session.status = 'failed';
      await session.save();
      // Partial refund
      await CreditService.refundCredits(
        userId,
        Math.floor(INTERVIEW_CREDIT_COST / 2),
        session._id,
        `refund-qualify-${sessionId}`
      );
    }

    return { qualifies, session };
  }

  /**
   * Queue AI analysis job.
   */
  static async triggerAI(session) {
    if (session.aiAnalysisStatus === 'queued' || session.aiAnalysisStatus === 'processing') return;
    const job = await QueueService.addAIAnalysisJob({ sessionId: session._id.toString() });
    session.aiJobId = job.id;
    session.aiAnalysisStatus = 'queued';
    await session.save();
  }

  /**
   * Submit answer to an AI question.
   */
  static async submitAnswer(sessionId, userId, questionId, answerText) {
    const session = await InterviewSession.findOne({ _id: sessionId, user: userId });
    if (!session) throw Object.assign(new Error('Session not found.'), { statusCode: 404 });
    if (session.status !== 'ai_phase')
      throw Object.assign(new Error('Session is not in AI phase.'), { statusCode: 400 });

    const question = await InterviewQuestion.findOne({ _id: questionId, session: sessionId });
    if (!question) throw Object.assign(new Error('Question not found.'), { statusCode: 404 });
    if (question.userAnswer)
      throw Object.assign(new Error('Already answered this question.'), { statusCode: 409 });

    question.userAnswer = answerText;
    question.answeredAt = new Date();
    await question.save();

    // Queue evaluation
    await QueueService.addAIAnalysisJob({
      sessionId: session._id.toString(),
      type: 'evaluate_answer',
      questionId: question._id.toString(),
    });

    return question;
  }

  /**
   * Get current session state with questions.
   */
  static async getSessionState(sessionId, userId) {
    const session = await InterviewSession.findOne({ _id: sessionId, user: userId })
      .populate('assignedProblems.problem')
      .lean();
    if (!session) throw Object.assign(new Error('Session not found.'), { statusCode: 404 });

    const questions = await InterviewQuestion.find({ session: sessionId }).lean();
    return { session, questions };
  }

  /**
   * Terminate session early due to violations or backoff.
   */
  static async terminateSession(sessionId, userId) {
    const session = await InterviewSession.findOne({ _id: sessionId, user: userId });
    if (!session) throw Object.assign(new Error('Session not found.'), { statusCode: 404 });

    session.status = 'failed';
    session.phase = 'done';
    session.completedAt = new Date();
    await session.save();

    return session;
  }
}

module.exports = InterviewService;
