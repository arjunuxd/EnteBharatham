import type {
  ProvenanceBlock,
  ProvenanceChange,
  ProvenanceClaimState,
  ProvenanceHistoryEntry,
  ProvenancePublic,
  ProvenanceReviewStatus,
  VariantDeclaration,
} from '@entebharatham/shared';
import type { HeritageRecordFields } from '../models/HeritageRecord.js';

/**
 * Provenance projections (owner/moderator and public).
 *
 * Kept in its own module so both the public mapper and the provenance
 * service can use them without depending on each other.
 */

function optional(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}

/**
 * Maps the internal review status onto a public claim state. `verified` means
 * "a reviewer checked that the attribution is consistent with what the
 * contributor stated" — it is never presented as historical authentication.
 */
export function toClaimState(
  reviewStatus: ProvenanceReviewStatus | undefined,
): ProvenanceClaimState {
  if (reviewStatus === 'verified') return 'review_observed';
  return 'contributor_provided';
}

/** Public projection — safe to expose on the public API. */
export function toProvenancePublic(doc: HeritageRecordFields): ProvenancePublic {
  const provenance = doc.provenance;
  const result: ProvenancePublic = {
    claimState: toClaimState(provenance?.reviewStatus),
    attributionPreference: provenance?.attributionPreference ?? 'named',
  };
  const originalLanguage = optional(provenance?.originalLanguage);
  if (originalLanguage !== undefined) result.originalLanguage = originalLanguage;
  const communityContext = optional(provenance?.communityContext);
  if (communityContext !== undefined) result.communityContext = communityContext;
  return result;
}

/** Owner/moderator projection — includes the internal reviewer note. */
export function toProvenanceBlock(doc: HeritageRecordFields): ProvenanceBlock {
  const provenance = doc.provenance;
  const block: ProvenanceBlock = {
    attributionPreference: provenance?.attributionPreference ?? 'named',
    permitAnonymity: provenance?.permitAnonymity ?? true,
    reviewStatus: provenance?.reviewStatus ?? 'unreviewed',
  };
  const originalLanguage = optional(provenance?.originalLanguage);
  if (originalLanguage !== undefined) block.originalLanguage = originalLanguage;
  const communityContext = optional(provenance?.communityContext);
  if (communityContext !== undefined) block.communityContext = communityContext;
  const reviewerNotes = optional(provenance?.reviewerNotes);
  if (reviewerNotes !== undefined) block.reviewerNotes = reviewerNotes;
  if (provenance?.reviewedAt !== undefined) {
    block.reviewedAt = new Date(provenance.reviewedAt).toISOString();
  }
  return block;
}

/** The auditable provenance history, oldest first. */
export function toProvenanceHistory(doc: HeritageRecordFields): ProvenanceHistoryEntry[] {
  const history = doc.provenanceHistory ?? [];
  return history.map((entry) => {
    const item: ProvenanceHistoryEntry = {
      id: entry._id !== undefined ? String(entry._id) : '',
      changedAt: new Date(entry.changedAt).toISOString(),
      changes: (entry.changes ?? []).map((change) => {
        const mapped: ProvenanceChange = { field: change.field };
        if (change.previous !== undefined) mapped.previous = change.previous;
        if (change.next !== undefined) mapped.next = change.next;
        return mapped;
      }),
    };
    if (entry.changedById !== undefined) item.changedById = String(entry.changedById);
    if (entry.changedByRole !== undefined) {
      item.changedByRole = entry.changedByRole as ProvenanceHistoryEntry['changedByRole'];
    }
    const reason = optional(entry.reason);
    if (reason !== undefined) item.reason = reason;
    return item;
  });
}

/** Variant declarations (a record may legitimately resemble another). */
export function toVariantDeclarations(doc: HeritageRecordFields): VariantDeclaration[] {
  const declarations = doc.variantDeclarations ?? [];
  return declarations.map((declaration) => ({
    id: declaration._id !== undefined ? String(declaration._id) : '',
    relatedRecordId: String(declaration.relatedRecordId),
    note: declaration.note,
    createdAt: new Date(declaration.createdAt).toISOString(),
  }));
}
