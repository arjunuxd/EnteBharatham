import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { errorResponse, jsonResponse } from '../test/apiMocks';
import { ContributePage } from './ContributePage';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';
import { VerifyEmailPage } from './VerifyEmailPage';

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<unknown>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => impl(url, init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** 401 from /auth/me is what an anonymous visitor always sees. */
const anonymousMe = (url: string) =>
  url.includes('/auth/me')
    ? Promise.resolve(errorResponse(401, 'Authentication required', 'UNAUTHENTICATED'))
    : null;

function renderAt(path: string, element: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>{element}</AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ForgotPasswordPage', () => {
  it('requests a reset link and shows an enumeration-safe confirmation', async () => {
    const fetchMock = stubFetch((url, init) => {
      const anonymous = anonymousMe(url);
      if (anonymous !== null) return anonymous;
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.includes('/account/password-reset/request')) {
        expect(JSON.parse(String(init?.body))).toEqual({ email: 'asha@example.com' });
        return Promise.resolve(
          jsonResponse({ message: 'If an account exists, a password reset email has been sent' }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderAt('/forgot-password', <ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'asha@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/if an account exists for/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/account/password-reset/request'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'x-csrf-token': 'tok' }),
        }),
      ),
    );
  });

  it('reports a rate-limited request without revealing whether the account exists', async () => {
    stubFetch((url) => {
      const anonymous = anonymousMe(url);
      if (anonymous !== null) return anonymous;
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      return Promise.resolve(errorResponse(429, 'Too many requests', 'RATE_LIMITED'));
    });

    renderAt('/forgot-password', <ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'asha@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i);
  });
});

describe('ResetPasswordPage', () => {
  it('confirms a new password with the token from the link', async () => {
    const fetchMock = stubFetch((url, init) => {
      const anonymous = anonymousMe(url);
      if (anonymous !== null) return anonymous;
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.includes('/account/password-reset/confirm')) {
        expect(JSON.parse(String(init?.body))).toEqual({
          token: 'reset-token-12345',
          newPassword: 'newpassword1',
        });
        return Promise.resolve(jsonResponse({ message: 'Password reset successful' }));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderAt('/reset-password?token=reset-token-12345', <ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: 'newpassword1' },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'newpassword1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }));

    expect(await screen.findByText(/your password has been reset/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/account/password-reset/confirm'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('explains an invalid or expired link', async () => {
    stubFetch((url) => {
      const anonymous = anonymousMe(url);
      if (anonymous !== null) return anonymous;
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      return Promise.resolve(errorResponse(400, 'Invalid or expired reset link', 'TOKEN_INVALID'));
    });

    renderAt('/reset-password?token=reset-token-12345', <ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: 'newpassword1' },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'newpassword1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }));

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new link/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('requires both passwords to match before calling the API', () => {
    const fetchMock = stubFetch((url) => {
      const anonymous = anonymousMe(url);
      if (anonymous !== null) return anonymous;
      return Promise.resolve(jsonResponse({}));
    });

    renderAt('/reset-password?token=reset-token-12345', <ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: 'newpassword1' },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'different1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/do not match/i);
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('/account/password-reset/confirm')),
    ).toBe(false);
  });

  it('warns when the link has no token', () => {
    stubFetch((url) => {
      const anonymous = anonymousMe(url);
      if (anonymous !== null) return anonymous;
      return Promise.resolve(jsonResponse({}));
    });

    renderAt('/reset-password', <ResetPasswordPage />);

    expect(screen.getByRole('alert')).toHaveTextContent(/link is incomplete/i);
  });
});

describe('VerifyEmailPage', () => {
  it('confirms the token automatically and reports success', async () => {
    const fetchMock = stubFetch((url, init) => {
      const anonymous = anonymousMe(url);
      if (anonymous !== null) return anonymous;
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.includes('/account/verify-email/confirm')) {
        expect(JSON.parse(String(init?.body))).toEqual({ token: 'verify-token-12345' });
        return Promise.resolve(jsonResponse({ message: 'Email verified successfully' }));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderAt('/verify-email?token=verify-token-12345', <VerifyEmailPage />);

    expect(await screen.findByText(/your email address is verified/i)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('/account/verify-email/confirm')),
    ).toHaveLength(1);
  });

  it('explains an invalid verification link', async () => {
    stubFetch((url) => {
      const anonymous = anonymousMe(url);
      if (anonymous !== null) return anonymous;
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      return Promise.resolve(
        errorResponse(400, 'Invalid or expired verification link', 'TOKEN_INVALID'),
      );
    });

    renderAt('/verify-email?token=verify-token-12345', <VerifyEmailPage />);

    expect(
      await screen.findByText(/verification link is invalid or has expired/i),
    ).toBeInTheDocument();
  });
});

describe('ContributePage', () => {
  it('states the actual consent commitments and marks demo records as fictional', () => {
    renderAt('/contribute', <ContributePage />);

    expect(screen.getByRole('heading', { name: /share a story with care/i })).toBeInTheDocument();
    expect(screen.getByText(/ask before recording/i)).toBeInTheDocument();
    expect(screen.getAllByText(/fictional demo record/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /^start a draft$/i })).not.toHaveLength(0);
    for (const link of screen.getAllByRole('link', { name: /^start a draft$/i })) {
      expect(link).toHaveAttribute('href', '/dashboard/drafts/new');
    }
  });
});
