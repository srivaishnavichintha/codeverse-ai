const fs = require('fs');
let code = fs.readFileSync('src/controllers/codeController.js', 'utf8');
code = code.replace(
  /async function runOnJudge0[\s\S]*?return res\.data;\r?\n}/,
  `async function runOnJudge0(sourceCode, languageId, stdin) {
  try {
    const res = await axios.post(
      \`\${JUDGE0_URL}/submissions?base64_encoded=false&wait=true\`,
      {
        source_code: sourceCode,
        language_id: languageId,
        stdin: stdin || '',
        cpu_time_limit:    process.env.JUDGE0_CPU_TIME_LIMIT    || 2,
        memory_limit:      process.env.JUDGE0_MEMORY_LIMIT      || 262144,
      },
      { headers: judge0Headers(), timeout: 30000 }
    );
    return res.data;
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    console.error('Judge0 API Error:', errMsg);
    return {
      stdout: null,
      time: null,
      memory: null,
      stderr: 'Compiler API Error: ' + errMsg + '\\n\\nPlease verify your RapidAPI subscription or API limits.',
      compile_output: null,
      message: null,
      status: {
        id: 13,
        description: 'API Error'
      }
    };
  }
}`
);
fs.writeFileSync('src/controllers/codeController.js', code, 'utf8');
console.log('Replaced successfully.');
