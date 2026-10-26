import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  API_BASE_URL,
  ApiError,
  apiGet,
  apiSend,
  apiUpload,
  getCsrfToken,
  setCsrfToken,
} from './api';

describe('API_BASE_URL', () => {
  it('falls back to the local API default and strips trailing slashes', () => {
    expect(API_BASE_URL).toBe('http://localhost:4000/api/v1');
    expect(API_BASE_URL.endsWith('/')).toBe(false);
  });
});

describe('apiGet', () => {
  it('performs a JSON GET against the configured base URL with cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const result = await apiGet<{ status: string }>('/health');
      expect(result).toEqual({ status: 'ok' });
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE_URL}/health`,
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('throws ApiError with the status code and error envelope on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: 'Not found', code: 'NOT_FOUND' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(apiGet('/missing')).rejects.toMatchObject({
        name: 'ApiError',
        status: 404,
        code: 'NOT_FOUND',
        message: 'Not found',
      });
      await expect(apiGet('/missing')).rejects.toBeInstanceOf(ApiError);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('apiSend', () => {
  beforeEach(() => {
    setCsrfToken(null);
  });

  afterEach(() => {
    setCsrfToken(null);
    vi.unstubAllGlobals();
  });

  it('fetches a CSRF token first and sends it in the x-csrf-token header', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ csrfToken: 'token-abc' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 'record-1' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiSend<{ id: string }>('POST', '/heritage', { title: 'Demo' });

    expect(result).toEqual({ id: 'record-1' });
    expect(getCsrfToken()).toBe('token-abc');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_BASE_URL}/auth/csrf`,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${API_BASE_URL}/heritage`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-csrf-token': 'token-abc' }),
        body: JSON.stringify({ title: 'Demo' }),
        credentials: 'include',
      }),
    );
  });

  it('retries exactly once after a stale CSRF token is rejected', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ csrfToken: 'stale' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: { message: 'Invalid or missing CSRF token', code: 'CSRF_INVALID' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ csrfToken: 'fresh' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiSend<{ ok: boolean }>('PATCH', '/heritage/1', { title: 'Updated' });

    expect(result).toEqual({ ok: true });
    // csrf → rejected attempt → refreshed csrf → successful retry
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(getCsrfToken()).toBe('fresh');
  });

  it('throws instead of looping when the retried token is also rejected', async () => {
    const csrfResponse = () => ({
      ok: true,
      status: 200,
      json: async () => ({ csrfToken: 'doomed' }),
    });
    const rejectResponse = {
      ok: false,
      status: 403,
      json: async () => ({
        error: { message: 'Invalid or missing CSRF token', code: 'CSRF_INVALID' },
      }),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse())
      .mockResolvedValueOnce(rejectResponse)
      .mockResolvedValueOnce(csrfResponse())
      .mockResolvedValueOnce(rejectResponse);
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiSend('POST', '/heritage', {})).rejects.toMatchObject({
      status: 403,
      code: 'CSRF_INVALID',
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('returns undefined for 204 responses without parsing a body', async () => {
    setCsrfToken('token-abc');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error('should not parse');
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiSend('POST', '/auth/logout')).resolves.toBeUndefined();
  });
});

describe('apiUpload', () => {
  beforeEach(() => {
    setCsrfToken(null);
  });

  afterEach(() => {
    setCsrfToken(null);
    vi.unstubAllGlobals();
  });

  it('posts multipart data with a CSRF token and lets fetch set the boundary', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ csrfToken: 'upload-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ media: { id: 'media-1' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const formData = new FormData();
    formData.append('file', new Blob(['demo']), 'demo.pdf');
    const result = await apiUpload<{ media: { id: string } }>('/media/record-1/upload', formData);

    expect(result.media.id).toBe('media-1');
    const [url, init] = fetchMock.mock.calls[1] ?? [];
    expect(url).toBe(`${API_BASE_URL}/media/record-1/upload`);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['x-csrf-token']).toBe('upload-token');
    expect(headers['Content-Type']).toBeUndefined();
  });
});
