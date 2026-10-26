import { Check, Link2, Share2 } from 'lucide-react';
import { useId, useState } from 'react';

type Status = 'idle' | 'copied' | 'shared' | 'error';

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText !== undefined) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the older selection-based path.
  }

  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

/**
 * Share a record without leaving the page. On supported devices the native
 * share sheet is used; otherwise the canonical link is copied. Feedback is
 * announced politely for screen-reader users.
 */
export function ShareActions({
  title,
  tone = 'light',
  compact = false,
}: {
  title: string;
  tone?: 'light' | 'dark';
  compact?: boolean;
}) {
  const statusId = useId();
  const [status, setStatus] = useState<Status>('idle');

  const dark = tone === 'dark';
  const base = dark
    ? 'border-ivory/20 bg-ivory/[0.06] text-ivory/80 hover:border-ivory/40 hover:bg-ivory/10 hover:text-ivory'
    : 'border-line-strong/80 bg-paper/60 text-earth-ink hover:border-forest/30 hover:bg-paper hover:text-forest';

  const label =
    status === 'copied'
      ? 'Link copied'
      : status === 'shared'
        ? 'Shared'
        : status === 'error'
          ? 'Could not copy'
          : 'Share';

  const share = async () => {
    const url = window.location.href;
    if (navigator.share !== undefined) {
      try {
        await navigator.share({ title, url });
        setStatus('shared');
        window.setTimeout(() => setStatus('idle'), 2400);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    const copied = await copyText(url);
    setStatus(copied ? 'copied' : 'error');
    window.setTimeout(() => setStatus('idle'), 2400);
  };

  const copyLink = async () => {
    const copied = await copyText(window.location.href);
    setStatus(copied ? 'copied' : 'error');
    window.setTimeout(() => setStatus('idle'), 2400);
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'mt-6'}`}>
      <button
        type="button"
        onClick={() => void share()}
        aria-describedby={statusId}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${base}`}
      >
        {status === 'shared' || status === 'copied' ? (
          <Check className="h-3.5 w-3.5 text-current" aria-hidden="true" />
        ) : (
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {label}
      </button>
      <button
        type="button"
        onClick={() => void copyLink()}
        aria-label="Copy record link"
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${base}`}
      >
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        Copy link
      </button>
      <span id={statusId} role="status" aria-live="polite" className="sr-only">
        {status === 'idle' ? '' : label}
      </span>
    </div>
  );
}
