import { describe, expect, it } from 'vitest';
import { loadEnv, parseEnv } from '../src/config/env.js';

const validEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '4000',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/entebharatham',
  API_CORS_ORIGINS: 'http://localhost:5173',
};

/**
 * Minimal configuration that satisfies every production safeguard. Individual
 * tests override one field at a time to prove each safeguard fires.
 */
const productionOverrides: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.mongodb.net/entebharatham',
  API_CORS_ORIGINS: 'https://app.example.com',
  APP_BASE_URL: 'https://app.example.com',
  SESSION_SECRET: 'a-strong-production-session-secret-value',
  EMAIL_PROVIDER: 'smtp',
  EMAIL_FROM: 'heritage@example.com',
  SMTP_HOST: 'smtp.example.com',
  RATE_LIMIT_STORE: 'mongo',
  STORAGE_PROVIDER: 's3',
  S3_REGION: 'ap-south-1',
  S3_BUCKET: 'entebharatham-media',
};

describe('parseEnv', () => {
  it('accepts a valid environment', () => {
    const env = parseEnv(validEnv);
    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(4000);
    expect(env.API_CORS_ORIGINS).toEqual(['http://localhost:5173']);
  });

  it('applies defaults when optional values are missing', () => {
    const env = parseEnv({ MONGODB_URI: 'mongodb://127.0.0.1:27017/entebharatham' });
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.API_CORS_ORIGINS).toEqual(['http://localhost:5173']);
  });

  it('splits comma-separated CORS origins and trims whitespace', () => {
    const env = parseEnv({
      ...validEnv,
      API_CORS_ORIGINS: 'http://localhost:5173, https://example.com ',
    });
    expect(env.API_CORS_ORIGINS).toEqual(['http://localhost:5173', 'https://example.com']);
  });

  it('rejects a missing MONGODB_URI', () => {
    expect(() => parseEnv({ NODE_ENV: 'test' })).toThrow(/MONGODB_URI/);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => parseEnv({ ...validEnv, PORT: '70000' })).toThrow();
    expect(() => parseEnv({ ...validEnv, PORT: '0' })).toThrow();
  });

  it('rejects invalid CORS origins', () => {
    expect(() => parseEnv({ ...validEnv, API_CORS_ORIGINS: 'not-a-url' })).toThrow();
  });

  it('allows wildcard CORS outside production', () => {
    const env = parseEnv({ ...validEnv, NODE_ENV: 'development', API_CORS_ORIGINS: '*' });
    expect(env.API_CORS_ORIGINS).toEqual(['*']);
  });

  it('rejects wildcard CORS in production', () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        ...productionOverrides,
        API_CORS_ORIGINS: '*',
      }),
    ).toThrow(/Wildcard|wildcard|\*/);
  });

  it('rejects an empty CORS allowlist', () => {
    expect(() => parseEnv({ ...validEnv, API_CORS_ORIGINS: ' , ' })).toThrow();
  });
});

describe('session and proxy configuration', () => {
  it('applies session defaults when unset', () => {
    const env = parseEnv(validEnv);
    expect(env.SESSION_COOKIE_SAMESITE).toBe('lax');
    expect(env.SESSION_MAX_AGE_HOURS).toBe(168);
    expect(env.TRUST_PROXY_HOPS).toBe(0);
    expect(env.SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it('parses numeric session and proxy settings', () => {
    const env = parseEnv({
      ...validEnv,
      SESSION_MAX_AGE_HOURS: '24',
      TRUST_PROXY_HOPS: '1',
    });
    expect(env.SESSION_MAX_AGE_HOURS).toBe(24);
    expect(env.TRUST_PROXY_HOPS).toBe(1);
  });

  it('rejects an invalid SameSite value', () => {
    expect(() => parseEnv({ ...validEnv, SESSION_COOKIE_SAMESITE: 'always' })).toThrow();
  });

  it('rejects out-of-range session lifetime and proxy hops', () => {
    expect(() => parseEnv({ ...validEnv, SESSION_MAX_AGE_HOURS: '0' })).toThrow();
    expect(() => parseEnv({ ...validEnv, TRUST_PROXY_HOPS: '-1' })).toThrow();
    expect(() => parseEnv({ ...validEnv, TRUST_PROXY_HOPS: '11' })).toThrow();
  });

  it('rejects the development session secret in production', () => {
    expect(() => parseEnv({ ...validEnv, NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
  });

  it('rejects a short session secret in production', () => {
    expect(() =>
      parseEnv({ ...validEnv, NODE_ENV: 'production', SESSION_SECRET: 'too-short' }),
    ).toThrow(/at least 32/);
  });

  it('accepts a strong session secret in production', () => {
    const env = parseEnv({ ...validEnv, ...productionOverrides });
    expect(env.SESSION_SECRET).toBe('a-strong-production-session-secret-value');
    expect(env.STORAGE_PROVIDER).toBe('s3');
    expect(env.RATE_LIMIT_STORE).toBe('mongo');
  });

  it('accepts STORAGE_PROVIDER=object as a legacy alias for s3', () => {
    const env = parseEnv({
      ...validEnv,
      ...productionOverrides,
      STORAGE_PROVIDER: 'object',
    });
    expect(env.STORAGE_PROVIDER).toBe('s3');
  });

  it('accepts RATE_LIMIT_STORE=mongodb as an alias for mongo', () => {
    const env = parseEnv({
      ...validEnv,
      ...productionOverrides,
      RATE_LIMIT_STORE: 'mongodb',
    });
    expect(env.RATE_LIMIT_STORE).toBe('mongo');
  });

  it('rejects a local database in production unless explicitly allowed', () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        ...productionOverrides,
        MONGODB_URI: 'mongodb://127.0.0.1:27017/entebharatham',
      }),
    ).toThrow(/remote MongoDB/);

    const env = parseEnv({
      ...validEnv,
      ...productionOverrides,
      MONGODB_URI: 'mongodb://127.0.0.1:27017/entebharatham',
      ALLOW_LOCAL_DATABASE_IN_PRODUCTION: 'true',
    });
    expect(env.ALLOW_LOCAL_DATABASE_IN_PRODUCTION).toBe(true);
  });

  it('rejects a Mongo URI without a database name', () => {
    expect(() => parseEnv({ ...validEnv, MONGODB_URI: 'mongodb://127.0.0.1:27017' })).toThrow(
      /database name/,
    );
  });

  it('rejects a non-https APP_BASE_URL in production', () => {
    expect(() =>
      parseEnv({ ...validEnv, ...productionOverrides, APP_BASE_URL: 'http://app.example.com' }),
    ).toThrow(/APP_BASE_URL must use https/);
  });

  it('requires SMTP delivery in production', () => {
    expect(() => parseEnv({ ...validEnv, ...productionOverrides, EMAIL_PROVIDER: 'dev' })).toThrow(
      /EMAIL_PROVIDER=smtp/,
    );
  });

  it('requires SMTP host and sender when smtp delivery is selected', () => {
    expect(() => parseEnv({ ...validEnv, ...productionOverrides, SMTP_HOST: '' })).toThrow(
      /SMTP_HOST/,
    );
    expect(() =>
      parseEnv({ ...validEnv, ...productionOverrides, EMAIL_FROM: 'not-an-email' }),
    ).toThrow(/EMAIL_FROM/);
  });

  it('requires SMTP credentials as a pair and refuses disabled TLS validation', () => {
    expect(() => parseEnv({ ...validEnv, ...productionOverrides, SMTP_USER: 'user' })).toThrow(
      /together/,
    );
    expect(() =>
      parseEnv({ ...validEnv, ...productionOverrides, SMTP_REJECT_UNAUTHORIZED: 'false' }),
    ).toThrow(/certificate validation/);
  });

  it('rejects an in-memory or Redis rate limit store in production', () => {
    expect(() =>
      parseEnv({ ...validEnv, ...productionOverrides, RATE_LIMIT_STORE: 'memory' }),
    ).toThrow(/shared rate limit store/);
    expect(() =>
      parseEnv({ ...validEnv, ...productionOverrides, RATE_LIMIT_STORE: 'redis' }),
    ).toThrow(/Redis-backed/);
  });

  it('rejects local media storage in production', () => {
    expect(() =>
      parseEnv({ ...validEnv, ...productionOverrides, STORAGE_PROVIDER: 'local' }),
    ).toThrow(/STORAGE_PROVIDER=s3/);
  });

  it('requires S3 region/bucket and paired credentials for object storage', () => {
    expect(() => parseEnv({ ...validEnv, ...productionOverrides, S3_REGION: '' })).toThrow(
      /S3_REGION/,
    );
    expect(() => parseEnv({ ...validEnv, ...productionOverrides, S3_BUCKET: '' })).toThrow(
      /S3_BUCKET/,
    );
    expect(() =>
      parseEnv({ ...validEnv, ...productionOverrides, S3_ACCESS_KEY_ID: 'key-only' }),
    ).toThrow(/together/);
  });

  it('requires https for custom S3 endpoints unless explicitly allowed', () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        ...productionOverrides,
        S3_ENDPOINT: 'http://minio.internal:9000',
      }),
    ).toThrow(/S3_ENDPOINT must use https/);

    const env = parseEnv({
      ...validEnv,
      ...productionOverrides,
      S3_ENDPOINT: 'http://minio.internal:9000',
      ALLOW_INSECURE_STORAGE_ENDPOINT: 'true',
    });
    expect(env.S3_ENDPOINT).toBe('http://minio.internal:9000');
  });
});

describe('loadEnv', () => {
  it('throws a helpful error when process.env is incomplete', () => {
    const original = process.env;
    process.env = { NODE_ENV: 'development' };
    try {
      expect(() => loadEnv()).toThrow(/Invalid environment configuration/);
    } finally {
      process.env = original;
    }
  });
});
