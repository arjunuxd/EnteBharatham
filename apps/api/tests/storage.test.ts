import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LocalStorageAdapter,
  S3StorageAdapter,
  assertSafeStorageKey,
  createStorageAdapter,
} from '../src/services/storage/index.js';
import {
  detectMimeFromSignature,
  generateStorageKey,
  sanitizeDisplayName,
  storageKeyWithExtension,
  validateUploadedContent,
} from '../src/services/media/validation.js';
import { createTestEnv } from './helpers/testApp.js';

describe('storage key validation', () => {
  it('accepts opaque generated keys', () => {
    expect(() => assertSafeStorageKey(generateStorageKey('media'))).not.toThrow();
    expect(() => assertSafeStorageKey('media/2026/photo.png')).not.toThrow();
  });

  it('rejects traversal, absolute paths, backslashes, and empty keys', () => {
    for (const key of [
      '../secret',
      'media/../../etc/passwd',
      '/etc/passwd',
      'media\\file',
      '',
      '.hidden',
    ]) {
      expect(() => assertSafeStorageKey(key), key).toThrow(/Invalid storage key/);
    }
  });
});

describe('media validation', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
  const pdf = Buffer.from('%PDF-1.7\n');

  it('detects supported signatures', () => {
    expect(detectMimeFromSignature(png)).toBe('image/png');
    expect(detectMimeFromSignature(jpeg)).toBe('image/jpeg');
    expect(detectMimeFromSignature(pdf)).toBe('application/pdf');
    expect(detectMimeFromSignature(Buffer.from('plain text'))).toBeNull();
  });

  it('rejects a declared type that does not match the bytes', () => {
    expect(() => validateUploadedContent('image/png', jpeg)).toThrow(/does not match/);
    expect(() => validateUploadedContent('text/html', Buffer.from('<script>'))).toThrow(
      /not allowed/,
    );
    expect(() => validateUploadedContent('image/png', Buffer.alloc(0))).toThrow(/Empty/);
  });

  it('sanitizes display names and strips paths/control characters', () => {
    expect(sanitizeDisplayName('../../etc/pass\u0000wd.jpg')).not.toContain('/');
    expect(sanitizeDisplayName('../../etc/pass\u0000wd.jpg')).not.toContain('\\');
    expect(sanitizeDisplayName('a'.repeat(400))).toHaveLength(255);
  });

  it('appends an extension derived from the validated MIME type only', () => {
    expect(storageKeyWithExtension('hero', 'image/png')).toBe('hero.png');
    expect(storageKeyWithExtension('hero', 'application/pdf')).toBe('hero.pdf');
    expect(storageKeyWithExtension('hero', 'unknown/type')).toBe('hero');
  });
});

describe('LocalStorageAdapter', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'entebharatham-storage-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('stores, reads, and deletes content', async () => {
    const storage = new LocalStorageAdapter(dir);
    const content = Buffer.from('hello heritage');
    const result = await storage.upload('media_abc.bin', content, 'application/octet-stream');
    expect(result).toEqual({ storageKey: 'media_abc.bin', size: content.length });

    const metadata = await storage.getMetadata('media_abc.bin');
    expect(metadata?.size).toBe(content.length);

    const object = await storage.getObject('media_abc.bin');
    expect(object?.content.equals(content)).toBe(true);

    await storage.delete('media_abc.bin');
    expect(await storage.getObject('media_abc.bin')).toBeNull();
    // Deletion is idempotent.
    await expect(storage.delete('media_abc.bin')).resolves.toBeUndefined();
  });

  it('refuses nested keys instead of resolving them', async () => {
    const storage = new LocalStorageAdapter(dir);
    await expect(storage.upload('nested/key.bin', Buffer.from('x'), 'text/plain')).rejects.toThrow(
      /Invalid storage key/,
    );
  });
});

describe('S3StorageAdapter', () => {
  /** Minimal command-capturing S3 client double; no network is ever used. */
  function fakeClient() {
    const commands: Array<{ name: string; input: Record<string, unknown> }> = [];
    return {
      commands,
      send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
        commands.push({ name: command.constructor.name, input: command.input });
        if (command.constructor.name === 'GetObjectCommand') {
          return {
            Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
            ContentType: 'image/png',
          };
        }
        if (command.constructor.name === 'HeadObjectCommand') {
          return { ContentLength: 3, ContentType: 'image/png' };
        }
        return {};
      },
    };
  }

  it('writes private objects under the configured prefix with no ACL', async () => {
    const client = fakeClient();
    const storage = new S3StorageAdapter(
      { region: 'ap-south-1', bucket: 'bucket', prefix: 'media/' },
      client as never,
    );

    const content = Buffer.from([1, 2, 3]);
    await storage.upload('key.png', content, 'image/png');

    const put = client.commands.find((command) => command.name === 'PutObjectCommand');
    expect(put?.input.Key).toBe('media/key.png');
    expect(put?.input.Bucket).toBe('bucket');
    expect(put?.input.ContentType).toBe('image/png');
    expect(put?.input.CacheControl).toBe('private, no-store');
    expect(put?.input).not.toHaveProperty('ACL');

    await storage.delete('key.png');
    expect(client.commands.at(-1)?.name).toBe('DeleteObjectCommand');
  });

  it('returns null for missing objects and reads present ones', async () => {
    const client = fakeClient();
    const storage = new S3StorageAdapter({ region: 'r', bucket: 'b' }, client as never);
    expect(await storage.getMetadata('key.png')).toEqual({ size: 3, contentType: 'image/png' });
    const object = await storage.getObject('key.png');
    expect(object?.content.equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  it('maps a 404 from the provider to null', async () => {
    const storage = new S3StorageAdapter({ region: 'r', bucket: 'b' }, {
      send: async () => {
        throw Object.assign(new Error('missing'), {
          name: 'NotFound',
          $metadata: { httpStatusCode: 404 },
        });
      },
    } as never);
    expect(await storage.getObject('key.png')).toBeNull();
    expect(await storage.getMetadata('key.png')).toBeNull();
  });
});

describe('createStorageAdapter', () => {
  it('selects the local adapter for local environments', () => {
    const adapter = createStorageAdapter(createTestEnv({ MEDIA_UPLOAD_DIR: 'tmp-uploads' }));
    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
  });

  it('selects the S3 adapter when object storage is configured', () => {
    const env = createTestEnv({
      STORAGE_PROVIDER: 's3',
      S3_REGION: 'ap-south-1',
      S3_BUCKET: 'entebharatham-media',
    });
    expect(createStorageAdapter(env)).toBeInstanceOf(S3StorageAdapter);
  });
});
