import type {
  ContributorPublic,
  HeritageRecordPublic,
  HeritageRecordSummary,
  SourcePublic,
} from '@entebharatham/shared';
import type { HeritageRecordFields } from '../models/HeritageRecord.js';
import { toProvenancePublic } from './provenance.mapper.js';

/**
 * Explicit serialization of stored records into the public API shapes.
 * Fields are picked one by one — raw Mongoose documents (and internal
 * fields such as consent.basis, source notes, and non-public contributor
 * entries) are never spread into responses.
 */

function optional(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}

export function toSummaryDto(doc: HeritageRecordFields): HeritageRecordSummary {
  return {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    summary: optional(doc.summary),
    heritageType: doc.heritageType,
    languages: [...doc.languages],
    region: {
      country: doc.region.country,
      state: optional(doc.region.state),
      district: optional(doc.region.district),
      locality: optional(doc.region.locality),
    },
    communityName: optional(doc.communityName),
    tags: [...doc.tags],
    isFictionalSample: doc.isFictionalSample,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toPublicDto(doc: HeritageRecordFields): HeritageRecordPublic {
  const contributors: ContributorPublic[] = doc.contributors
    .filter((contributor) => contributor.isPublicAttribution)
    .map((contributor) => ({
      name: contributor.name,
      role: contributor.role,
    }));

  // Source entries marked private by the contributor are not published, and
  // the reviewer-only verification flag never appears in a public response.
  const sources: SourcePublic[] = doc.sources
    .filter((source) => source.isPublic !== false)
    .map((source) => ({
      sourceType: source.sourceType,
      description: source.description,
      collectedOn: optional(source.collectedOn),
      context: optional(source.context),
      originalLanguage: optional(source.originalLanguage),
      communityContext: optional(source.communityContext),
      collector: optional(source.collector),
      recorder: optional(source.recorder),
      translator: optional(source.translator),
      transcriber: optional(source.transcriber),
    }));

  return {
    ...toSummaryDto(doc),
    content: optional(doc.content),
    contributors,
    sources,
    provenance: toProvenancePublic(doc),
    consent: {
      allowAttribution: doc.consent.allowAttribution,
      allowRedistribution: doc.consent.allowRedistribution,
      verification: doc.consent.verification,
      restrictions: optional(doc.consent.restrictions),
    },
    license: {
      rightsStatus: doc.license.rightsStatus,
      licenseName: optional(doc.license.licenseName),
      licenseUrl: optional(doc.license.licenseUrl),
      holder: optional(doc.license.holder),
    },
  };
}
