import { FileAudio, FileImage, FileText, Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiError, apiUpload } from '../lib/api';
import { InlineNotice } from './ui/States';

const MAX_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/aac',
  'application/pdf',
]);

const ALLOWED_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'mp3',
  'wav',
  'm4a',
  'aac',
  'pdf',
]);

function isAllowed(file: File): boolean {
  if (ALLOWED_MIME.has(file.type)) return true;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension !== undefined && ALLOWED_EXTENSIONS.has(extension);
}

/**
 * Media upload for a draft the contributor owns.
 *
 * Files are validated in the browser for fast feedback, but the server remains
 * the authority for both MIME type and size. Uploads go through the CSRF-aware
 * multipart helper; a raw fetch would be rejected with `CSRF_INVALID`.
 */
export function UploadMedia({ recordId }: { recordId: string }) {
  const { status } = useAuth();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  if (status !== 'authenticated') return null;

  const chooseFile = (selected: File | null) => {
    setError(null);
    setSuccess(null);
    if (selected === null) {
      setFile(null);
      return;
    }
    if (!isAllowed(selected)) {
      setFile(null);
      setError('Choose a JPEG, PNG, WebP, MP3, WAV, M4A, AAC, or PDF file.');
      if (inputRef.current !== null) inputRef.current.value = '';
      return;
    }
    if (selected.size > MAX_SIZE) {
      setFile(null);
      setError('Files must be 10 MB or smaller.');
      if (inputRef.current !== null) inputRef.current.value = '';
      return;
    }
    setFile(selected);
  };

  const upload = async () => {
    if (file === null || uploading) return;
    setError(null);
    setSuccess(null);
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await apiUpload<unknown>(`/media/${encodeURIComponent(recordId)}/upload`, formData);
      setSuccess(`${file.name} uploaded.`);
      setFile(null);
      if (inputRef.current !== null) inputRef.current.value = '';
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 413) {
        setError('That file is larger than the 10 MB limit.');
      } else if (caught instanceof ApiError && caught.status === 415) {
        setError(
          'That file type is not supported. Choose a JPEG, PNG, WebP, MP3, WAV, M4A, AAC, or PDF file.',
        );
      } else if (caught instanceof ApiError && caught.status === 403) {
        setError('Your session expired. Sign in again before uploading.');
      } else if (caught instanceof ApiError && caught.status === 429) {
        setError('Too many uploads right now. Please wait a moment and try again.');
      } else if (caught instanceof ApiError) {
        setError(caught.message);
      } else {
        setError('We could not upload the file. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <section aria-labelledby="media-heading" className="card-paper p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cream text-forest">
          <Upload className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 id="media-heading" className="font-display text-xl text-ink">
            Media
          </h2>
          <p className="mt-1 text-sm leading-6 text-earth-ink">
            Add a photograph, recording, or document that belongs with this record. Only upload
            material you have permission to share.
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-5">
        <label htmlFor={inputId} className="field-label">
          Choose a file
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.mp3,.wav,.m4a,.aac,.pdf,image/jpeg,image/png,image/webp,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,application/pdf"
          onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          className="block w-full cursor-pointer rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-earth-ink file:mr-3 file:rounded-xs file:border-0 file:bg-forest file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ivory hover:file:bg-forest-deep"
        />

        <div className="mt-3 grid gap-2 text-xs leading-5 text-earth-ink sm:grid-cols-3">
          <span className="inline-flex items-center gap-2">
            <FileImage className="h-3.5 w-3.5 shrink-0 text-earth-ink" aria-hidden="true" />
            JPEG, PNG, WebP
          </span>
          <span className="inline-flex items-center gap-2">
            <FileAudio className="h-3.5 w-3.5 shrink-0 text-earth-ink" aria-hidden="true" />
            MP3, WAV, M4A, AAC
          </span>
          <span className="inline-flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 shrink-0 text-earth-ink" aria-hidden="true" />
            PDF
          </span>
        </div>
        <p className="field-hint">
          Up to 10 MB per file. Files larger than that or of another type cannot be uploaded.
        </p>

        <button
          type="button"
          onClick={() => void upload()}
          disabled={file === null || uploading}
          className="btn-primary btn-sm mt-4"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {success !== null && (
        <div role="status">
          <InlineNotice tone="success" live="status" className="mt-4">
            {success}
          </InlineNotice>
        </div>
      )}

      {error !== null && (
        <InlineNotice tone="error" live="alert" className="mt-4">
          {error}
        </InlineNotice>
      )}
    </section>
  );
}
