const { z } = require('zod');

// ─── Schemas ──────────────────────────────────────────────────────────────────

const QuestionSchema = z.object({
  questionText: z.string().min(10),
  category: z
    .enum(['complexity', 'optimization', 'approach', 'edge_case', 'concept', 'behavioral'])
    .default('concept'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  relatedProblemIndex: z.number().nullable().optional().default(null),
});

const QuestionsResponseSchema = z.object({
  questions: z.array(QuestionSchema).min(1).max(5),
});

const EvaluationSchema = z.object({
  score: z.number().min(0).max(10),
  correct: z.boolean(),
  feedback: z.string().min(5),
});

const FinalReportSchema = z.object({
  overallScore: z.number().min(0).max(100),
  technicalScore: z.number().min(0).max(100).optional().default(70),
  communicationScore: z.number().min(0).max(100).optional().default(70),
  problemSolvingScore: z.number().min(0).max(100).optional().default(70),
  summary: z.string().min(10),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  recommendation: z.string(),
  eligibleCompanies: z.array(z.string()).default([]),
  suggestedTopics: z.array(z.string()).default([]),
  behavioralImprovements: z.array(z.string()).default([]),
});

const CodingProblemsSchema = z.object({
  problems: z.array(z.object({
    title: z.string(),
    description: z.string(),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']),
    constraints: z.array(z.string()),
    examples: z.array(z.object({
      input: z.string(),
      output: z.string(),
      explanation: z.string().optional()
    })),
    testCases: z.array(z.object({
      input: z.string(),
      output: z.string()
    }))
  })).min(1).max(3)
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely extract JSON from AI response text (handles markdown fences).
 */
function extractJSON(text) {
  if (!text) return null;

  // Try to extract from ```json ... ``` or ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch (_) {}
  }

  // Try raw JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (_) {}
  }

  return null;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseCodingProblemsResponse(rawText) {
  const json = extractJSON(rawText);
  if (!json) return null;

  const result = CodingProblemsSchema.safeParse(json);
  if (!result.success) {
    console.warn('[aiParser] CodingProblems validation failed:', result.error.flatten());
    return null;
  }
  return result.data;
}

/**
 * Parse and validate AI-generated questions response.
 * @returns {Object|null} Validated parsed object or null on failure.
 */
function parseQuestionsResponse(rawText) {
  const json = extractJSON(rawText);
  if (!json) return null;

  const result = QuestionsResponseSchema.safeParse(json);
  if (!result.success) {
    console.warn('[aiParser] Questions validation failed:', result.error.flatten());
    return null;
  }
  return result.data;
}

/**
 * Parse and validate an answer evaluation response.
 */
function parseEvaluationResponse(rawText) {
  const json = extractJSON(rawText);
  if (!json) return null;

  const result = EvaluationSchema.safeParse(json);
  if (!result.success) {
    console.warn('[aiParser] Evaluation validation failed:', result.error.flatten());
    return null;
  }
  return result.data;
}

/**
 * Parse and validate a final report response.
 */
function parseFinalReportResponse(rawText) {
  const json = extractJSON(rawText);
  if (!json) return null;

  const result = FinalReportSchema.safeParse(json);
  if (!result.success) {
    console.warn('[aiParser] Final report validation failed:', result.error.flatten());
    return null;
  }
  return result.data;
}

module.exports = {
  parseQuestionsResponse,
  parseEvaluationResponse,
  parseFinalReportResponse,
  parseCodingProblemsResponse,
  // Export schemas for testing
  QuestionsResponseSchema,
  EvaluationSchema,
  FinalReportSchema,
  CodingProblemsSchema,
};
