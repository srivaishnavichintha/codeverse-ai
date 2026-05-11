require('dotenv').config();
const Groq = require('groq-sdk');

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function test() {
  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
    max_tokens: 50,
  });
  console.log('✅ Groq working:', response.choices[0].message.content);
}

test().catch(err => console.error('❌ Groq error:', err.message));