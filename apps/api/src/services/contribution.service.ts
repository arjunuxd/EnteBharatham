import type {
  AuthUserPublic,
  ContributorRecordDetail,
  ContributorRecordSummary,
  PaginatedResponse,
} from '@entebharatham/shared';
import { randomBytes } from 'node:crypto';
import { HeritageRecordModel, type HeritageRecordFields } from '../models/HeritageRecord.js';
import type {
  CreateHeritageDraftInput,
  UpdateHeritageDraftInput,
} from '../validation/heritageWrite.schema.js';
import { recordAuditEvent } from './audit.service.js';
import { deleteRecordMedia } from './media/media.service.js';
import { blockingFields, evaluateQuality } from './quality.service.js';
import { toContributorDto, toContributorSummaryDto } from './workflow.mapper.js';
import type { StorageAdapter } from './storage/index.js';
import { AppError } from '../utils/AppError.js';

/**
 * Contributor-side workflow: draft creation, editing, submission, and the
 * owner's dashboard views.
 *
 * Ownership is part of every database filter (`createdBy` = session user), so
 * one contributor can never read or modify another contributor's records —
 * and a missing record and someone else's record produce the identical 404.
 */

/** Statuses from which the owner may edit (review decisions block edits). */
const EDITABLE_STATUSES = ['draft', 'changes_requested'] as const;

/** Statuses from which the owner may submit for review. */
const SUBMITTABLE_STATUSES = ['draft', 'changes_requested'] as const;

/**
 * Statuses the owner may delete outright. Published records are part of the
 * public archive and must go through the withdrawal governance flow instead;
 * archived records are retained for the audit trail.
 */
const DELETABLE_STATUSES = ['draft', 'changes_requested', 'pending_review', 'rejected'] as const;

/** Legacy seed fixtures predate accounts; the API always sets an owner. */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '');
}

/** Slugs reserved by the API surface itself (e.g. GET /heritage/mine). */
const RESERVED_SLUGS = new Set(['mine']);

/**
 * Builds a unique slug from the title. Non-ASCII titles (e.g. pure
 * Malayalam) have no ASCII-safe base, so a stable random fallback is used.
 * The caller also handles the uniqueness race at insert time.
 */
async function deriveUniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  const root =
    base.length >= 3 && !RESERVED_SLUGS.has(base)
      ? base
      : `record-${randomBytes(4).toString('hex')}`;

  for (let suffix = 2; suffix <= 50; suffix += 1) {
    const candidate = suffix === 2 ? root : `${root}-${suffix - 1}`;
    const exists = await HeritageRecordModel.exists({ slug: candidate }).exec();
    if (exists === null) return candidate;
  }
  return `${root}-${randomBytes(4).toString('hex')}`;
}

async function insertDraft(
  user: AuthUserPublic,
  input: CreateHeritageDraftInput,
  slug: string,
): Promise<HeritageRecordFields> {
  return HeritageRecordModel.create({
    ...input,
    slug,
    status: 'draft',
    visibility: input.visibility ?? 'private',
    createdBy: user.id,
    isFictionalSample: false,
  });
}

/**
 * Creates a draft owned by the authenticated contributor. `status` is forced
 * to `draft`, ownership comes from the session, and `isFictionalSample` is
 * never client-controlled.
 */
export async function createDraft(
  user: AuthUserPublic,
  input: CreateHeritageDraftInput,
): Promise<ContributorRecordDetail> {
  const slug = await deriveUniqueSlug(input.title);

  try {
    const doc = await insertDraft(user, input, slug);
    return toContributorDto(doc);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      // Unique-slug race: retry with a random suffix a couple of times.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const fallbackRoot = slugify(input.title).slice(0, 80).replace(/-+$/g, '');
        const safeRoot =
          fallbackRoot.length >= 3 && !RESERVED_SLUGS.has(fallbackRoot) ? fallbackRoot : 'record';
        const fallbackSlug = `${safeRoot}-${randomBytes(6).toString('hex')}`;
        try {
          const doc = await insertDraft(user, input, fallbackSlug);
          return toContributorDto(doc);
        } catch (retryError) {
          if (!isDuplicateKeyError(retryError)) throw retryError;
        }
      }
    }
    throw error;
  }
}

/**
 * Builds the `$set` payload for a draft edit. Nested blocks are merged
 * field-by-field so a partial client payload never resets untouched consent
 * or rights values; arrays replace wholesale. Only editable fields are ever
 * written — lifecycle, ownership, and review fields are absent by design.
 */
function buildDraftUpdate(
  current: HeritageRecordFields,
  input: UpdateHeritageDraftInput,
): Record<string, unknown> {
  const set: Record<string, unknown> = {};

  const scalars = [
    'title',
    'summary',
    'content',
    'heritageType',
    'languages',
    'communityName',
    'tags',
    'contributors',
    'sources',
    'visibility',
  ] as const;
  for (const field of scalars) {
    const value = input[field];
    if (value !== undefined) set[field] = value;
  }

  if (input.region !== undefined) {
    set.region = { ...current.region, ...input.region };
  }
  if (input.consent !== undefined) {
    set.consent = { ...current.consent, ...input.consent };
  }
  if (input.license !== undefined) {
    set.license = { ...current.license, ...input.license };
  }
  if (input.sources !== undefined) {
    // Source arrays replace wholesale, but the reviewer-only `isVerified` flag
    // is carried over from the stored entry: a contributor edit can never
    // clear or set it.
    const currentSources = current.sources ?? [];
    set.sources = input.sources.map((source, index) => ({
      ...source,
      mediaReferences: source.mediaReferences ?? [],
      isPublic: source.isPublic ?? true,
      isVerified: currentSources[index]?.isVerified ?? false,
    }));
  }

  return set;
}

/**
 * Edits a draft the caller owns. Enforced in the query itself: the record
 * must match both `_id` and `createdBy`, and its status must still be
 * editable at write time (an optimistic check so a concurrent review decision
 * cannot be bypassed by an edit).
 */
export async function updateDraft(
  user: AuthUserPublic,
  recordId: string,
  input: UpdateHeritageDraftInput,
): Promise<ContributorRecordDetail> {
  const current = await HeritageRecordModel.findOne({
    _id: recordId,
    createdBy: user.id,
  })
    .lean()
    .exec();

  if (current === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }
  if (!(EDITABLE_STATUSES as readonly string[]).includes(current.status)) {
    throw new AppError(
      409,
      `Records with status "${current.status}" can no longer be edited`,
      'INVALID_TRANSITION',
    );
  }

  const set = buildDraftUpdate(current, input);

  const result = await HeritageRecordModel.updateOne(
    { _id: recordId, createdBy: user.id, status: { $in: [...EDITABLE_STATUSES] } },
    { $set: set },
    { runValidators: true },
  ).exec();

  if (result.matchedCount === 0) {
    throw new AppError(
      409,
      'The record status changed before the edit could be applied. Reload and try again.',
      'INVALID_TRANSITION',
    );
  }

  const updated = await HeritageRecordModel.findOne({ _id: recordId, createdBy: user.id })
    .lean()
    .exec();
  if (updated === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }
  return toContributorDto(updated);
}

/**
 * Validates that a record's consent and rights information is complete
 * enough to enter review, and returns which fields are missing. Unconfirmed
 * consent (`permissionToPublish` false, or `verification: unverified`) and
 * unknown rights are never treated as permission.
 *
 * The minimum body length is content-type aware: a proverb or a single
 * dialect expression is a complete contribution at a few characters, so it is
 * never rejected for being short.
 */
export function collectSubmissionBlockers(doc: HeritageRecordFields): string[] {
  return blockingFields(evaluateQuality(doc, 'submission'));
}

/**
 * Submits an owned draft for review. Only drafts (or records sent back with
 * requested changes) can be submitted; the server sets `pending_review` and
 * `submittedAt`, records an audit event, and never allows direct publishing.
 */
export async function submitForReview(
  user: AuthUserPublic,
  recordId: string,
): Promise<ContributorRecordDetail> {
  const doc = await HeritageRecordModel.findOne({
    _id: recordId,
    createdBy: user.id,
  })
    .lean()
    .exec();

  if (doc === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }
  if (!(SUBMITTABLE_STATUSES as readonly string[]).includes(doc.status)) {
    throw new AppError(
      409,
      `Records with status "${doc.status}" cannot be submitted for review`,
      'INVALID_TRANSITION',
    );
  }

  const missing = collectSubmissionBlockers(doc);
  if (missing.length > 0) {
    throw new AppError(422, 'This record is not ready for review', 'SUBMISSION_INCOMPLETE', {
      missing,
    });
  }

  const submittedAt = new Date();
  const result = await HeritageRecordModel.updateOne(
    { _id: recordId, createdBy: user.id, status: { $in: [...SUBMITTABLE_STATUSES] } },
    { $set: { status: 'pending_review', submittedAt } },
  ).exec();

  if (result.matchedCount === 0) {
    throw new AppError(409, 'The record can no longer be submitted', 'INVALID_TRANSITION');
  }

  await recordAuditEvent({
    action: 'record.submitted',
    actorId: user.id,
    actorRole: user.role,
    recordId,
    metadata: { statusAfter: 'pending_review' },
  });

  const updated = await HeritageRecordModel.findOne({ _id: recordId, createdBy: user.id })
    .lean()
    .exec();
  if (updated === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }
  return toContributorDto(updated);
}

/**
 * Lists the authenticated contributor's own records (server-side filter —
 * never "fetch all and filter in the frontend"). Private moderation notes of
 * other actors are not involved; the review block shown is this owner's own.
 */
export async function listOwnRecords(
  user: AuthUserPublic,
  query: { page: number; limit: number; status?: string },
): Promise<PaginatedResponse<ContributorRecordSummary>> {
  const filter: Record<string, unknown> = { createdBy: user.id };
  if (query.status !== undefined) filter.status = query.status;

  const skip = (query.page - 1) * query.limit;
  const [docs, total] = await Promise.all([
    HeritageRecordModel.find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean()
      .exec(),
    HeritageRecordModel.countDocuments(filter).exec(),
  ]);

  return {
    items: docs.map((doc) => toContributorSummaryDto(doc)),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
}

/** Returns one owned record, or a non-disclosing 404. */
export async function getOwnRecord(
  user: AuthUserPublic,
  recordId: string,
): Promise<ContributorRecordDetail> {
  const doc = await HeritageRecordModel.findOne({
    _id: recordId,
    createdBy: user.id,
  })
    .lean()
    .exec();

  if (doc === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }
  return toContributorDto(doc);
}

/**
 * Deletes one of the caller's records when its lifecycle state is still
 * private or unpublished. The ownership filter is part of the atomic delete,
 * so a concurrent review transition cannot be bypassed: if the record becomes
 * published first, nothing is deleted and the owner is directed to the
 * withdrawal flow. Media rows and stored objects are removed afterwards.
 */
export async function deleteOwnRecord(
  user: AuthUserPublic,
  recordId: string,
  storage?: StorageAdapter,
): Promise<void> {
  const deleted = await HeritageRecordModel.findOneAndDelete({
    _id: recordId,
    createdBy: user.id,
    status: { $in: [...DELETABLE_STATUSES] },
  })
    .lean()
    .exec();

  if (deleted === null) {
    const existing = await HeritageRecordModel.findOne({
      _id: recordId,
      createdBy: user.id,
    })
      .select({ status: 1 })
      .lean()
      .exec();

    if (existing === null) {
      throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
    }
    if (existing.status === 'published') {
      throw new AppError(
        409,
        'Published records must be removed through a withdrawal request',
        'WITHDRAWAL_REQUIRED',
      );
    }
    throw new AppError(409, 'Records in this state can no longer be deleted', 'INVALID_TRANSITION');
  }

  await recordAuditEvent({
    action: 'record.deleted',
    actorId: user.id,
    actorRole: user.role,
    recordId,
    metadata: { statusBefore: deleted.status },
  });

  await deleteRecordMedia(deleted._id, storage);
}
