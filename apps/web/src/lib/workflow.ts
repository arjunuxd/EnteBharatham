import type {
  AuditEventPublic,
  ContributorRecordDetail,
  ContributorRecordSummary,
  ModerationSubmissionDetail,
  ModerationSubmissionSummary,
  PaginatedResponse,
} from '@entebharatham/shared';
import { apiGet, apiSend } from './api';

/**
 * Typed callers for the contributor workflow (own drafts) and the
 * moderator workflow (review queue, decisions, audit). Ownership and role
 * are enforced server-side; these helpers only shape requests.
 */

export interface OwnListQuery {
  page: number;
  limit: number;
  status?: string;
}

export function buildOwnListPath(query: OwnListQuery): string {
  const search = new URLSearchParams();
  search.set('page', String(query.page));
  search.set('limit', String(query.limit));
  if (query.status !== undefined && query.status !== '') {
    search.set('status', query.status);
  }
  return `/heritage/mine?${search.toString()}`;
}

export function fetchOwnRecords(
  query: OwnListQuery,
  signal?: AbortSignal,
): Promise<PaginatedResponse<ContributorRecordSummary>> {
  return apiGet(buildOwnListPath(query), signal);
}

export function fetchOwnRecord(id: string, signal?: AbortSignal): Promise<ContributorRecordDetail> {
  return apiGet(`/heritage/mine/${encodeURIComponent(id)}`, signal);
}

export function createDraft(body: unknown): Promise<ContributorRecordDetail> {
  return apiSend<ContributorRecordDetail>('POST', '/heritage', body);
}

export function updateDraft(id: string, body: unknown): Promise<ContributorRecordDetail> {
  return apiSend<ContributorRecordDetail>('PATCH', `/heritage/${encodeURIComponent(id)}`, body);
}

export function submitDraft(id: string): Promise<ContributorRecordDetail> {
  return apiSend<ContributorRecordDetail>('POST', `/heritage/${encodeURIComponent(id)}/submit`);
}

export function deleteOwnRecord(id: string): Promise<void> {
  return apiSend<void>('DELETE', `/heritage/${encodeURIComponent(id)}`);
}

export function fetchReviewQueue(
  page: number,
  limit: number,
  signal?: AbortSignal,
): Promise<PaginatedResponse<ModerationSubmissionSummary>> {
  return apiGet(`/moderation/submissions?page=${page}&limit=${limit}`, signal);
}

export function fetchSubmission(
  id: string,
  signal?: AbortSignal,
): Promise<ModerationSubmissionDetail> {
  return apiGet(`/moderation/submissions/${encodeURIComponent(id)}`, signal);
}

export function approveSubmission(id: string): Promise<ModerationSubmissionDetail> {
  return apiSend<ModerationSubmissionDetail>(
    'POST',
    `/moderation/submissions/${encodeURIComponent(id)}/approve`,
  );
}

export function rejectSubmission(id: string, reason: string): Promise<ModerationSubmissionDetail> {
  return apiSend<ModerationSubmissionDetail>(
    'POST',
    `/moderation/submissions/${encodeURIComponent(id)}/reject`,
    { reason },
  );
}

export function requestChanges(id: string, reason: string): Promise<ModerationSubmissionDetail> {
  return apiSend<ModerationSubmissionDetail>(
    'POST',
    `/moderation/submissions/${encodeURIComponent(id)}/request-changes`,
    { reason },
  );
}

export function fetchAuditLog(
  page: number,
  limit: number,
  signal?: AbortSignal,
): Promise<PaginatedResponse<AuditEventPublic>> {
  return apiGet(`/moderation/audit?page=${page}&limit=${limit}`, signal);
}
