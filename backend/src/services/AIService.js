// const { GoogleGenerativeAI } = require('@google/generative-ai');
// const AIResponse = require('../models/AIResponse');
// const InterviewSession = require('../models/InterviewSession');
// const InterviewQuestion = require('../models/InterviewQuestion');
// const Submission = require('../models/Submission');
// const { buildCodeAnalysisPrompt, buildQuestionGenPrompt, buildEvaluationPrompt, buildFinalReportPrompt } = require('../utils/aiPrompts');
// const { parseQuestionsResponse, parseEvaluationResponse, parseFinalReportResponse } = require('../utils/aiParser');

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const MODEL = 'gemini-1.5-flash'; 

// class AIService {
//   /**
//    * Analyze submitted code and generate interview questions.
//    */
//   static async analyzeAndGenerateQuestions(sessionId) {
//     const session = await InterviewSession.findById(sessionId)
//       .populate('assignedProblems.problem')
//       .populate('assignedProblems.submission');

//     if (!session) throw new Error(`Session ${sessionId} not found`);

//     // Build code analysis prompt
//     const solvedEntries = session.assignedProblems.filter((p) => p.solved && p.submission);
//     const prompt = buildCodeAnalysisPrompt(solvedEntries);

//     const start = Date.now();
//     let rawResponse = null;
//     let parsedResponse = null;
//     let success = false;
//     let errorMessage = null;
//     let inputTokens = 0;
//     let outputTokens = 0;

//     try {
//     const model = genAI.getGenerativeModel({ model: MODEL });
//     const result = await model.generateContent(prompt);
//     rawResponse = result.response.text();
//     inputTokens = 0;
//     outputTokens = 0;

//       parsedResponse = parseQuestionsResponse(rawResponse);
//       success = true;
//     } catch (err) {
//       errorMessage = err.message;
//       success = false;
//     }

//     const latencyMs = Date.now() - start;

//     // Log AI response
//     const aiLog = await AIResponse.create({
//       session: sessionId,
//       type: 'question_generation',
//       prompt,
//       rawResponse,
//       parsedResponse,
//       model: MODEL,
//       tokensUsed: { input: inputTokens, output: outputTokens },
//       latencyMs,
//       success,
//       errorMessage,
//       validationPassed: success && !!parsedResponse,
//     });

//     if (!success || !parsedResponse) {
//       throw new Error(`AI question generation failed: ${errorMessage}`);
//     }

//     // Store questions
//     const questions = [];
//     for (let i = 0; i < parsedResponse.questions.length; i++) {
//       const q = parsedResponse.questions[i];
//       const question = await InterviewQuestion.create({
//         session: sessionId,
//         user: session.user,
//         questionNumber: i + 1,
//         questionText: q.questionText,
//         category: q.category || 'concept',
//         relatedProblem: q.relatedProblemIndex != null
//           ? solvedEntries[q.relatedProblemIndex]?.problem?._id
//           : null,
//         difficulty: q.difficulty || 'medium',
//         isAdaptive: false,
//       });
//       questions.push(question);
//     }

//     return questions;
//   }

//   /**
//    * Generate an adaptive follow-up question based on previous answer.
//    */
//   static async generateAdaptiveQuestion(sessionId, basedOnQuestionId) {
//     const session = await InterviewSession.findById(sessionId).populate('assignedProblems.problem');
//     const baseQuestion = await InterviewQuestion.findById(basedOnQuestionId);
//     if (!baseQuestion?.userAnswer) throw new Error('No answer found for adaptive generation.');

//     const existingQuestions = await InterviewQuestion.find({ session: sessionId }).lean();
//     const prompt = buildQuestionGenPrompt(session, baseQuestion, existingQuestions);

//     const start = Date.now();
//     let rawResponse = null;
//     let parsedResponse = null;
//     let success = false;
//     let errorMessage = null;

//     try {
//      // ADD:
//     const model = genAI.getGenerativeModel({ model: MODEL });
//     const result = await model.generateContent(prompt);
//     rawResponse = result.response.text();
//     inputTokens = 0;
//     outputTokens = 0;
//     } catch (err) {
//       errorMessage = err.message;
//     }

//     await AIResponse.create({
//       session: sessionId,
//       type: 'question_generation',
//       prompt,
//       rawResponse,
//       parsedResponse,
//       model: MODEL,
//       latencyMs: Date.now() - start,
//       success,
//       errorMessage,
//       validationPassed: success && !!parsedResponse,
//     });

//     if (!success || !parsedResponse?.questions?.length) return null;

//     const q = parsedResponse.questions[0];
//     return InterviewQuestion.create({
//       session: sessionId,
//       user: session.user,
//       questionNumber: existingQuestions.length + 1,
//       questionText: q.questionText,
//       category: q.category || 'concept',
//       difficulty: q.difficulty || 'medium',
//       isAdaptive: true,
//       basedOnQuestion: basedOnQuestionId,
//     });
//   }

//   /**
//    * Evaluate a single answer.
//    */
//   static async evaluateAnswer(sessionId, questionId) {
//     const question = await InterviewQuestion.findById(questionId);
//     if (!question) throw new Error('Question not found');
//     if (!question.userAnswer) throw new Error('No answer to evaluate');

//     const prompt = buildEvaluationPrompt(question);
//     const start = Date.now();
//     let rawResponse = null;
//     let parsedResponse = null;
//     let success = false;
//     let errorMessage = null;

//     try {
//       const model = genAI.getGenerativeModel({ model: MODEL });
//       const result = await model.generateContent(prompt);
//       rawResponse = result.response.text();
//       inputTokens = 0;
//       outputTokens = 0;
//     } catch (err) {
//       errorMessage = err.message;
//     }

//     await AIResponse.create({
//       session: sessionId,
//       type: 'answer_evaluation',
//       prompt,
//       rawResponse,
//       parsedResponse,
//       model: MODEL,
//       latencyMs: Date.now() - start,
//       success,
//       errorMessage,
//       validationPassed: success && !!parsedResponse,
//     });

//     if (success && parsedResponse) {
//       question.evaluation = {
//         score: parsedResponse.score,
//         feedback: parsedResponse.feedback,
//         correct: parsedResponse.correct,
//         evaluatedAt: new Date(),
//       };
//       await question.save();
//     }

//     return question;
//   }

//   /**
//    * Generate the final interview report.
//    */
//   static async generateFinalReport(sessionId) {
//     const session = await InterviewSession.findById(sessionId).populate('assignedProblems.problem');
//     const questions = await InterviewQuestion.find({ session: sessionId }).lean();

//     const prompt = buildFinalReportPrompt(session, questions);
//     const start = Date.now();
//     let rawResponse = null;
//     let parsedResponse = null;
//     let success = false;
//     let errorMessage = null;

//     try {
//       const model = genAI.getGenerativeModel({ model: MODEL });
//       const result = await model.generateContent(prompt);
//       rawResponse = result.response.text();
//       inputTokens = 0;
//       outputTokens = 0;
//     } catch (err) {
//       errorMessage = err.message;
//     }

//     await AIResponse.create({
//       session: sessionId,
//       type: 'final_report',
//       prompt,
//       rawResponse,
//       parsedResponse,
//       model: MODEL,
//       latencyMs: Date.now() - start,
//       success,
//       errorMessage,
//       validationPassed: success && !!parsedResponse,
//     });

//     if (success && parsedResponse) {
//       session.finalReport = {
//         overallScore: parsedResponse.overallScore,
//         summary: parsedResponse.summary,
//         strengths: parsedResponse.strengths || [],
//         weaknesses: parsedResponse.weaknesses || [],
//         recommendation: parsedResponse.recommendation,
//         generatedAt: new Date(),
//       };
//       session.status = 'completed';
//       session.phase = 'done';
//       session.completedAt = new Date();
//       await session.save();
//     }

//     return session;
//   }
// }

// module.exports = AIService;


'use strict';

// ── Lazy Gemini client ───────────────────────────────────────────────────────
// Instantiated on first call so missing GEMINI_API_KEY doesn't crash at startup.
let _GoogleGenerativeAI = null;
let _genAI = null;

function getGeminiClient() {
  if (_genAI) return _genAI;
  if (!_GoogleGenerativeAI) {
    try {
      _GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
    } catch {
      throw new Error('@google/generative-ai not installed. Run: npm install @google/generative-ai');
    }
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY env var is not set. Add it to your .env file.');
  }
  _genAI = new _GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return _genAI;
}

const AIResponse = require('../models/AIResponse');
const InterviewSession = require('../models/InterviewSession');
const InterviewQuestion = require('../models/InterviewQuestion');
const {
  buildCodeAnalysisPrompt,
  buildQuestionGenPrompt,
  buildEvaluationPrompt,
  buildFinalReportPrompt,
} = require('../utils/aiPrompts');
const {
  parseQuestionsResponse,
  parseEvaluationResponse,
  parseFinalReportResponse,
} = require('../utils/aiParser');

const MODEL = 'gemini-2.5-flash';

async function callGemini(prompt, maxTokens = 1024) {
  const start = Date.now();
  const model = getGeminiClient().getGenerativeModel({
    model: MODEL,
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json',
    },
  });
  
  const result = await model.generateContent(prompt);
  const response = await result.response;
  
  console.log('--- GEMINI FINISH REASON ---');
  console.log(response.candidates?.[0]?.finishReason);
  
  const text = response.text();
  console.log('--- RAW RESPONSE FROM GEMINI ---');
console.log(text);
console.log('--------------------------------');
  
  return {
    text,
    inputTokens: response.usageMetadata?.promptTokenCount || 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
    latencyMs: Date.now() - start,
  };
}

class AIService {
  
  static async analyzeAndGenerateQuestions(sessionId) {
    console.log('🔥 analyzeAndGenerateQuestions CALLED');
    console.log('SESSION ID:', sessionId);
    const session = await InterviewSession.findById(sessionId)
      .populate('assignedProblems.problem')
      .populate('assignedProblems.submission');

    if (!session) throw new Error(`Session ${sessionId} not found`);

    const solvedEntries = session.assignedProblems.filter((p) => p.solved && p.submission);
    const prompt = buildCodeAnalysisPrompt(solvedEntries);

    let rawResponse = null;
    let parsedResponse = null;
    let success = false;
    let errorMessage = null;
    let inputTokens = 0;
    let outputTokens = 0;
    let latencyMs = 0;

    try {
      const result = await callGemini(prompt, 2048);
      rawResponse = result.text;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      latencyMs = result.latencyMs;
      parsedResponse = parseQuestionsResponse(rawResponse);

console.log('--- PARSED INTERVIEW QUESTIONS ---');
console.log(parsedResponse);
console.log('----------------------------------');

success = !!parsedResponse;
    } catch (err) {
      errorMessage = err.message;
    }

    await AIResponse.create({
      session: sessionId,
      type: 'question_generation',
      prompt,
      rawResponse,
      parsedResponse,
      model: MODEL,
      tokensUsed: { input: inputTokens, output: outputTokens },
      latencyMs,
      success,
      errorMessage,
      validationPassed: success && !!parsedResponse,
    });

    if (!success || !parsedResponse) {
      throw new Error(`AI question generation failed: ${errorMessage}`);
    }

    const questions = [];
    for (let i = 0; i < parsedResponse.questions.length; i++) {
      const q = parsedResponse.questions[i];
      const question = await InterviewQuestion.create({
        session: sessionId,
        user: session.user,
        questionNumber: i + 1,
        questionText: q.questionText,
        category: q.category || 'concept',
        relatedProblem:
          q.relatedProblemIndex != null
            ? solvedEntries[q.relatedProblemIndex]?.problem?._id
            : null,
        difficulty: q.difficulty || 'medium',
        isAdaptive: false,
      });
      questions.push(question);
    }

    return questions;
  }

  static async generateCodingProblems(sessionId) {
    const { buildCodingProblemsPrompt } = require('../utils/aiPrompts');
    const { parseCodingProblemsResponse } = require('../utils/aiParser');
    
    const prompt = buildCodingProblemsPrompt('A software engineer candidate');
    let rawResponse = null;
    let parsedResponse = null;
    let success = false;
    let errorMessage = null;
    let latencyMs = 0;

    try {
      const result = await callGemini(prompt, 3072);
      rawResponse = result.text;
      latencyMs = result.latencyMs;
      parsedResponse = parseCodingProblemsResponse(rawResponse);

console.log('--- PARSED CODING PROBLEMS ---');
console.log(parsedResponse);
console.log('--------------------------------');

success = !!parsedResponse;
    } catch (err) {
      errorMessage = err.message;
    }

    await AIResponse.create({
      session: sessionId,
      type: 'question_generation',
      prompt,
      rawResponse,
      parsedResponse,
      model: MODEL,
      latencyMs,
      success,
      errorMessage,
      validationPassed: success && !!parsedResponse,
    });

    if (!success || !parsedResponse) {
      throw new Error(`AI problem generation failed: ${errorMessage}`);
    }

    const Problem = require('../models/Problem');
    const TestCase = require('../models/TestCase');

    const createdProblems = [];

    for (let i = 0; i < parsedResponse.problems.length; i++) {
      const p = parsedResponse.problems[i];
      const slug = `ai-gen-${sessionId}-${Date.now()}-${i}`;
      
      const starterCode = {
        javascript: '// Write your solution here\n',
        python: '# Write your solution here\n',
        java: 'class Solution {\n  public static void main(String[] args) {\n    // Write your solution here\n  }\n}\n',
        cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n  // Write your solution here\n  return 0;\n}\n',
      };

      const newProblem = await Problem.create({
        title: p.title,
        slug,
        description: p.description,
        difficulty: p.difficulty ? p.difficulty.charAt(0).toUpperCase() + p.difficulty.slice(1).toLowerCase() : 'Medium',
        hints: p.hints || [],
        tags: p.tags || [],
        constraints: p.constraints || [],
        examples: p.examples || [],
        starterCode,
        isActive: false, 
      });

      if (p.testCases && p.testCases.length > 0) {
        for (let j = 0; j < p.testCases.length; j++) {
          const tc = p.testCases[j];
          await TestCase.create({
            problem: newProblem._id,
            input: tc.input,
            output: tc.output,
            isHidden: true,
            order: j
          });
        }
      }

      if (p.examples && p.examples.length > 0) {
        for (let j = 0; j < p.examples.length; j++) {
          const ex = p.examples[j];
          await TestCase.create({
            problem: newProblem._id,
            input: ex.input,
            output: ex.output,
            isHidden: false,
            isSample: true,
            order: p.testCases ? p.testCases.length + j : j
          });
        }
      }

      createdProblems.push(newProblem);
    }

    return createdProblems;
  }

  static async generateAdaptiveQuestion(sessionId, basedOnQuestionId) {
    const session = await InterviewSession.findById(sessionId).populate(
      'assignedProblems.problem'
    );
    const baseQuestion = await InterviewQuestion.findById(basedOnQuestionId);
    if (!baseQuestion?.userAnswer) throw new Error('No answer found for adaptive generation.');

    const existingQuestions = await InterviewQuestion.find({ session: sessionId }).lean();
    const prompt = buildQuestionGenPrompt(session, baseQuestion, existingQuestions);

    let rawResponse = null;
    let parsedResponse = null;
    let success = false;
    let errorMessage = null;
    let latencyMs = 0;

    try {
      const result = await callGemini(prompt, 512);
      rawResponse = result.text;
      latencyMs = result.latencyMs;
      parsedResponse = parseQuestionsResponse(rawResponse);

console.log('--- PARSED ADAPTIVE QUESTION ---');
console.log(parsedResponse);
console.log('--------------------------------');

success = !!parsedResponse;
    } catch (err) {
      errorMessage = err.message;
    }

    await AIResponse.create({
      session: sessionId,
      type: 'question_generation',
      prompt,
      rawResponse,
      parsedResponse,
      model: MODEL,
      latencyMs,
      success,
      errorMessage,
      validationPassed: success && !!parsedResponse,
    });

    if (!success || !parsedResponse?.questions?.length) return null;

    const q = parsedResponse.questions[0];
    return InterviewQuestion.create({
      session: sessionId,
      user: session.user,
      questionNumber: existingQuestions.length + 1,
      questionText: q.questionText,
      category: q.category || 'concept',
      difficulty: q.difficulty || 'medium',
      isAdaptive: true,
      basedOnQuestion: basedOnQuestionId,
    });
  }

  static async evaluateAnswer(sessionId, questionId) {
    const question = await InterviewQuestion.findById(questionId);
    if (!question) throw new Error('Question not found');
    if (!question.userAnswer) throw new Error('No answer to evaluate');

    const prompt = buildEvaluationPrompt(question);

    let rawResponse = null;
    let parsedResponse = null;
    let success = false;
    let errorMessage = null;
    let latencyMs = 0;

    try {
      const result = await callGemini(prompt, 512);
      rawResponse = result.text;
      latencyMs = result.latencyMs;
      parsedResponse = parseEvaluationResponse(rawResponse);

console.log('--- PARSED EVALUATION ---');
console.log(parsedResponse);
console.log('--------------------------');

success = !!parsedResponse;
    } catch (err) {
      errorMessage = err.message;
    }

    await AIResponse.create({
      session: sessionId,
      type: 'answer_evaluation',
      prompt,
      rawResponse,
      parsedResponse,
      model: MODEL,
      latencyMs,
      success,
      errorMessage,
      validationPassed: success && !!parsedResponse,
    });

    if (success && parsedResponse) {
      question.evaluation = {
        score: parsedResponse.score,
        feedback: parsedResponse.feedback,
        correct: parsedResponse.correct,
        evaluatedAt: new Date(),
      };
      await question.save();
    }

    return question;
  }

  static async generateFinalReport(sessionId) {
    const session = await InterviewSession.findById(sessionId).populate(
      'assignedProblems.problem'
    );
    const questions = await InterviewQuestion.find({ session: sessionId }).lean();

    const prompt = buildFinalReportPrompt(session, questions);

    let rawResponse = null;
    let parsedResponse = null;
    let success = false;
    let errorMessage = null;
    let latencyMs = 0;

    try {
      const result = await callGemini(prompt, 1024);
      rawResponse = result.text;
      latencyMs = result.latencyMs;
      parsedResponse = parseFinalReportResponse(rawResponse);

console.log('--- PARSED FINAL REPORT ---');
console.log(parsedResponse);
console.log('----------------------------');

success = !!parsedResponse;
    } catch (err) {
      errorMessage = err.message;
    }

    await AIResponse.create({
      session: sessionId,
      type: 'final_report',
      prompt,
      rawResponse,
      parsedResponse,
      model: MODEL,
      latencyMs,
      success,
      errorMessage,
      validationPassed: success && !!parsedResponse,
    });

    if (success && parsedResponse) {
      session.finalReport = {
        overallScore: parsedResponse.overallScore,
        technicalScore: parsedResponse.technicalScore,
        communicationScore: parsedResponse.communicationScore,
        problemSolvingScore: parsedResponse.problemSolvingScore,
        summary: parsedResponse.summary,
        strengths: parsedResponse.strengths || [],
        weaknesses: parsedResponse.weaknesses || [],
        recommendation: parsedResponse.recommendation,
        eligibleCompanies: parsedResponse.eligibleCompanies || [],
        suggestedTopics: parsedResponse.suggestedTopics || [],
        behavioralImprovements: parsedResponse.behavioralImprovements || [],
        generatedAt: new Date(),
      };
      session.status = 'completed';
      session.phase = 'done';
      session.completedAt = new Date();
      await session.save();
    }

    return session;
  }
  static async generatePOTD(dateStr) {
    const { buildPOTDPrompt } = require('../utils/aiPrompts');
    const prompt = buildPOTDPrompt(dateStr);
    let rawResponse = null;
    let parsedResponse = null;
    let success = false;
    let errorMessage = null;
    let latencyMs = 0;

    try {
      const result = await callGemini(prompt, 2048);
      rawResponse = result.text;
      latencyMs = result.latencyMs;
      
      console.log('--- RAW RESPONSE FROM GEMINI ---');
      console.log(rawResponse);
      console.log('--------------------------------');

      // Parse JSON from text
      let jsonStr = rawResponse.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
      
      parsedResponse = JSON.parse(jsonStr.trim());
      success = true;
    } catch (err) {
      errorMessage = err.message;
    }

    if (!success || !parsedResponse) {
      throw new Error(`AI POTD generation failed: ${errorMessage}`);
    }

    const Problem = require('../models/Problem');
    const TestCase = require('../models/TestCase');

    const p = parsedResponse;
    const slug = `potd-${dateStr}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    
    const starterCode = {
      javascript: '// Write your solution here\n',
      python: '# Write your solution here\n',
      java: 'class Solution {\n  public static void main(String[] args) {\n    // Write your solution here\n  }\n}\n',
      cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n  // Write your solution here\n  return 0;\n}\n',
    };

    const newProblem = await Problem.create({
      title: p.title,
      slug,
      description: Array.isArray(p.description) ? p.description.join('\\n\\n') : p.description,
      editorial: Array.isArray(p.editorial) ? p.editorial.join('\\n\\n') : p.editorial,
      hints: p.hints || [],
      tags: p.tags || [],
      difficulty: p.difficulty,
      constraints: p.constraints || [],
      examples: p.examples || [],
      starterCode,
      isActive: true, // POTD should be active
    });

    if (p.testCases && p.testCases.length > 0) {
      for (let j = 0; j < p.testCases.length; j++) {
        const tc = p.testCases[j];
        await TestCase.create({
          problem: newProblem._id,
          input: tc.input,
          output: tc.output,
          isHidden: true,
          order: j
        });
      }
    }

    if (p.examples && p.examples.length > 0) {
      for (let j = 0; j < p.examples.length; j++) {
        const ex = p.examples[j];
        await TestCase.create({
          problem: newProblem._id,
          input: ex.input,
          output: ex.output,
          isHidden: false,
          isSample: true,
          order: p.testCases ? p.testCases.length + j : j
        });
      }
    }

    return newProblem;
  }
}

module.exports = AIService;