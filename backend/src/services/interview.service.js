/**
 * interview.service.js
 *
 * Responsibility: manage the runtime interview flow.
 *
 * This service:
 *  ✔ determines the interview difficulty profile from user stats
 *  ✔ generates fresh problems via AI at interview start
 *  ✔ persists generated problems and their test cases to the DB
 *  ✔ creates and manages InterviewSession documents
 *  ✔ handles qualification for AI round
 *  ✔ queues AI interview analysis jobs
 */

"use strict";

const User = require("../models/User");
const InterviewSession = require("../models/InterviewSession");

const { generateAndStoreProblems } = require("./problem.service");

const { QueueService } = require("./QueueService");

// ─────────────────────────────────────────────────────────────
// Skill Calculation
// ─────────────────────────────────────────────────────────────

function calculateSkill(user) {
  const { easy = 0, medium = 0, hard = 0 } = user.stats || {};

  const total = easy + medium + hard;

  if (total === 0) {
    return {
      score: 0,
      level: "Beginner",
    };
  }

  const score =
    (easy * 1 + medium * 2 + hard * 3) / total;

  const level =
    score < 1.5
      ? "Beginner"
      : score <= 2.2
      ? "Intermediate"
      : "Advanced";

  return {
    score,
    level,
  };
}

// ─────────────────────────────────────────────────────────────
// Difficulty Distribution
// ─────────────────────────────────────────────────────────────

function getDistribution(level) {
  const map = {
    Beginner: [
      { difficulty: "easy", count: 2 },
      { difficulty: "medium", count: 1 },
    ],

    Intermediate: [
      { difficulty: "easy", count: 1 },
      { difficulty: "medium", count: 2 },
    ],

    Advanced: [
      { difficulty: "medium", count: 2 },
      { difficulty: "hard", count: 1 },
    ],
  };

  return map[level] || map.Beginner;
}

// ─────────────────────────────────────────────────────────────
// Assign Problems
// ─────────────────────────────────────────────────────────────

async function assignProblems(userId) {
  // 1. Fetch User

  const user = await User.findById(userId).lean();

  if (!user) {
    throw Object.assign(
      new Error("User not found."),
      { statusCode: 404 }
    );
  }

  // 2. Calculate Skill

  const { level: skillLevel } =
    calculateSkill(user);

  const difficultyProfile =
    getDistribution(skillLevel);

  console.info(
    `[interview.service] userId=${userId} | skillLevel=${skillLevel}`
  );

  // 3. Generate Problems

  const {
    savedProblems,
    publicTestCasesMap,
  } = await generateAndStoreProblems(
    difficultyProfile,
    userId
  );

  if (
    !savedProblems ||
    savedProblems.length === 0
  ) {
    throw Object.assign(
      new Error(
        "Failed to generate interview problems."
      ),
      { statusCode: 502 }
    );
  }

  return {
    user,
    problems: savedProblems,
    publicTestCasesMap,
    skillLevel,
    difficultyProfile,
  };
}

// ─────────────────────────────────────────────────────────────
// Start Interview Session
// ─────────────────────────────────────────────────────────────

async function startInterview(userId) {
  const {
    problems,
    skillLevel,
    difficultyProfile,
  } = await assignProblems(userId);

  const session =
    await InterviewSession.create({
      user: userId,

      status: "coding",

      phase: "coding",

      assignedProblems: problems.map(
        (problem) => ({
          problem: problem._id,
          solved: false,
        })
      ),

      solvedCount: 0,

      qualifiedForAI: false,

      aiAnalysisStatus: "not_started",

      startedAt: new Date(),

      codingDeadline: new Date(
        Date.now() + 60 * 60 * 1000
      ),
    });

  console.log(
    `🔥 Interview session created: ${session._id}`
  );

  return {
    session,
    problems,
    skillLevel,
    difficultyProfile,
  };
}

// ─────────────────────────────────────────────────────────────
// Qualification Check
// ─────────────────────────────────────────────────────────────

async function checkQualification(
  sessionId,
  userId
) {
  const session =
    await InterviewSession.findOne({
      _id: sessionId,
      user: userId,
    });

  if (!session) {
    throw Object.assign(
      new Error("Session not found."),
      { statusCode: 404 }
    );
  }

  // Qualification Logic

  const qualifies =
    session.solvedCount >= 1;

  if (!qualifies) {
    session.status = "failed";

    await session.save();

    console.log(
      `❌ Session failed qualification: ${sessionId}`
    );

    return {
      qualifies: false,
      session,
    };
  }

  // Move To AI Phase

  session.qualifiedForAI = true;

  session.status = "ai_phase";

  session.phase = "ai";

  session.aiAnalysisStatus = "queued";

  await session.save();

  console.log(
    `🔥 Session moved to AI phase: ${sessionId}`
  );

  // Queue AI Interview Question Generation

  await QueueService.addAIAnalysisJob({
    sessionId: session._id.toString(),

    type: "analyze_session",
  });

  console.log(
    `🔥 AI analysis job added: ${sessionId}`
  );

  return {
    qualifies: true,
    session,
  };
}

// ─────────────────────────────────────────────────────────────
// Mark Problem Solved
// ─────────────────────────────────────────────────────────────

async function markProblemSolved(
  sessionId,
  problemId,
  submissionId
) {
  const session =
    await InterviewSession.findById(
      sessionId
    );

  if (!session) {
    throw Object.assign(
      new Error("Session not found."),
      { statusCode: 404 }
    );
  }

  const assigned =
    session.assignedProblems.find(
      (p) =>
        p.problem.toString() ===
        problemId.toString()
    );

  if (!assigned) {
    throw Object.assign(
      new Error(
        "Problem not assigned to session."
      ),
      { statusCode: 400 }
    );
  }

  if (!assigned.solved) {
    assigned.solved = true;

    assigned.submission = submissionId;

    session.solvedCount += 1;

    await session.save();

    console.log(
      `✅ Problem solved | session=${sessionId} | solvedCount=${session.solvedCount}`
    );
  }

  return session;
}

// ─────────────────────────────────────────────────────────────
// Complete Interview
// ─────────────────────────────────────────────────────────────

async function completeInterview(
  sessionId
) {
  const session =
    await InterviewSession.findById(
      sessionId
    );

  if (!session) {
    throw Object.assign(
      new Error("Session not found."),
      { statusCode: 404 }
    );
  }

  session.status = "completed";

  session.phase = "done";

  session.completedAt = new Date();

  await session.save();

  console.log(
    `✅ Interview completed: ${sessionId}`
  );

  return session;
}

// ─────────────────────────────────────────────────────────────
// Get Session State
// ─────────────────────────────────────────────────────────────

async function getSessionState(
  sessionId,
  userId
) {
  const session =
    await InterviewSession.findOne({
      _id: sessionId,
      user: userId,
    })
      .populate("assignedProblems.problem")
      .lean();

  if (!session) {
    throw Object.assign(
      new Error("Session not found."),
      { statusCode: 404 }
    );
  }

  return session;
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

module.exports = {
  calculateSkill,

  getDistribution,

  assignProblems,

  startInterview,

  checkQualification,

  markProblemSolved,

  completeInterview,

  getSessionState,
};