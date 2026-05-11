const axios = require('axios');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

async function aiDecision(sub1, sub2) {
    try {
        const prompt = `
You are a coding judge.Compare the following two submissions and decide the winner.
Submission 1:
Code:
${sub1.code}
Runtime: ${sub1.runtimeMs}
Score: ${sub1.score}
Submission 2:
Code:
${sub2.code}
Runtime: ${sub2.runtimeMs}
Score: ${sub2.score}
Return ONLY JSON in this format:
{
  "winner": "1" or "2" or "tie",
  "reason": "short explanation"
}`;
const response = await axios.post(
            'https://api.deepseek.com/v1/chat/completions',
            {
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: 'You are a competitive programming judge.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.2,
            },
            {
                headers: {
                    Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const content = response.data.choices[0].message.content;

        // Parse AI output
        const parsed = JSON.parse(content);

        if (parsed.winner === '1') {
            return { winnerId: sub1.user, reason: 'ai_decision' };
        }

        if (parsed.winner === '2') {
            return { winnerId: sub2.user, reason: 'ai_decision' };
        }

        return { winnerId: null, reason: 'tie' };

    } catch (err) {
        console.error('AI ERROR:', err.message);

        // fallback safety
        return { winnerId: null, reason: 'tie' };
    }
}

module.exports = { aiDecision };