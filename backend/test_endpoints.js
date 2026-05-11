const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let token = null;

const api = axios.create({ baseURL: BASE_URL });
api.interceptors.request.use(config => {
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

async function runTests() {
  try {
    const timestamp = Date.now();
    const username = `testuser_${timestamp}`;
    const email = `test_${timestamp}@example.com`;
    const password = 'password123';

    console.log('1. Testing Registration...');
    const regRes = await api.post('/auth/register', { username, email, password });
    console.log('Registration Success:', regRes.data.success);
    token = regRes.data.token;
    if (!token) throw new Error('No token returned after registration');

    console.log('2. Testing Login...');
    const loginRes = await api.post('/auth/login', { email, password });
    console.log('Login Success:', loginRes.data.success);
    token = loginRes.data.token;

    console.log('3. Testing /users/me/stats...');
    const statsRes = await api.get('/user/problem-stats');
    console.log('Stats Success:', statsRes.data.success, 'Data keys:', Object.keys(statsRes.data.data));

    console.log('4. Testing /problems...');
    const problemsRes = await api.get('/problems');
    console.log('Problems Success:', problemsRes.data.success, 'Count:', problemsRes.data.items.length);
    
    if (problemsRes.data.items.length > 0) {
      const problem = problemsRes.data.items[0];
      console.log('5. Testing /problems/:slug...', problem.slug);
      const detailRes = await api.get(`/problems/${problem.slug}`);
      console.log('Detail Success:', detailRes.data.success, 'Problem ID:', detailRes.data.data._id);
      
      console.log('6. Testing /problems/:problemId/submissions...', detailRes.data.data._id);
      const probSubsRes = await api.get(`/problems/${detailRes.data.data._id}/submissions`);
      console.log('Problem Submissions Success:', probSubsRes.data.success);
    }

    console.log('7. Testing /submissions/recent...');
    const recentSubsRes = await api.get('/submissions/recent');
    console.log('Recent Submissions Success:', recentSubsRes.data.success);

    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed:', error.response ? error.response.data : error.message);
  }
}

runTests();
