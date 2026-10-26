import type {
  AuthUserPublic,
  CorrectionProposalPublic,
  ReportCategory,
  ReportDetail,
  ReportStatus,
  WithdrawalRequestPublic,
  WithdrawalRequestType,
  WithdrawalStatus,
  CorrectionStatus,
} from '@entebharatham/shared';
import { CommunityReportModel } from '../models/CommunityReport.js';
import { CorrectionProposalModel } from '../models/CorrectionProposal.js';
import { WithdrawalRequestModel } from '../models/WithdrawalRequest.js';
import { HeritageRecordModel } from '../models/HeritageRecord.js';
import type { Types } from 'mongoose';
import { recordAuditEvent } from './audit.service.js';
import { PUBLIC_ELIGIBILITY_FILTER } from './heritage.service.js';
import type { StorageAdapter } from './storage/index.js';
import { AppError } from '../utils/AppError.js';

/**
 * Governance service (Phase 6 hardening of the Phase 4 surface).
 *
 * Community reporting, corrections, and withdrawals are the safety valves of
 * the archive. They are handled here — outside the route handlers — so that
 * the same rules apply no matter which client calls them:
 *
 * - **Reports** require the reported record to exist and to be publicly
 *   listed; the same reporter cannot spam the same record with the same
 *   category; and the moderator sees an explicit DTO, never a raw document.
 * - **Corrections** may only change a whitelisted set of descriptive fields.
 *   Consent, rights, and visibility are never altered by a correction — they
 *   belong to the contributor. Approving a correction applies the change and
 *   writes an audit event.
 * - **Withdrawals** never delete anything. A moderator action restricts or
 *   archives the record and revokes the publication permission, so the record
 *   disappears from the public API, search, related records, media, and the
 *   sitemap while the record and its history remain auditable.
 */

/** Fields a community correction may change. Everything else is rejected. */
const CORRECTABLE_FIELDS = ['title', 'summary', 'content', 'tags', 'communityName'] as const;

function isModerator(user: AuthUserPublic): boolean {
  return user.role === 'moderator' || user.role === 'admin';
}

function optional(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}

/**
 * A record may only be reported while it is publicly listed. Reporting a
 * private draft would disclose its existence.
 */
async function assertPubliclyListed(recordId: string): Promise<string> {
  const doc = await HeritageRecordModel.findOne({
    ...PUBLIC_ELIGIBILITY_FILTER,
    _id: recordId,
  })
    .select({ title: 1 })
    .lean()
    .exec();
  if (doc === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }
  return doc.title;
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                     */
/* -------------------------------------------------------------------------- */

export interface SubmitReportInput {
  heritageRecordId: string;
  category: ReportCategory;
  explanation?: string;
}

/**
 * Files a community report against a publicly listed record.
 *
 * The reporter is taken from the session. An identical open report from the
 * same reporter is refused, so a single concern is not multiplied.
 */
export async function submitReport(
  user: AuthUserPublic,
  input: SubmitReportInput,
): Promise<{ id: string }> {
  await assertPubliclyListed(input.heritageRecordId);

  const existing = await CommunityReportModel.findOne({
    heritageRecordId: input.heritageRecordId,
    reporterId: user.id,
    category: input.category,
    status: { $in: ['open', 'under_review'] },
  })
    .lean()
    .exec();
  if (existing !== null) {
    throw new AppError(
      409,
      'You have already reported this record with this category',
      'DUPLICATE_REPORT',
    );
  }

  const report = await CommunityReportModel.create({
    heritageRecordId: input.heritageRecordId,
    category: input.category,
    explanation: input.explanation,
    reporterId: user.id,
    status: 'open',
  });

  await recordAuditEvent({
    action: 'report.submitted',
    actorId: user.id,
    actorRole: user.role,
    recordId: input.heritageRecordId,
    metadata: { category: input.category },
  });

  return { id: String(report._id) };
}

/** Lists reports for moderators, newest first. */
export async function listReports(limit = 50): Promise<ReportDetail[]> {
  const reports = await CommunityReportModel.find()
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean()
    .exec();

  const recordIds = reports
    .map((report) => report.heritageRecordId)
    .filter((id) => id !== undefined);
  const records = await HeritageRecordModel.find({ _id: { $in: recordIds } })
    .select({ title: 1 })
    .lean()
    .exec();
  const titles = new Map(records.map((record) => [String(record._id), record.title]));

  return reports.map((report) => {
    const detail: ReportDetail = {
      id: String(report._id),
      heritageRecordId: String(report.heritageRecordId),
      category: report.category,
      status: report.status,
      createdAt: new Date(report.createdAt).toISOString(),
      updatedAt: new Date(report.updatedAt).toISOString(),
    };
    const title = titles.get(String(report.heritageRecordId));
    if (title !== undefined) detail.recordTitle = title;
    const explanation = optional(report.explanation);
    if (explanation !== undefined) detail.explanation = explanation;
    if (report.reporterId !== undefined) detail.reporterId = String(report.reporterId);
    if (report.assignedModeratorId !== undefined) {
      detail.assignedModeratorId = String(report.assignedModeratorId);
    }
    const resolutionCategory = optional(report.resolutionCategory);
    if (resolutionCategory !== undefined) detail.resolutionCategory = resolutionCategory;
    const decisionNote = optional(report.decisionNote);
    if (decisionNote !== undefined) detail.decisionNote = decisionNote;
    if (report.reviewedAt !== undefined) {
      detail.reviewedAt = new Date(report.reviewedAt).toISOString();
    }
    return detail;
  });
}

export interface ReportResolutionInput {
  status: Extract<ReportStatus, 'under_review' | 'resolved' | 'dismissed'>;
  resolutionCategory?: string;
  decisionNote?: string;
}

/**
 * Records a moderator's decision on a report.
 *
 * Resolving a report does not change the record itself: if the material must
 * come down, the moderator follows up with a withdrawal action, which is
 * recorded separately.
 */
export async function resolveReport(
  moderator: AuthUserPublic,
  reportId: string,
  input: ReportResolutionInput,
): Promise<{ id: string; status: ReportStatus }> {
  const report = await CommunityReportModel.findById(reportId).exec();
  if (report === null) {
    throw new AppError(404, 'Report not found', 'REPORT_NOT_FOUND');
  }
  if (report.status === 'resolved' || report.status === 'dismissed') {
    throw new AppError(409, 'This report has already been closed', 'INVALID_TRANSITION');
  }

  report.status = input.status;
  report.resolutionCategory = input.resolutionCategory;
  report.decisionNote = input.decisionNote;
  if (input.status === 'resolved' || input.status === 'dismissed') {
    report.reviewedAt = new Date();
    report.assignedModeratorId = moderator.id as unknown as Types.ObjectId;
  }
  await report.save();

  await recordAuditEvent({
    action: input.status === 'dismissed' ? 'report.dismissed' : 'report.resolved',
    actorId: moderator.id,
    actorRole: moderator.role,
    recordId: String(report.heritageRecordId),
    metadata: { status: input.status },
  });

  return { id: String(report._id), status: report.status };
}

/* -------------------------------------------------------------------------- */
/* Corrections                                                                 */
/* -------------------------------------------------------------------------- */

export interface ProposeCorrectionInput {
  heritageRecordId: string;
  proposedChanges: Record<string, unknown>;
  rationale?: string;
}

/**
 * Proposes a correction to a publicly listed record.
 *
 * Only the whitelisted descriptive fields may be changed. A correction can
 * never alter consent, rights, visibility, or the lifecycle of a record.
 */
export async function proposeCorrection(
  user: AuthUserPublic,
  input: ProposeCorrectionInput,
): Promise<{ id: string }> {
  await assertPubliclyListed(input.heritageRecordId);

  const unknownFields = Object.keys(input.proposedChanges).filter(
    (field) => !(CORRECTABLE_FIELDS as readonly string[]).includes(field),
  );
  if (unknownFields.length > 0) {
    throw new AppError(
      400,
      `These fields cannot be changed by a correction: ${unknownFields.join(', ')}`,
      'INVALID_CORRECTION',
      { allowed: [...CORRECTABLE_FIELDS] },
    );
  }

  const proposal = await CorrectionProposalModel.create({
    heritageRecordId: input.heritageRecordId,
    proposedChanges: input.proposedChanges,
    rationale: input.rationale,
    proposedById: user.id,
    status: 'proposed',
  });

  await recordAuditEvent({
    action: 'correction.proposed',
    actorId: user.id,
    actorRole: user.role,
    recordId: input.heritageRecordId,
    metadata: { fields: Object.keys(input.proposedChanges).join(',') },
  });

  return { id: String(proposal._id) };
}

/** Lists correction proposals for moderators. */
export async function listCorrections(limit = 50): Promise<CorrectionProposalPublic[]> {
  const proposals = await CorrectionProposalModel.find()
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean()
    .exec();

  const recordIds = proposals.map((proposal) => proposal.heritageRecordId);
  const records = await HeritageRecordModel.find({ _id: { $in: recordIds } })
    .select({ title: 1 })
    .lean()
    .exec();
  const titles = new Map(records.map((record) => [String(record._id), record.title]));

  return proposals.map((proposal) => {
    const dto: CorrectionProposalPublic = {
      id: String(proposal._id),
      heritageRecordId: String(proposal.heritageRecordId),
      status: proposal.status,
      proposedChanges: proposal.proposedChanges as Record<string, unknown>,
      createdAt: new Date(proposal.createdAt).toISOString(),
    };
    const title = titles.get(String(proposal.heritageRecordId));
    if (title !== undefined) dto.recordTitle = title;
    if (proposal.proposedById !== undefined) dto.proposedById = String(proposal.proposedById);
    if (proposal.reviewerId !== undefined) dto.reviewerId = String(proposal.reviewerId);
    const rationale = optional(proposal.rationale);
    if (rationale !== undefined) dto.rationale = rationale;
    if (proposal.reviewedAt !== undefined) {
      dto.reviewedAt = new Date(proposal.reviewedAt).toISOString();
    }
    const decisionNote = optional(proposal.decisionNote);
    if (decisionNote !== undefined) dto.decisionNote = decisionNote;
    return dto;
  });
}

export interface CorrectionReviewInput {
  status: Extract<CorrectionStatus, 'under_review' | 'approved' | 'rejected'>;
  decisionNote?: string;
}

/**
 * Reviews a correction. Approving it applies the whitelisted changes to the
 * record and writes an audit event — the change is always attributable.
 */
export async function reviewCorrection(
  moderator: AuthUserPublic,
  correctionId: string,
  input: CorrectionReviewInput,
): Promise<{ id: string; status: CorrectionStatus }> {
  const proposal = await CorrectionProposalModel.findById(correctionId).exec();
  if (proposal === null) {
    throw new AppError(404, 'Correction not found', 'CORRECTION_NOT_FOUND');
  }
  if (proposal.status === 'approved' || proposal.status === 'rejected') {
    throw new AppError(409, 'This correction has already been reviewed', 'INVALID_TRANSITION');
  }

  proposal.status = input.status;
  proposal.decisionNote = input.decisionNote;
  proposal.reviewerId = moderator.id as unknown as Types.ObjectId;
  proposal.reviewedAt = new Date();
  await proposal.save();

  if (input.status === 'approved') {
    const changes = proposal.proposedChanges as Record<string, unknown>;
    const set: Record<string, unknown> = {};
    for (const field of CORRECTABLE_FIELDS) {
      const value = changes[field];
      if (value !== undefined) set[field] = value;
    }
    if (Object.keys(set).length > 0) {
      await HeritageRecordModel.updateOne(
        { _id: proposal.heritageRecordId },
        { $set: set },
        { runValidators: true },
      ).exec();
    }
    await recordAuditEvent({
      action: 'correction.approved',
      actorId: moderator.id,
      actorRole: moderator.role,
      recordId: String(proposal.heritageRecordId),
      metadata: { fields: Object.keys(set).join(',') },
    });
  } else if (input.status === 'rejected') {
    await recordAuditEvent({
      action: 'correction.rejected',
      actorId: moderator.id,
      actorRole: moderator.role,
      recordId: String(proposal.heritageRecordId),
      metadata: {},
    });
  }

  return { id: String(proposal._id), status: proposal.status };
}

/* -------------------------------------------------------------------------- */
/* Withdrawals                                                                 */
/* -------------------------------------------------------------------------- */

export interface RequestWithdrawalInput {
  heritageRecordId?: string;
  mediaId?: string;
  type: WithdrawalRequestType;
  reason: string;
  details?: string;
}

/**
 * Records a withdrawal request.
 *
 * A contributor may withdraw their own record. A community request may be
 * filed by any authenticated user. A moderator-initiated withdrawal requires
 * the moderator role.
 */
export async function requestWithdrawal(
  user: AuthUserPublic,
  input: RequestWithdrawalInput,
): Promise<{ id: string }> {
  if (input.heritageRecordId === undefined && input.mediaId === undefined) {
    throw new AppError(
      400,
      'A withdrawal must refer to a record or a media item',
      'VALIDATION_ERROR',
    );
  }

  if (input.type === 'moderator_initiated' && !isModerator(user)) {
    throw new AppError(403, 'Only moderators can start a withdrawal', 'FORBIDDEN');
  }

  if (input.heritageRecordId !== undefined) {
    const record = await HeritageRecordModel.findById(input.heritageRecordId)
      .select({ createdBy: 1 })
      .lean()
      .exec();
    if (record === null) {
      throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
    }
    // Fail closed: a missing owner is never treated as permission. A moderator
    // who needs to remove a record with no owner must start a
    // `moderator_initiated` withdrawal instead.
    if (
      input.type === 'contributor_withdrawal' &&
      (record.createdBy === undefined || String(record.createdBy) !== user.id)
    ) {
      throw new AppError(403, 'Only the contributor can withdraw their record', 'FORBIDDEN');
    }
  }

  if (input.mediaId !== undefined) {
    // Validate media exists; ownership/targeting is enforced by moderators or
    // through the record context in practice. Still require a valid id and
    // avoid leaking media existence outside expected flows.
    const { HeritageMediaModel } = await import('../models/HeritageMedia.js');
    const media = await HeritageMediaModel.findById(input.mediaId)
      .select({ _id: 1, heritageRecordId: 1 })
      .lean()
      .exec();
    if (media === null) {
      throw new AppError(404, 'Media not found', 'NOT_FOUND');
    }
    if (input.heritageRecordId !== undefined && media.heritageRecordId !== undefined) {
      if (String(media.heritageRecordId) !== String(input.heritageRecordId)) {
        throw new AppError(
          400,
          'Media does not belong to the specified record',
          'VALIDATION_ERROR',
        );
      }
    }
    if (input.type === 'contributor_withdrawal') {
      // A contributor can only withdraw media tied to their own record.
      const record = await HeritageRecordModel.findById(media.heritageRecordId)
        .select({ createdBy: 1 })
        .lean()
        .exec();
      if (record === null) {
        throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
      }
      if (record.createdBy === undefined || String(record.createdBy) !== user.id) {
        throw new AppError(403, 'Only the contributor can withdraw their media', 'FORBIDDEN');
      }
    }
  }

  // One open contributor request per record is enough. Without this, repeated
  // clicks or a page reload would flood the moderator queue with duplicates.
  if (input.type === 'contributor_withdrawal' && input.heritageRecordId !== undefined) {
    const openRequest = await WithdrawalRequestModel.findOne({
      heritageRecordId: input.heritageRecordId,
      requestedById: user.id,
      type: 'contributor_withdrawal',
      status: { $in: ['requested', 'under_review'] },
    })
      .select({ _id: 1 })
      .lean()
      .exec();
    if (openRequest !== null) {
      throw new AppError(
        409,
        'A withdrawal request for this record is already being reviewed',
        'WITHDRAWAL_EXISTS',
      );
    }
  }

  const request = await WithdrawalRequestModel.create({
    heritageRecordId: input.heritageRecordId,
    mediaId: input.mediaId,
    type: input.type,
    reason: input.reason,
    details: input.details,
    requestedById: user.id,
    status: 'requested',
  });

  await recordAuditEvent({
    action: 'withdrawal.requested',
    actorId: user.id,
    actorRole: user.role,
    recordId: input.heritageRecordId ?? '',
    metadata: { type: input.type },
  });

  return { id: String(request._id) };
}

/** Lists withdrawal requests for moderators. */
export async function listWithdrawals(limit = 50): Promise<WithdrawalRequestPublic[]> {
  const requests = await WithdrawalRequestModel.find()
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean()
    .exec();

  const recordIds = requests
    .map((request) => request.heritageRecordId)
    .filter((id) => id !== undefined);
  const records = await HeritageRecordModel.find({ _id: { $in: recordIds } })
    .select({ title: 1 })
    .lean()
    .exec();
  const titles = new Map(records.map((record) => [String(record._id), record.title]));

  return requests.map((request) => {
    const dto: WithdrawalRequestPublic = {
      id: String(request._id),
      type: request.type,
      status: request.status,
      reason: request.reason,
      createdAt: new Date(request.createdAt).toISOString(),
    };
    if (request.heritageRecordId !== undefined) {
      dto.heritageRecordId = String(request.heritageRecordId);
      const title = titles.get(String(request.heritageRecordId));
      if (title !== undefined) dto.recordTitle = title;
    }
    if (request.mediaId !== undefined) dto.mediaId = String(request.mediaId);
    const details = optional(request.details);
    if (details !== undefined) dto.details = details;
    if (request.requestedById !== undefined) dto.requestedById = String(request.requestedById);
    if (request.reviewedById !== undefined) dto.reviewedById = String(request.reviewedById);
    if (request.reviewedAt !== undefined) {
      dto.reviewedAt = new Date(request.reviewedAt).toISOString();
    }
    const actionTaken = optional(request.actionTaken);
    if (actionTaken !== undefined) dto.actionTaken = actionTaken;
    return dto;
  });
}

export interface WithdrawalActionInput {
  status: Extract<
    WithdrawalStatus,
    'under_review' | 'restricted' | 'unpublished' | 'removed' | 'dismissed'
  >;
  actionTaken?: string;
}

/**
 * Applies a moderator's decision on a withdrawal request.
 *
 * A restrictive action (`restricted`, `unpublished`, `removed`) never deletes
 * anything. It revokes the publication permission and changes the visibility,
 * so the record leaves the public API, search, related records, media, and the
 * sitemap, while the record and its provenance history stay auditable.
 */
export async function actionWithdrawal(
  moderator: AuthUserPublic,
  withdrawalId: string,
  input: WithdrawalActionInput,
  storage?: StorageAdapter,
): Promise<{ id: string; status: WithdrawalStatus }> {
  const request = await WithdrawalRequestModel.findById(withdrawalId).exec();
  if (request === null) {
    throw new AppError(404, 'Withdrawal request not found', 'WITHDRAWAL_NOT_FOUND');
  }
  if (request.status === 'removed') {
    throw new AppError(409, 'This withdrawal has already been actioned', 'INVALID_TRANSITION');
  }

  request.status = input.status;
  request.actionTaken = input.actionTaken;
  request.reviewedAt = new Date();
  request.reviewedById = moderator.id as unknown as Types.ObjectId;
  await request.save();

  const restricts =
    input.status === 'restricted' || input.status === 'unpublished' || input.status === 'removed';

  if (restricts && request.heritageRecordId !== undefined) {
    const visibility = input.status === 'removed' ? 'private' : 'restricted';
    await HeritageRecordModel.updateOne(
      { _id: request.heritageRecordId },
      {
        $set: {
          visibility,
          'consent.permissionToPublish': false,
          ...(input.status === 'removed' ? { status: 'archived' } : {}),
        },
      },
    ).exec();

    // Restricted/removed records must also take their media out of public
    // delivery. Objects are physically removed only for the terminal state,
    // and only when no other record references the same key.
    const lifecycleState = input.status === 'removed' ? 'removed' : 'restricted';
    const { restrictRecordMedia } = await import('./media/media.service.js');
    await restrictRecordMedia(request.heritageRecordId, lifecycleState, storage);
  }

  if (restricts && request.heritageRecordId === undefined && request.mediaId !== undefined) {
    const { HeritageMediaModel } = await import('../models/HeritageMedia.js');
    const lifecycleState = input.status === 'removed' ? 'removed' : 'restricted';
    const media = await HeritageMediaModel.findOneAndUpdate(
      { _id: request.mediaId },
      { $set: { lifecycleState } },
      { new: true },
    ).exec();
    if (lifecycleState === 'removed' && media !== null && storage !== undefined) {
      const { deleteStoredMediaIfUnreferenced } = await import('./media/media.service.js');
      try {
        await deleteStoredMediaIfUnreferenced(storage, media);
      } catch {
        // Best-effort: the lifecycle state already denies delivery.
        console.error('[media] failed to delete withdrawn object');
      }
    }
  }

  await recordAuditEvent({
    action: 'withdrawal.actioned',
    actorId: moderator.id,
    actorRole: moderator.role,
    recordId: request.heritageRecordId === undefined ? '' : String(request.heritageRecordId),
    metadata: { status: input.status },
  });

  return { id: String(request._id), status: request.status };
}
