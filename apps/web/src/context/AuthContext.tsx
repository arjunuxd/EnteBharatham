import type { AuthUserPublic } from '@entebharatham/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchMe,
  loginAccount,
  logoutAccount,
  registerAccount,
  type LoginPayload,
  type RegisterPayload,
} from '../lib/auth';

/**
 * Session state for the whole app. The httpOnly cookie is the source of
 * truth; this provider only mirrors what the server reports via /auth/me.
 * On mount it restores an existing session, so a page reload keeps the
 * user signed in.
 */

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  user: AuthUserPublic | null;
  status: AuthStatus;
  login(payload: LoginPayload): Promise<void>;
  register(payload: RegisterPayload): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserPublic | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    const controller = new AbortController();

    fetchMe(controller.signal)
      .then((session) => {
        if (controller.signal.aborted) return;
        setUser(session?.user ?? null);
        setStatus(session !== null ? 'authenticated' : 'anonymous');
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        // Not a 401: the API is unreachable. Treat the visitor as signed out;
        // pages that need an account still prompt for a fresh sign-in.
        setUser(null);
        setStatus('anonymous');
      });

    return () => controller.abort();
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const session = await loginAccount(payload);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const session = await registerAccount(payload);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await logoutAccount();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Accesses the session context. Throws when used outside AuthProvider. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
