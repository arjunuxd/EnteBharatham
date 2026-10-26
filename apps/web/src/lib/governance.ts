import type {
  CorrectionProposalPublic,
  ReportDetail,
  WithdrawalRequestPublic,
} from '@entebharatham/shared';
import { apiGet, apiSend } from './api';

/**
 * Governance API helpers (community reports, corrections, withdrawals).
 *
 * All three queues are moderator-only on the server; the client only shapes
 * requests.
 */

export function fetchGovernanceReports(signal?: AbortSignal): Promise<ReportDetail[]> {
  return apiGet<{ reports: ReportDetail[] }>('/reports', signal).then((body) => body.reports);
}

export function resolveGovernanceReport(
  id: string,
  body: {
    status: 'under_review' | 'resolved' | 'dismissed';
    resolutionCategory?: string;
    decisionNote?: string;
  },
): Promise<ReportDetail> {
  return apiSend<{ report: ReportDetail }>(
    'POST',
    `/reports/${encodeURIComponent(id)}/resolution`,
    body,
  ).then((result) => result.report);
}

export function fetchGovernanceCorrections(
  signal?: AbortSignal,
): Promise<CorrectionProposalPublic[]> {
  return apiGet<{ corrections: CorrectionProposalPublic[] }>('/corrections', signal).then(
    (body) => body.corrections,
  );
}

export function reviewGovernanceCorrection(
  id: string,
  body: { status: 'under_review' | 'approved' | 'rejected'; decisionNote?: string },
): Promise<CorrectionProposalPublic> {
  return apiSend<{ correction: CorrectionProposalPublic }>(
    'POST',
    `/corrections/${encodeURIComponent(id)}/review`,
    body,
  ).then((result) => result.correction);
}

export function fetchGovernanceWithdrawals(
  signal?: AbortSignal,
): Promise<WithdrawalRequestPublic[]> {
  return apiGet<{ withdrawals: WithdrawalRequestPublic[] }>('/withdrawals', signal).then(
    (body) => body.withdrawals,
  );
}

/** Files a contributor withdrawal request for one of the caller's records. */
export function requestRecordWithdrawal(
  heritageRecordId: string,
  reason: string,
  details?: string,
): Promise<{ id: string }> {
  return apiSend<{ withdrawal: { id: string } }>('POST', '/withdrawals', {
    heritageRecordId,
    type: 'contributor_withdrawal',
    reason: reason.trim(),
    ...(details !== undefined && details.trim() !== '' ? { details: details.trim() } : {}),
  }).then((body) => body.withdrawal);
}

export function actionGovernanceWithdrawal(
  id: string,
  body: {
    status: 'under_review' | 'restricted' | 'unpublished' | 'removed' | 'dismissed';
    actionTaken?: string;
  },
): Promise<WithdrawalRequestPublic> {
  return apiSend<{ withdrawal: WithdrawalRequestPublic }>(
    'POST',
    `/withdrawals/${encodeURIComponent(id)}/action`,
    body,
  ).then((result) => result.withdrawal);
}
