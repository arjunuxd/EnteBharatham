import { Flag } from 'lucide-react';
import { useId, useState } from 'react';
import { ApiError } from '../lib/api';
import { submitCommunityReport } from '../lib/phase6';
import { InlineNotice } from './ui/States';

/**
 * Community report form.
 *
 * Reports go through the CSRF-aware API helper so the request carries the
 * session's synchroniser token; the raw `fetch` call this used to make was
 * rejected by the server with `CSRF_INVALID`.
 */
export function ReportButton({ recordId }: { recordId: string }) {
  const categoryId = useId();
  const explanationId = useId();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('other');
  const [explanation, setExplanation] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      await submitCommunityReport({
        heritageRecordId: recordId,
        category,
        ...(explanation.trim() === '' ? {} : { explanation: explanation.trim() }),
      });
      setDone(true);
      setOpen(false);
      setExplanation('');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 429) {
        setError('Too many reports from this account. Please try again later.');
      } else if (caught instanceof ApiError && caught.status === 409) {
        setError('You already have an open report for this record.');
      } else if (caught instanceof ApiError && caught.status === 403) {
        setError('Your session expired. Please sign in again and resubmit.');
      } else {
        setError('We could not submit the report. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div role="status">
        <InlineNotice tone="success" live="status">
          Report submitted
        </InlineNotice>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="link-quiet inline-flex items-center gap-2 text-sm"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        Report this record
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-line bg-cream/50 p-4">
      <h3 className="font-sans text-sm font-semibold text-ink">Report this record</h3>
      <p className="mt-1 text-xs leading-5 text-earth-ink">
        Reports go to the review team. If you are reporting a rights or consent concern, include as
        much detail as you safely can.
      </p>

      <div className="mt-4">
        <label htmlFor={categoryId} className="field-label">
          Category
        </label>
        <select
          id={categoryId}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="select"
        >
          <option value="incorrect_misleading">Incorrect/misleading</option>
          <option value="attribution_ownership">Attribution/ownership</option>
          <option value="missing_disputed_consent">Missing/disputed consent</option>
          <option value="sensitive_restricted_knowledge">Sensitive/restricted</option>
          <option value="privacy_concern">Privacy concern</option>
          <option value="harmful_inappropriate">Harmful/inappropriate</option>
          <option value="copyright_licensing">Copyright/licensing</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="mt-3">
        <label htmlFor={explanationId} className="field-label">
          Explanation (optional)
        </label>
        <textarea
          id={explanationId}
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          className="input"
          rows={3}
          maxLength={1000}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="btn-primary btn-sm"
        >
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">
          Cancel
        </button>
      </div>

      {error !== null && (
        <InlineNotice tone="error" live="alert" className="mt-3">
          {error}
        </InlineNotice>
      )}
    </div>
  );
}
