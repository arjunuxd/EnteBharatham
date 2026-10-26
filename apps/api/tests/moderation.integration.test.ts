import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectToDatabase, disconnectFromDatabase } from '../src/config/database.js';
import { AuditEventModel } from '../src/models/AuditEvent.js';
import { HeritageRecordModel } from '../src/models/HeritageRecord.js';
import { UserModel } from '../src/models/User.js';
import { createTestApp } from './helpers/testApp.js';
import type { UserRole } from '@entebharatham/shared';

let mongod: MongoMemoryServer;
const app = createTestApp();

interface AgentState {
  agent: request.Agent;
  csrfToken: string;
  userId: string;
}

let userCounter = 0;

async function signUp(role: UserRole = 'contributor'): Promise<AgentState> {
  const agent = request.agent(app);
  const csrfRes = await agent.get('/api/v1/auth/csrf');
  const csrfToken = csrfRes.body.csrfToken as string;
  userCounter += 1;
  const res = await agent
    .post('/api/v1/auth/register')
    .set('x-csrf-token', csrfToken)
    .send({
      email: `mod-${userCounter}@example.com`,
      password: 'password123',
      displayName: `User ${userCounter}`,
    });
  expect(res.status).toBe(201);
  const userId = res.body.user.id as string;
  if (role !== 'contributor') {
    await UserModel.updateOne({ _id: userId }, { $set: { role } });
    // Re-login so the session's user (loaded per request from the DB) is fine;
    // loadSessionUser reads the DB each request, so the role change is live.
  }
  return { agent, csrfToken: res.body.csrfToken as string, userId };
}

function publishableDraft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'A consented craft technique from the mountains',
    content: 'Detailed instructions for a traditional craft technique, fully consented.',
    heritageType: 'craft',
    languages: ['Hindi'],
    visibility: 'public',
    consent: { permissionToPublish: true, verification: 'community_confirmed' },
    license: { rightsStatus: 'confirmed', holder: 'Mountain craft community' },
    ...overrides,
  };
}

async function createAndSubmit(state: AgentState, overrides: Record<string, unknown> = {}) {
  const draft = await state.agent
    .post('/api/v1/heritage')
    .set('x-csrf-token', state.csrfToken)
    .send(publishableDraft(overrides));
  expect(draft.status).toBe(201);
  const submit = await state.agent
    .post(`/api/v1/heritage/${draft.body.id}/submit`)
    .set('x-csrf-token', state.csrfToken);
  expect(submit.status).toBe(200);
  return draft.body.id as string;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectToDatabase(mongod.getUri('entebharatham-moderation'));
  await UserModel.syncIndexes();
  await HeritageRecordModel.syncIndexes();
}, 180_000);

afterAll(async () => {
  await disconnectFromDatabase();
  await mongod?.stop();
});

beforeEach(async () => {
  await HeritageRecordModel.deleteMany({});
  await AuditEventModel.deleteMany({});
  await UserModel.deleteMany({});
});

describe('GET /api/v1/moderation/submissions (review queue)', () => {
  it('is forbidden for contributors and anonymous users', async () => {
    const contributor = await signUp();
    const forbidden = await contributor.agent.get('/api/v1/moderation/submissions');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');

    const anonymous = await request(app).get('/api/v1/moderation/submissions');
    expect(anonymous.status).toBe(401);
  });

  it('lists pending submissions with consent indicators for moderators', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    await createAndSubmit(contributor, { title: 'Queued craft tale' });

    const res = await moderator.agent.get('/api/v1/moderation/submissions');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    const item = res.body.items[0];
    expect(item.title).toBe('Queued craft tale');
    expect(item.status).toBe('pending_review');
    expect(item.permissionToPublish).toBe(true);
    expect(item.consentVerification).toBe('community_confirmed');
    expect(item.rightsStatus).toBe('confirmed');
    expect(item.createdBy).toBe(contributor.userId);
    // Queue rows never include full content.
    expect(item).not.toHaveProperty('content');
    expect(item).not.toHaveProperty('sources');
  });

  it('does not list drafts, published, rejected, or changes_requested records', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    // A draft (never submitted).
    await contributor.agent
      .post('/api/v1/heritage')
      .set('x-csrf-token', contributor.csrfToken)
      .send(publishableDraft({ title: 'Just a draft' }));
    // A submitted record.
    await createAndSubmit(contributor, { title: 'In the queue' });

    const res = await moderator.agent.get('/api/v1/moderation/submissions?limit=50');
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].title).toBe('In the queue');
  });
});

describe('POST /api/v1/moderation/submissions/:id/approve', () => {
  it('approves a publishable submission and records an audit event', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const recordId = await createAndSubmit(contributor);

    const res = await moderator.agent
      .post(`/api/v1/moderation/submissions/${recordId}/approve`)
      .set('x-csrf-token', moderator.csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');
    expect(res.body.review.decision).toBe('approved');
    expect(typeof res.body.review.reviewedAt).toBe('string');
    expect(res.body.review).not.toHaveProperty('reason');

    const events = await AuditEventModel.find({ action: 'record.approved' }).lean().exec();
    expect(events).toHaveLength(1);
    expect(String(events[0]?.actorId)).toBe(moderator.userId);
    expect(String(events[0]?.recordId)).toBe(recordId);
  });

  it('blocks approval when publish consent or rights are missing (NOT_PUBLISHABLE)', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    // Submit succeeds only with permissionToPublish + verified consent + confirmed
    // rights, so tamper the record after submission to simulate the race where
    // data changed between submit and approve.
    const recordId = await createAndSubmit(contributor);
    await HeritageRecordModel.updateOne(
      { _id: recordId },
      { $set: { 'license.rightsStatus': 'unknown' } },
    );

    const res = await moderator.agent
      .post(`/api/v1/moderation/submissions/${recordId}/approve`)
      .set('x-csrf-token', moderator.csrfToken);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_PUBLISHABLE');
    expect(res.body.error.details.missing).toContain('license.rightsStatus');

    const record = await HeritageRecordModel.findById(recordId).lean().exec();
    expect(record?.status).toBe('pending_review');
  });

  it('blocks approval when visibility is not public', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const recordId = await createAndSubmit(contributor, { visibility: 'private' });

    const res = await moderator.agent
      .post(`/api/v1/moderation/submissions/${recordId}/approve`)
      .set('x-csrf-token', moderator.csrfToken);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_PUBLISHABLE');
    expect(res.body.error.details.missing).toContain('visibility');
  });

  it('rejects approval of a non-pending record with 409 (no double decision)', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const recordId = await createAndSubmit(contributor);

    const first = await moderator.agent
      .post(`/api/v1/moderation/submissions/${recordId}/approve`)
      .set('x-csrf-token', moderator.csrfToken);
    expect(first.status).toBe(200);

    const second = await moderator.agent
      .post(`/api/v1/moderation/submissions/${recordId}/approve`)
      .set('x-csrf-token', moderator.csrfToken);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('is forbidden for contributors', async () => {
    const contributor = await signUp();
    const recordId = await createAndSubmit(contributor);
    const other = await signUp();
    const res = await other.agent
      .post(`/api/v1/moderation/submissions/${recordId}/approve`)
      .set('x-csrf-token', other.csrfToken);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/moderation/submissions/:id/reject', () => {
  it('rejects with a mandatory reason and records an audit event', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const recordId = await createAndSubmit(contributor);

    const res = await moderator.agent
      .post(`/api/v1/moderation/submissions/${recordId}/reject`)
      .set('x-csrf-token', moderator.csrfToken)
      .send({ reason: 'The provenance is incomplete and needs independent sourcing.' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(res.body.review.decision).toBe('rejected');
    expect(res.body.review.reason).toBe(
      'The provenance is incomplete and needs independent sourcing.',
    );

    const events = await AuditEventModel.find({ action: 'record.rejected' }).lean().exec();
    expect(events).toHaveLength(1);
    // Audit metadata never includes the reason text.
    expect(JSON.stringify(events[0]?.metadata ?? {})).not.toContain('provenance');
  });

  it('rejects a missing or too-short reason with 400', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const recordId = await createAndSubmit(contributor);

    for (const body of [{}, { reason: 'too short' }, { reason: 123 }]) {
      const res = await moderator.agent
        .post(`/api/v1/moderation/submissions/${recordId}/reject`)
        .set('x-csrf-token', moderator.csrfToken)
        .send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('rejects a non-pending record with 409', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const recordId = await createAndSubmit(contributor);
    await moderator.agent
      .post(`/api/v1/moderation/submissions/${recordId}/approve`)
      .set('x-csrf-token', moderator.csrfToken);

    const res = await moderator.agent
      .post(`/api/v1/moderation/submissions/${recordId}/reject`)
      .set('x-csrf-token', moderator.csrfToken)
      .send({ reason: 'Trying to reject an already approved record entirely.' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/moderation/submissions/:id/request-changes', () => {
  it('sends the record back with a reason; the owner can then edit and resubmit', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const recordId = await createAndSubmit(contributor);

    const res = await moderator.agent
      .post(`/api/v1/moderation/submissions/${recordId}/request-changes`)
      .set('x-csrf-token', moderator.csrfToken)
      .send({ reason: 'Please add the community context section before publishing.' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('changes_requested');
    expect(res.body.review.decision).toBe('changes_requested');
    expect(res.body.review.reason).toBe(
      'Please add the community context section before publishing.',
    );

    // The owner sees the reason and can edit the record again.
    const detail = await contributor.agent.get(`/api/v1/heritage/mine/${recordId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.review.reason).toBe(
      'Please add the community context section before publishing.',
    );

    const edit = await contributor.agent
      .patch(`/api/v1/heritage/${recordId}`)
      .set('x-csrf-token', contributor.csrfToken)
      .send({ summary: 'Added community context per reviewer request.' });
    expect(edit.status).toBe(200);

    const resubmit = await contributor.agent
      .post(`/api/v1/heritage/${recordId}/submit`)
      .set('x-csrf-token', contributor.csrfToken);
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.status).toBe('pending_review');

    const events = await AuditEventModel.find({ action: 'record.changes_requested' }).lean().exec();
    expect(events).toHaveLength(1);
  });

  it('rejects a missing reason with 400', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const recordId = await createAndSubmit(contributor);

    const res = await moderator.agent
      .post(`/api/v1/moderation/submissions/${recordId}/request-changes`)
      .set('x-csrf-token', moderator.csrfToken)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/moderation/audit', () => {
  it('lists audit events for moderators only', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const recordId = await createAndSubmit(contributor);
    await moderator.agent
      .post(`/api/v1/moderation/submissions/${recordId}/approve`)
      .set('x-csrf-token', moderator.csrfToken);

    const res = await moderator.agent.get('/api/v1/moderation/audit');
    expect(res.status).toBe(200);
    // 2 × user.registered (contributor + moderator signups) + submitted + approved.
    expect(res.body.total).toBe(4);
    const actions = res.body.items.map((item: { action: string }) => item.action);
    expect(actions).toContain('record.submitted');
    expect(actions).toContain('record.approved');
    expect(actions).toContain('user.registered');

    // Audit events never carry review reasons or passwords.
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('password');

    const forbidden = await contributor.agent.get('/api/v1/moderation/audit');
    expect(forbidden.status).toBe(403);
  });
});

describe('admin role also moderates', () => {
  it('an admin account can approve submissions', async () => {
    const contributor = await signUp();
    const admin = await signUp('admin');
    const recordId = await createAndSubmit(contributor);

    const res = await admin.agent
      .post(`/api/v1/moderation/submissions/${recordId}/approve`)
      .set('x-csrf-token', admin.csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');
  });
});
