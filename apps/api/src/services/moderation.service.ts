import type {
  AuthUserPublic,
  ModerationSubmissionDetail,
  ModerationSubmissionSummary,
  PaginatedResponse,
} from '@entebharatham/shared';
import { HeritageRecordModel, type HeritageRecordFields } from '../models/HeritageRecord.js';
import { recordAuditEvent } from './audit.service.js';
import { blockingFields, evaluateQuality } from './quality.service.js';
import { toModerationDetailDto, toModerationSummaryDto } from './workflow.mapper.js';
import { AppError } from '../utils/AppError.js';

/**
 * Moderator workflow: review queue, review decisions, and the publication
 * gate.
 *
 * Decisions are applied atomically against `status: pending_review`, so a
 * decision can neither be made twice nor applied to a record that has left
 * the queue (e.g. edited or rejected concurrently). Every decision records
 * the reviewer, timestamp, and (for rejections / change requests) a required
 * reason, and writes an audit event.
 */

/**
 * Checks every condition that must hold before a record may become publicly
 * visible. Approval is refused while any of these is missing — a moderator
 * decision can never override absent publish consent, unconfirmed consent
 * verification, a restricted/private marking, or unknown rights status.
 *
 * The deterministic quality checks (Phase 6) are included, so a record that
 * is structurally incomplete (no title, no content, no language) cannot be
 * published either.
 */
export function collectPublicationBlockers(doc: HeritageRecordFields): string[] {
  const blockers: string[] = [];
  if (!doc.consent.permissionToPublish) blockers.push('consent.permissionToPublish');
  if (doc.consent.verification === 'unverified') blockers.push('consent.verification');
  if (doc.visibility !== 'public') blockers.push('visibility');
  if (doc.license.rightsStatus !== 'confirmed') blockers.push('license.rightsStatus');
  for (const field of blockingFields(evaluateQuality(doc, 'publication'))) {
    if (!blockers.includes(field)) blockers.push(field);
  }
  return blockers;
}

/** Lists submissions awaiting review (callers enforce the moderator role). */
export async function listReviewQueue(query: {
  page: number;
  limit: number;
}): Promise<PaginatedResponse<ModerationSubmissionSummary>> {
  const filter = { status: 'pending_review' as const };
  const skip = (query.page - 1) * query.limit;

  const [docs, total] = await Promise.all([
    HeritageRecordModel.find(filter)
      .sort({ submittedAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean()
      .exec(),
    HeritageRecordModel.countDocuments(filter).exec(),
  ]);

  return {
    items: docs.map((doc) => toModerationSummaryDto(doc)),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
}

/** Fetches a queued submission for review, or a non-disclosing 404. */
export async function getQueuedSubmission(recordId: string): Promise<ModerationSubmissionDetail> {
  const doc = await HeritageRecordModel.findOne({
    _id: recordId,
    status: 'pending_review',
  })
    .lean()
    .exec();

  if (doc === null) {
    throw new AppError(404, 'Submission not found', 'NOT_FOUND');
  }
  return toModerationDetailDto(doc);
}

async function loadPending(recordId: string): Promise<HeritageRecordFields> {
  const doc = await HeritageRecordModel.findOne({
    _id: recordId,
    status: 'pending_review',
  })
    .lean()
    .exec();

  if (doc === null) {
    // Either the record does not exist or it is not awaiting review — both
    // are indistinguishable, and neither can be acted on.
    throw new AppError(409, 'This submission is not awaiting review', 'INVALID_TRANSITION');
  }
  return doc;
}

/**
 * A reviewer may not act on their own contribution. The check is on the
 * record's owner, so it also covers the case where a moderator wrote the
 * record themselves.
 */
function assertNotSelfReview(moderator: AuthUserPublic, doc: HeritageRecordFields): void {
  if (doc.createdBy !== undefined && String(doc.createdBy) === moderator.id) {
    throw new AppError(
      409,
      'You cannot review your own contribution. Another moderator must handle it.',
      'SELF_REVIEW_FORBIDDEN',
    );
  }
}

/**
 * Approves and publishes a submission. Refuses with actionable detail while
 * publication conditions are unmet (missing publish consent, unconfirmed
 * verification, non-public visibility, or unknown rights status).
 */
export async function approveSubmission(
  moderator: AuthUserPublic,
  recordId: string,
): Promise<ModerationSubmissionDetail> {
  const doc = await loadPending(recordId);
  assertNotSelfReview(moderator, doc);

  const blockers = collectPublicationBlockers(doc);
  if (blockers.length > 0) {
    throw new AppError(
      409,
      'This submission cannot be published yet: required permission or rights information is missing',
      'NOT_PUBLISHABLE',
      { missing: blockers },
    );
  }

  const reviewedAt = new Date();
  const result = await HeritageRecordModel.updateOne(
    { _id: recordId, status: 'pending_review' },
    {
      $set: {
        status: 'published',
        review: {
          decision: 'approved',
          reviewedAt,
          reviewerId: moderator.id,
        },
      },
    },
    { runValidators: true },
  ).exec();

  if (result.matchedCount === 0) {
    throw new AppError(409, 'This submission is not awaiting review', 'INVALID_TRANSITION');
  }

  await recordAuditEvent({
    action: 'record.approved',
    actorId: moderator.id,
    actorRole: moderator.role,
    recordId,
    metadata: { statusAfter: 'published' },
  });

  return getUpdatedDetail(recordId);
}

/** Rejects a submission with a mandatory reason. */
export async function rejectSubmission(
  moderator: AuthUserPublic,
  recordId: string,
  reason: string,
): Promise<ModerationSubmissionDetail> {
  const doc = await loadPending(recordId);
  assertNotSelfReview(moderator, doc);

  const reviewedAt = new Date();
  const result = await HeritageRecordModel.updateOne(
    { _id: recordId, status: 'pending_review' },
    {
      $set: {
        status: 'rejected',
        review: {
          decision: 'rejected',
          reason,
          reviewedAt,
          reviewerId: moderator.id,
        },
      },
    },
    { runValidators: true },
  ).exec();

  if (result.matchedCount === 0) {
    throw new AppError(409, 'This submission is not awaiting review', 'INVALID_TRANSITION');
  }

  await recordAuditEvent({
    action: 'record.rejected',
    actorId: moderator.id,
    actorRole: moderator.role,
    recordId,
    metadata: { statusAfter: 'rejected' },
  });

  return getUpdatedDetail(recordId);
}

/**
 * Sends a submission back to its contributor with a mandatory reason. The
 * record becomes `changes_requested`, which the owner can edit and resubmit.
 */
export async function requestChanges(
  moderator: AuthUserPublic,
  recordId: string,
  reason: string,
): Promise<ModerationSubmissionDetail> {
  const doc = await loadPending(recordId);
  assertNotSelfReview(moderator, doc);

  const reviewedAt = new Date();
  const result = await HeritageRecordModel.updateOne(
    { _id: recordId, status: 'pending_review' },
    {
      $set: {
        status: 'changes_requested',
        review: {
          decision: 'changes_requested',
          reason,
          reviewedAt,
          reviewerId: moderator.id,
        },
      },
    },
    { runValidators: true },
  ).exec();

  if (result.matchedCount === 0) {
    throw new AppError(409, 'This submission is not awaiting review', 'INVALID_TRANSITION');
  }

  await recordAuditEvent({
    action: 'record.changes_requested',
    actorId: moderator.id,
    actorRole: moderator.role,
    recordId,
    metadata: { statusAfter: 'changes_requested' },
  });

  return getUpdatedDetail(recordId);
}

async function getUpdatedDetail(recordId: string): Promise<ModerationSubmissionDetail> {
  const doc = await HeritageRecordModel.findOne({ _id: recordId }).lean().exec();
  if (doc === null) {
    throw new AppError(404, 'Submission not found', 'NOT_FOUND');
  }
  return toModerationDetailDto(doc);
}
