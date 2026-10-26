import type { Server } from 'http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectToDatabase, disconnectFromDatabase } from '../src/config/database.js';
import { AuditEventModel } from '../src/models/AuditEvent.js';
import { HeritageMediaModel } from '../src/models/HeritageMedia.js';
import { HeritageRecordModel } from '../src/models/HeritageRecord.js';
import { UserModel } from '../src/models/User.js';
import type { StorageAdapter } from '../src/services/storage/index.js';
import { closeServer, listen } from './helpers/servers.js';
import { createTestApp, createTestEnv } from './helpers/testApp.js';

/**
 * Full media lifecycle: contributor upload → server-side validation →
 * moderation publication → authorized public delivery → withdrawal that
 * denies delivery and deletes the object. Storage is an in-memory adapter, so
 * no cloud bucket or network is involved.
 */

class MemoryStorage implements StorageAdapter {
  readonly objects = new Map<string, { content: Buffer; contentType: string }>();
  readonly deletes: string[] = [];

  async upload(
    storageKey: string,
    content: Buffer,
    contentType: string,
  ): Promise<{ storageKey: string; size: number }> {
    this.objects.set(storageKey, { content, contentType });
    return { storageKey, size: content.length };
  }

  async getMetadata(storageKey: string): Promise<{ size: number; contentType: string } | null> {
    const object = this.objects.get(storageKey);
    return object === undefined
      ? null
      : { size: object.content.length, contentType: object.contentType };
  }

  async delete(storageKey: string): Promise<void> {
    this.deletes.push(storageKey);
    this.objects.delete(storageKey);
  }

  async getObject(storageKey: string): Promise<{ content: Buffer; contentType: string } | null> {
    return this.objects.get(storageKey) ?? null;
  }
}

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

let mongod: MongoMemoryServer;
let storage: MemoryStorage;
let app: ReturnType<typeof createTestApp>;
let server: Server;
const extraServers: Server[] = [];
let userCounter = 0;

interface AgentState {
  agent: request.Agent;
  csrfToken: string;
  userId: string;
}

async function csrf(agent: request.Agent): Promise<string> {
  const res = await agent.get('/api/v1/auth/csrf');
  expect(res.status).toBe(200);
  return res.body.csrfToken as string;
}

async function signUp(
  role: 'contributor' | 'moderator' = 'contributor',
  target: Server = server,
): Promise<AgentState> {
  const agent = request.agent(target);
  userCounter += 1;
  // Fetch the CSRF token (and session cookie) before building the request:
  // SuperTest captures cookies when the request object is created.
  const token = await csrf(agent);
  const res = await agent
    .post('/api/v1/auth/register')
    .set('x-csrf-token', token)
    .send({
      email: `media-${userCounter}@example.com`,
      password: 'password123',
      displayName: `Media User ${userCounter}`,
    });
  expect(res.status).toBe(201);
  const userId = res.body.user.id as string;
  if (role === 'moderator') {
    await UserModel.updateOne({ _id: userId }, { $set: { role: 'moderator' } });
  }
  return { agent, csrfToken: res.body.csrfToken as string, userId };
}

function publishableDraft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'A consented craft technique with media',
    content: 'Detailed instructions for a traditional craft technique, fully consented.',
    heritageType: 'craft',
    languages: ['Hindi'],
    visibility: 'public',
    consent: { permissionToPublish: true, verification: 'community_confirmed' },
    license: { rightsStatus: 'confirmed', holder: 'Craft community' },
    ...overrides,
  };
}

async function createDraft(
  state: AgentState,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; slug: string }> {
  const draft = await state.agent
    .post('/api/v1/heritage')
    .set('x-csrf-token', state.csrfToken)
    .send(publishableDraft(overrides));
  expect(draft.status).toBe(201);
  return { id: draft.body.id as string, slug: draft.body.slug as string };
}

async function submitRecord(state: AgentState, recordId: string): Promise<void> {
  const submit = await state.agent
    .post(`/api/v1/heritage/${recordId}/submit`)
    .set('x-csrf-token', state.csrfToken);
  expect(submit.status).toBe(200);
}

async function createSubmittedRecord(state: AgentState): Promise<{ id: string; slug: string }> {
  const draft = await createDraft(state);
  await submitRecord(state, draft.id);
  return draft;
}

async function approve(moderator: AgentState, recordId: string): Promise<void> {
  const res = await moderator.agent
    .post(`/api/v1/moderation/submissions/${recordId}/approve`)
    .set('x-csrf-token', moderator.csrfToken);
  expect(res.status).toBe(200);
}

async function upload(
  state: AgentState,
  recordId: string,
  content: Buffer = PNG,
  contentType = 'image/png',
  filename = 'craft.png',
) {
  return state.agent
    .post(`/api/v1/media/${recordId}/upload`)
    .set('x-csrf-token', state.csrfToken)
    .attach('file', content, { filename, contentType });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectToDatabase(mongod.getUri('entebharatham-media'));
  await UserModel.syncIndexes();
  await HeritageRecordModel.syncIndexes();
}, 180_000);

afterAll(async () => {
  await disconnectFromDatabase();
  await mongod?.stop();
});

beforeEach(async () => {
  storage = new MemoryStorage();
  app = createTestApp(createTestEnv(), { storage });
  server = await listen(app);
  await HeritageMediaModel.deleteMany({});
  await HeritageRecordModel.deleteMany({});
  await AuditEventModel.deleteMany({});
  await UserModel.deleteMany({});
});

afterEach(async () => {
  await closeServer(server);
  await Promise.all(extraServers.splice(0).map((extra) => closeServer(extra)));
});

describe('media lifecycle', () => {
  it('uploads, publishes, serves, and withdraws media end to end', async () => {
    const contributor = await signUp();
    const { id, slug } = await createDraft(contributor);

    const uploaded = await upload(contributor, id);
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.media.mediaType).toBe('image');
    expect(uploaded.body.media.displayName).toBe('craft.png');
    const contentPath = uploaded.body.media.contentPath as string;
    expect(contentPath).toBe(`/api/v1/media/${id}/${uploaded.body.media.id}/content`);
    expect(storage.objects.size).toBe(1);
    const storageKey = [...storage.objects.keys()][0] ?? '';
    expect(storageKey).toMatch(/^media_\d+_[a-f0-9]+\.png$/);

    const listed = await contributor.agent.get(`/api/v1/media/${id}`);
    expect(listed.status).toBe(200);
    expect(listed.body.media).toHaveLength(1);

    // Draft media is private to anonymous callers.
    expect((await request(server).get(contentPath)).status).toBe(404);

    await submitRecord(contributor, id);
    const moderator = await signUp('moderator');
    await approve(moderator, id);

    const publicRecord = await request(server).get(`/api/v1/heritage/${slug}`);
    expect(publicRecord.status).toBe(200);

    const delivered = await request(server).get(contentPath);
    expect(delivered.status).toBe(200);
    expect(delivered.headers['content-type']).toContain('image/png');
    expect(delivered.headers['cache-control']).toContain('no-store');
    expect(delivered.headers['x-content-type-options']).toBe('nosniff');

    const withdrawal = await contributor.agent
      .post('/api/v1/withdrawals')
      .set('x-csrf-token', contributor.csrfToken)
      .send({
        heritageRecordId: id,
        type: 'contributor_withdrawal',
        reason: 'The contributor no longer consents to publication.',
      });
    expect(withdrawal.status).toBe(201);

    const action = await moderator.agent
      .post(`/api/v1/withdrawals/${withdrawal.body.withdrawal.id}/action`)
      .set('x-csrf-token', moderator.csrfToken)
      .send({ status: 'removed', actionTaken: 'Removed at contributor request' });
    expect(action.status).toBe(200);

    // Public and owner delivery are both denied; the object is gone.
    expect((await request(server).get(contentPath)).status).toBe(404);
    expect((await contributor.agent.get(contentPath)).status).toBe(404);
    expect((await request(server).get(`/api/v1/heritage/${slug}`)).status).toBe(404);
    expect(storage.objects.size).toBe(0);
    expect(storage.deletes).toContain(storageKey);

    const media = await HeritageMediaModel.findOne({ heritageRecordId: id }).exec();
    expect(media?.lifecycleState).toBe('removed');
    const record = await HeritageRecordModel.findById(id).exec();
    expect(record?.status).toBe('archived');
    expect(record?.visibility).toBe('private');
    expect(record?.consent.permissionToPublish).toBe(false);
  });

  it('restricts media without deleting objects for a non-terminal action', async () => {
    const contributor = await signUp();
    const { id } = await createDraft(contributor);
    const uploaded = await upload(contributor, id);
    expect(uploaded.status).toBe(201);
    const contentPath = uploaded.body.media.contentPath as string;

    await submitRecord(contributor, id);
    const moderator = await signUp('moderator');
    await approve(moderator, id);

    const withdrawal = await contributor.agent
      .post('/api/v1/withdrawals')
      .set('x-csrf-token', contributor.csrfToken)
      .send({
        heritageRecordId: id,
        type: 'contributor_withdrawal',
        reason: 'Please take this down while we review it.',
      });
    expect(withdrawal.status).toBe(201);

    await moderator.agent
      .post(`/api/v1/withdrawals/${withdrawal.body.withdrawal.id}/action`)
      .set('x-csrf-token', moderator.csrfToken)
      .send({ status: 'restricted' })
      .expect(200);

    expect((await request(server).get(contentPath)).status).toBe(404);
    expect((await contributor.agent.get(contentPath)).status).toBe(404);
    expect(storage.objects.size).toBe(1);
    const media = await HeritageMediaModel.findOne({ heritageRecordId: id }).exec();
    expect(media?.lifecycleState).toBe('restricted');
  });

  it('rejects uploads whose bytes do not match the declared type', async () => {
    const contributor = await signUp();
    const draft = await contributor.agent
      .post('/api/v1/heritage')
      .set('x-csrf-token', contributor.csrfToken)
      .send(publishableDraft());
    expect(draft.status).toBe(201);

    const fakePng = await upload(
      contributor,
      draft.body.id as string,
      Buffer.from('<html><script>alert(1)</script></html>'),
      'image/png',
      'payload.png',
    );
    expect(fakePng.status).toBe(400);
    expect(fakePng.body.error.code).toBe('INVALID_FILE');
    expect(storage.objects.size).toBe(0);
  });

  it('refuses uploads by non-owners and to published records', async () => {
    const owner = await signUp();
    const { id } = await createSubmittedRecord(owner);
    const stranger = await signUp();

    const notOwner = await upload(stranger, id);
    expect(notOwner.status).toBe(404);

    const moderator = await signUp('moderator');
    await approve(moderator, id);

    const published = await upload(owner, id);
    expect(published.status).toBe(403);
    expect(published.body.error.code).toBe('UPLOAD_NOT_ALLOWED');
  });

  it('refuses deletion of published media outside governance', async () => {
    const contributor = await signUp();
    const { id } = await createDraft(contributor);
    const uploaded = await upload(contributor, id);
    const mediaId = uploaded.body.media.id as string;

    const beforePublish = await contributor.agent
      .delete(`/api/v1/media/${id}/${mediaId}`)
      .set('x-csrf-token', contributor.csrfToken);
    expect(beforePublish.status).toBe(204);

    // Re-upload, submit, and publish, then attempt contributor deletion again.
    const again = await upload(contributor, id);
    expect(again.status).toBe(201);
    const moderator = await signUp('moderator');
    await submitRecord(contributor, id);
    await approve(moderator, id);

    const afterPublish = await contributor.agent
      .delete(`/api/v1/media/${id}/${again.body.media.id as string}`)
      .set('x-csrf-token', contributor.csrfToken);
    expect(afterPublish.status).toBe(409);
    expect(afterPublish.body.error.code).toBe('WITHDRAWAL_REQUIRED');
  });
});

describe('S3 delivery', () => {
  it('redirects to a short-lived signed URL instead of proxying object bytes', async () => {
    const signedStorage: StorageAdapter = Object.assign(new MemoryStorage(), {
      getSignedUrl: async (storageKey: string) =>
        `https://bucket.example.com/${storageKey}?X-Amz-Expires=300`,
    });
    const s3App = createTestApp(
      createTestEnv({
        STORAGE_PROVIDER: 's3',
        S3_REGION: 'ap-south-1',
        S3_BUCKET: 'entebharatham-media',
        MEDIA_SIGNED_URL_TTL_SECONDS: '120',
      }),
      { storage: signedStorage },
    );
    const s3Server = await listen(s3App);
    extraServers.push(s3Server);

    const contributor = await signUp('contributor', s3Server);
    const { id } = await createDraft(contributor);
    const uploaded = await contributor.agent
      .post(`/api/v1/media/${id}/upload`)
      .set('x-csrf-token', contributor.csrfToken)
      .attach('file', PNG, { filename: 'craft.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(201);

    await submitRecord(contributor, id);
    const moderator = await signUp('moderator', s3Server);
    await moderator.agent
      .post(`/api/v1/moderation/submissions/${id}/approve`)
      .set('x-csrf-token', moderator.csrfToken)
      .expect(200);

    const delivered = await request(s3Server).get(uploaded.body.media.contentPath as string);
    expect(delivered.status).toBe(302);
    expect(delivered.headers.location).toMatch(/X-Amz-Expires=300/);
    expect(delivered.headers.location).toMatch(/^https:\/\//);
  });
});
