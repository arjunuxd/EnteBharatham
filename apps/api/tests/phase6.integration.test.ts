import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserRole } from '@entebharatham/shared';
import { connectToDatabase, disconnectFromDatabase } from '../src/config/database.js';
import { AuditEventModel } from '../src/models/AuditEvent.js';
import { HeritageRecordModel } from '../src/models/HeritageRecord.js';
import { ReviewFeedbackModel } from '../src/models/ReviewFeedback.js';
import { UserModel } from '../src/models/User.js';
import { createRateLimiters } from '../src/middleware/rateLimit.js';
import { createTestApp, createTestEnv } from './helpers/testApp.js';

let mongod: MongoMemoryServer;
const app = createTestApp(createTestEnv(), {
  rateLimiters: createRateLimiters({
    authAttempts: 10_000,
    createDraft: 10_000,
    submitForReview: 10_000,
    moderationActions: 10_000,
    publicReports: 10_000,
  }),
});

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
      email: `phase6-${userCounter}@example.com`,
      password: 'password123',
      displayName: `Phase6 ${userCounter}`,
    });
  expect(res.status).toBe(201);
  const userId = res.body.user.id as string;
  if (role !== 'contributor') {
    await UserModel.updateOne({ _id: userId }, { $set: { role } });
  }
  return { agent, csrfToken: res.body.csrfToken as string, userId };
}

/** A draft that satisfies every publication condition. */
function publishableDraft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'The lamp keeper of the coastal village',
    summary: 'A short account of the lamp keeper told along the coast.',
    content:
      'Every evening the lamp keeper climbed the old stone steps and lit the beacon that guided the fishing boats home.',
    heritageType: 'folk_story',
    languages: ['Malayalam'],
    region: { country: 'India', state: 'Kerala' },
    tags: ['coast', 'lamps'],
    visibility: 'public',
    sources: [
      {
        sourceType: 'oral_account',
        description: 'Told by the harbour master',
        collectedOn: '2026-01-15',
        context: 'Evening gathering at the harbour',
      },
    ],
    contributors: [{ name: 'Harbour Master', role: 'storyteller' }],
    consent: { permissionToPublish: true, verification: 'community_confirmed' },
    license: { rightsStatus: 'confirmed', holder: 'The coastal community' },
    ...overrides,
  };
}

async function createDraft(state: AgentState, overrides: Record<string, unknown> = {}) {
  const res = await state.agent
    .post('/api/v1/heritage')
    .set('x-csrf-token', state.csrfToken)
    .send(publishableDraft(overrides));
  expect(res.status).toBe(201);
  return res.body.id as string;
}

/** Creates, submits, and publishes a record as a moderator would. */
async function publishRecord(
  contributor: AgentState,
  moderator: AgentState,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; slug: string }> {
  const id = await createDraft(contributor, overrides);
  const submit = await contributor.agent
    .post(`/api/v1/heritage/${id}/submit`)
    .set('x-csrf-token', contributor.csrfToken);
  expect(submit.status).toBe(200);
  const approve = await moderator.agent
    .post(`/api/v1/moderation/submissions/${id}/approve`)
    .set('x-csrf-token', moderator.csrfToken);
  expect(approve.status, JSON.stringify(approve.body)).toBe(200);
  const slug = await slugFor(id);
  return { id, slug };
}

/** The public archive addresses records by slug, not by id. */
async function slugFor(id: string): Promise<string> {
  const doc = await HeritageRecordModel.findById(id).lean().exec();
  return doc?.slug ?? '';
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectToDatabase(mongod.getUri('entebharatham-phase6'));
  await UserModel.syncIndexes();
  await HeritageRecordModel.syncIndexes();
  await ReviewFeedbackModel.syncIndexes();
}, 180_000);

afterAll(async () => {
  await disconnectFromDatabase();
  await mongod?.stop();
});

beforeEach(async () => {
  await HeritageRecordModel.deleteMany({});
  await AuditEventModel.deleteMany({});
  await ReviewFeedbackModel.deleteMany({});
  await UserModel.deleteMany({});
});

describe('GET /api/v1/heritage/mine/:id/quality (deterministic checks)', () => {
  it('returns findings and counts without any score', async () => {
    const state = await signUp();
    const id = await createDraft(state, {
      content: 'short',
      consent: { permissionToPublish: false, verification: 'unverified' },
      license: { rightsStatus: 'unknown' },
    });

    const res = await state.agent.get(`/api/v1/heritage/mine/${id}/quality`);

    expect(res.status).toBe(200);
    expect(res.body.quality.findings).toBeInstanceOf(Array);
    expect(res.body.quality.blocking).toBe(true);
    expect(res.body.quality.blockerCount).toBeGreaterThan(0);
    // The report is a list of findings, never a weighted score.
    expect(res.body.quality).not.toHaveProperty('score');
    expect(res.body.quality).not.toHaveProperty('rating');

    const codes = (res.body.quality.findings as Array<{ code: string }>).map(
      (finding) => finding.code,
    );
    expect(codes).toContain('content.too_short');
    expect(codes).toContain('consent.publish_permission_missing');
    expect(codes).toContain('consent.verification_missing');
    expect(codes).toContain('rights.unresolved');
  });

  it('reports every finding with a message and actionable guidance', async () => {
    const state = await signUp();
    const id = await createDraft(state, { sources: [], contributors: [] });

    const res = await state.agent.get(`/api/v1/heritage/mine/${id}/quality`);

    expect(res.status).toBe(200);
    for (const finding of res.body.quality.findings as Array<{
      message: string;
      guidance: string;
      severity: string;
    }>) {
      expect(finding.message.length).toBeGreaterThan(0);
      expect(finding.guidance.length).toBeGreaterThan(0);
      expect(['blocker', 'warning', 'info']).toContain(finding.severity);
    }
    const codes = (res.body.quality.findings as Array<{ code: string }>).map((f) => f.code);
    expect(codes).toContain('provenance.source_missing');
    expect(codes).toContain('provenance.attribution_missing');
  });

  it('is deterministic: the same record always yields the same findings', async () => {
    const state = await signUp();
    const id = await createDraft(state, { content: 'tiny' });

    const first = await state.agent.get(`/api/v1/heritage/mine/${id}/quality`);
    const second = await state.agent.get(`/api/v1/heritage/mine/${id}/quality`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.quality.findings).toEqual(first.body.quality.findings);
  });

  it('does not judge a proverb against a written-narrative template', async () => {
    const state = await signUp();
    const id = await createDraft(state, {
      title: 'A proverb',
      summary: undefined,
      heritageType: 'proverb',
      content: 'Rain before rice.',
    });

    const res = await state.agent.get(`/api/v1/heritage/mine/${id}/quality`);

    expect(res.status).toBe(200);
    const codes = (res.body.quality.findings as Array<{ code: string }>).map((f) => f.code);
    // A proverb needs no summary and is complete at a few words.
    expect(codes).not.toContain('summary.missing');
    expect(codes).not.toContain('content.too_short');
  });

  it('does not disclose another contributor’s record', async () => {
    const owner = await signUp();
    const intruder = await signUp();
    const id = await createDraft(owner);

    const res = await intruder.agent.get(`/api/v1/heritage/mine/${id}/quality`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/heritage/mine/000000000000000000000000/quality');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/moderation/submissions/:id/quality (publication phase)', () => {
  it('blocks publication while visibility is not public', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const id = await createDraft(contributor, { visibility: 'restricted' });

    const res = await moderator.agent.get(`/api/v1/moderation/submissions/${id}/quality`);

    expect(res.status).toBe(200);
    const codes = (res.body.quality.findings as Array<{ code: string }>).map((f) => f.code);
    expect(codes).toContain('visibility.not_public');
  });

  it('is forbidden for contributors', async () => {
    const contributor = await signUp();
    const id = await createDraft(contributor);
    const res = await contributor.agent.get(`/api/v1/moderation/submissions/${id}/quality`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/heritage/mine/:id/duplicates (duplicate assistance)', () => {
  it('suggests similar published records with reasons and caveats', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    await publishRecord(contributor, moderator, {
      title: 'The lamp keeper of the coastal village',
    });
    const mine = await createDraft(contributor, {
      title: 'The lamp keeper of the coastal village',
    });

    const res = await contributor.agent.get(`/api/v1/heritage/mine/${mine}/duplicates`);

    expect(res.status).toBe(200);
    expect(res.body.recordId).toBe(mine);
    expect(res.body.candidates.length).toBeGreaterThan(0);
    const candidate = res.body.candidates[0];
    expect(candidate.reasons).toContain('identical_title');
    expect(candidate.explanation).toMatch(/identical/i);
    expect(res.body.notes.length).toBeGreaterThan(0);
    // Advisory only — nothing is merged or deleted.
    expect(res.body).not.toHaveProperty('duplicateOf');
  });

  it('never lists drafts, unpublished, or restricted records', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const published = await publishRecord(contributor, moderator, {
      title: 'A shared title',
    });
    await createDraft(contributor, { title: 'A shared title' });
    const mine = await createDraft(contributor, { title: 'A shared title' });

    const res = await contributor.agent.get(`/api/v1/heritage/mine/${mine}/duplicates`);

    expect(res.status).toBe(200);
    const ids = (res.body.candidates as Array<{ id: string }>).map((c) => c.id);
    // Only the published record is a candidate; drafts never are.
    expect(ids).toContain(published.id);
    expect(ids).not.toContain(mine);

    const drafts = await HeritageRecordModel.find({ status: 'draft' }).lean().exec();
    expect(drafts.length).toBeGreaterThan(0);
    for (const doc of drafts) {
      expect(ids).not.toContain(String(doc._id));
    }
  });

  it('does not disclose another contributor’s record', async () => {
    const owner = await signUp();
    const intruder = await signUp();
    const id = await createDraft(owner);
    const res = await intruder.agent.get(`/api/v1/heritage/mine/${id}/duplicates`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/heritage/mine/:id/provenance (contributor provenance)', () => {
  it('updates the provenance block and appends an auditable history entry', async () => {
    const state = await signUp();
    const id = await createDraft(state);

    const res = await state.agent
      .patch(`/api/v1/heritage/mine/${id}/provenance`)
      .set('x-csrf-token', state.csrfToken)
      .send({
        originalLanguage: 'Malayalam',
        communityContext: 'Northern coastal villages',
        attributionPreference: 'pseudonymous',
        permitAnonymity: true,
        reason: 'Adding the origin of the telling',
      });

    expect(res.status).toBe(200);
    expect(res.body.provenance.originalLanguage).toBe('Malayalam');
    expect(res.body.provenance.communityContext).toBe('Northern coastal villages');
    expect(res.body.provenance.attributionPreference).toBe('pseudonymous');
    expect(res.body.provenance.permitAnonymity).toBe(true);
    expect(res.body.provenanceHistory.length).toBe(1);
    expect(res.body.provenanceHistory[0].changes.length).toBeGreaterThan(0);

    const events = await AuditEventModel.find({ action: 'provenance.updated' }).lean().exec();
    expect(events).toHaveLength(1);
  });

  it('rejects reviewer-only fields with 400 (strict schema)', async () => {
    const state = await signUp();
    const id = await createDraft(state);

    const res = await state.agent
      .patch(`/api/v1/heritage/mine/${id}/provenance`)
      .set('x-csrf-token', state.csrfToken)
      .send({ reviewStatus: 'verified', reviewerNotes: 'looks good to me' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('preserves the reviewer-set source verification across contributor edits', async () => {
    const state = await signUp();
    const id = await createDraft(state);

    await HeritageRecordModel.updateOne(
      { _id: id },
      { $set: { 'sources.0.isVerified': true } },
    ).exec();

    const res = await state.agent
      .patch(`/api/v1/heritage/mine/${id}/provenance`)
      .set('x-csrf-token', state.csrfToken)
      .send({
        sources: [
          {
            sourceType: 'oral_account',
            description: 'Told by the harbour master',
            collectedOn: '2026-01-15',
            context: 'Evening gathering at the harbour',
            isPublic: true,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.sources[0].isVerified).toBe(true);
  });

  it('refuses to change provenance once the record is under review', async () => {
    const state = await signUp();
    const id = await createDraft(state);
    await state.agent.post(`/api/v1/heritage/${id}/submit`).set('x-csrf-token', state.csrfToken);

    const res = await state.agent
      .patch(`/api/v1/heritage/mine/${id}/provenance`)
      .set('x-csrf-token', state.csrfToken)
      .send({ communityContext: 'Too late' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('does not disclose another contributor’s record', async () => {
    const owner = await signUp();
    const intruder = await signUp();
    const id = await createDraft(owner);
    const res = await intruder.agent
      .patch(`/api/v1/heritage/mine/${id}/provenance`)
      .set('x-csrf-token', intruder.csrfToken)
      .send({ communityContext: 'Hijacked' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/moderation/submissions/:id/provenance (reviewer assessment)', () => {
  it('records the reviewer assessment and an internal note', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const id = await createDraft(contributor);

    const res = await moderator.agent
      .patch(`/api/v1/moderation/submissions/${id}/provenance`)
      .set('x-csrf-token', moderator.csrfToken)
      .send({ reviewStatus: 'verified', reviewerNotes: 'Collector confirmed the attribution' });

    expect(res.status).toBe(200);
    expect(res.body.provenance.reviewStatus).toBe('verified');
    expect(res.body.provenance.reviewerNotes).toBe('Collector confirmed the attribution');
  });

  it('never exposes the reviewer note or verification claim publicly', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const { id, slug } = await publishRecord(contributor, moderator);

    await moderator.agent
      .patch(`/api/v1/moderation/submissions/${id}/provenance`)
      .set('x-csrf-token', moderator.csrfToken)
      .send({ reviewStatus: 'verified', reviewerNotes: 'Internal reasoning that stays internal' });

    const publicRes = await request(app).get(`/api/v1/heritage/${slug}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.provenance.claimState).toBe('review_observed');
    expect(publicRes.body.provenance).not.toHaveProperty('reviewerNotes');
    expect(publicRes.body.provenance).not.toHaveProperty('reviewStatus');
    expect(JSON.stringify(publicRes.body)).not.toContain('Internal reasoning that stays internal');
  });

  it('is forbidden for contributors', async () => {
    const contributor = await signUp();
    const id = await createDraft(contributor);
    const res = await contributor.agent
      .patch(`/api/v1/moderation/submissions/${id}/provenance`)
      .set('x-csrf-token', contributor.csrfToken)
      .send({ reviewStatus: 'verified' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/heritage/mine/:id/variants (variant declaration)', () => {
  it('records a variant declaration instead of merging records', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const { id: related } = await publishRecord(contributor, moderator);
    const mine = await createDraft(contributor, { title: 'A regional variant of the tale' });

    const res = await contributor.agent
      .post(`/api/v1/heritage/mine/${mine}/variants`)
      .set('x-csrf-token', contributor.csrfToken)
      .send({
        relatedRecordId: related,
        note: 'Told differently in the northern villages; both tellings are kept.',
      });

    expect(res.status).toBe(200);
    expect(res.body.variantDeclarations.length).toBe(1);
    expect(res.body.variantDeclarations[0].relatedRecordId).toBe(related);

    const events = await AuditEventModel.find({ action: 'variant.declared' }).lean().exec();
    expect(events).toHaveLength(1);
  });

  it('rejects a note shorter than 10 characters with 400', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const { id: related } = await publishRecord(contributor, moderator);
    const mine = await createDraft(contributor);

    const res = await contributor.agent
      .post(`/api/v1/heritage/mine/${mine}/variants`)
      .set('x-csrf-token', contributor.csrfToken)
      .send({ relatedRecordId: related, note: 'short' });

    expect(res.status).toBe(400);
  });

  it('refuses to relate a record to itself', async () => {
    const contributor = await signUp();
    const mine = await createDraft(contributor);

    const res = await contributor.agent
      .post(`/api/v1/heritage/mine/${mine}/variants`)
      .set('x-csrf-token', contributor.csrfToken)
      .send({
        relatedRecordId: mine,
        note: 'A record cannot be a variant of itself in practice.',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_VARIANT');
  });
});

describe('Structured review feedback', () => {
  it('lets a contributor post and read their own thread', async () => {
    const state = await signUp();
    const id = await createDraft(state);

    const created = await state.agent
      .post(`/api/v1/heritage/mine/${id}/feedback`)
      .set('x-csrf-token', state.csrfToken)
      .send({ kind: 'clarification', message: 'Should the second verse be included as well?' });

    expect(created.status).toBe(201);
    expect(created.body.messages.length).toBe(1);
    expect(created.body.openContributorMessages).toBe(1);

    const read = await state.agent.get(`/api/v1/heritage/mine/${id}/feedback`);
    expect(read.status).toBe(200);
    expect(read.body.messages.length).toBe(1);
  });

  it('keeps moderator internal notes away from the contributor', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const id = await createDraft(contributor);

    await moderator.agent
      .post(`/api/v1/moderation/submissions/${id}/feedback`)
      .set('x-csrf-token', moderator.csrfToken)
      .send({
        kind: 'provenance',
        message: 'Internal reasoning: the attribution still needs checking.',
        visibility: 'internal',
      });

    const moderatorView = await moderator.agent.get(
      `/api/v1/moderation/submissions/${id}/feedback`,
    );
    expect(moderatorView.status).toBe(200);
    expect(moderatorView.body.messages.length).toBe(1);
    expect(moderatorView.body.openInternalMessages).toBe(1);

    const contributorView = await contributor.agent.get(`/api/v1/heritage/mine/${id}/feedback`);
    expect(contributorView.status).toBe(200);
    expect(contributorView.body.messages.length).toBe(0);
    expect(contributorView.body.openInternalMessages).toBe(0);
    expect(JSON.stringify(contributorView.body)).not.toContain('Internal reasoning');
  });

  it('forces a contributor’s message to stay contributor-visible', async () => {
    const state = await signUp();
    const id = await createDraft(state);

    const res = await state.agent
      .post(`/api/v1/heritage/mine/${id}/feedback`)
      .set('x-csrf-token', state.csrfToken)
      .send({
        kind: 'general',
        message: 'Trying to write an internal note as a contributor.',
        visibility: 'internal',
      });

    expect(res.status).toBe(201);
    const stored = await ReviewFeedbackModel.find({ recordId: id }).lean().exec();
    expect(stored[0]?.visibility).toBe('contributor');
  });

  it('rejects a message shorter than the minimum length with 400', async () => {
    const state = await signUp();
    const id = await createDraft(state);

    const res = await state.agent
      .post(`/api/v1/heritage/mine/${id}/feedback`)
      .set('x-csrf-token', state.csrfToken)
      .send({ kind: 'general', message: 'short' });

    expect(res.status).toBe(400);
  });

  it('does not let a contributor add feedback once the record is under review', async () => {
    const state = await signUp();
    const id = await createDraft(state);
    await state.agent.post(`/api/v1/heritage/${id}/submit`).set('x-csrf-token', state.csrfToken);

    const res = await state.agent
      .post(`/api/v1/heritage/mine/${id}/feedback`)
      .set('x-csrf-token', state.csrfToken)
      .send({ kind: 'general', message: 'Adding a note while the record is queued.' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('resolves a message and records who resolved it', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const id = await createDraft(contributor);

    const created = await moderator.agent
      .post(`/api/v1/moderation/submissions/${id}/feedback`)
      .set('x-csrf-token', moderator.csrfToken)
      .send({ kind: 'correction', message: 'Please correct the spelling of the village name.' });
    expect(created.status).toBe(201);
    const feedbackId = created.body.messages[0].id as string;

    const resolved = await moderator.agent
      .post(`/api/v1/moderation/submissions/${id}/feedback/${feedbackId}/resolve`)
      .set('x-csrf-token', moderator.csrfToken);

    expect(resolved.status).toBe(200);
    expect(resolved.body.messages[0].resolvedAt).toBeDefined();
    expect(resolved.body.openContributorMessages).toBe(0);

    const events = await AuditEventModel.find({ action: 'feedback.resolved' }).lean().exec();
    expect(events).toHaveLength(1);
  });

  it('does not disclose another contributor’s thread', async () => {
    const owner = await signUp();
    const intruder = await signUp();
    const id = await createDraft(owner);
    const res = await intruder.agent.get(`/api/v1/heritage/mine/${id}/feedback`);
    expect(res.status).toBe(404);
  });
});

describe('Governance hardening', () => {
  it('refuses a duplicate open report from the same reporter', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const reporter = await signUp();
    const { id } = await publishRecord(contributor, moderator);

    const first = await reporter.agent
      .post('/api/v1/reports')
      .set('x-csrf-token', reporter.csrfToken)
      .send({ heritageRecordId: id, category: 'incorrect_misleading' });
    expect(first.status).toBe(201);

    const second = await reporter.agent
      .post('/api/v1/reports')
      .set('x-csrf-token', reporter.csrfToken)
      .send({ heritageRecordId: id, category: 'incorrect_misleading' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DUPLICATE_REPORT');
  });

  it('refuses to report a record that is not publicly listed', async () => {
    const contributor = await signUp();
    const reporter = await signUp();
    const id = await createDraft(contributor);

    const res = await reporter.agent
      .post('/api/v1/reports')
      .set('x-csrf-token', reporter.csrfToken)
      .send({ heritageRecordId: id, category: 'privacy_concern' });

    expect(res.status).toBe(404);
  });

  it('rejects a correction that tries to change consent or rights', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const reporter = await signUp();
    const { id } = await publishRecord(contributor, moderator);

    const res = await reporter.agent
      .post('/api/v1/corrections')
      .set('x-csrf-token', reporter.csrfToken)
      .send({
        heritageRecordId: id,
        proposedChanges: { consent: { permissionToPublish: true } },
        rationale: 'Attempting to change the consent block.',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CORRECTION');
  });

  it('applies an approved correction and records it', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const reporter = await signUp();
    const { id } = await publishRecord(contributor, moderator);

    const proposal = await reporter.agent
      .post('/api/v1/corrections')
      .set('x-csrf-token', reporter.csrfToken)
      .send({
        heritageRecordId: id,
        proposedChanges: { summary: 'A corrected summary of the tale.' },
        rationale: 'The original summary named the wrong village.',
      });
    expect(proposal.status).toBe(201);
    const correctionId = proposal.body.correction.id as string;

    const review = await moderator.agent
      .post(`/api/v1/corrections/${correctionId}/review`)
      .set('x-csrf-token', moderator.csrfToken)
      .send({ status: 'approved', decisionNote: 'Confirmed with the community' });
    expect(review.status).toBe(200);

    const record = await HeritageRecordModel.findById(id).lean().exec();
    expect(record?.summary).toBe('A corrected summary of the tale.');

    const events = await AuditEventModel.find({ action: 'correction.approved' }).lean().exec();
    expect(events).toHaveLength(1);
  });

  it('removes a withdrawn record from the public archive without deleting it', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const { id, slug } = await publishRecord(contributor, moderator);

    const before = await request(app).get(`/api/v1/heritage/${slug}`);
    expect(before.status).toBe(200);

    const sitemapBefore = await request(app).get('/sitemap.xml');
    expect(sitemapBefore.status).toBe(200);
    expect(String(sitemapBefore.text)).toContain(`/heritage/${slug}`);

    const withdrawal = await contributor.agent
      .post('/api/v1/withdrawals')
      .set('x-csrf-token', contributor.csrfToken)
      .send({
        heritageRecordId: id,
        type: 'contributor_withdrawal',
        reason: 'The family asked us to take this story down.',
      });
    expect(withdrawal.status).toBe(201);
    const withdrawalId = withdrawal.body.withdrawal.id as string;

    const action = await moderator.agent
      .post(`/api/v1/withdrawals/${withdrawalId}/action`)
      .set('x-csrf-token', moderator.csrfToken)
      .send({ status: 'unpublished', actionTaken: 'Record removed from public view' });
    expect(action.status).toBe(200);

    const after = await request(app).get(`/api/v1/heritage/${slug}`);
    expect(after.status).toBe(404);

    const list = await request(app).get('/api/v1/heritage?limit=50');
    expect(list.status).toBe(200);
    const ids = (list.body.items as Array<{ id: string }>).map((item) => item.id);
    expect(ids).not.toContain(id);

    const sitemapAfter = await request(app).get('/sitemap.xml');
    expect(sitemapAfter.status).toBe(200);
    expect(String(sitemapAfter.text)).not.toContain(`/heritage/${slug}`);

    // Nothing is deleted: the record and its history remain auditable.
    const stored = await HeritageRecordModel.findById(id).lean().exec();
    expect(stored).not.toBeNull();
    expect(stored?.consent.permissionToPublish).toBe(false);
    expect(stored?.visibility).toBe('restricted');
  });

  it('does not create a duplicate open contributor withdrawal request', async () => {
    const contributor = await signUp();
    const moderator = await signUp('moderator');
    const { id } = await publishRecord(contributor, moderator);

    const body = {
      heritageRecordId: id,
      type: 'contributor_withdrawal',
      reason: 'The family has asked for this record to be removed.',
    };

    const first = await contributor.agent
      .post('/api/v1/withdrawals')
      .set('x-csrf-token', contributor.csrfToken)
      .send(body);
    expect(first.status).toBe(201);

    const second = await contributor.agent
      .post('/api/v1/withdrawals')
      .set('x-csrf-token', contributor.csrfToken)
      .send(body);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('WITHDRAWAL_EXISTS');
  });

  it('refuses a contributor-initiated withdrawal of someone else’s record', async () => {
    const contributor = await signUp();
    const intruder = await signUp();
    const id = await createDraft(contributor);

    const res = await intruder.agent
      .post('/api/v1/withdrawals')
      .set('x-csrf-token', intruder.csrfToken)
      .send({
        heritageRecordId: id,
        type: 'contributor_withdrawal',
        reason: 'Attempting to withdraw a record that is not mine.',
      });

    expect(res.status).toBe(403);
  });

  it('refuses to let a moderator review their own contribution', async () => {
    const moderator = await signUp('moderator');
    const id = await createDraft(moderator);
    await moderator.agent
      .post(`/api/v1/heritage/${id}/submit`)
      .set('x-csrf-token', moderator.csrfToken);

    const res = await moderator.agent
      .post(`/api/v1/moderation/submissions/${id}/approve`)
      .set('x-csrf-token', moderator.csrfToken);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SELF_REVIEW_FORBIDDEN');
  });
});
