import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectToDatabase, disconnectFromDatabase } from '../src/config/database.js';
import { UserModel } from '../src/models/User.js';
import { createTestApp, createTestEnv } from './helpers/testApp.js';
import { createRateLimiters } from '../src/middleware/rateLimit.js';

let mongod: MongoMemoryServer;

/** Extracts the raw session id from a response's Set-Cookie header. */
function sessionIdFrom(response: request.Response): string | undefined {
  const raw = response.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw !== undefined ? [String(raw)] : [];
  const sessionCookie = cookies.find((cookie) => cookie.startsWith('entebharatham.sid='));
  return sessionCookie?.split(';')[0]?.split('=')[1];
}

async function getCsrf(agent: request.Agent): Promise<string> {
  const res = await agent.get('/api/v1/auth/csrf');
  expect(res.status).toBe(200);
  return res.body.csrfToken as string;
}

async function register(
  agent: request.Agent,
  body: Record<string, unknown>,
  csrfToken: string,
): Promise<request.Response> {
  return agent.post('/api/v1/auth/register').set('x-csrf-token', csrfToken).send(body);
}

async function login(
  agent: request.Agent,
  body: Record<string, unknown>,
  csrfToken: string,
): Promise<request.Response> {
  return agent.post('/api/v1/auth/login').set('x-csrf-token', csrfToken).send(body);
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectToDatabase(mongod.getUri('entebharatham-auth'));
  // Build indexes (including the unique email index) synchronously so
  // duplicate-key behavior is deterministic within tests.
  await UserModel.syncIndexes();
}, 180_000);

afterAll(async () => {
  await disconnectFromDatabase();
  await mongod?.stop();
});

beforeEach(async () => {
  await UserModel.deleteMany({});
});

describe('POST /api/v1/auth/register', () => {
  const app = createTestApp();

  it('registers a contributor, starts a session, and returns a CSRF token', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrf(agent);
    const res = await register(
      agent,
      { email: 'new@example.com', password: 'password123', displayName: 'New User' },
      csrfToken,
    );

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@example.com');
    expect(res.body.user.role).toBe('contributor');
    expect(res.body.user.accountStatus).toBe('active');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(typeof res.body.csrfToken).toBe('string');

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(res.body.user.id);
  });

  it('normalizes email to lowercase', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrf(agent);
    const res = await register(
      agent,
      { email: 'MiXeD@Example.COM', password: 'password123', displayName: 'Mixed Case' },
      csrfToken,
    );
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('mixed@example.com');
  });

  it('rejects duplicate email with 409 and does not leak the account', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrf(agent);
    await register(
      agent,
      { email: 'dup@example.com', password: 'password123', displayName: 'First' },
      csrfToken,
    );

    const second = request.agent(app);
    const csrf2 = await getCsrf(second);
    const res = await register(
      second,
      { email: 'dup@example.com', password: 'password456', displayName: 'Second' },
      csrf2,
    );
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('rejects mass-assignment of privileged fields with 400', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrf(agent);
    const res = await register(
      agent,
      {
        email: 'evil@example.com',
        password: 'password123',
        displayName: 'Evil',
        role: 'admin',
        accountStatus: 'active',
      },
      csrfToken,
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects weak passwords with 400', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrf(agent);
    const res = await register(
      agent,
      { email: 'weak@example.com', password: 'short', displayName: 'Weak' },
      csrfToken,
    );
    expect(res.status).toBe(400);
  });

  it('rejects a request without a CSRF token', async () => {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/v1/auth/register')
      .send({ email: 'nocsrf@example.com', password: 'password123', displayName: 'No CSRF' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });
});

describe('POST /api/v1/auth/login', () => {
  const app = createTestApp();

  beforeEach(async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrf(agent);
    await register(
      agent,
      { email: 'login@example.com', password: 'password123', displayName: 'Login User' },
      csrfToken,
    );
  });

  it('logs in with correct credentials and starts a session', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrf(agent);
    const res = await login(
      agent,
      { email: 'login@example.com', password: 'password123' },
      csrfToken,
    );

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('login@example.com');
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
  });

  it('returns a generic 401 for a wrong password', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrf(agent);
    const res = await login(
      agent,
      { email: 'login@example.com', password: 'wrongpassword' },
      csrfToken,
    );
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns the same generic 401 for an unknown email', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrf(agent);
    const res = await login(
      agent,
      { email: 'nobody@example.com', password: 'password123' },
      csrfToken,
    );
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('regenerates the session id at login (fixation defense)', async () => {
    const agent = request.agent(app);
    const csrfRes = await agent.get('/api/v1/auth/csrf');
    const preLoginSid = sessionIdFrom(csrfRes);
    expect(preLoginSid).toBeDefined();

    const loginRes = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrfRes.body.csrfToken)
      .send({ email: 'login@example.com', password: 'password123' });
    expect(loginRes.status).toBe(200);

    const postLoginSid = sessionIdFrom(loginRes);
    expect(postLoginSid).toBeDefined();
    expect(postLoginSid).not.toBe(preLoginSid);
  });

  it('rotates the CSRF token at login', async () => {
    const agent = request.agent(app);
    const preLoginCsrf = await getCsrf(agent);
    const res = await login(
      agent,
      { email: 'login@example.com', password: 'password123' },
      preLoginCsrf,
    );
    expect(res.status).toBe(200);
    expect(res.body.csrfToken).not.toBe(preLoginCsrf);
  });

  it('rejects suspended accounts with 403 after password verification', async () => {
    await UserModel.updateOne(
      { email: 'login@example.com' },
      { $set: { accountStatus: 'suspended' } },
    );

    const agent = request.agent(app);
    const csrfToken = await getCsrf(agent);
    const res = await login(
      agent,
      { email: 'login@example.com', password: 'password123' },
      csrfToken,
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });
});

describe('GET /api/v1/auth/me and POST /api/v1/auth/logout', () => {
  const app = createTestApp();

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('destroys the session on logout; the dead CSRF token also dies with it', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrf(agent);
    const registerRes = await register(
      agent,
      { email: 'logout@example.com', password: 'password123', displayName: 'Logout User' },
      csrfToken,
    );
    expect(registerRes.status).toBe(201);
    // Registration regenerated the session, so the live CSRF token is the one
    // issued in the register response — not the pre-registration one.
    const liveCsrf = registerRes.body.csrfToken as string;

    const me1 = await agent.get('/api/v1/auth/me');
    expect(me1.status).toBe(200);

    const logoutRes = await agent.post('/api/v1/auth/logout').set('x-csrf-token', liveCsrf);
    expect(logoutRes.status).toBe(204);

    const me2 = await agent.get('/api/v1/auth/me');
    expect(me2.status).toBe(401);

    // A second logout reuses the (now-dead) CSRF token from the destroyed
    // session; csrf-sync rejects it before requireAuth even runs.
    const logout2 = await agent.post('/api/v1/auth/logout').set('x-csrf-token', liveCsrf);
    expect(logout2.status).toBe(403);
    expect(logout2.body.error.code).toBe('CSRF_INVALID');
  });
});

describe('CSRF protection on state-changing routes', () => {
  const app = createTestApp();

  it('rejects a POST /auth/login without a CSRF token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'x@example.com', password: 'password123' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('allows GET requests without a CSRF token', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/auth/register rate limiting', () => {
  // Real default limits (the shared test app raises them for other suites).
  const app = createTestApp(createTestEnv(), { rateLimiters: createRateLimiters() });

  it('returns 429 after exceeding the shared auth rate limit', async () => {
    // The limiter allows 15 register+login attempts per 15 minutes per IP.
    // Each successful register regenerates the session (and rotates the CSRF
    // token), so a fresh token is fetched before every attempt.
    const agent = request.agent(app);

    let lastStatus = 0;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const csrfToken = await getCsrf(agent);
      const res = await register(
        agent,
        { email: `rl-${attempt}@example.com`, password: 'password123', displayName: 'RL' },
        csrfToken,
      );
      lastStatus = res.status;
      if (res.status === 429) break;
    }
    expect(lastStatus).toBe(429);

    // A subsequent login attempt is also throttled (shared counter).
    const loginCsrf = await getCsrf(agent);
    const loginRes = await login(
      agent,
      { email: 'rl-0@example.com', password: 'password123' },
      loginCsrf,
    );
    expect(loginRes.status).toBe(429);
    expect(loginRes.body.error.code).toBe('RATE_LIMITED');
  }, 60_000);
});
