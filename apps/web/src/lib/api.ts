const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

/**
 * Configurable API base URL. The browser only ever talks to the backend
 * through this value — never directly to the database.
 */
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

/** Standard error envelope returned by the API's central error handler. */
interface ApiErrorEnvelope {
  error?: {
    message?: string;
    code?: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Requests fail fast instead of leaving the interface spinning forever. */
const DEFAULT_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;
const PUBLIC_CACHE_TTL_MS = 60_000;
const PUBLIC_CACHE_MAX_ENTRIES = 100;

const FRIENDLY_NETWORK_MESSAGE =
  "We couldn't reach the archive right now. Check your connection and try again.";
const FRIENDLY_SERVER_MESSAGE = 'Something went wrong on our side. Please try again in a moment.';
const FRIENDLY_TIMEOUT_MESSAGE = 'The archive is taking longer than usual. Please try again.';

/**
 * Plain-language fallbacks keyed by status. The API's own messages are used
 * for client errors when present; server errors, proxy HTML, and empty bodies
 * always get a friendly message instead of a status number or markup.
 */
const STATUS_FALLBACK: Record<number, string> = {
  400: 'Some details need attention. Please check them and try again.',
  401: 'Please sign in to continue.',
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: 'That action conflicts with the current state. Refresh the page and try again.',
  413: 'That file is too large. Please choose a smaller one.',
  415: 'That file type is not supported.',
  422: 'Some details need attention. Please check them and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
};

const CODE_FALLBACK: Record<string, string> = {
  CSRF_INVALID: 'Your session needs to be refreshed. Please try again.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  NETWORK_ERROR: FRIENDLY_NETWORK_MESSAGE,
  TIMEOUT: FRIENDLY_TIMEOUT_MESSAGE,
};

function friendlyFallback(status: number): string {
  if (status >= 500) return FRIENDLY_SERVER_MESSAGE;
  return STATUS_FALLBACK[status] ?? 'Something went wrong. Please try again.';
}

/**
 * Parses the API's error envelope into an ApiError. Untrusted/technical
 * messages (5xx) are replaced with a friendly sentence; 4xx messages are
 * curated server-side and safe to show.
 */
async function toApiError(response: Response): Promise<ApiError> {
  let message: string | undefined;
  let code: string | undefined;
  let details: unknown;
  try {
    const body = (await response.json()) as ApiErrorEnvelope;
    if (body.error !== undefined) {
      message = typeof body.error.message === 'string' ? body.error.message : undefined;
      code = body.error.code;
      details = body.error.details;
    }
  } catch {
    // Non-JSON error body (proxy, gateway, empty response) — use the fallback.
  }

  const fallback = code !== undefined ? CODE_FALLBACK[code] : undefined;
  const safeMessage =
    response.status >= 500
      ? FRIENDLY_SERVER_MESSAGE
      : (fallback ?? message ?? friendlyFallback(response.status));
  return new ApiError(safeMessage, response.status, code, details);
}

/**
 * Runs `fetch` with a timeout and converts transport failures into friendly
 * ApiErrors. Caller aborts are re-thrown unchanged so components can ignore
 * them when unmounting.
 */
async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const abortFromCaller = () => controller.abort();
  if (signal !== undefined) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', abortFromCaller, { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new ApiError(FRIENDLY_TIMEOUT_MESSAGE, 0, 'TIMEOUT');
    }
    if (signal?.aborted) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(FRIENDLY_NETWORK_MESSAGE, 0, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

/** Ends a JSON response, returning undefined for 204 rather than parsing. */
async function readJson<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * CSRF synchroniser token for the current session. Every state-changing
 * request must send it in the `x-csrf-token` header; the server keeps the
 * authoritative copy in the session and rotates it on login.
 */
let csrfToken: string | null = null;

/** Sets the CSRF token (from an auth response or the /auth/csrf endpoint). */
export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

/** Current cached CSRF token, if any. Exposed for tests. */
export function getCsrfToken(): string | null {
  return csrfToken;
}

/** Fetches (and caches) the CSRF token for a fresh or anonymous session. */
async function ensureCsrfToken(): Promise<string> {
  if (csrfToken !== null) {
    return csrfToken;
  }
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/auth/csrf`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    },
    undefined,
    DEFAULT_TIMEOUT_MS,
  );
  if (!response.ok) {
    throw await toApiError(response);
  }
  const body = (await response.json()) as { csrfToken?: string };
  if (typeof body.csrfToken !== 'string' || body.csrfToken.length === 0) {
    throw new ApiError(
      'Your session needs to be refreshed. Please try again.',
      response.status,
      'CSRF_INVALID',
    );
  }
  csrfToken = body.csrfToken;
  return csrfToken;
}

/* -------------------------------------------------------------------------- */
/* Public read cache                                                          */
/* -------------------------------------------------------------------------- */

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const publicGetCache = new Map<string, CacheEntry>();
const inFlightGets = new Map<string, Promise<unknown>>();
let cacheGeneration = 0;

/**
 * Only anonymous, publicly eligible read endpoints are cached. Owner views,
 * authentication state, media, and health checks are always fetched fresh.
 */
const PUBLIC_GET_PATTERNS = [
  /^\/heritage\?(?:[^#]*)$/,
  /^\/heritage\/[^/?#]+$/,
  /^\/heritage\/[^/?#]+\/related(?:\?[^#]*)?$/,
  /^\/discovery\/(?:facets|regions|languages)(?:\?[^#]*)?$/,
  /^\/discovery\/related\/[^/?#]+(?:\?[^#]*)?$/,
  /^\/search\/(?:suggestions|facets)(?:\?[^#]*)?$/,
  /^\/profiles\/[^/?#]+$/,
];

function isPublicCacheablePath(path: string): boolean {
  if (path.startsWith('/heritage/mine') || path.startsWith('/auth/')) return false;
  return PUBLIC_GET_PATTERNS.some((pattern) => pattern.test(path));
}

function readCache<T>(key: string): T | undefined {
  const entry = publicGetCache.get(key);
  if (entry === undefined) return undefined;
  if (entry.expiresAt <= Date.now()) {
    publicGetCache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function writeCache(key: string, value: unknown, generation: number): void {
  if (generation !== cacheGeneration) return;
  if (publicGetCache.size >= PUBLIC_CACHE_MAX_ENTRIES) {
    const oldest = publicGetCache.keys().next().value;
    if (oldest !== undefined) publicGetCache.delete(oldest);
  }
  publicGetCache.set(key, { value, expiresAt: Date.now() + PUBLIC_CACHE_TTL_MS });
}

/**
 * Clears cached public reads. Called when the session changes so a different
 * account never reuses responses fetched for the previous visitor.
 */
export function clearApiCache(): void {
  cacheGeneration += 1;
  publicGetCache.clear();
  inFlightGets.clear();
}

/** Performs the actual GET (no caching logic). */
async function executeGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}${path}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    },
    signal,
    DEFAULT_TIMEOUT_MS,
  );
  if (!response.ok) {
    throw await toApiError(response);
  }
  return readJson<T>(response);
}

/**
 * Typed GET helper. Sends cookies (`credentials: 'include'`) so session auth
 * works; safe methods never require a CSRF token. Public, anonymous reads are
 * cached briefly and concurrent identical requests are deduplicated.
 */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const cacheable = isPublicCacheablePath(path);
  if (cacheable) {
    const cached = readCache<T>(path);
    if (cached !== undefined) return cached;

    if (signal === undefined) {
      const pending = inFlightGets.get(path);
      if (pending !== undefined) return pending as Promise<T>;
    }
  }

  const generation = cacheGeneration;
  const request = executeGet<T>(path, signal).then((value) => {
    if (cacheable) writeCache(path, value, generation);
    return value;
  });

  if (cacheable && signal === undefined) {
    inFlightGets.set(path, request);
    const clearInFlight = () => {
      if (inFlightGets.get(path) === request) inFlightGets.delete(path);
    };
    request.then(clearInFlight, clearInFlight);
  }

  return request;
}

/** HTTP verbs that change state (and therefore require a CSRF token). */
export type WriteMethod = 'POST' | 'PATCH' | 'DELETE';

/**
 * Typed write helper (POST/PATCH/DELETE). Ensures a CSRF token, sends it in
 * the `x-csrf-token` header, and transparently retries exactly once after
 * refreshing the token if the server rejects it as stale (e.g. after a
 * session rotation the client has not observed yet).
 */
export async function apiSend<T>(
  method: WriteMethod,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return apiSendAttempt<T>(method, path, body, signal, true);
}

async function apiSendAttempt<T>(
  method: WriteMethod,
  path: string,
  body: unknown,
  signal: AbortSignal | undefined,
  allowRetry: boolean,
): Promise<T> {
  const token = await ensureCsrfToken();
  const response = await fetchWithTimeout(
    `${API_BASE_URL}${path}`,
    {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-csrf-token': token,
      },
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    signal,
    DEFAULT_TIMEOUT_MS,
  );

  if (response.ok) {
    return readJson<T>(response);
  }

  const error = await toApiError(response);
  if (allowRetry && error.status === 403 && error.code === 'CSRF_INVALID') {
    // Stale token: refresh once and retry the request exactly once.
    csrfToken = null;
    return apiSendAttempt<T>(method, path, body, signal, false);
  }
  throw error;
}

/**
 * CSRF-aware multipart upload helper.
 *
 * `fetch` must set the multipart boundary itself, so this deliberately omits
 * `Content-Type`. The same one-retry stale-CSRF behaviour as `apiSend` applies.
 */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  signal?: AbortSignal,
): Promise<T> {
  return apiUploadAttempt<T>(path, formData, signal, true);
}

async function apiUploadAttempt<T>(
  path: string,
  formData: FormData,
  signal: AbortSignal | undefined,
  allowRetry: boolean,
): Promise<T> {
  const token = await ensureCsrfToken();
  const response = await fetchWithTimeout(
    `${API_BASE_URL}${path}`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'x-csrf-token': token,
      },
      credentials: 'include',
      body: formData,
    },
    signal,
    UPLOAD_TIMEOUT_MS,
  );

  if (response.ok) {
    return readJson<T>(response);
  }

  const error = await toApiError(response);
  if (allowRetry && error.status === 403 && error.code === 'CSRF_INVALID') {
    csrfToken = null;
    return apiUploadAttempt<T>(path, formData, signal, false);
  }
  throw error;
}
