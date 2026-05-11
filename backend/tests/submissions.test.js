const request = require('supertest');
const app     = require('../src/app');

describe('Problems Endpoints', () => {
  it('GET /api/v1/problems — returns problem list', async () => {
    const res = await request(app)
      .get('/api/v1/problems')
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeDefined();
  });

  it('GET /api/v1/problems — filters by difficulty=easy', async () => {
    const res = await request(app)
      .get('/api/v1/problems?difficulty=easy')
      .expect(200);

    res.body.data.forEach(p => expect(p.difficulty).toBe('easy'));
  });

  it('GET /api/v1/problems/:slug — returns problem detail with examples', async () => {
    const res = await request(app)
      .get('/api/v1/problems/two-sum')
      .expect(200);

    const p = res.body.data;
    expect(p.slug).toBe('two-sum');
    expect(p.examples).toBeInstanceOf(Array);
    expect(p.visible_test_cases).toBeInstanceOf(Array);
    // Hidden test cases must NEVER appear
    p.visible_test_cases?.forEach(tc => {
      expect(tc.visibility).not.toBe('hidden');
    });
  });

  it('GET /api/v1/problems/tags — returns all tags', async () => {
    const res = await request(app)
      .get('/api/v1/problems/tags')
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data[0]).toHaveProperty('name');
    expect(res.body.data[0]).toHaveProperty('slug');
  });

  it('POST /api/v1/problems — rejects unauthenticated', async () => {
    await request(app)
      .post('/api/v1/problems')
      .send({ title: 'Hack', difficulty: 'easy' })
      .expect(401);
  });
});

describe('Submissions Endpoints', () => {
  let accessToken;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@codeverse.dev', password: 'Admin@123' });
    accessToken = res.body.data?.accessToken;
  });

  it('POST /api/v1/submissions — creates pending submission', async () => {
    if (!accessToken) return;
    const res = await request(app)
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        problem_slug: 'two-sum',
        language:     'python',
        source_code:  'def twoSum(nums, target):\n    seen={}\n    for i,n in enumerate(nums):\n        if target-n in seen: return [seen[target-n],i]\n        seen[n]=i',
      })
      .expect(202);

    expect(res.body.data.verdict).toBe('pending');
    expect(res.body.data.id).toBeDefined();
  });

  it('GET /api/v1/submissions/me — lists user submissions', async () => {
    if (!accessToken) return;
    const res = await request(app)
      .get('/api/v1/submissions/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
  });

  it('GET /api/v1/submissions/problem/:id/fastest — leaderboard', async () => {
    const problems = await request(app).get('/api/v1/problems?difficulty=easy');
    const firstId  = problems.body.data?.[0]?.id;
    if (!firstId) return;

    const res = await request(app)
      .get(`/api/v1/submissions/problem/${firstId}/fastest`)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
  });
});
