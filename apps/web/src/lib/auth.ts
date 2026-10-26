import type { AuthUserPublic } from '@entebharatham/shared';
import { ApiError, apiGet, apiSend, clearApiCache, setCsrfToken } from './api';

/** Response shape of /auth/register, /auth/login, and /auth/me. */
export interface AuthSessionResponse {
  user: AuthUserPublic;
  csrfToken: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

/**
 * Restores the current session from the httpOnly cookie. Returns null on
 * 401 (no/expired session) and throws on other failures so the UI can
 * distinguish "logged out" from "API unavailable".
 */
export async function fetchMe(signal?: AbortSignal): Promise<AuthSessionResponse | null> {
  try {
    const result = await apiGet<AuthSessionResponse>('/auth/me', signal);
    setCsrfToken(result.csrfToken);
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      setCsrfToken(null);
      return null;
    }
    throw error;
  }
}

/** Registers a contributor account and starts its session. */
export async function registerAccount(payload: RegisterPayload): Promise<AuthSessionResponse> {
  const result = await apiSend<AuthSessionResponse>('POST', '/auth/register', payload);
  clearApiCache();
  setCsrfToken(result.csrfToken);
  return result;
}

/** Logs in and starts a fresh session (the server rotates the session id). */
export async function loginAccount(payload: LoginPayload): Promise<AuthSessionResponse> {
  const result = await apiSend<AuthSessionResponse>('POST', '/auth/login', payload);
  clearApiCache();
  setCsrfToken(result.csrfToken);
  return result;
}

/** Ends the session server-side and clears the local CSRF token. */
export async function logoutAccount(): Promise<void> {
  await apiSend<void>('POST', '/auth/logout');
  clearApiCache();
  setCsrfToken(null);
}
