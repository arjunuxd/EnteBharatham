import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs/promises';
import path from 'path';
import type { Env } from '../../config/env.js';

/**
 * Storage abstraction for heritage media.
 *
 * Two adapters exist:
 * - {@link LocalStorageAdapter}: development/tests only, stores files under a
 *   local directory.
 * - {@link S3StorageAdapter}: any S3-compatible object store (AWS S3,
 *   Cloudflare R2, Backblaze B2, MinIO, ...). Objects are always private; the
 *   API either proxies the object or returns a short-lived signed URL.
 *
 * Storage keys are generated server-side (see
 * `services/media/validation.ts`) and validated here, so a client can never
 * choose a path or object key.
 */

export interface StorageAdapter {
  upload(
    storageKey: string,
    content: Buffer,
    contentType: string,
  ): Promise<{ storageKey: string; size: number }>;
  getMetadata(storageKey: string): Promise<{ size: number; contentType: string } | null>;
  delete(storageKey: string): Promise<void>;
  getObject(storageKey: string): Promise<{ content: Buffer; contentType: string } | null>;
  /**
   * Short-lived authorized download URL, when the provider supports it.
   * Returns null for adapters (local) that must be proxied by the API.
   */
  getSignedUrl?(storageKey: string, expiresInSeconds: number): Promise<string | null>;
}

const STORAGE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/;

/** Rejects traversal, absolute paths, backslashes, and control characters. */
export function assertSafeStorageKey(storageKey: string): void {
  if (
    !STORAGE_KEY_PATTERN.test(storageKey) ||
    storageKey.includes('..') ||
    storageKey.includes('//') ||
    storageKey.startsWith('/')
  ) {
    throw new Error('Invalid storage key');
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private baseDir: string) {}

  private resolveKey(storageKey: string): string {
    assertSafeStorageKey(storageKey);
    // Local keys are flat: a nested key is rejected rather than resolved.
    const safe = path.basename(storageKey);
    if (safe !== storageKey) {
      throw new Error('Invalid storage key');
    }
    return path.join(this.baseDir, safe);
  }

  async upload(
    storageKey: string,
    content: Buffer,
    _contentType: string,
  ): Promise<{ storageKey: string; size: number }> {
    void _contentType;
    await fs.mkdir(this.baseDir, { recursive: true });
    const fullPath = this.resolveKey(storageKey);
    await fs.writeFile(fullPath, content, { flag: 'wx' });
    return { storageKey, size: content.length };
  }

  async getMetadata(storageKey: string): Promise<{ size: number; contentType: string } | null> {
    try {
      const fullPath = this.resolveKey(storageKey);
      const stat = await fs.stat(fullPath);
      return { size: stat.size, contentType: 'application/octet-stream' };
    } catch {
      return null;
    }
  }

  async delete(storageKey: string): Promise<void> {
    try {
      const fullPath = this.resolveKey(storageKey);
      await fs.unlink(fullPath);
    } catch {
      // Idempotent: a missing file is already deleted.
    }
  }

  async getObject(storageKey: string): Promise<{ content: Buffer; contentType: string } | null> {
    try {
      const fullPath = this.resolveKey(storageKey);
      const content = await fs.readFile(fullPath);
      return { content, contentType: 'application/octet-stream' };
    } catch {
      return null;
    }
  }
}

export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly signedUrlTtlSeconds: number;

  constructor(
    options: {
      region: string;
      bucket: string;
      endpoint?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      forcePathStyle?: boolean;
      prefix?: string;
      signedUrlTtlSeconds?: number;
    },
    client?: S3Client,
  ) {
    this.bucket = options.bucket;
    this.prefix = options.prefix ?? '';
    this.signedUrlTtlSeconds = options.signedUrlTtlSeconds ?? 300;
    this.client =
      client ??
      new S3Client({
        region: options.region,
        ...(options.endpoint !== undefined ? { endpoint: options.endpoint } : {}),
        forcePathStyle: options.forcePathStyle ?? false,
        ...(options.accessKeyId !== undefined && options.secretAccessKey !== undefined
          ? {
              credentials: {
                accessKeyId: options.accessKeyId,
                secretAccessKey: options.secretAccessKey,
              },
            }
          : {}),
      });
  }

  private objectKey(storageKey: string): string {
    assertSafeStorageKey(storageKey);
    return `${this.prefix}${storageKey}`;
  }

  async upload(
    storageKey: string,
    content: Buffer,
    contentType: string,
  ): Promise<{ storageKey: string; size: number }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(storageKey),
        Body: content,
        ContentLength: content.length,
        ContentType: contentType,
        CacheControl: 'private, no-store',
        // Deliberately no ACL: bucket policies decide access, and the default
        // is private. Public URLs are never constructed for restricted media.
      }),
    );
    return { storageKey, size: content.length };
  }

  async getMetadata(storageKey: string): Promise<{ size: number; contentType: string } | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.objectKey(storageKey) }),
      );
      return {
        size: result.ContentLength ?? 0,
        contentType: result.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(storageKey: string): Promise<void> {
    // S3 DeleteObject is idempotent: deleting a missing key succeeds.
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey(storageKey) }),
    );
  }

  async getObject(storageKey: string): Promise<{ content: Buffer; contentType: string } | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(storageKey) }),
      );
      if (result.Body === undefined) return null;
      const bytes = await result.Body.transformToByteArray();
      return {
        content: Buffer.from(bytes),
        contentType: result.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async getSignedUrl(storageKey: string, expiresInSeconds: number): Promise<string> {
    const ttl = Math.max(30, Math.min(expiresInSeconds, this.signedUrlTtlSeconds));
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(storageKey) }),
      { expiresIn: ttl },
    );
  }
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    candidate.name === 'NoSuchKey' ||
    candidate.name === 'NotFound' ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

/** Builds the configured adapter from validated environment configuration. */
export function createStorageAdapter(env: Env): StorageAdapter {
  if (env.STORAGE_PROVIDER === 'local') {
    return new LocalStorageAdapter(env.MEDIA_UPLOAD_DIR);
  }
  return new S3StorageAdapter({
    region: env.S3_REGION ?? '',
    bucket: env.S3_BUCKET ?? '',
    ...(env.S3_ENDPOINT !== undefined ? { endpoint: env.S3_ENDPOINT } : {}),
    ...(env.S3_ACCESS_KEY_ID !== undefined ? { accessKeyId: env.S3_ACCESS_KEY_ID } : {}),
    ...(env.S3_SECRET_ACCESS_KEY !== undefined
      ? { secretAccessKey: env.S3_SECRET_ACCESS_KEY }
      : {}),
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    prefix: env.S3_PREFIX,
    signedUrlTtlSeconds: env.MEDIA_SIGNED_URL_TTL_SECONDS,
  });
}
