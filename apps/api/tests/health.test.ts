import type { DetailedHealthResponse, HealthResponse } from '@entebharatham/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/testApp.js';

function app(): express.Express {
  return createTestApp();
}

describe('GET /api/v1/health', () => {
  it('returns basic health information', async () => {
    const response = await request(app()).get('/api/v1/health');
    expect(response.status).toBe(200);
    const body = response.body as HealthResponse;
    expect(body.status).toBe('ok');
    expect(body.service).toBe('entebharatham-api');
    expect(typeof body.timestamp).toBe('string');
    expect(typeof body.uptimeSeconds).toBe('number');
    // Basic health must not include verbose details.
    expect(body).not.toHaveProperty('database');
    expect(body).not.toHaveProperty('environment');
  });

  it('returns extended details when verbose=1', async () => {
    const response = await request(app()).get('/api/v1/health?verbose=1');
    expect(response.status).toBe(200);
    const body = response.body as DetailedHealthResponse;
    expect(body.environment).toBe('test');
    expect(typeof body.database.connected).toBe('boolean');
    expect(['disconnected', 'connected', 'connecting', 'disconnecting']).toContain(
      body.database.readyState,
    );
  });

  it('rejects invalid query parameters', async () => {
    const response = await request(app()).get('/api/v1/health?verbose=yes');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/health/ready', () => {
  it('returns 503 and unavailable while the database is disconnected', async () => {
    const response = await request(app()).get('/api/v1/health/ready');
    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unavailable');
    expect(response.body.service).toBe('entebharatham-api');
    expect(response.body.database.connected).toBe(false);
    expect(['disconnected', 'connecting', 'disconnecting']).toContain(
      response.body.database.readyState,
    );
  });

  it('does not disclose connection details', async () => {
    const response = await request(app()).get('/api/v1/health/ready');
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('mongodb://');
    expect(serialized).not.toContain('MONGODB_URI');
    expect(serialized).not.toContain('stack');
  });
});

describe('security defaults', () => {
  it('does not expose the x-powered-by header', async () => {
    const response = await request(app()).get('/api/v1/health');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('sets baseline security headers via helmet', async () => {
    const response = await request(app()).get('/api/v1/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('returns JSON 404 for unknown routes', async () => {
    const response = await request(app()).get('/api/v1/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
