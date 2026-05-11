'use strict';

/**
 * Build a prompt to analyze submitted code and generate interview questions.
 */
function buildCodeAnalysisPrompt(solvedEntries) {
  const problemsText = solvedEntries
    .map((entry, idx) => {
      const problem = entry.problem;
      const submission = entry.submission;
      return `
--- Problem ${idx + 1}: ${problem?.title || 'Unknown'} (${problem?.difficulty || 'N/A'}) ---
Description: ${problem?.description?.slice(0, 300) || 'N/A'}
Submitted Code:
\`\`\`
${submission?.code || 'No code available'}
\`\`\`
Status: ${submission?.status || 'unknown'}
Language: ${submission?.language || 'unknown'}
`;
    })
    .join('\n');

  return `You are a senior software engineer conducting a technical interview.

The candidate has solved the following problems:
${problemsText}

Based on their code, generate 2-3 targeted interview questions. Focus on:
- Time and space complexity analysis
- Alternative approaches or optimizations
- Edge cases they may have missed
- Conceptual understanding of algorithms used

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "questions": [
    {
      "questionText": "Your question here",
      "category": "complexity|optimization|approach|edge_case|concept",
      "difficulty": "easy|medium|hard",
      "relatedProblemIndex": 0
    }
  ]
}`;
}

/**
 * Build prompt for generating an adaptive follow-up question.
 */
function buildQuestionGenPrompt(session, baseQuestion, existingQuestions) {
  const asked = existingQuestions.map((q) => `Q${q.questionNumber}: ${q.questionText}`).join('\n');

  return `You are a senior software engineer conducting a technical interview.

The candidate previously answered this question:
"${baseQuestion.questionText}"

Their answer: "${baseQuestion.userAnswer}"

Questions already asked:
${asked}

Based on their answer, generate ONE adaptive follow-up question that probes deeper into areas where they showed weakness or uncertainty. Do NOT repeat already-asked questions.

Respond ONLY with valid JSON (no markdown):
{
  "questions": [
    {
      "questionText": "Your follow-up question",
      "category": "complexity|optimization|approach|edge_case|concept",
      "difficulty": "easy|medium|hard",
      "relatedProblemIndex": null
    }
  ]
}`;
}

/**
 * Build prompt to evaluate a candidate's answer.
 */
function buildEvaluationPrompt(question) {
  return `You are a senior software engineer evaluating a technical interview answer.

Question: "${question.questionText}"
Category: ${question.category}
Difficulty: ${question.difficulty}

Candidate's Answer: "${question.userAnswer}"

Evaluate the answer on accuracy, depth, and clarity. Score it from 0 to 10.

Respond ONLY with valid JSON (no markdown):
{
  "score": 7,
  "correct": true,
  "feedback": "Clear explanation with your specific constructive feedback here."
}`;
}

/**
 * Build prompt to generate the final interview report.
 */
function buildFinalReportPrompt(session, questions) {
  const solvedCount = session.solvedCount || 0;
  const totalProblems = session.assignedProblems?.length || 3;

  const qaText = questions
    .map(
      (q) =>
        `Q${q.questionNumber} [${q.category}]: ${q.questionText}\nAnswer: ${q.userAnswer || '(no answer)'}\nScore: ${q.evaluation?.score ?? 'N/A'}/10\nFeedback: ${q.evaluation?.feedback || 'N/A'}`
    )
    .join('\n\n');

  const avgScore =
    questions.filter((q) => q.evaluation?.score != null).length > 0
      ? (
          questions
            .filter((q) => q.evaluation?.score != null)
            .reduce((sum, q) => sum + q.evaluation.score, 0) /
          questions.filter((q) => q.evaluation?.score != null).length
        ).toFixed(1)
      : 'N/A';

  return `You are a senior hiring manager generating a final technical interview report.

Coding Round: Solved ${solvedCount}/${totalProblems} problems.
AI Interview Average Score: ${avgScore}/10

Q&A Summary:
${qaText}

Generate a comprehensive final report. You must assign 3 sub-scores (0 to 100) based on their performance:
- technicalScore (understanding of algorithms/code)
- communicationScore (clarity of explanations)
- problemSolvingScore (ability to address edge cases and optimize)

Also provide:
- eligibleCompanies: array of 3-4 top tech companies they might be ready for
- suggestedTopics: array of 3-4 DSA topics to study
- behavioralImprovements: array of 2-3 specific behavioral feedback points

Respond ONLY with valid JSON (no markdown):
{
  "overallScore": 75,
  "technicalScore": 80,
  "communicationScore": 70,
  "problemSolvingScore": 75,
  "summary": "2-3 sentence summary of the candidate's performance",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendation": "Strong Hire / Hire / Conditional Hire / No Hire",
  "eligibleCompanies": ["Google", "Meta", "Stripe"],
  "suggestedTopics": ["Dynamic Programming", "Graphs"],
  "behavioralImprovements": ["Speak clearer", "Explain thought process earlier"]
}`;
}

/**
 * Build a prompt to generate 3 dynamic coding problems.
 */
function buildCodingProblemsPrompt(userContext = '') {
  return `You are a senior technical interviewer generating a completely new, unique coding assessment for a candidate.
${userContext ? `User Context: ${userContext}` : ''}

Generate exactly 3 coding problems: 1 Easy, 1 Medium, 1 Hard. 
These should be Data Structures and Algorithms problems.

For each problem, provide:
1. title: A concise title.
2. description: The problem statement.
3. difficulty: "Easy", "Medium", or "Hard".
4. constraints: Array of string constraints.
5. examples: Array of 3 examples, each with "input", "output", and "explanation".
6. testCases: Array of exactly 5 hidden test cases (different from examples), each with "input" and "output". 
   - IMPORTANT: The testCases must be extremely accurate. If the problem is "add two numbers", input is "2\\n3", output must be "5".
   - The testCases inputs and outputs must be plain strings, formatted exactly as they would appear in standard stdin/stdout.

Respond ONLY with valid JSON (no markdown):
{
  "problems": [
    {
      "title": "Problem Title",
      "description": "Problem description text here.",
      "difficulty": "Easy",
      "constraints": ["1 <= N <= 100"],
      "examples": [
        { "input": "1 2", "output": "3", "explanation": "1 + 2 = 3" }
      ],
      "testCases": [
        { "input": "5 7", "output": "12" }
      ]
    }
  ]
}`;
}

/**
 * Build a prompt to generate a single Problem of the Day (POTD).
 */
function buildPOTDPrompt(date) {
  return `You are a senior technical interviewer generating the "Problem of the Day" for a coding platform.
Generate exactly 1 unique Data Structures and Algorithms problem suitable for today (${date}).

For the problem, provide:
1. title: A concise, creative title.
2. description: The problem statement. Must be an ARRAY OF STRINGS, where each string is a paragraph.
3. difficulty: "Medium".
4. constraints: Array of string constraints (e.g. "1 <= N <= 10^5").
5. examples: Array of exactly 2 or 3 examples, each with "input", "output", and "explanation".
6. testCases: Array of exactly 5 hidden test cases (different from examples), each with "input" and "output". 
   - IMPORTANT: The testCases must be extremely accurate. 
   - The testCases inputs and outputs must be plain strings, formatted exactly as they would appear in standard stdin/stdout.
7. editorial: A detailed explanation of the optimal approach to solve the problem, including time and space complexity. Must be an ARRAY OF STRINGS, where each string is a paragraph.
8. hints: Array of 2 or 3 strings. Each string should provide a progressive hint to help the user solve the problem without giving away the full solution.
9. tags: Array of strings representing topics/tags (e.g. ["Array", "Dynamic Programming", "Hash Table"]).

Respond ONLY with valid JSON. IMPORTANT: Do not use literal newlines inside JSON strings. Use escaped newlines (\\n).
{
  "title": "Problem Title",
  "description": ["Paragraph 1", "Paragraph 2"],
  "hints": ["Hint 1: Think about data structures...", "Hint 2: Try using a hash map..."],
  "tags": ["Array", "Hash Table"],
  "editorial": ["Paragraph 1", "Paragraph 2"],
  "difficulty": "Medium",
  "constraints": ["1 <= N <= 100"],
  "examples": [
    { "input": "1 2", "output": "3", "explanation": "1 + 2 = 3" }
  ],
  "testCases": [
    { "input": "5 7", "output": "12" }
  ]
}`;
}

module.exports = {
  buildCodeAnalysisPrompt,
  buildQuestionGenPrompt,
  buildEvaluationPrompt,
  buildFinalReportPrompt,
  buildCodingProblemsPrompt,
  buildPOTDPrompt,
};
