import type { Server } from 'http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectToDatabase, disconnectFromDatabase } from '../src/config/database.js';
import { createRateLimiters } from '../src/middleware/rateLimit.js';
import { AuditEventModel } from '../src/models/AuditEvent.js';
import { TokenModel } from '../src/models/Token.js';
import { UserModel } from '../src/models/User.js';
import { DevTestEmailTransport, type EmailTransport } from '../src/services/email/transport.js';
import { closeServer, listen } from './helpers/servers.js';
import { createTestApp, createTestEnv } from './helpers/testApp.js';

/**
 * Account recovery end-to-end coverage. Email delivery is a real code path but
 * an injected in-memory transport, never a network SMTP connection.
 */

let mongod: MongoMemoryServer;
let emails: DevTestEmailTransport;
let server: Server;
const extraServers: Server[] = [];
let userCounter = 0;

class FailingTransport implements EmailTransport {
  async send(): Promise<void> {
    throw new Error('synthetic delivery failure');
  }
}

function extractToken(text: string): string {
  const match = /[?&]token=([^&\s]+)/.exec(text);
  if (match?.[1] === undefined) throw new Error('No token in email');
  return decodeURIComponent(match[1]);
}

async function csrf(agent: request.Agent): Promise<string> {
  const res = await agent.get('/api/v1/auth/csrf');
  expect(res.status).toBe(200);
  return res.body.csrfToken as string;
}

/**
 * Sends a CSRF-protected JSON request. The token (and its session cookie) must
 * be fetched before the request object is created, otherwise SuperTest attaches
 * the cookie jar from the previous state.
 */
async function post(
  agent: request.Agent,
  path: string,
  body: Record<string, unknown>,
): Promise<request.Response> {
  const token = await csrf(agent);
  return agent.post(path).set('x-csrf-token', token).send(body);
}

async function register(
  agent: request.Agent,
  email: string,
  password = 'password123',
): Promise<string> {
  userCounter += 1;
  const res = await post(agent, '/api/v1/auth/register', {
    email,
    password,
    displayName: `Recovery User ${userCounter}`,
  });
  expect(res.status).toBe(201);
  return res.body.user.id as string;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectToDatabase(mongod.getUri('entebharatham-account'));
  await UserModel.syncIndexes();
  await TokenModel.syncIndexes();
}, 180_000);

afterAll(async () => {
  await disconnectFromDatabase();
  await mongod?.stop();
});

beforeEach(async () => {
  emails = new DevTestEmailTransport();
  const app = createTestApp(createTestEnv(), { emailTransport: emails });
  server = await listen(app);
  await UserModel.deleteMany({});
  await TokenModel.deleteMany({});
  await AuditEventModel.deleteMany({});
});

afterEach(async () => {
  await closeServer(server);
  await Promise.all(extraServers.splice(0).map((extra) => closeServer(extra)));
});

describe('email verification', () => {
  it('sends a single-use link and marks the account verified', async () => {
    const agent = request.agent(server);
    await register(agent, 'verify@example.com');

    const requestRes = await post(agent, '/api/v1/account/verify-email/request', {
      email: 'verify@example.com',
    });
    expect(requestRes.status).toBe(200);
    expect(requestRes.body.message).toMatch(/If an account exists/);
    expect(emails.getSent()).toHaveLength(1);
    expect(emails.getSent()[0]?.to).toBe('verify@example.com');

    const token = extractToken(emails.getSent()[0]?.text ?? '');
    const confirm = await post(agent, '/api/v1/account/verify-email/confirm', { token });
    expect(confirm.status).toBe(200);
    expect(confirm.body.message).toMatch(/verified/i);

    const user = await UserModel.findOne({ email: 'verify@example.com' }).exec();
    expect(user?.emailVerified).toBe(true);
    expect(user?.emailVerifiedAt).toBeInstanceOf(Date);

    // Same token cannot be replayed.
    const replay = await post(agent, '/api/v1/account/verify-email/confirm', { token });
    expect(replay.status).toBe(400);
    expect(replay.body.error.code).toBe('TOKEN_INVALID');
  });

  it('returns the same response for an unknown address and sends nothing', async () => {
    const agent = request.agent(server);
    const res = await post(agent, '/api/v1/account/verify-email/request', {
      email: 'nobody@example.com',
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an account exists/);
    expect(emails.getSent()).toHaveLength(0);
  });

  it('does not send a second email to an already verified account', async () => {
    const agent = request.agent(server);
    await register(agent, 'already@example.com');
    await UserModel.updateOne({ email: 'already@example.com' }, { $set: { emailVerified: true } });

    const res = await post(agent, '/api/v1/account/verify-email/request', {
      email: 'already@example.com',
    });
    expect(res.status).toBe(200);
    expect(emails.getSent()).toHaveLength(0);
  });
});

describe('password reset', () => {
  it('rotates the password, invalidates existing sessions, and refuses token reuse', async () => {
    const userAgent = request.agent(server);
    const userId = await register(userAgent, 'reset@example.com', 'original-password');
    expect((await userAgent.get('/api/v1/auth/me')).status).toBe(200);

    const requestRes = await post(userAgent, '/api/v1/account/password-reset/request', {
      email: 'RESET@example.com',
    });
    expect(requestRes.status).toBe(200);
    expect(requestRes.body.message as string).toMatch(/If an account exists/);
    expect(emails.getSent()).toHaveLength(1);
    const token = extractToken(emails.getSent()[0]?.text ?? '');

    const resetAgent = request.agent(server);
    const reset = await post(resetAgent, '/api/v1/account/password-reset/confirm', {
      token,
      newPassword: 'brand-new-password',
    });
    expect(reset.status).toBe(200);

    // Every pre-existing session is now unauthenticated.
    const me = await userAgent.get('/api/v1/auth/me');
    expect(me.status).toBe(401);

    const user = await UserModel.findById(userId).exec();
    expect(user?.credentialVersion).toBe(1);

    // Old credentials no longer work; the new password does.
    const oldLogin = request.agent(server);
    const oldRes = await post(oldLogin, '/api/v1/auth/login', {
      email: 'reset@example.com',
      password: 'original-password',
    });
    expect(oldRes.status).toBe(401);

    const newLogin = request.agent(server);
    const newRes = await post(newLogin, '/api/v1/auth/login', {
      email: 'reset@example.com',
      password: 'brand-new-password',
    });
    expect(newRes.status).toBe(200);

    // The reset token is single-use.
    const replay = await post(resetAgent, '/api/v1/account/password-reset/confirm', {
      token,
      newPassword: 'another-password',
    });
    expect(replay.status).toBe(400);
  });

  it('rejects expired tokens', async () => {
    const agent = request.agent(server);
    await register(agent, 'expired@example.com');
    await post(agent, '/api/v1/account/password-reset/request', {
      email: 'expired@example.com',
    });
    const token = extractToken(emails.getSent()[0]?.text ?? '');

    await TokenModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const confirmAgent = request.agent(server);
    const confirm = await post(confirmAgent, '/api/v1/account/password-reset/confirm', {
      token,
      newPassword: 'brand-new-password',
    });
    expect(confirm.status).toBe(400);
  });

  it('revokes the token when delivery fails and still answers generically', async () => {
    const failingApp = createTestApp(createTestEnv(), {
      emailTransport: new FailingTransport(),
    });
    const failingServer = await listen(failingApp);
    extraServers.push(failingServer);
    const agent = request.agent(failingServer);
    await register(agent, 'undeliverable@example.com');

    const res = await post(agent, '/api/v1/account/password-reset/request', {
      email: 'undeliverable@example.com',
    });
    expect(res.status).toBe(200);
    expect(res.body.message as string).toMatch(/If an account exists/);
    expect(await TokenModel.countDocuments({ purpose: 'password_reset' })).toBe(0);
  });

  it('only stores a hash of the token', async () => {
    const agent = request.agent(server);
    await register(agent, 'hash@example.com');
    await post(agent, '/api/v1/account/password-reset/request', {
      email: 'hash@example.com',
    });
    const token = extractToken(emails.getSent()[0]?.text ?? '');

    const stored = await TokenModel.findOne({ purpose: 'password_reset' }).exec();
    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).not.toBe(token);
    expect(stored?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rate-limits repeated recovery requests from one client', async () => {
    const limitedApp = createTestApp(createTestEnv(), {
      emailTransport: emails,
      rateLimiters: createRateLimiters({ accountRecovery: 2 }),
    });
    const limitedServer = await listen(limitedApp);
    extraServers.push(limitedServer);
    const agent = request.agent(limitedServer);
    const token = await csrf(agent);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const allowed = await agent
        .post('/api/v1/account/password-reset/request')
        .set('x-csrf-token', token)
        .send({ email: `unknown-${attempt}@example.com` });
      expect(allowed.status).toBe(200);
    }

    const limited = await agent
      .post('/api/v1/account/password-reset/request')
      .set('x-csrf-token', token)
      .send({ email: 'unknown-final@example.com' });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });
});
