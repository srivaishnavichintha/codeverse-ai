require('dotenv').config();
const Groq = require('groq-sdk');

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = 'llama-3.3-70b-versatile';

// 🧠 Sample user submission (simulate DB data)
const submission = {
  problemTitle: "Two Sum",
  difficulty: "Easy",
  code: `
function twoSum(nums, target) {
  const map = {};
  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i];
    if (map[diff] !== undefined) {
      return [map[diff], i];
    }
    map[nums[i]] = i;
  }
}
`,
};

// 🔥 STEP 1: Analyze code + generate questions
async function generateQuestions() {
  const prompt = `
You are a technical interviewer.

Analyze the following code submission:

Problem: ${submission.problemTitle}
Difficulty: ${submission.difficulty}

Code:
${submission.code}

Generate 3 interview questions:
- 1 conceptual
- 1 optimization-based
- 1 edge-case based

Return JSON format:
{
  "questions": [
    { "type": "concept", "question": "" },
    { "type": "optimization", "question": "" },
    { "type": "edge_case", "question": "" }
  ]
}
`;

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 800,
  });

  const text = res.choices[0].message.content;
  console.log("\n🧠 Generated Questions:\n", text);

  return text;
}

// 🔥 STEP 2: Simulate adaptive follow-up
async function adaptiveQuestion(prevAnswer) {
  const prompt = `
You are an interviewer.

Candidate answered:
"${prevAnswer}"

Ask ONE deeper follow-up question based on this answer.
`;

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 200,
  });

  console.log("\n🔁 Adaptive Question:\n", res.choices[0].message.content);
}

// 🔥 STEP 3: Evaluate answer
async function evaluateAnswer(answer) {
  const prompt = `
Evaluate this candidate answer:

"${answer}"

Return JSON:
{
  "score": (0-10),
  "feedback": "",
  "correct": true/false
}
`;

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 300,
  });

  console.log("\n📊 Evaluation:\n", res.choices[0].message.content);
}

// 🔥 STEP 4: Final Report
async function finalReport() {
  const prompt = `
Generate a final interview report.

Include:
- overallScore (0–100)
- strengths
- weaknesses
- improvement suggestions
`;

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
    max_tokens: 500,
  });

  console.log("\n📄 Final Report:\n", res.choices[0].message.content);
}

// 🚀 RUN FLOW
async function runInterviewSimulation() {
  console.log("🚀 Starting AI Interview Simulation...\n");

  await generateQuestions();

  // Simulated candidate answer
  const sampleAnswer = "I used a hash map to reduce time complexity to O(n).";

  await adaptiveQuestion(sampleAnswer);
  await evaluateAnswer(sampleAnswer);
  await finalReport();

  console.log("\n✅ Interview Simulation Complete");
}

runInterviewSimulation().catch((err) => {
  console.error("❌ Error:", err.message);
});