import type {
  AuthUserPublic,
  FeedbackKind,
  FeedbackMessagePublic,
  FeedbackThreadPublic,
  FeedbackVisibility,
  RecordStatus,
} from '@entebharatham/shared';
import { ReviewFeedbackModel } from '../models/ReviewFeedback.js';
import { HeritageRecordModel } from '../models/HeritageRecord.js';
import { recordAuditEvent } from './audit.service.js';
import { AppError } from '../utils/AppError.js';

/**
 * Review-feedback service (Phase 6).
 *
 * Feedback replaces a single free-text rejection reason with a structured
 * exchange:
 *
 * - A moderator raises **contributor-visible guidance** (what to change) or an
 *   **internal note** (moderator reasoning). Internal notes are never returned
 *   to a contributor — not in the thread, not in the counts.
 * - A contributor replies to guidance on their own record.
 * - Items can be **resolved**, which records who resolved them and when.
 *
 * The record lifecycle is untouched: feedback adds to `draft`,
 * `changes_requested`, and `pending_review` rather than replacing them.
 */

/** Statuses on which the owner may still change the record. */
const EDITABLE_STATUSES = ['draft', 'changes_requested'] as const;

function isModerator(user: AuthUserPublic): boolean {
  return user.role === 'moderator' || user.role === 'admin';
}

function toMessage(doc: {
  _id: { toString(): string };
  recordId: { toString(): string };
  parentId?: { toString(): string };
  kind: FeedbackKind;
  message: string;
  field?: string;
  visibility: FeedbackVisibility;
  authorId?: { toString(): string };
  authorRole: string;
  resolvedAt?: Date;
  resolvedById?: { toString(): string };
  createdAt: Date;
}): FeedbackMessagePublic {
  const message: FeedbackMessagePublic = {
    id: String(doc._id),
    recordId: String(doc.recordId),
    kind: doc.kind,
    message: doc.message,
    visibility: doc.visibility,
    authorRole: doc.authorRole as FeedbackMessagePublic['authorRole'],
    createdAt: new Date(doc.createdAt).toISOString(),
  };
  if (doc.parentId !== undefined) message.parentId = String(doc.parentId);
  if (doc.field !== undefined) message.field = doc.field;
  if (doc.authorId !== undefined) message.authorId = String(doc.authorId);
  if (doc.resolvedAt !== undefined) message.resolvedAt = new Date(doc.resolvedAt).toISOString();
  if (doc.resolvedById !== undefined) message.resolvedById = String(doc.resolvedById);
  return message;
}

/**
 * Loads the thread for a record. The viewer decides what may be seen: a
 * moderator sees everything, a contributor sees contributor-visible messages
 * only.
 */
export async function listFeedback(
  viewer: AuthUserPublic,
  recordId: string,
): Promise<FeedbackThreadPublic> {
  const record = await HeritageRecordModel.findById(recordId)
    .select({ status: 1, createdBy: 1 })
    .lean()
    .exec();
  if (record === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }

  const moderator = isModerator(viewer);
  const isOwner = record.createdBy !== undefined && String(record.createdBy) === viewer.id;
  if (!moderator && !isOwner) {
    // Do not disclose whether the record exists for another contributor.
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }

  const filter = moderator ? { recordId } : { recordId, visibility: 'contributor' as const };
  const docs = await ReviewFeedbackModel.find(filter).sort({ createdAt: 1, _id: 1 }).lean().exec();

  const messages = docs.map((doc) => toMessage(doc));
  const openContributorMessages = messages.filter(
    (message) => message.visibility === 'contributor' && message.resolvedAt === undefined,
  ).length;
  const openInternalMessages = messages.filter(
    (message) => message.visibility === 'internal' && message.resolvedAt === undefined,
  ).length;

  return {
    recordId: String(record._id),
    status: record.status as RecordStatus,
    messages,
    openContributorMessages,
    openInternalMessages: moderator ? openInternalMessages : 0,
  };
}

export interface AddFeedbackInput {
  kind: FeedbackKind;
  message: string;
  field?: string;
  visibility?: FeedbackVisibility;
  parentId?: string;
}

/**
 * Adds a message to the thread.
 *
 * - A moderator chooses contributor-visible guidance or an internal note.
 * - A contributor may only reply on their own record, only with
 *   contributor-visible visibility, and only while the record is still
 *   editable — once a record is with the moderators, the contributor waits.
 */
export async function addFeedback(
  viewer: AuthUserPublic,
  recordId: string,
  input: AddFeedbackInput,
): Promise<FeedbackThreadPublic> {
  const record = await HeritageRecordModel.findById(recordId)
    .select({ status: 1, createdBy: 1 })
    .lean()
    .exec();
  if (record === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }

  const moderator = isModerator(viewer);
  const isOwner = record.createdBy !== undefined && String(record.createdBy) === viewer.id;

  if (!moderator && !isOwner) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }

  let visibility: FeedbackVisibility = input.visibility ?? 'contributor';
  if (!moderator) {
    if (!(EDITABLE_STATUSES as readonly string[]).includes(record.status)) {
      throw new AppError(
        409,
        'Feedback can only be added while the record can still be edited',
        'INVALID_TRANSITION',
      );
    }
    // A contributor can never write an internal note.
    visibility = 'contributor';
  }

  if (input.parentId !== undefined) {
    const parent = await ReviewFeedbackModel.findOne({
      _id: input.parentId,
      recordId,
    })
      .select({ visibility: 1 })
      .lean()
      .exec();
    if (parent === null) {
      throw new AppError(404, 'Feedback message not found', 'NOT_FOUND');
    }
    if (!moderator && parent.visibility !== 'contributor') {
      throw new AppError(404, 'Feedback message not found', 'NOT_FOUND');
    }
  }

  const created = await ReviewFeedbackModel.create({
    recordId,
    parentId: input.parentId,
    kind: input.kind,
    message: input.message,
    field: input.field,
    visibility,
    authorId: viewer.id,
    authorRole: viewer.role,
  });

  await recordAuditEvent({
    action: 'feedback.added',
    actorId: viewer.id,
    actorRole: viewer.role,
    recordId,
    metadata: { visibility, kind: input.kind },
  });

  void created;
  return listFeedback(viewer, recordId);
}

/**
 * Marks a message as resolved. Moderators may resolve any message; a
 * contributor may resolve a contributor-visible message they wrote. Internal
 * notes can only be resolved by a moderator.
 */
export async function resolveFeedback(
  viewer: AuthUserPublic,
  feedbackId: string,
): Promise<FeedbackThreadPublic> {
  const doc = await ReviewFeedbackModel.findById(feedbackId).lean().exec();
  if (doc === null) {
    throw new AppError(404, 'Feedback message not found', 'NOT_FOUND');
  }

  const moderator = isModerator(viewer);
  const isAuthor = doc.authorId !== undefined && String(doc.authorId) === viewer.id;
  if (!moderator && (!isAuthor || doc.visibility !== 'contributor')) {
    throw new AppError(404, 'Feedback message not found', 'NOT_FOUND');
  }
  if (doc.resolvedAt !== undefined) {
    return listFeedback(viewer, String(doc.recordId));
  }

  await ReviewFeedbackModel.updateOne(
    { _id: feedbackId, resolvedAt: null },
    { $set: { resolvedAt: new Date(), resolvedById: viewer.id } },
  ).exec();

  await recordAuditEvent({
    action: 'feedback.resolved',
    actorId: viewer.id,
    actorRole: viewer.role,
    recordId: String(doc.recordId),
    metadata: { feedbackId: String(doc._id) },
  });

  return listFeedback(viewer, String(doc.recordId));
}
