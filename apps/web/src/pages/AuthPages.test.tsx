import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { errorResponse, jsonResponse, sessionResponse } from '../test/apiMocks';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<unknown>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => impl(url, init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** 401 from /auth/me is what an anonymous visitor always sees. */
const anonymousMe = (url: string) =>
  url.includes('/auth/me')
    ? Promise.resolve(errorResponse(401, 'Authentication required', 'UNAUTHENTICATED'))
    : null;

describe('LoginPage', () => {
  it('signs in with the submitted credentials', async () => {
    const fetchMock = stubFetch((url, init) => {
      const anonymous = anonymousMe(url);
      if (anonymous !== null) return anonymous;
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.includes('/auth/login')) {
        expect(JSON.parse(String(init?.body))).toEqual({
          email: 'asha@example.com',
          password: 'password123',
        });
        return Promise.resolve(jsonResponse(sessionResponse()));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderLogin();

    await waitFor(() => expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled());

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'asha@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('shows an invalid-credentials message on 401', async () => {
    stubFetch((url) => {
      const anonymous = anonymousMe(url);
      if (anonymous !== null) return anonymous;
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      return Promise.resolve(errorResponse(401, 'Authentication required', 'UNAUTHENTICATED'));
    });

    renderLogin();

    await waitFor(() => expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled());

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'asha@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'wrongpass1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not correct/i);
  });

  it('shows a rate-limit message on 429', async () => {
    stubFetch((url) => {
      const anonymous = anonymousMe(url);
      if (anonymous !== null) return anonymous;
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      return Promise.resolve(errorResponse(429, 'Too many requests', 'RATE_LIMITED'));
    });

    renderLogin();

    await waitFor(() => expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled());

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'asha@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i);
  });
});

describe('RegisterPage', () => {
  it('registers the account with the submitted fields', async () => {
    const fetchMock = stubFetch((url, init) => {
      const anonymous = anonymousMe(url);
      if (anonymous !== null) return anonymous;
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.includes('/auth/register')) {
        expect(JSON.parse(String(init?.body))).toEqual({
          displayName: 'Asha',
          email: 'asha@example.com',
          password: 'password123',
        });
        return Promise.resolve(jsonResponse(sessionResponse(), 201));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderRegister();

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Asha' } });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'asha@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('shows a duplicate-account message on 409', async () => {
    stubFetch((url) => {
      const anonymous = anonymousMe(url);
      if (anonymous !== null) return anonymous;
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      return Promise.resolve(errorResponse(409, 'Email already registered', 'EMAIL_TAKEN'));
    });

    renderRegister();

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Asha' } });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'asha@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i);
  });
});
