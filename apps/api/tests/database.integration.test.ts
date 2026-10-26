import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  connectToDatabase,
  disconnectFromDatabase,
  isDatabaseConnected,
} from '../src/config/database.js';
import { upsertSeedFixtures } from '../src/scripts/seedDatabase.js';
import { createTestApp } from './helpers/testApp.js';

const app = createTestApp();

const PUBLIC_SLUGS = [
  'demo-fictional-lantern-of-willingtown',
  'demo-fictional-lamp-song',
  'demo-fictional-hindi-proverb-examples',
];

const NON_PUBLIC_SLUGS = [
  'demo-fictional-restricted-ritual-narrative',
  'demo-fictional-draft-recipe',
  'demo-fictional-pending-review-craft',
  'demo-fictional-archived-dialect-notes',
  'demo-fictional-no-publish-consent',
];

/**
 * Connection lifecycle behavior that does not need a running database.
 * Runs before the in-memory server is started on purpose.
 */
describe('database connection lifecycle', () => {
  it('reports disconnected before any connection is attempted', () => {
    expect(isDatabaseConnected()).toBe(false);
  });

  it('rejects an unreachable database and never reports a false ready state', async () => {
    await expect(
      connectToDatabase('mongodb://127.0.0.1:9/entebharatham-unreachable'),
    ).rejects.toThrow();
    expect(isDatabaseConnected()).toBe(false);
  }, 20_000);

  it('builds the Express app without a live database connection', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
  });

  it('reports readiness failure (503) while the database is unavailable', async () => {
    const response = await request(app).get('/api/v1/health/ready');
    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unavailable');
    expect(response.body.database.connected).toBe(false);
  });
});

describe('heritage API (integration, isolated in-memory MongoDB)', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await connectToDatabase(mongod.getUri('entebharatham-integration'));
    await upsertSeedFixtures();
  }, 180_000);

  afterAll(async () => {
    await disconnectFromDatabase();
    await mongod?.stop();
  });

  it('reports readiness success once connected', async () => {
    const response = await request(app).get('/api/v1/health/ready');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
    expect(response.body.database.connected).toBe(true);
    expect(response.body.database.readyState).toBe('connected');
  });

  it('lists only publicly eligible records', async () => {
    const response = await request(app).get('/api/v1/heritage');
    expect(response.status).toBe(200);
    const slugs = response.body.items.map((item: { slug: string }) => item.slug);
    expect(new Set(slugs)).toEqual(new Set(PUBLIC_SLUGS));
    expect(response.body.total).toBe(PUBLIC_SLUGS.length);
    expect(response.body.totalPages).toBe(1);
    expect(response.body.page).toBe(1);
  });

  it('never returns restricted, draft, pending, archived, or consent-less records', async () => {
    const response = await request(app).get('/api/v1/heritage?limit=50');
    const slugs: string[] = response.body.items.map((item: { slug: string }) => item.slug);
    for (const slug of NON_PUBLIC_SLUGS) {
      expect(slugs).not.toContain(slug);
    }
    expect(response.body.total).toBe(PUBLIC_SLUGS.length);
  });

  it('does not leak internal fields in list items', async () => {
    const response = await request(app).get('/api/v1/heritage?limit=50');
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('INTERNAL-');
    expect(serialized).not.toContain('_id');
    expect(serialized).not.toContain('__v');
    expect(serialized).not.toContain('"content"');
    expect(serialized).not.toContain('"sources"');
    expect(serialized).not.toContain('Hidden Demo Editor');
  });

  it('filters by heritage type', async () => {
    const response = await request(app).get('/api/v1/heritage?heritageType=folk_story');
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].slug).toBe('demo-fictional-lantern-of-willingtown');
  });

  it('excludes non-public records even when the type filter matches them', async () => {
    // A draft recipe exists in the fixtures; it must not be reachable.
    const response = await request(app).get('/api/v1/heritage?heritageType=recipe');
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(0);
    expect(response.body.total).toBe(0);
  });

  it('filters by language', async () => {
    const response = await request(app).get('/api/v1/heritage?language=Malayalam');
    expect(response.body.items.map((item: { slug: string }) => item.slug)).toEqual([
      'demo-fictional-lamp-song',
    ]);
  });

  it('filters by region across state and locality', async () => {
    const response = await request(app).get('/api/v1/heritage?region=Kerala');
    expect(response.body.items.map((item: { slug: string }) => item.slug)).toEqual([
      'demo-fictional-lamp-song',
      'demo-fictional-lantern-of-willingtown',
    ]);

    const locality = await request(app).get('/api/v1/heritage?region=Vilakkur%20(fictional)');
    expect(locality.body.items.map((item: { slug: string }) => item.slug)).toEqual([
      'demo-fictional-lamp-song',
    ]);
  });

  it('filters by tags with all-of semantics', async () => {
    const all = await request(app).get('/api/v1/heritage?tags=demo');
    expect(all.body.total).toBe(PUBLIC_SLUGS.length);

    const matching = await request(app).get('/api/v1/heritage?tags=demo,song');
    expect(matching.body.total).toBe(1);
    expect(matching.body.items[0].slug).toBe('demo-fictional-lamp-song');

    const none = await request(app).get('/api/v1/heritage?tags=demo,does-not-exist');
    expect(none.body.total).toBe(0);
  });

  it('performs text search over public fields only', async () => {
    const response = await request(app).get('/api/v1/heritage?q=lantern');
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].slug).toBe('demo-fictional-lantern-of-willingtown');
  });

  it('paginates with stable, non-overlapping pages', async () => {
    const first = await request(app).get('/api/v1/heritage?page=1&limit=2');
    expect(first.body.items).toHaveLength(2);
    expect(first.body.total).toBe(3);
    expect(first.body.totalPages).toBe(2);

    const second = await request(app).get('/api/v1/heritage?page=2&limit=2');
    expect(second.body.items).toHaveLength(1);

    const firstSlugs = first.body.items.map((item: { slug: string }) => item.slug);
    const secondSlugs = second.body.items.map((item: { slug: string }) => item.slug);
    expect(firstSlugs.filter((slug: string) => secondSlugs.includes(slug))).toHaveLength(0);
  });

  it('returns an empty page beyond the last page', async () => {
    const response = await request(app).get('/api/v1/heritage?page=99&limit=10');
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.total).toBe(3);
  });

  it('returns safe validation errors for invalid query parameters', async () => {
    for (const query of [
      'limit=999',
      'page=0',
      'heritageType=not-a-type',
      'q=a',
      'unknownParam=1',
    ]) {
      const response = await request(app).get(`/api/v1/heritage?${query}`);
      expect(response.status, query).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('treats operator-like input as a literal value (no NoSQL injection)', async () => {
    const response = await request(app).get('/api/v1/heritage?language=%7B%22%24ne%22%3Anull%7D');
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
  });

  it('returns a public record by slug with a safe public shape', async () => {
    const response = await request(app).get(
      '/api/v1/heritage/demo-fictional-lantern-of-willingtown',
    );
    expect(response.status).toBe(200);

    const body = response.body;
    expect(body.slug).toBe('demo-fictional-lantern-of-willingtown');
    expect(body.title).toContain('Fictional Demo Record');
    expect(body.content).toContain('invented demonstration text');
    expect(body.contributors).toEqual([{ name: 'Demo Author (fictional)', role: 'contributor' }]);
    expect(body.sources[0]).not.toHaveProperty('notes');
    expect(body.consent).not.toHaveProperty('basis');
    expect(body.consent.permissionToPublish).toBeUndefined();
    expect(body.license).not.toHaveProperty('notes');
    expect(body).not.toHaveProperty('_id');
    expect(body).not.toHaveProperty('__v');

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('INTERNAL-');
    expect(serialized).not.toContain('Hidden Demo Editor');
  });

  it('preserves Malayalam content end to end', async () => {
    const response = await request(app).get('/api/v1/heritage/demo-fictional-lamp-song');
    expect(response.status).toBe(200);
    expect(response.body.title).toContain('വിളക്കൂരിലെ പാട്ട്');
    expect(response.body.content).toContain('സാങ്കല്പ്പിക');
  });

  it('returns a non-disclosing 404 for restricted, unpublished, and consent-less records', async () => {
    const missing = await request(app).get('/api/v1/heritage/definitely-not-a-real-record');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');

    for (const slug of NON_PUBLIC_SLUGS) {
      const response = await request(app).get(`/api/v1/heritage/${slug}`);
      expect(response.status, slug).toBe(404);
      // Identical body to a genuinely missing record — existence is not disclosed.
      expect(response.body, slug).toEqual(missing.body);
    }
  });

  it('rejects malformed slugs with a validation error', async () => {
    const response = await request(app).get('/api/v1/heritage/Invalid_Slug%21');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns safe errors when the database connection is down', async () => {
    await disconnectFromDatabase();

    const list = await request(app).get('/api/v1/heritage');
    expect(list.status).toBe(500);
    expect(list.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(list.body)).not.toContain('Mongo');

    const detail = await request(app).get('/api/v1/heritage/demo-fictional-lantern-of-willingtown');
    expect(detail.status).toBe(500);
    expect(detail.body.error.code).toBe('INTERNAL_ERROR');

    const ready = await request(app).get('/api/v1/health/ready');
    expect(ready.status).toBe(503);
  });
});
