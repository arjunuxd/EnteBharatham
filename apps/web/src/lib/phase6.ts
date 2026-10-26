import type {
  ContributorRecordDetail,
  DuplicateSuggestionResponse,
  FeedbackKind,
  FeedbackThreadPublic,
  FeedbackVisibility,
  ProvenanceReviewStatus,
  QualityReport,
} from '@entebharatham/shared';
import { ApiError, apiGet, apiSend } from './api';

/**
 * Typed callers for the Phase 6 surface: deterministic quality checks,
 * duplicate assistance, provenance management, and structured review
 * feedback.
 *
 * Ownership and role are enforced server-side; these helpers only shape the
 * requests and unwrap the API's envelopes.
 */

/** Unwraps `{ key: value }` envelopes, rejecting malformed responses. */
function unwrap<T>(body: unknown, key: string): T {
  if (body !== null && typeof body === 'object' && key in body) {
    const value = (body as Record<string, unknown>)[key];
    if (value !== undefined) return value as T;
  }
  throw new ApiError(`Malformed API response: missing "${key}"`, 500, 'MALFORMED_RESPONSE');
}

/** GET /heritage/mine/:id/quality */
export async function fetchOwnQuality(id: string, signal?: AbortSignal): Promise<QualityReport> {
  const body = await apiGet<{ quality: QualityReport }>(
    `/heritage/mine/${encodeURIComponent(id)}/quality`,
    signal,
  );
  return unwrap<QualityReport>(body, 'quality');
}

/** GET /moderation/submissions/:id/quality */
export async function fetchSubmissionQuality(
  id: string,
  signal?: AbortSignal,
): Promise<QualityReport> {
  const body = await apiGet<{ quality: QualityReport }>(
    `/moderation/submissions/${encodeURIComponent(id)}/quality`,
    signal,
  );
  return unwrap<QualityReport>(body, 'quality');
}

/** GET /heritage/mine/:id/duplicates */
export function fetchOwnDuplicates(
  id: string,
  signal?: AbortSignal,
): Promise<DuplicateSuggestionResponse> {
  return apiGet<DuplicateSuggestionResponse>(
    `/heritage/mine/${encodeURIComponent(id)}/duplicates`,
    signal,
  );
}

/** GET /heritage/mine/:id/feedback */
export function fetchOwnFeedback(id: string, signal?: AbortSignal): Promise<FeedbackThreadPublic> {
  return apiGet<FeedbackThreadPublic>(`/heritage/mine/${encodeURIComponent(id)}/feedback`, signal);
}

/** POST /heritage/mine/:id/feedback */
export function addOwnFeedback(
  id: string,
  body: { kind: FeedbackKind; message: string; field?: string; parentId?: string },
): Promise<FeedbackThreadPublic> {
  return apiSend<FeedbackThreadPublic>(
    'POST',
    `/heritage/mine/${encodeURIComponent(id)}/feedback`,
    body,
  );
}

/** GET /moderation/submissions/:id/feedback */
export function fetchSubmissionFeedback(
  id: string,
  signal?: AbortSignal,
): Promise<FeedbackThreadPublic> {
  return apiGet<FeedbackThreadPublic>(
    `/moderation/submissions/${encodeURIComponent(id)}/feedback`,
    signal,
  );
}

/** POST /moderation/submissions/:id/feedback */
export function addSubmissionFeedback(
  id: string,
  body: {
    kind: FeedbackKind;
    message: string;
    field?: string;
    visibility?: FeedbackVisibility;
    parentId?: string;
  },
): Promise<FeedbackThreadPublic> {
  return apiSend<FeedbackThreadPublic>(
    'POST',
    `/moderation/submissions/${encodeURIComponent(id)}/feedback`,
    body,
  );
}

/** POST /moderation/submissions/:id/feedback/:feedbackId/resolve */
export function resolveFeedbackMessage(
  id: string,
  feedbackId: string,
): Promise<FeedbackThreadPublic> {
  return apiSend<FeedbackThreadPublic>(
    'POST',
    `/moderation/submissions/${encodeURIComponent(id)}/feedback/${encodeURIComponent(feedbackId)}/resolve`,
  );
}

/** PATCH /heritage/mine/:id/provenance */
export function updateOwnProvenance(
  id: string,
  body: Record<string, unknown>,
): Promise<ContributorRecordDetail> {
  return apiSend<ContributorRecordDetail>(
    'PATCH',
    `/heritage/mine/${encodeURIComponent(id)}/provenance`,
    body,
  );
}

/** PATCH /moderation/submissions/:id/provenance */
export function reviewProvenance(
  id: string,
  body: { reviewStatus: ProvenanceReviewStatus; reviewerNotes?: string },
): Promise<ContributorRecordDetail> {
  return apiSend<ContributorRecordDetail>(
    'PATCH',
    `/moderation/submissions/${encodeURIComponent(id)}/provenance`,
    body,
  );
}

/** POST /heritage/mine/:id/variants */
export function declareVariant(
  id: string,
  body: { relatedRecordId: string; note: string },
): Promise<ContributorRecordDetail> {
  return apiSend<ContributorRecordDetail>(
    'POST',
    `/heritage/mine/${encodeURIComponent(id)}/variants`,
    body,
  );
}

/** POST /reports — community report against a published record. */
export function submitCommunityReport(body: {
  heritageRecordId: string;
  category: string;
  explanation?: string;
}): Promise<{ report: { id: string } }> {
  return apiSend<{ report: { id: string } }>('POST', '/reports', body);
}
