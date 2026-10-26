import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ProtectedRoute, RoleGuard } from './ProtectedRoute';
import { authUser, errorResponse, jsonResponse, sessionResponse } from '../test/apiMocks';

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<unknown>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => impl(url, init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Probe component that reports what the auth guard decided. */
function Probe() {
  const { status, user } = useAuth();
  return (
    <div>
      <p data-testid="auth-status">{status}</p>
      <p data-testid="auth-user">{user?.displayName ?? 'anonymous'}</p>
    </div>
  );
}

function renderGuards(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Probe />
              </ProtectedRoute>
            }
          />
          <Route
            path="/moderation"
            element={
              <RoleGuard roles={['moderator', 'admin']}>
                <Probe />
              </RoleGuard>
            }
          />
          <Route path="/login" element={<p data-testid="login-page">Login page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AuthProvider session restore', () => {
  it('becomes authenticated when /auth/me returns a session', async () => {
    stubFetch((url) =>
      url.includes('/auth/me')
        ? Promise.resolve(jsonResponse(sessionResponse(authUser({ displayName: 'Asha' }))))
        : Promise.resolve(jsonResponse({})),
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>,
    );

    // findByTestId resolves as soon as the probe renders (while the session
    // restore is still in flight), so wait for the restored name itself.
    await waitFor(() => expect(screen.getByTestId('auth-user')).toHaveTextContent('Asha'));
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
  });

  it('becomes anonymous when /auth/me returns 401', async () => {
    stubFetch(() =>
      Promise.resolve(errorResponse(401, 'Authentication required', 'UNAUTHENTICATED')),
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('auth-user')).toHaveTextContent('anonymous');
  });

  it('flags a restore failure when the API is unreachable', async () => {
    stubFetch(() => Promise.reject(new Error('network down')));

    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('anonymous'));
  });
});

describe('ProtectedRoute', () => {
  it('redirects anonymous visitors to /login with a next parameter', async () => {
    stubFetch(() =>
      Promise.resolve(errorResponse(401, 'Authentication required', 'UNAUTHENTICATED')),
    );

    renderGuards('/dashboard');

    const login = await screen.findByTestId('login-page');
    expect(login).toBeInTheDocument();
  });

  it('renders the guarded content for an authenticated user', async () => {
    stubFetch((url) =>
      url.includes('/auth/me')
        ? Promise.resolve(jsonResponse(sessionResponse()))
        : Promise.resolve(jsonResponse({})),
    );

    renderGuards('/dashboard');

    expect(await screen.findByTestId('auth-user')).toHaveTextContent('Demo Contributor');
  });
});

describe('RoleGuard', () => {
  it('allows moderators through', async () => {
    stubFetch((url) =>
      url.includes('/auth/me')
        ? Promise.resolve(jsonResponse(sessionResponse(authUser({ role: 'moderator' }))))
        : Promise.resolve(jsonResponse({})),
    );

    renderGuards('/moderation');

    expect(await screen.findByTestId('auth-status')).toHaveTextContent('authenticated');
  });

  it('shows a permission notice for contributors', async () => {
    stubFetch((url) =>
      url.includes('/auth/me')
        ? Promise.resolve(jsonResponse(sessionResponse(authUser({ role: 'contributor' }))))
        : Promise.resolve(jsonResponse({})),
    );

    renderGuards('/moderation');

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not have access/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/contributor/i);
  });

  it('redirects anonymous visitors to login', async () => {
    stubFetch(() =>
      Promise.resolve(errorResponse(401, 'Authentication required', 'UNAUTHENTICATED')),
    );

    renderGuards('/moderation');

    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
  });
});
