import type {
  CorrectionProposalPublic,
  ReportDetail,
  WithdrawalRequestPublic,
} from '@entebharatham/shared';
import { ArrowRight, FileCheck2, Flag, History, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState, ErrorState, InlineNotice, LoadingState } from '../components/ui/States';
import { ApiError } from '../lib/api';
import {
  actionGovernanceWithdrawal,
  fetchGovernanceCorrections,
  fetchGovernanceReports,
  fetchGovernanceWithdrawals,
  resolveGovernanceReport,
  reviewGovernanceCorrection,
} from '../lib/governance';

type Queue = 'reports' | 'corrections' | 'withdrawals';

type LoadStatus = 'loading' | 'ready' | 'error';

const REPORT_STATUSES = ['under_review', 'resolved', 'dismissed'] as const;
const CORRECTION_STATUSES = ['under_review', 'approved', 'rejected'] as const;
const WITHDRAWAL_STATUSES = [
  'under_review',
  'restricted',
  'unpublished',
  'removed',
  'dismissed',
] as const;

function label(value: string): string {
  return value.replace(/_/g, ' ');
}

function statusTone(value: string): string {
  if (value === 'resolved' || value === 'approved' || value === 'removed') return 'badge-success';
  if (value === 'rejected' || value === 'dismissed') return 'badge-danger';
  if (value === 'restricted' || value === 'unpublished') return 'badge-warning';
  return 'badge-neutral';
}

/**
 * Moderator governance queues: community reports, correction proposals, and
 * withdrawal requests.
 *
 * Every decision here is recorded in the audit log with the moderator's
 * account, so the UI always asks for an explicit outcome instead of letting
 * a record silently change.
 */
export function ModerationGovernancePage() {
  const [queue, setQueue] = useState<Queue>('reports');
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const [reports, setReports] = useState<ReportDetail[]>([]);
  const [corrections, setCorrections] = useState<CorrectionProposalPublic[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequestPublic[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setError(null);
    setForbidden(false);

    const load = async () => {
      try {
        if (queue === 'reports') {
          setReports(await fetchGovernanceReports(controller.signal));
        } else if (queue === 'corrections') {
          setCorrections(await fetchGovernanceCorrections(controller.signal));
        } else {
          setWithdrawals(await fetchGovernanceWithdrawals(controller.signal));
        }
        setStatus('ready');
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setStatus('error');
        if (caught instanceof ApiError && caught.status === 403) {
          setForbidden(true);
          setError('You do not have permission to view this queue.');
        } else {
          setError('We could not load this queue. Please try again.');
        }
      }
    };

    void load();
    return () => controller.abort();
  }, [queue, retryToken]);

  const runAction = async (id: string, action: () => Promise<unknown>) => {
    if (pendingId !== null) return;
    setActionError(null);
    setPendingId(id);
    try {
      await action();
    } catch (caught) {
      setActionError(
        caught instanceof ApiError && caught.status === 409
          ? 'That item is no longer in a state that allows this action.'
          : 'The action could not be completed. Please try again.',
      );
    } finally {
      setPendingId(null);
    }
  };

  const tabs: Array<{ key: Queue; label: string; icon: typeof Flag }> = [
    { key: 'reports', label: 'Community reports', icon: Flag },
    { key: 'corrections', label: 'Corrections', icon: FileCheck2 },
    { key: 'withdrawals', label: 'Withdrawals', icon: History },
  ];

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
            title="Governance"
            border={false}
            description="Reports, corrections, and withdrawal requests. Every decision is written to the audit log with the reviewer's account and a timestamp."
            actions={
              <Link to="/moderation/audit" className="btn-secondary">
                Audit log
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />
        </div>
      </section>

      <div className="container-page">
        <div role="tablist" aria-label="Governance queues" className="mt-10 flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = queue === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setQueue(tab.key)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  active
                    ? 'border-forest bg-forest text-ivory shadow-xs'
                    : 'border-line-strong/80 bg-paper/50 text-earth-ink hover:-translate-y-px hover:border-forest/40 hover:bg-forest-soft hover:text-forest'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div className="min-w-0 space-y-5">
            {status === 'loading' && <LoadingState>Loading queue…</LoadingState>}

            {status === 'error' && (
              <ErrorState
                title={error ?? 'We could not load this queue.'}
                description={
                  forbidden
                    ? 'Governance queues are limited to moderators and administrators.'
                    : 'We could not load this queue just now. Please try again.'
                }
                onRetry={forbidden ? undefined : () => setRetryToken((token) => token + 1)}
              />
            )}

            {actionError !== null && (
              <InlineNotice tone="error" live="alert">
                {actionError}
              </InlineNotice>
            )}

            {status === 'ready' && queue === 'reports' && (
              <>
                {reports.length === 0 ? (
                  <EmptyState
                    title="No community reports."
                    description="Reports from readers and communities will appear here for review."
                  />
                ) : (
                  <ul className="space-y-4">
                    {reports.map((report) => (
                      <li
                        key={report.id}
                        className="rounded-xl border border-line/90 bg-paper p-5 shadow-card sm:p-6"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="break-words font-display text-xl text-ink">
                              {report.recordTitle ?? report.heritageRecordId}
                            </h2>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-earth-ink">
                              {label(report.category)}
                            </p>
                          </div>
                          <span className={statusTone(report.status)}>{label(report.status)}</span>
                        </div>
                        {report.explanation !== undefined && report.explanation !== '' && (
                          <p className="mt-3 border-l-2 border-terracotta/40 pl-4 text-sm leading-6 text-earth-ink">
                            {report.explanation}
                          </p>
                        )}
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                          <span className="mr-1 text-xs text-earth-ink">Record outcome:</span>
                          {REPORT_STATUSES.filter((option) => option !== report.status).map(
                            (option) => (
                              <button
                                key={option}
                                type="button"
                                disabled={pendingId === report.id}
                                onClick={() =>
                                  void runAction(report.id, () =>
                                    resolveGovernanceReport(report.id, { status: option }),
                                  )
                                }
                                className="btn-secondary btn-sm capitalize"
                              >
                                {pendingId === report.id ? 'Working…' : label(option)}
                              </button>
                            ),
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {status === 'ready' && queue === 'corrections' && (
              <>
                {corrections.length === 0 ? (
                  <EmptyState
                    title="No correction proposals."
                    description="Proposed corrections to published records will appear here."
                  />
                ) : (
                  <ul className="space-y-4">
                    {corrections.map((correction) => (
                      <li
                        key={correction.id}
                        className="rounded-xl border border-line/90 bg-paper p-5 shadow-card sm:p-6"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h2 className="break-words font-display text-xl text-ink">
                            {correction.recordTitle ?? correction.heritageRecordId}
                          </h2>
                          <span className={statusTone(correction.status)}>
                            {label(correction.status)}
                          </span>
                        </div>
                        {correction.rationale !== undefined && correction.rationale !== '' && (
                          <p className="mt-3 text-sm leading-6 text-earth-ink">
                            {correction.rationale}
                          </p>
                        )}
                        {correction.proposedChanges !== undefined && (
                          <div className="mt-4">
                            <h3 className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-earth-ink">
                              Proposed changes
                            </h3>
                            <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-cream/60 p-3 text-xs leading-5 text-ink">
                              {JSON.stringify(correction.proposedChanges, null, 2)}
                            </pre>
                          </div>
                        )}
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                          <span className="mr-1 text-xs text-earth-ink">Review outcome:</span>
                          {CORRECTION_STATUSES.filter((option) => option !== correction.status).map(
                            (option) => (
                              <button
                                key={option}
                                type="button"
                                disabled={pendingId === correction.id}
                                onClick={() =>
                                  void runAction(correction.id, () =>
                                    reviewGovernanceCorrection(correction.id, { status: option }),
                                  )
                                }
                                className="btn-secondary btn-sm capitalize"
                              >
                                {pendingId === correction.id ? 'Working…' : label(option)}
                              </button>
                            ),
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {status === 'ready' && queue === 'withdrawals' && (
              <>
                {withdrawals.length === 0 ? (
                  <EmptyState
                    title="No withdrawal requests."
                    description="Requests to restrict or remove a record will appear here."
                  />
                ) : (
                  <ul className="space-y-4">
                    {withdrawals.map((withdrawal) => (
                      <li
                        key={withdrawal.id}
                        className="rounded-xl border border-line/90 bg-paper p-5 shadow-card sm:p-6"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="break-words font-display text-xl text-ink">
                              {withdrawal.recordTitle ??
                                withdrawal.heritageRecordId ??
                                withdrawal.mediaId}
                            </h2>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-earth-ink">
                              {label(withdrawal.type)}
                            </p>
                          </div>
                          <span className={statusTone(withdrawal.status)}>
                            {label(withdrawal.status)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-earth-ink">{withdrawal.reason}</p>
                        {withdrawal.details !== undefined && withdrawal.details !== '' && (
                          <p className="mt-1 text-sm leading-6 text-earth-ink">
                            {withdrawal.details}
                          </p>
                        )}
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                          <span className="mr-1 text-xs text-earth-ink">Set outcome:</span>
                          {WITHDRAWAL_STATUSES.filter((option) => option !== withdrawal.status).map(
                            (option) => (
                              <button
                                key={option}
                                type="button"
                                disabled={pendingId === withdrawal.id}
                                onClick={() =>
                                  void runAction(withdrawal.id, () =>
                                    actionGovernanceWithdrawal(withdrawal.id, { status: option }),
                                  )
                                }
                                className="btn-secondary btn-sm capitalize"
                              >
                                {pendingId === withdrawal.id ? 'Working…' : label(option)}
                              </button>
                            ),
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <aside className="space-y-5">
            <section className="rounded-xl border border-line/90 bg-cream/90 p-5 shadow-card">
              <ShieldCheck className="h-5 w-5 text-forest" aria-hidden="true" />
              <h2 className="mt-3 font-display text-lg text-ink">A record of every decision</h2>
              <p className="mt-2 text-sm leading-6 text-earth-ink">
                Governance actions do not erase history. The audit log keeps the actor, the previous
                state, and the new state for each change.
              </p>
              <Link to="/moderation/audit" className="link-underline mt-4 inline-block text-sm">
                Read the audit log
              </Link>
            </section>

            <section className="rounded-xl border border-line/90 bg-paper/80 p-5 shadow-card">
              <h2 className="font-display text-lg text-ink">
                Corrections, not corrections of fact
              </h2>
              <p className="mt-2 text-sm leading-6 text-earth-ink">
                A community may hold more than one account of the same tradition. Prefer recording a
                variant over declaring one version wrong.
              </p>
              <Link to="/about#principles" className="link-underline mt-4 inline-block text-sm">
                Review principles
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
