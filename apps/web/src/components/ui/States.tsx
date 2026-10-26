import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RotateCcw } from 'lucide-react';

/** Shared loading, empty, error, and inline-notice states. */

export function LoadingState({
  children = 'Loading…',
  className = '',
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`flex items-center gap-3 rounded-lg border border-line/80 bg-cream/70 px-5 py-4 text-sm text-earth-ink ${className}`}
    >
      <span
        aria-hidden="true"
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line-strong border-t-terracotta motion-reduce:animate-none"
      />
      <span>{children}</span>
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`min-w-0 ${className}`}>
      <div className="aspect-[4/3] animate-pulse rounded-lg border border-line/70 bg-forest-soft/50 motion-reduce:animate-none" />
      <div className="space-y-3 pt-5">
        <div className="h-2.5 w-24 animate-pulse rounded-full bg-line motion-reduce:animate-none" />
        <div className="h-5 w-4/5 animate-pulse rounded-full bg-line motion-reduce:animate-none" />
        <div className="h-3 w-full animate-pulse rounded-full bg-line/70 motion-reduce:animate-none" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-line/70 motion-reduce:animate-none" />
      </div>
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Retry',
  className = '',
}: {
  title: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`rounded-lg border border-danger/25 bg-danger-soft px-5 py-5 text-danger ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold text-ink">{title}</p>
          {description !== undefined && <p className="mt-1 text-sm text-danger">{description}</p>}
          {onRetry !== undefined && (
            <button type="button" onClick={onRetry} className="btn-quiet-danger btn-sm mt-4">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {retryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className = '',
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-dashed border-line-strong bg-cream/70 px-6 py-10 text-center ${className}`}
    >
      <Inbox className="mx-auto h-7 w-7 text-earth-ink" aria-hidden="true" />
      <p className="mt-4 font-display text-xl text-ink">{title}</p>
      {description !== undefined && (
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-earth-ink">{description}</p>
      )}
      {action !== undefined && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

type NoticeTone = 'success' | 'error' | 'warning' | 'info';

const NOTICE_STYLES: Record<NoticeTone, string> = {
  success: 'border-success/25 bg-success-soft text-success',
  error: 'border-danger/25 bg-danger-soft text-danger',
  warning: 'border-warning/25 bg-warning-soft text-warning',
  info: 'border-line-strong bg-cream text-earth-ink',
};

export function InlineNotice({
  tone = 'info',
  children,
  className = '',
  live = false,
}: {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
  /** Use `alert` for errors, `status` for confirmations. */
  live?: false | 'alert' | 'status';
}) {
  return (
    <div
      role={live === false ? undefined : live === 'alert' ? 'alert' : 'status'}
      className={`rounded-lg border px-4 py-3 text-sm leading-6 ${NOTICE_STYLES[tone]} ${className}`}
    >
      {children}
    </div>
  );
}

/** Small status dot + label, used in editorial metadata rows. */
export function StatusMark({ tone, children }: { tone: NoticeTone; children: ReactNode }) {
  const colour =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'error'
          ? 'text-danger'
          : 'text-earth-ink';
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-medium ${colour}`}>
      <span className="status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}
