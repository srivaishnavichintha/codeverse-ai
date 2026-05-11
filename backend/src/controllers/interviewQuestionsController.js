'use strict';

const mongoose = require('mongoose');
const InterviewQuestions = require('../models/InterviewQuestion');

// ── Validation helpers ────────────────────────────────────────────────────────

const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const VALID_CATEGORIES = new Set([
  'complexity', 'optimization', 'approach', 'edge_case',
  'concept', 'behavioral', 'system_design', 'data_structures', 'algorithms',
]);

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/interview-questions
 * Save one or more AI-generated interview questions.
 *
 * Body:
 * {
 *   questions: [
 *     {
 *       question: "string",
 *       topic: "string",
 *       difficulty: "easy|medium|hard",
 *       category: "concept|...",       (optional)
 *       sessionId: "<ObjectId>",       (optional)
 *       relatedProblemId: "<ObjectId>" (optional)
 *     }
 *   ]
 * }
 */
async function saveQuestions(req, res, next) {
  try {
    const userId = req.user.id;
    const { questions } = req.body;

    // ── Input validation ───────────────────────────────────────────────────
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: '`questions` must be a non-empty array.',
      });
    }

    if (questions.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Cannot save more than 50 questions at once.',
      });
    }

    // Validate each question
    const errors = [];
    questions.forEach((q, i) => {
      const questionText = q.question || q.questionText;
      if (
        !questionText ||
        typeof questionText !== 'string' ||
        questionText.trim().length < 10
      ) {
        errors.push(
          `questions[${i}]: "question/questionText" must be a string of at least 10 characters.`
        );
      }
      if (
        q.topic &&
        (typeof q.topic !== 'string' || !q.topic.trim())
      ) {
        errors.push(`questions[${i}]: invalid "topic".`);
      }
      if (!q.difficulty || !VALID_DIFFICULTIES.has(q.difficulty.toLowerCase())) {
        errors.push(`questions[${i}]: "difficulty" must be easy, medium, or hard.`);
      }
      if (q.category && !VALID_CATEGORIES.has(q.category)) {
        errors.push(`questions[${i}]: invalid "category".`);
      }
      if (q.sessionId && !isValidObjectId(q.sessionId)) {
        errors.push(`questions[${i}]: invalid "sessionId".`);
      }
      if (q.relatedProblemId && !isValidObjectId(q.relatedProblemId)) {
        errors.push(`questions[${i}]: invalid "relatedProblemId".`);
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors,
      });
    }

    // ── Build docs ─────────────────────────────────────────────────────────
    const docs = questions.map((q) => ({
      userId,
      sessionId: q.sessionId || null,
      question: questionText.trim(),
      topic: (q.topic || q.category || 'dsa').trim().toLowerCase(),
      difficulty: q.difficulty.toLowerCase(),
      category: q.category || 'concept',
      relatedProblemId: q.relatedProblemId || null,
      aiGenerated: true,
    }));

    const saved = await InterviewQuestions.insertMany(docs, { ordered: false });

    return res.status(201).json({
      success: true,
      message: `${saved.length} question(s) saved successfully.`,
      data: saved,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/interview-questions
 * Fetch questions for the authenticated user.
 *
 * Query params:
 *  - page        (default 1)
 *  - limit       (default 20, max 100)
 *  - difficulty  easy|medium|hard
 *  - topic       string (partial match)
 *  - category    string
 *  - sessionId   ObjectId — filter by session
 */
async function getUserQuestions(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      difficulty,
      topic,
      category,
      sessionId,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // ── Build filter ───────────────────────────────────────────────────────
    const filter = { userId };

    if (difficulty) {
      if (!VALID_DIFFICULTIES.has(difficulty.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid difficulty. Must be easy, medium, or hard.',
        });
      }
      filter.difficulty = difficulty.toLowerCase();
    }

    if (topic) {
      filter.topic = { $regex: topic.trim(), $options: 'i' };
    }

    if (category) {
      if (!VALID_CATEGORIES.has(category)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category.',
        });
      }
      filter.category = category;
    }

    if (sessionId) {
      if (!isValidObjectId(sessionId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sessionId.',
        });
      }
      filter.sessionId = sessionId;
    }

    // ── Query ──────────────────────────────────────────────────────────────
    const [questions, total] = await Promise.all([
      InterviewQuestions.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('relatedProblemId', 'title slug difficulty')
        .lean(),
      InterviewQuestions.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: questions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/interview-questions/:id
 * Fetch a single question by ID (must belong to authenticated user).
 */
async function getQuestionById(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid question ID.' });
    }

    const question = await InterviewQuestions.findOne({ _id: id, userId })
      .populate('relatedProblemId', 'title slug difficulty')
      .lean();

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    return res.status(200).json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/interview-questions/:id
 * Delete a single question (must belong to authenticated user).
 */
async function deleteQuestion(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid question ID.' });
    }

    const deleted = await InterviewQuestions.findOneAndDelete({ _id: id, userId });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    return res.status(200).json({ success: true, message: 'Question deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  saveQuestions,
  getUserQuestions,
  getQuestionById,
  deleteQuestion,
};
