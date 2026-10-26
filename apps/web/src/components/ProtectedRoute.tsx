import type { UserRole } from '@entebharatham/shared';
import type { ReactNode } from 'react';
import { Link, Navigate, useLocation, type Location } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Client-side route guards. These shape navigation UX only — every
 * protected API endpoint re-checks authentication and roles server-side
 * (see docs/SECURITY.md). Redirects preserve the intended destination in
 * `?next=` so login returns the user to the page they asked for.
 */

function loginRedirect(location: Location): ReactNode {
  const next = `${location.pathname}${location.search}`;
  return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
}

function SessionLoading() {
  return (
    <div className="container-page py-16">
      <p role="status" className="flex items-center gap-3 text-sm text-earth-ink">
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line-strong border-t-terracotta motion-reduce:animate-none"
          aria-hidden="true"
        />
        Checking your session…
      </p>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <SessionLoading />;
  }
  if (status === 'anonymous') {
    return loginRedirect(location);
  }
  return <>{children}</>;
}

/** Requires one of the given roles; renders a permission notice otherwise. */
export function RoleGuard({
  roles,
  children,
}: {
  roles: readonly UserRole[];
  children: ReactNode;
}) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <SessionLoading />;
  }
  if (status === 'anonymous' || user === null) {
    return loginRedirect(location);
  }
  if (!roles.includes(user.role)) {
    return (
      <div className="container-page py-16">
        <div
          role="alert"
          className="mx-auto max-w-xl rounded-md border border-danger/25 bg-danger-soft p-6"
        >
          <h1 className="font-display text-2xl text-ink">You do not have access to this page</h1>
          <p className="mt-3 text-sm leading-6 text-earth-ink">
            This area is limited to accounts with the {roles.join(' or ')} role. Your account is a{' '}
            {user.role} account.
          </p>
          <Link to="/" className="btn-secondary btn-sm mt-5">
            Back to home
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
