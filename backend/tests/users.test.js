const request = require('supertest');
const app     = require('../src/app');

// These are integration tests — requires a running test DB.
// Set TEST_DB_NAME in .env for isolated test database.

describe('Auth Endpoints', () => {
  let accessToken, refreshToken;

  const testUser = {
    username:    `testuser_${Date.now()}`,
    email:       `test_${Date.now()}@codeverse.dev`,
    password:    'TestPass@123',
    display_name: 'Test User',
  };

  it('POST /api/v1/auth/register — should create a new user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe(testUser.username);
    expect(res.body.data.password_hash).toBeUndefined();
  });

  it('POST /api/v1/auth/register — rejects duplicate email', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect(409);
  });

  it('POST /api/v1/auth/login — returns tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    accessToken  = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('POST /api/v1/auth/login — rejects wrong password', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'WrongPassword' })
      .expect(401);
  });

  it('GET /api/v1/users/me — returns authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.username).toBe(testUser.username);
  });

  it('GET /api/v1/users/me — rejects without token', async () => {
    await request(app).get('/api/v1/users/me').expect(401);
  });

  it('POST /api/v1/auth/refresh — returns new tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body.data.accessToken).toBeDefined();
  });

  it('PATCH /api/v1/users/me — updates profile', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ bio: 'I love competitive programming!', country: 'India' })
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});

describe('User Stats & Leaderboard', () => {
  it('GET /api/v1/users/leaderboard — returns paginated results', async () => {
    const res = await request(app)
      .get('/api/v1/users/leaderboard?limit=10')
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeDefined();
  });
});
