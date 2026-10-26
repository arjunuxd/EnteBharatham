import { z } from 'zod';

/**
 * Placeholder secret for local development and tests ONLY. Production rejects
 * it explicitly (see the superRefine below) so it can never ship silently.
 */
const DEV_SESSION_SECRET = 'entebharatham-development-session-secret-do-not-use-in-production';

/** Parses common boolean spellings from environment strings. */
const booleanFromString = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  return value;
}, z.boolean());

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function hasMongoDatabaseName(uri: string): boolean {
  const match = /^mongodb(\+srv)?:\/\//i.exec(uri);
  if (match === null) return false;
  const remainder = uri.slice(match[0].length);
  // Credentials may contain an escaped slash (%2F) but not a raw slash.
  const slash = remainder.indexOf('/');
  if (slash === -1) return false;
  const database =
    remainder
      .slice(slash + 1)
      .split('?')[0]
      ?.trim() ?? '';
  return database.length > 0;
}

function isLocalMongoUri(uri: string): boolean {
  const hostPart = uri.replace(/^mongodb(\+srv)?:\/\//i, '').split('/')[0] ?? '';
  const host = hostPart.includes('@') ? hostPart.slice(hostPart.lastIndexOf('@') + 1) : hostPart;
  const hostname = host.split(':')[0]?.toLowerCase() ?? '';
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    API_CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
      )
      .refine((origins) => origins.length > 0, {
        message: 'API_CORS_ORIGINS must contain at least one origin',
      })
      .refine(
        (origins) => {
          return origins.every((origin) => {
            if (origin === '*') return true;
            try {
              const url = new URL(origin);
              return url.protocol === 'http:' || url.protocol === 'https:';
            } catch {
              return false;
            }
          });
        },
        {
          message: 'Each CORS origin must be "*" or a valid http(s) URL',
        },
      ),
    // Signs session cookies and CSRF tokens. Required (strong) in production;
    // a fixed development default is used elsewhere and rejected in prod.
    SESSION_SECRET: z.string().default(DEV_SESSION_SECRET),
    // SameSite policy for the session cookie. Cross-site deployments (e.g.
    // Vercel frontend calling a Render API) require "none" plus Secure.
    SESSION_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    // Session lifetime in hours (default 7 days).
    SESSION_MAX_AGE_HOURS: z.coerce.number().int().min(1).max(2160).default(168),
    // Number of trusted proxy hops in front of the API (0 = none). Set to 1
    // when deployed behind a single reverse proxy (e.g. Render) so rate
    // limiting and secure-cookie logic see the real client address.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
    // Email delivery: 'dev'/'test' for local, 'smtp' for production.
    EMAIL_PROVIDER: z.enum(['dev', 'test', 'smtp']).default('dev'),
    EMAIL_FROM: z.string().trim().optional(),
    SMTP_HOST: z.string().trim().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    // true for implicit TLS (usually port 465); false for STARTTLS (587).
    SMTP_SECURE: booleanFromString.default(false),
    // Upgrade to TLS when the server advertises STARTTLS.
    SMTP_REQUIRE_TLS: booleanFromString.default(true),
    // Certificate validation must never be disabled in production.
    SMTP_REJECT_UNAUTHORIZED: booleanFromString.default(true),
    // Public frontend URL used in verification/reset links.
    APP_BASE_URL: z
      .string()
      .trim()
      .url('APP_BASE_URL must be a valid URL')
      .default('http://localhost:5173'),
    // Rate limiter shared store (for multi-instance). 'memory' (dev/test) or
    // 'mongo' (shared via MongoDB). Redis is not supported by this deployment
    // and is rejected in production.
    RATE_LIMIT_STORE: z
      .enum(['memory', 'redis', 'mongo', 'mongodb'])
      .default('memory')
      .transform((value) => (value === 'mongodb' ? 'mongo' : value)),
    REDIS_URL: z.string().optional(),
    // Media storage. 'object' is accepted as a legacy alias for 's3'.
    STORAGE_PROVIDER: z
      .enum(['local', 's3', 'object'])
      .default('local')
      .transform((value) => (value === 'object' ? 's3' : value)),
    MEDIA_UPLOAD_DIR: z.string().default('uploads'),
    MEDIA_MAX_SIZE_BYTES: z.coerce
      .number()
      .int()
      .min(1)
      .default(10 * 1024 * 1024),
    MEDIA_MAX_COUNT_PER_RECORD: z.coerce.number().int().min(1).default(10),
    // Lifetime of signed media URLs (short-lived by design).
    MEDIA_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
    // S3-compatible object storage. Credentials are optional only when the
    // runtime supplies them through its instance role/credential chain.
    S3_ENDPOINT: z.string().trim().optional(),
    S3_REGION: z.string().trim().optional(),
    S3_BUCKET: z.string().trim().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: booleanFromString.default(false),
    S3_PREFIX: z
      .string()
      .trim()
      .default('media/')
      .transform((value) => (value.endsWith('/') ? value : `${value}/`)),
    // Escape hatch for local/self-hosted MongoDB use in a production build.
    ALLOW_LOCAL_DATABASE_IN_PRODUCTION: booleanFromString.default(false),
    // Escape hatch for HTTP object-storage endpoints (e.g. MinIO on a private
    // network). Never enable this for a public endpoint.
    ALLOW_INSECURE_STORAGE_ENDPOINT: booleanFromString.default(false),
  })
  .superRefine((value, ctx) => {
    const production = value.NODE_ENV === 'production';
    const usesWildcard = value.API_CORS_ORIGINS.includes('*');

    if (!/^mongodb(\+srv)?:\/\//i.test(value.MONGODB_URI)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MONGODB_URI'],
        message: 'MONGODB_URI must start with mongodb:// or mongodb+srv://',
      });
    } else if (!hasMongoDatabaseName(value.MONGODB_URI)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MONGODB_URI'],
        message: 'MONGODB_URI must include a database name',
      });
    }

    if (production && usesWildcard) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['API_CORS_ORIGINS'],
        message: 'Wildcard CORS ("*") is not allowed in production',
      });
    }

    if (
      production &&
      isLocalMongoUri(value.MONGODB_URI) &&
      !value.ALLOW_LOCAL_DATABASE_IN_PRODUCTION
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MONGODB_URI'],
        message:
          'Production requires a remote MongoDB (for example MongoDB Atlas). Set ALLOW_LOCAL_DATABASE_IN_PRODUCTION=true only for an intentional self-hosted deployment.',
      });
    }

    if (production) {
      if (value.SESSION_SECRET === DEV_SESSION_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SESSION_SECRET'],
          message: 'SESSION_SECRET must be set to a unique value in production',
        });
      } else if (value.SESSION_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SESSION_SECRET'],
          message: 'SESSION_SECRET must be at least 32 characters in production',
        });
      }

      try {
        const parsedAppBaseUrl = new URL(value.APP_BASE_URL);
        if (parsedAppBaseUrl.protocol !== 'https:') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['APP_BASE_URL'],
            message: 'APP_BASE_URL must use https in production',
          });
        }
      } catch {
        // APP_BASE_URL is already validated as a URL above; this is defensive only.
      }

      if (value.EMAIL_PROVIDER !== 'smtp') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_PROVIDER'],
          message: 'Production must use EMAIL_PROVIDER=smtp',
        });
      }

      if (value.RATE_LIMIT_STORE === 'memory') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['RATE_LIMIT_STORE'],
          message: 'Production must use a shared rate limit store',
        });
      }
      if (value.RATE_LIMIT_STORE === 'redis') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['RATE_LIMIT_STORE'],
          message:
            'Redis-backed rate limiting is not supported in this deployment; use RATE_LIMIT_STORE=mongo',
        });
      }
      if (value.STORAGE_PROVIDER === 'local') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['STORAGE_PROVIDER'],
          message: 'Production media storage must be configured with STORAGE_PROVIDER=s3',
        });
      }
    }

    if (value.EMAIL_PROVIDER === 'smtp') {
      if (value.SMTP_HOST === undefined || value.SMTP_HOST.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_HOST'],
          message: 'SMTP_HOST is required when EMAIL_PROVIDER=smtp',
        });
      }
      if (value.EMAIL_FROM === undefined || !EMAIL_PATTERN.test(value.EMAIL_FROM)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_FROM'],
          message: 'EMAIL_FROM must be a valid email address when EMAIL_PROVIDER=smtp',
        });
      }
      if ((value.SMTP_USER === undefined) !== (value.SMTP_PASS === undefined)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_USER'],
          message: 'SMTP_USER and SMTP_PASS must be provided together',
        });
      }
      if (value.SMTP_REJECT_UNAUTHORIZED === false) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_REJECT_UNAUTHORIZED'],
          message: 'SMTP certificate validation cannot be disabled',
        });
      }
    }

    if (value.STORAGE_PROVIDER === 's3') {
      if (value.S3_REGION === undefined || value.S3_REGION.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['S3_REGION'],
          message: 'S3_REGION is required when STORAGE_PROVIDER=s3',
        });
      }
      if (value.S3_BUCKET === undefined || value.S3_BUCKET.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['S3_BUCKET'],
          message: 'S3_BUCKET is required when STORAGE_PROVIDER=s3',
        });
      }
      if ((value.S3_ACCESS_KEY_ID === undefined) !== (value.S3_SECRET_ACCESS_KEY === undefined)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['S3_ACCESS_KEY_ID'],
          message: 'S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be provided together',
        });
      }
      if (value.S3_ENDPOINT !== undefined) {
        try {
          const endpoint = new URL(value.S3_ENDPOINT);
          if (endpoint.protocol !== 'https:' && !value.ALLOW_INSECURE_STORAGE_ENDPOINT) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['S3_ENDPOINT'],
              message:
                'S3_ENDPOINT must use https. Set ALLOW_INSECURE_STORAGE_ENDPOINT=true only for a private/self-hosted endpoint.',
            });
          }
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['S3_ENDPOINT'],
            message: 'S3_ENDPOINT must be a valid URL',
          });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;
export type StorageProvider = Env['STORAGE_PROVIDER'];

/**
 * Validates and normalizes a raw environment bag into a typed {@link Env}.
 * Pure function so it can be unit-tested without mutating process.env.
 */
export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  return envSchema.parse(raw);
}

/**
 * Loads environment variables from process.env (optionally seeded from a
 * .env file by the caller) and fails fast on invalid configuration.
 */
export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}
