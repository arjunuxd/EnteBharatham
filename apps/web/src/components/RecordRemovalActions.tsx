import type { RecordStatus } from '@entebharatham/shared';
import { Trash2, Undo2 } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Dialog } from './ui/Dialog';
import { InlineNotice } from './ui/States';
import { ApiError } from '../lib/api';
import { requestRecordWithdrawal } from '../lib/governance';
import { deleteOwnRecord } from '../lib/workflow';

/**
 * Removal controls for a contributor's own record.
 *
 * Private/unpublished records can be deleted outright. Published records are
 * part of the public archive, so the only removal path offered is the
 * withdrawal-request governance flow; the server enforces the same split.
 */
export const DELETABLE_RECORD_STATUSES: readonly RecordStatus[] = [
  'draft',
  'changes_requested',
  'pending_review',
  'rejected',
];

export const WITHDRAWABLE_RECORD_STATUSES: readonly RecordStatus[] = ['published'];

export function canDeleteRecord(status: RecordStatus): boolean {
  return DELETABLE_RECORD_STATUSES.includes(status);
}

export function canRequestWithdrawal(status: RecordStatus): boolean {
  return WITHDRAWABLE_RECORD_STATUSES.includes(status);
}

function deleteErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'WITHDRAWAL_REQUIRED') {
      return 'Published records need a withdrawal request instead of deletion.';
    }
    if (error.status === 404) {
      return 'This record no longer exists. Refresh the page to see your current records.';
    }
    if (error.status === 409) {
      return 'This record can no longer be deleted because its status changed. Refresh the page and try again.';
    }
    if (error.status === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }
  }
  return 'We could not delete this record. Please try again.';
}

function withdrawalErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return 'A withdrawal request for this record is already being reviewed.';
    }
    if (error.status === 403) {
      return 'Only the contributor who created this record can request its withdrawal.';
    }
    if (error.status === 404) {
      return 'This record no longer exists.';
    }
    if (error.status === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }
  }
  return 'We could not send the withdrawal request. Please try again.';
}

export function RecordRemovalActions({
  recordId,
  title,
  status,
  onDeleted,
}: {
  recordId: string;
  title: string;
  status: RecordStatus;
  onDeleted?: () => void;
}) {
  const formId = useId();
  const reasonId = useId();
  const reasonHelpId = useId();
  const detailsId = useId();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawNotice, setWithdrawNotice] = useState<string | null>(null);

  const deletable = canDeleteRecord(status);
  const withdrawable = canRequestWithdrawal(status);
  if (!deletable && !withdrawable) return null;

  const closeDelete = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteOwnRecord(recordId);
      setDeleteOpen(false);
      onDeleted?.();
    } catch (error) {
      setDeleteError(deleteErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const closeWithdraw = () => {
    if (withdrawing) return;
    setWithdrawOpen(false);
    setWithdrawError(null);
    setReason('');
    setDetails('');
  };

  const handleWithdraw = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (withdrawing) return;

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 10) {
      setWithdrawError(
        'Please give at least 10 characters so moderators can understand the request.',
      );
      return;
    }

    setWithdrawing(true);
    setWithdrawError(null);
    try {
      await requestRecordWithdrawal(recordId, trimmedReason, details);
      setWithdrawOpen(false);
      setReason('');
      setDetails('');
      setWithdrawNotice('Withdrawal request sent. A moderator will review it.');
    } catch (error) {
      setWithdrawError(withdrawalErrorMessage(error));
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <>
      {deletable && (
        <button
          type="button"
          className="btn-quiet-danger btn-sm"
          onClick={() => {
            setDeleteError(null);
            setDeleteOpen(true);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </button>
      )}

      {withdrawable && (
        <button
          type="button"
          className="btn-quiet-danger btn-sm"
          onClick={() => {
            setWithdrawError(null);
            setWithdrawOpen(true);
          }}
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
          Request withdrawal
        </button>
      )}

      {withdrawNotice !== null && (
        <p role="status" className="basis-full text-sm leading-6 text-success">
          {withdrawNotice}
        </p>
      )}

      <Dialog
        open={deleteOpen}
        onClose={closeDelete}
        title="Delete this record?"
        size="sm"
        dismissible={!deleting}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={closeDelete}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete record'}
            </button>
          </>
        }
      >
        <p className="text-sm leading-6 text-earth-ink">
          This permanently deletes <strong className="font-semibold text-ink">“{title}”</strong> and
          any uploaded media. This cannot be undone.
        </p>
        {deleteError !== null && (
          <InlineNotice tone="error" live="alert" className="mt-3">
            {deleteError}
          </InlineNotice>
        )}
      </Dialog>

      <Dialog
        open={withdrawOpen}
        onClose={closeWithdraw}
        title="Request a withdrawal"
        description="A moderator reviews the request before anything changes publicly."
        size="md"
        dismissible={!withdrawing}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={closeWithdraw}
              disabled={withdrawing}
            >
              Cancel
            </button>
            <button type="submit" form={formId} className="btn-primary" disabled={withdrawing}>
              {withdrawing ? 'Sending…' : 'Send request'}
            </button>
          </>
        }
      >
        <form id={formId} className="space-y-4" onSubmit={handleWithdraw}>
          <div>
            <label htmlFor={reasonId} className="field-label">
              Reason for withdrawal
            </label>
            <textarea
              id={reasonId}
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-describedby={reasonHelpId}
              aria-invalid={withdrawError !== null ? true : undefined}
              className={`input ${withdrawError !== null ? 'input-error' : ''}`}
            />
            <p id={reasonHelpId} className="mt-1.5 text-xs leading-5 text-earth-ink">
              At least 10 characters. Explain what should be removed and why.
            </p>
          </div>

          <div>
            <label htmlFor={detailsId} className="field-label">
              Additional details <span className="font-normal text-earth-ink">(optional)</span>
            </label>
            <textarea
              id={detailsId}
              maxLength={2000}
              rows={3}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              className="input"
            />
          </div>

          {withdrawError !== null && (
            <InlineNotice tone="error" live="alert">
              {withdrawError}
            </InlineNotice>
          )}
        </form>
      </Dialog>
    </>
  );
}
