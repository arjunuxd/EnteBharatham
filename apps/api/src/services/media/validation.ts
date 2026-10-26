import { randomBytes, randomUUID } from 'crypto';

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp'] as const;
const ALLOWED_AUDIO = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac'] as const;
const ALLOWED_DOC = ['application/pdf'] as const;

export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  ...ALLOWED_IMAGE,
  ...ALLOWED_AUDIO,
  ...ALLOWED_DOC,
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'application/pdf': '.pdf',
};

export function detectMediaType(mime: string): 'image' | 'audio' | 'document' | null {
  if ((ALLOWED_IMAGE as readonly string[]).includes(mime)) return 'image';
  if ((ALLOWED_AUDIO as readonly string[]).includes(mime)) return 'audio';
  if ((ALLOWED_DOC as readonly string[]).includes(mime)) return 'document';
  return null;
}

export function isAllowedMime(mime: string): boolean {
  return detectMediaType(mime) !== null;
}

export function sanitizeDisplayName(name: string): string {
  // Strip path components and control chars.
  return name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\p{C}/gu, '')
    .slice(0, 255);
}

/**
 * Content-signature check. The declared MIME type is never trusted on its
 * own: the first bytes of the upload must match a known container for that
 * type. Returns the detected MIME type, or null when the signature is not
 * recognised.
 */
export function detectMimeFromSignature(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer.length >= 8 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  // PDF: %PDF-
  if (buffer.toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf';
  }
  // WAV: RIFF....WAVE
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  ) {
    return 'audio/wav';
  }
  // AAC ADTS: FF F1 or FF F9 (check before the broader MPEG sync).
  if (buffer[0] === 0xff && (buffer[1] === 0xf1 || buffer[1] === 0xf9)) {
    return 'audio/aac';
  }
  // MP3: ID3 tag or an MPEG audio frame sync (FF Ex, excluding ADTS above).
  if (
    buffer.toString('ascii', 0, 3) === 'ID3' ||
    (buffer[0] === 0xff && buffer.length >= 2 && (buffer[1] ?? 0) >= 0xe0)
  ) {
    return 'audio/mpeg';
  }
  // MP4/M4A: box size + 'ftyp' at offset 4.
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    return 'audio/mp4';
  }

  return null;
}

/**
 * Verifies the declared type is allowed and that the bytes really are that
 * type. WAV and x-wav are the same container; the declared alias is accepted.
 */
export function validateUploadedContent(
  declaredMime: string,
  content: Buffer,
): { mediaType: 'image' | 'audio' | 'document'; mime: string } {
  if (content.length === 0) {
    throw new Error('Empty file');
  }
  const mediaType = detectMediaType(declaredMime);
  if (mediaType === null) {
    throw new Error('File type not allowed');
  }
  const detected = detectMimeFromSignature(content);
  if (detected === null) {
    throw new Error('File content does not match a supported type');
  }
  const matches =
    detected === declaredMime ||
    (detected === 'audio/wav' && declaredMime === 'audio/x-wav') ||
    (detected === 'audio/mpeg' && declaredMime === 'audio/mpeg');
  if (!matches) {
    throw new Error('File content does not match declared type');
  }
  return { mediaType, mime: declaredMime };
}

/**
 * Generates an unpredictable storage key. Nothing from the client (filename,
 * path, MIME-derived extension except a fixed lookup) influences the key.
 */
export function generateStorageKey(prefix = 'media'): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'media';
  return `${safePrefix}_${Date.now()}_${randomUUID().replace(/-/g, '')}${randomBytes(8).toString('hex')}`;
}

/** Generated keys are opaque; when a provider needs an extension we append it. */
export function storageKeyWithExtension(storageKey: string, mime: string): string {
  return `${storageKey}${EXTENSION_BY_MIME[mime] ?? ''}`;
}
