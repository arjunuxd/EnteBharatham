import type { AuditEventPublic, PaginatedResponse } from '@entebharatham/shared';
import { ArrowLeft, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { ApiError } from '../lib/api';
import { fetchAuditLog } from '../lib/workflow';

type Status = 'loading' | 'ready' | 'error';

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<string, string> = {
  'user.registered': 'Account registered',
  'record.submitted': 'Record submitted',
  'record.approved': 'Record approved',
  'record.rejected': 'Record rejected',
  'record.changes_requested': 'Changes requested',
  'record.deleted': 'Record deleted',
  'user.role_changed': 'Role changed',
};

/** Append-only audit trail, newest first. Moderator-only route. */
export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResponse<AuditEventPublic> | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [retryToken, setRetryToken] = useState(0);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setForbidden(false);

    fetchAuditLog(page, PAGE_SIZE, controller.signal)
      .then((result) => {
        setData(result);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof ApiError && error.status === 403) {
          setForbidden(true);
        }
        setStatus('error');
      });

    return () => controller.abort();
  }, [page, retryToken]);

  return (
    <div className="pb-20">
      <section className="relative overflow-hidden border-b border-line bg-cream">
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-[24rem] w-[24rem] rounded-full border border-terracotta/10"
          aria-hidden="true"
        />
        <div className="container-page relative pb-9 pt-10 sm:pb-11 sm:pt-14">
          <PageHeader
            eyebrow="Stewardship"
            title="Audit log"
            border={false}
            description="Every registration, submission, review decision, and role change, recorded with actor and timestamp. Events are append-only and never edited or deleted."
            actions={
              <Link to="/moderation" className="btn-secondary">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Review queue
              </Link>
            }
          />
        </div>
      </section>

      <div className="container-page">
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <span className="badge-neutral">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Append-only
          </span>
          {status === 'ready' && data !== null && (
            <p className="text-sm text-earth-ink" aria-live="polite">
              {data.total === 1 ? '1 event' : `${data.total} events`} recorded
            </p>
          )}
        </div>

        <div className="mt-6">
          {status === 'loading' && <LoadingState>Loading audit events…</LoadingState>}

          {status === 'error' && (
            <ErrorState
              title={
                forbidden
                  ? 'Your account does not have moderator access.'
                  : 'We could not load the audit log.'
              }
              description={
                forbidden
                  ? 'The audit log is available to moderators and administrators only.'
                  : 'We could not load the audit log just now. Please try again.'
              }
              onRetry={forbidden ? undefined : () => setRetryToken((token) => token + 1)}
            />
          )}

          {status === 'ready' && data !== null && (
            <>
              {data.items.length === 0 ? (
                <EmptyState
                  title="No audit events recorded yet."
                  description="Registrations, submissions, and moderation decisions will appear here as they happen."
                />
              ) : (
                <div className="overflow-hidden rounded-xl border border-line/90 bg-paper shadow-card">
                  <div
                    className="overflow-x-auto"
                    role="region"
                    aria-label="Audit events table"
                    tabIndex={0}
                  >
                    <table className="w-full min-w-[46rem] text-left text-sm">
                      <caption className="sr-only">Audit events, newest first</caption>
                      <thead className="border-b border-line bg-cream/90 text-[0.625rem] uppercase tracking-[0.14em] text-earth-ink">
                        <tr>
                          <th scope="col" className="px-5 py-3.5 font-semibold">
                            When
                          </th>
                          <th scope="col" className="px-5 py-3.5 font-semibold">
                            Action
                          </th>
                          <th scope="col" className="px-5 py-3.5 font-semibold">
                            Actor
                          </th>
                          <th scope="col" className="px-5 py-3.5 font-semibold">
                            Details
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {data.items.map((event) => (
                          <tr
                            key={event.id}
                            className="align-top transition-colors hover:bg-cream/60"
                          >
                            <td className="whitespace-nowrap px-5 py-4 text-xs text-earth-ink">
                              {new Date(event.createdAt).toLocaleString()}
                            </td>
                            <td className="px-5 py-4">
                              <span className="font-medium text-ink">
                                {ACTION_LABELS[event.action] ?? event.action}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              {event.actorRole !== undefined ? (
                                <span className="badge-neutral capitalize">{event.actorRole}</span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-5 py-4 text-xs leading-5 text-earth-ink">
                              {event.metadata !== undefined
                                ? Object.entries(event.metadata)
                                    .map(([key, value]) => `${key}: ${value}`)
                                    .join(', ')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {data.totalPages > 1 && (
                <div className="mt-8">
                  <Pagination
                    page={data.page}
                    totalPages={data.totalPages}
                    total={data.total}
                    onChange={setPage}
                    label="Audit log pagination"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <p className="mt-8 max-w-3xl text-xs leading-5 text-earth-ink">
          Audit events record what changed and who changed it. They are never rewritten, so a
          correction or withdrawal remains visible alongside the original decision.
        </p>
      </div>
    </div>
  );
}
