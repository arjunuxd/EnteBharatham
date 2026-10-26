import type {
  AttributionPreference,
  AuthUserPublic,
  ContributorRecordDetail,
  ProvenanceChange,
  ProvenanceReviewStatus,
  SourceType,
} from '@entebharatham/shared';
import { HeritageRecordModel, type HeritageRecordFields } from '../models/HeritageRecord.js';
import { recordAuditEvent } from './audit.service.js';
import { toContributorDto } from './workflow.mapper.js';
import { AppError } from '../utils/AppError.js';

/**
 * Provenance service (Phase 6).
 *
 * Provenance records where a contribution came from and who says so. It is
 * deliberately separate from consent, rights, and visibility:
 *
 * - **consent** — may this material be published?
 * - **rights** — may it be reused?
 * - **visibility** — who may see it?
 * - **provenance** — where did it come from, and who is credited?
 *
 * Every change to the provenance block or to the source entries is appended
 * to an auditable history. History entries are never edited or removed, so a
 * later correction cannot erase what was recorded earlier.
 *
 * Privacy rules enforced here:
 * - The reviewer-only `isVerified` flag on a source entry is never written
 *   from contributor input; it is preserved across contributor edits.
 * - Internal reviewer notes are never included in a public projection.
 * - The public projection never claims verification — it reports a *claim
 *   state* instead.
 */

/** Statuses from which the owner may change the provenance. */
const PROVENANCE_EDITABLE_STATUSES = ['draft', 'changes_requested'] as const;

export interface ProvenanceUpdateInput {
  originalLanguage?: string;
  communityContext?: string;
  attributionPreference?: AttributionPreference;
  permitAnonymity?: boolean;
  sources?: {
    sourceType: SourceType;
    description: string;
    reference?: string;
    collectedOn?: string;
    context?: string;
    notes?: string;
    originalLanguage?: string;
    communityContext?: string;
    collector?: string;
    recorder?: string;
    translator?: string;
    transcriber?: string;
    mediaReferences?: string[];
    isPublic?: boolean;
  }[];
  reason?: string;
}

export interface ProvenanceReviewInput {
  reviewStatus: ProvenanceReviewStatus;
  reviewerNotes?: string;
}

/**
 * Maps the internal review status onto a public claim state. `verified` means
 * "a reviewer checked that the attribution is consistent with what the
 * contributor stated" — it is never presented as historical authentication.
 *
 * The canonical implementation lives in `provenance.mapper.ts` so that the
 * public projection and this service can never drift apart.
 */
export { toClaimState } from './provenance.mapper.js';

function describe(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

/**
 * Builds the list of provenance changes between the stored record and the
 * requested update. Only genuinely changed fields are recorded, so the
 * history stays a record of what actually happened.
 */
function diffProvenance(
  doc: HeritageRecordFields,
  input: ProvenanceUpdateInput,
): ProvenanceChange[] {
  const changes: ProvenanceChange[] = [];
  const current = doc.provenance;

  const recordFields: Array<
    [
      'originalLanguage' | 'communityContext' | 'attributionPreference' | 'permitAnonymity',
      string | undefined,
    ]
  > = [
    ['originalLanguage', input.originalLanguage],
    ['communityContext', input.communityContext],
    ['attributionPreference', input.attributionPreference],
    [
      'permitAnonymity',
      input.permitAnonymity === undefined ? undefined : String(input.permitAnonymity),
    ],
  ];

  for (const [field, next] of recordFields) {
    if (next === undefined) continue;
    const previous = describe((current as unknown as Record<string, unknown> | undefined)?.[field]);
    const nextValue = describe(next);
    if (previous !== nextValue) {
      const change: ProvenanceChange = { field };
      if (previous !== undefined) change.previous = previous;
      if (nextValue !== undefined) change.next = nextValue;
      changes.push(change);
    }
  }

  if (input.sources !== undefined) {
    const previousSources = doc.sources ?? [];
    const max = Math.max(previousSources.length, input.sources.length);
    for (let index = 0; index < max; index += 1) {
      const before = previousSources[index];
      const after = input.sources[index];
      if (after === undefined) {
        changes.push({ field: `sources[${index}]`, previous: 'present', next: 'removed' });
        continue;
      }
      if (before === undefined) {
        changes.push({ field: `sources[${index}]`, previous: 'absent', next: 'added' });
        continue;
      }
      const compared: Array<keyof typeof after> = [
        'sourceType',
        'description',
        'reference',
        'collectedOn',
        'context',
        'originalLanguage',
        'communityContext',
        'collector',
        'recorder',
        'translator',
        'transcriber',
        'isPublic',
      ];
      for (const field of compared) {
        const previousValue = describe(before[field]);
        const nextValue = describe(after[field]);
        if (previousValue !== nextValue) {
          const change: ProvenanceChange = { field: `sources[${index}].${String(field)}` };
          if (previousValue !== undefined) change.previous = previousValue;
          if (nextValue !== undefined) change.next = nextValue;
          changes.push(change);
        }
      }
      const beforeMedia = (before.mediaReferences ?? []).join(',');
      const afterMedia = (after.mediaReferences ?? []).join(',');
      if (beforeMedia !== afterMedia) {
        const change: ProvenanceChange = { field: `sources[${index}].mediaReferences` };
        if (beforeMedia.length > 0) change.previous = beforeMedia;
        if (afterMedia.length > 0) change.next = afterMedia;
        changes.push(change);
      }
    }
  }

  return changes;
}

/**
 * Applies a contributor's provenance update and appends an auditable history
 * entry. The contributor can only change provenance on a record they own and
 * can still edit; the reviewer-only `isVerified` flag on each source entry is
 * preserved and can never be set from this input.
 */
export async function updateProvenance(
  user: AuthUserPublic,
  recordId: string,
  input: ProvenanceUpdateInput,
): Promise<ContributorRecordDetail> {
  const doc = await HeritageRecordModel.findOne({ _id: recordId, createdBy: user.id })
    .lean()
    .exec();

  if (doc === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }
  if (!(PROVENANCE_EDITABLE_STATUSES as readonly string[]).includes(doc.status)) {
    throw new AppError(
      409,
      `Records with status "${doc.status}" can no longer be edited`,
      'INVALID_TRANSITION',
    );
  }

  const changes = diffProvenance(doc, input);
  if (changes.length === 0) {
    return toContributorDto(doc);
  }

  const setFields: Record<string, unknown> = {};
  const provenance: Record<string, unknown> = { ...(doc.provenance ?? {}) };
  if (input.originalLanguage !== undefined) provenance.originalLanguage = input.originalLanguage;
  if (input.communityContext !== undefined) provenance.communityContext = input.communityContext;
  if (input.attributionPreference !== undefined) {
    provenance.attributionPreference = input.attributionPreference;
  }
  if (input.permitAnonymity !== undefined) provenance.permitAnonymity = input.permitAnonymity;
  setFields.provenance = provenance;

  if (input.sources !== undefined) {
    const currentSources = doc.sources ?? [];
    setFields.sources = input.sources.map((source, index) => ({
      ...source,
      mediaReferences: source.mediaReferences ?? [],
      isPublic: source.isPublic ?? true,
      // Reviewer-set only — carried over from the stored entry.
      isVerified: currentSources[index]?.isVerified ?? false,
    }));
  }

  const result = await HeritageRecordModel.updateOne(
    { _id: recordId, createdBy: user.id, status: { $in: [...PROVENANCE_EDITABLE_STATUSES] } },
    {
      $set: setFields,
      $push: {
        provenanceHistory: {
          changedAt: new Date(),
          changedById: user.id,
          changedByRole: user.role,
          reason: input.reason,
          changes,
        },
      },
    },
    { runValidators: true },
  ).exec();

  if (result.matchedCount === 0) {
    throw new AppError(
      409,
      'The record status changed before the update could be applied. Reload and try again.',
      'INVALID_TRANSITION',
    );
  }

  await recordAuditEvent({
    action: 'provenance.updated',
    actorId: user.id,
    actorRole: user.role,
    recordId,
    metadata: { changedFields: changes.map((change) => change.field).join(',') },
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
 * Records a moderator's provenance review. The reviewer may mark the
 * provenance as reviewed, in review, or disputed, and add an internal note.
 * The public projection only ever reports the resulting claim state.
 */
export async function reviewProvenance(
  moderator: AuthUserPublic,
  recordId: string,
  input: ProvenanceReviewInput,
): Promise<ContributorRecordDetail> {
  const doc = await HeritageRecordModel.findOne({ _id: recordId }).lean().exec();
  if (doc === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }

  const previous = doc.provenance ?? undefined;
  const changes: ProvenanceChange[] = [];
  if ((previous?.reviewStatus ?? 'unreviewed') !== input.reviewStatus) {
    changes.push({
      field: 'provenance.reviewStatus',
      previous: previous?.reviewStatus ?? 'unreviewed',
      next: input.reviewStatus,
    });
  }

  const setFields: Record<string, unknown> = {
    provenance: {
      ...(previous ?? {}),
      reviewStatus: input.reviewStatus,
      reviewerId: moderator.id,
      reviewedAt: new Date(),
      ...(input.reviewerNotes !== undefined ? { reviewerNotes: input.reviewerNotes } : {}),
    },
  };

  const update: Record<string, unknown> = { $set: setFields };

  if (changes.length > 0) {
    update.$push = {
      provenanceHistory: {
        changedAt: new Date(),
        changedById: moderator.id,
        changedByRole: moderator.role,
        reason: 'provenance review',
        changes,
      },
    };
  }

  await HeritageRecordModel.updateOne({ _id: recordId }, update, { runValidators: true }).exec();

  if (changes.length > 0) {
    await recordAuditEvent({
      action: 'provenance.reviewed',
      actorId: moderator.id,
      actorRole: moderator.role,
      recordId,
      metadata: { reviewStatus: input.reviewStatus },
    });
  }

  const updated = await HeritageRecordModel.findOne({ _id: recordId }).lean().exec();
  if (updated === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }
  return toContributorDto(updated);
}

/**
 * Records that a similar record is a distinct variant or independent
 * account. This preserves the cultural reality of regional variation: the
 * records are kept side by side instead of one being merged into the other.
 */
export async function declareVariant(
  user: AuthUserPublic,
  recordId: string,
  relatedRecordId: string,
  note: string,
): Promise<ContributorRecordDetail> {
  const doc = await HeritageRecordModel.findOne({ _id: recordId, createdBy: user.id })
    .lean()
    .exec();
  if (doc === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }
  if (relatedRecordId === recordId) {
    throw new AppError(400, 'A record cannot be a variant of itself', 'INVALID_VARIANT');
  }

  const related = await HeritageRecordModel.exists({ _id: relatedRecordId }).exec();
  if (related === null) {
    throw new AppError(404, 'Related record not found', 'NOT_FOUND');
  }

  const alreadyDeclared = (doc.variantDeclarations ?? []).some(
    (declaration) => String(declaration.relatedRecordId) === relatedRecordId,
  );
  if (alreadyDeclared) {
    throw new AppError(409, 'This variant relationship is already recorded', 'DUPLICATE_VARIANT');
  }

  await HeritageRecordModel.updateOne(
    { _id: recordId, createdBy: user.id },
    {
      $push: {
        variantDeclarations: {
          relatedRecordId,
          note,
          createdAt: new Date(),
        },
        provenanceHistory: {
          changedAt: new Date(),
          changedById: user.id,
          changedByRole: user.role,
          reason: 'variant declaration',
          changes: [{ field: 'variantDeclarations', previous: 'absent', next: relatedRecordId }],
        },
      },
    },
    { runValidators: true },
  ).exec();

  await recordAuditEvent({
    action: 'variant.declared',
    actorId: user.id,
    actorRole: user.role,
    recordId,
    metadata: { relatedRecordId },
  });

  const updated = await HeritageRecordModel.findOne({ _id: recordId, createdBy: user.id })
    .lean()
    .exec();
  if (updated === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }
  return toContributorDto(updated);
}
