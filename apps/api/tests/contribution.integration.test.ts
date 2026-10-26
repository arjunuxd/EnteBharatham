import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectToDatabase, disconnectFromDatabase } from '../src/config/database.js';
import { HeritageRecordModel } from '../src/models/HeritageRecord.js';
import { HeritageMediaModel } from '../src/models/HeritageMedia.js';
import { AuditEventModel } from '../src/models/AuditEvent.js';
import { UserModel } from '../src/models/User.js';
import { createTestApp } from './helpers/testApp.js';

let mongod: MongoMemoryServer;
const app = createTestApp();

interface AgentState {
  agent: request.Agent;
  csrfToken: string;
  userId: string;
  email: string;
}

let userCounter = 0;

async function signUp(): Promise<AgentState> {
  const agent = request.agent(app);
  const csrfRes = await agent.get('/api/v1/auth/csrf');
  const csrfToken = csrfRes.body.csrfToken as string;
  userCounter += 1;
  const email = `contributor-${userCounter}@example.com`;
  const res = await agent
    .post('/api/v1/auth/register')
    .set('x-csrf-token', csrfToken)
    .send({ email, password: 'password123', displayName: `Contributor ${userCounter}` });
  expect(res.status).toBe(201);
  return {
    agent,
    csrfToken: res.body.csrfToken as string,
    userId: res.body.user.id as string,
    email,
  };
}

function validDraft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'A test folk tale from the hills',
    summary: 'A short summary of the tale.',
    content: 'Once upon a time in a fictional village, a lamp keeper told a story.',
    heritageType: 'folk_story',
    languages: ['Hindi'],
    region: { country: 'India', state: 'Himachal Pradesh' },
    tags: ['test', 'folk-tale'],
    ...overrides,
  };
}

async function createDraft(state: AgentState, overrides: Record<string, unknown> = {}) {
  const res = await state.agent
    .post('/api/v1/heritage')
    .set('x-csrf-token', state.csrfToken)
    .send(validDraft(overrides));
  return res;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectToDatabase(mongod.getUri('entebharatham-contribution'));
  await UserModel.syncIndexes();
  await HeritageRecordModel.syncIndexes();
}, 180_000);

afterAll(async () => {
  await disconnectFromDatabase();
  await mongod?.stop();
});

beforeEach(async () => {
  await HeritageMediaModel.deleteMany({});
  await HeritageRecordModel.deleteMany({});
  await AuditEventModel.deleteMany({});
});

describe('POST /api/v1/heritage (create draft)', () => {
  it('creates a draft owned by the authenticated user, defaulting to private', async () => {
    const state = await signUp();
    const res = await createDraft(state);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');
    expect(res.body.visibility).toBe('private');
    expect(res.body.isFictionalSample).toBe(false);
    expect(res.body.slug).toMatch(/^a-test-folk-tale-from-the-hills$/);
    expect(res.body).not.toHaveProperty('createdBy');
    expect(res.body).not.toHaveProperty('_id');
  });

  it('rejects unauthenticated creation with 401', async () => {
    const agent = request.agent(app);
    const csrfRes = await agent.get('/api/v1/auth/csrf');
    const res = await agent
      .post('/api/v1/heritage')
      .set('x-csrf-token', csrfRes.body.csrfToken)
      .send(validDraft());
    expect(res.status).toBe(401);
  });

  it('rejects lifecycle and privileged fields with 400 (strict schema)', async () => {
    const state = await signUp();
    for (const extra of [
      { status: 'published' },
      { createdBy: 'someone-else' },
      { isFictionalSample: true },
      { review: { decision: 'approved' } },
      { submittedAt: new Date().toISOString() },
    ]) {
      const res = await createDraft(state, extra);
      expect(res.status, JSON.stringify(extra)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects missing required fields with 400', async () => {
    const state = await signUp();
    const res = await state.agent
      .post('/api/v1/heritage')
      .set('x-csrf-token', state.csrfToken)
      .send({ title: 'Only a title' });
    expect(res.status).toBe(400);
  });

  it('generates a unique slug when the title collides', async () => {
    const state = await signUp();
    const first = await createDraft(state);
    expect(first.status).toBe(201);
    const second = await createDraft(state);
    expect(second.status).toBe(201);
    expect(second.body.slug).not.toBe(first.body.slug);
    expect(second.body.slug).toMatch(/^a-test-folk-tale-from-the-hills-\d+$/);
  });
});

describe('PATCH /api/v1/heritage/:id (edit draft)', () => {
  it('updates editable fields and merges nested consent/license blocks', async () => {
    const state = await signUp();
    const draft = await createDraft(state, {
      consent: { permissionToPublish: true, verification: 'community_confirmed' },
      license: { rightsStatus: 'confirmed' },
    });
    expect(draft.status).toBe(201);
    const id = draft.body.id as string;

    // Partial consent patch must not wipe permissionToPublish.
    const patch = await state.agent
      .patch(`/api/v1/heritage/${id}`)
      .set('x-csrf-token', state.csrfToken)
      .send({ consent: { restrictions: 'No commercial use' }, title: 'An updated title' });

    expect(patch.status).toBe(200);
    expect(patch.body.title).toBe('An updated title');
    expect(patch.body.consent.permissionToPublish).toBe(true);
    expect(patch.body.consent.verification).toBe('community_confirmed');
    expect(patch.body.consent.restrictions).toBe('No commercial use');
    expect(patch.body.license.rightsStatus).toBe('confirmed');
  });

  it('rejects an edit by a different authenticated contributor with 404', async () => {
    const owner = await signUp();
    const draft = await createDraft(owner);
    const intruder = await signUp();

    const res = await intruder.agent
      .patch(`/api/v1/heritage/${draft.body.id}`)
      .set('x-csrf-token', intruder.csrfToken)
      .send({ title: 'Hijacked title' });
    // Non-disclosing: identical to a missing record.
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    const original = await HeritageRecordModel.findById(draft.body.id).lean().exec();
    expect(original?.title).toBe(validDraft().title);
  });

  it('rejects edits once the record is pending_review', async () => {
    const state = await signUp();
    const draft = await createDraft(state, {
      consent: { permissionToPublish: true, verification: 'community_confirmed' },
      license: { rightsStatus: 'confirmed' },
    });
    const id = draft.body.id as string;
    const submit = await state.agent
      .post(`/api/v1/heritage/${id}/submit`)
      .set('x-csrf-token', state.csrfToken);
    expect(submit.status).toBe(200);

    const res = await state.agent
      .patch(`/api/v1/heritage/${id}`)
      .set('x-csrf-token', state.csrfToken)
      .send({ title: 'Too late to edit' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('rejects an empty patch with 400', async () => {
    const state = await signUp();
    const draft = await createDraft(state);
    const res = await state.agent
      .patch(`/api/v1/heritage/${draft.body.id}`)
      .set('x-csrf-token', state.csrfToken)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/heritage/:id/submit (submit for review)', () => {
  async function draftWithConsent(state: AgentState) {
    return createDraft(state, {
      content: 'A fully consented tale with enough content to submit for review.',
      consent: { permissionToPublish: true, verification: 'community_confirmed' },
      license: { rightsStatus: 'confirmed' },
    });
  }

  it('transitions a ready draft to pending_review and records the time', async () => {
    const state = await signUp();
    const draft = await draftWithConsent(state);
    const id = draft.body.id as string;

    const res = await state.agent
      .post(`/api/v1/heritage/${id}/submit`)
      .set('x-csrf-token', state.csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending_review');
    expect(typeof res.body.submittedAt).toBe('string');
  });

  it('records a record.submitted audit event', async () => {
    const state = await signUp();
    const draft = await draftWithConsent(state);
    await state.agent
      .post(`/api/v1/heritage/${draft.body.id}/submit`)
      .set('x-csrf-token', state.csrfToken);

    const events = await AuditEventModel.find({ action: 'record.submitted' }).lean().exec();
    expect(events).toHaveLength(1);
    expect(String(events[0]?.actorId)).toBe(state.userId);
    expect(String(events[0]?.recordId)).toBe(draft.body.id);
    expect(events[0]?.metadata).toEqual({ statusAfter: 'pending_review' });
  });

  it('blocks submission without publish consent and reports what is missing', async () => {
    const state = await signUp();
    const draft = await createDraft(state, {
      consent: { permissionToPublish: false, verification: 'community_confirmed' },
      license: { rightsStatus: 'confirmed' },
    });

    const res = await state.agent
      .post(`/api/v1/heritage/${draft.body.id}/submit`)
      .set('x-csrf-token', state.csrfToken);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SUBMISSION_INCOMPLETE');
    expect(res.body.error.details.missing).toContain('consent.permissionToPublish');
  });

  it('blocks submission with unverified consent, unknown rights, or thin content', async () => {
    const state = await signUp();
    const draft = await createDraft(state, {
      content: 'short',
      consent: { permissionToPublish: true, verification: 'unverified' },
      license: { rightsStatus: 'unknown' },
    });

    const res = await state.agent
      .post(`/api/v1/heritage/${draft.body.id}/submit`)
      .set('x-csrf-token', state.csrfToken);

    expect(res.status).toBe(422);
    const missing = res.body.error.details.missing as string[];
    expect(missing).toContain('consent.verification');
    expect(missing).toContain('license.rightsStatus');
    expect(missing).toContain('content');
  });

  it('rejects submission by a non-owner with 404', async () => {
    const owner = await signUp();
    const draft = await draftWithConsent(owner);
    const intruder = await signUp();

    const res = await intruder.agent
      .post(`/api/v1/heritage/${draft.body.id}/submit`)
      .set('x-csrf-token', intruder.csrfToken);
    expect(res.status).toBe(404);
  });

  it('rejects double submission with 409', async () => {
    const state = await signUp();
    const draft = await draftWithConsent(state);
    const id = draft.body.id as string;

    const first = await state.agent
      .post(`/api/v1/heritage/${id}/submit`)
      .set('x-csrf-token', state.csrfToken);
    expect(first.status).toBe(200);

    const second = await state.agent
      .post(`/api/v1/heritage/${id}/submit`)
      .set('x-csrf-token', state.csrfToken);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('INVALID_TRANSITION');
  });
});

describe('GET /api/v1/heritage/mine (owner dashboard list)', () => {
  it('lists only the authenticated contributor’s own records', async () => {
    const alice = await signUp();
    const bob = await signUp();
    await createDraft(alice, { title: 'Alice first tale' });
    await createDraft(alice, { title: 'Alice second tale' });
    await createDraft(bob, { title: 'Bob only tale' });

    const res = await alice.agent.get('/api/v1/heritage/mine');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const titles = res.body.items.map((item: { title: string }) => item.title);
    expect(titles).toContain('Alice first tale');
    expect(titles).toContain('Alice second tale');
    expect(titles).not.toContain('Bob only tale');
  });

  it('filters by status', async () => {
    const state = await signUp();
    await createDraft(state, { title: 'Ready to submit' });
    const pending = await createDraft(state, {
      title: 'Already submitted',
      consent: { permissionToPublish: true, verification: 'community_confirmed' },
      license: { rightsStatus: 'confirmed' },
    });
    await state.agent
      .post(`/api/v1/heritage/${pending.body.id}/submit`)
      .set('x-csrf-token', state.csrfToken);

    const res = await state.agent.get('/api/v1/heritage/mine?status=pending_review');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].title).toBe('Already submitted');
    expect(res.body.items[0].status).toBe('pending_review');
  });

  it('returns 401 for anonymous requests', async () => {
    const res = await request(app).get('/api/v1/heritage/mine');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/heritage/mine/:id (owner detail view)', () => {
  it('returns the full detail including consent, license, and review info', async () => {
    const state = await signUp();
    const draft = await createDraft(state, {
      consent: { permissionToPublish: true, verification: 'community_confirmed' },
      license: { rightsStatus: 'confirmed', holder: 'The fictional community' },
    });
    const res = await state.agent.get(`/api/v1/heritage/mine/${draft.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.consent.permissionToPublish).toBe(true);
    expect(res.body.license.holder).toBe('The fictional community');
  });

  it('returns a non-disclosing 404 for another contributor’s record', async () => {
    const owner = await signUp();
    const draft = await createDraft(owner);
    const intruder = await signUp();
    const res = await intruder.agent.get(`/api/v1/heritage/mine/${draft.body.id}`);
    expect(res.status).toBe(404);
  });

  it('rejects a malformed record id with 400', async () => {
    const state = await signUp();
    const res = await state.agent.get('/api/v1/heritage/mine/not-an-object-id');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/v1/heritage/:id (owner deletion)', () => {
  async function remove(state: AgentState, id: string) {
    return state.agent.delete(`/api/v1/heritage/${id}`).set('x-csrf-token', state.csrfToken);
  }

  it('deletes an owned draft and records an audit event', async () => {
    const state = await signUp();
    const draft = await createDraft(state);
    const id = draft.body.id as string;

    const res = await remove(state, id);

    expect(res.status).toBe(204);
    expect(await HeritageRecordModel.findById(id).lean().exec()).toBeNull();

    const events = await AuditEventModel.find({ action: 'record.deleted' }).lean().exec();
    expect(events).toHaveLength(1);
    expect(String(events[0]?.actorId)).toBe(state.userId);
    expect(String(events[0]?.recordId)).toBe(id);
    expect(events[0]?.metadata).toEqual({ statusBefore: 'draft' });
  });

  it('allows deletion from other private or unpublished statuses', async () => {
    const state = await signUp();
    for (const status of ['changes_requested', 'pending_review', 'rejected'] as const) {
      const draft = await createDraft(state);
      const id = draft.body.id as string;
      await HeritageRecordModel.updateOne({ _id: id }, { $set: { status } }).exec();

      const res = await remove(state, id);
      expect(res.status, status).toBe(204);
      expect(await HeritageRecordModel.findById(id).lean().exec()).toBeNull();
    }
  });

  it('removes attached media rows with the record', async () => {
    const state = await signUp();
    const draft = await createDraft(state);
    const id = draft.body.id as string;

    await HeritageMediaModel.create({
      heritageRecordId: id,
      storageKey: `media_delete_test_${Date.now()}.png`,
      verifiedMediaType: 'image',
      mediaType: 'image/png',
      detectedMime: 'image/png',
      size: 12,
      displayName: 'test.png',
      safeDisplayName: 'test.png',
      category: 'photograph',
      uploaderId: state.userId,
      lifecycleState: 'uploaded',
    });

    const res = await remove(state, id);

    expect(res.status).toBe(204);
    expect(await HeritageMediaModel.countDocuments({ heritageRecordId: id })).toBe(0);
  });

  it('rejects deletion by another contributor with a non-disclosing 404', async () => {
    const owner = await signUp();
    const draft = await createDraft(owner);
    const intruder = await signUp();

    const res = await remove(intruder, draft.body.id as string);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(await HeritageRecordModel.findById(draft.body.id).lean().exec()).not.toBeNull();
  });

  it('refuses to delete a published record and points to withdrawal', async () => {
    const state = await signUp();
    const draft = await createDraft(state);
    const id = draft.body.id as string;
    await HeritageRecordModel.updateOne({ _id: id }, { $set: { status: 'published' } }).exec();

    const res = await remove(state, id);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('WITHDRAWAL_REQUIRED');
    expect(await HeritageRecordModel.findById(id).lean().exec()).not.toBeNull();
    expect(await AuditEventModel.countDocuments({ action: 'record.deleted' })).toBe(0);
  });

  it('rejects anonymous deletion with 401', async () => {
    const state = await signUp();
    const draft = await createDraft(state);

    const anonymous = request.agent(app);
    const csrfRes = await anonymous.get('/api/v1/auth/csrf');
    const res = await anonymous
      .delete(`/api/v1/heritage/${draft.body.id}`)
      .set('x-csrf-token', csrfRes.body.csrfToken);

    expect(res.status).toBe(401);
    expect(await HeritageRecordModel.findById(draft.body.id).lean().exec()).not.toBeNull();
  });

  it('rejects a malformed record id with 400', async () => {
    const state = await signUp();
    const res = await remove(state, 'not-an-object-id');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
