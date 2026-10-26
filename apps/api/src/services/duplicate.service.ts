import type {
  DuplicateCandidate,
  DuplicateReasonCode,
  DuplicateSuggestionResponse,
  HeritageRecordSummary,
} from '@entebharatham/shared';
import { DUPLICATE_DETECTION_NOTES, DUPLICATE_MATCH } from '@entebharatham/shared';
import { HeritageRecordModel } from '../models/HeritageRecord.js';
import { PUBLIC_ELIGIBILITY_FILTER } from './heritage.service.js';
import { AppError } from '../utils/AppError.js';

/**
 * Duplicate-assistance service (Phase 6).
 *
 * Duplicate detection is *assistance*, never an automatic action. Two records
 * that look alike may be:
 *
 * - a regional variant (the same proverb told differently in two districts),
 * - a translation,
 * - an adaptation for a different audience,
 * - two genuinely independent tellings.
 *
 * All of those are legitimate cultural outcomes. The service therefore:
 *
 * - only ever looks at **publicly published** records (private drafts,
 *   restricted records, and unpublished submissions are never listed);
 * - is **bounded** — at most 60 candidates are scanned and at most 5 are
 *   returned, so the check cannot become a way to enumerate the archive;
 * - returns **reasons**, so a moderator can see why a pair was surfaced;
 * - never merges, rejects, or deletes anything.
 */

/** Lower-cases, strips diacritics and punctuation, and collapses whitespace. */
export function normalizeTitle(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Character bigrams of the normalised title (used for the Dice coefficient). */
function bigrams(value: string): string[] {
  const padded = ` ${value} `;
  const result: string[] = [];
  for (let index = 0; index < padded.length - 1; index += 1) {
    result.push(padded.slice(index, index + 2));
  }
  return result;
}

/** Jaccard similarity of the token sets. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Dice similarity of the character bigram sets. */
function dice(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const gram of setA) {
    if (setB.has(gram)) intersection += 1;
  }
  return (2 * intersection) / (setA.size + setB.size);
}

function tokenize(value: string): Set<string> {
  return new Set(
    normalizeTitle(value)
      .split(' ')
      .filter((token) => token.length > 0),
  );
}

function sameRegion(
  a: { country?: string; state?: string; district?: string },
  b: { country?: string; state?: string; district?: string },
): boolean {
  return (
    (a.country ?? '').toLowerCase() === (b.country ?? '').toLowerCase() &&
    (a.state ?? '').toLowerCase() === (b.state ?? '').toLowerCase() &&
    (a.district ?? '').toLowerCase() === (b.district ?? '').toLowerCase()
  );
}

function sameLanguageSet(a: string[], b: string[]): boolean {
  const left = new Set(a.map((item) => item.toLowerCase()));
  const right = new Set(b.map((item) => item.toLowerCase()));
  if (left.size === 0 || right.size === 0) return false;
  for (const item of left) {
    if (right.has(item)) return true;
  }
  return false;
}

function sharedTags(a: string[], b: string[]): string[] {
  const right = new Set(b.map((item) => item.toLowerCase()));
  return a.filter((item) => right.has(item.toLowerCase()));
}

/**
 * Scores one candidate against the record under review and explains the
 * result. The score compares titles and metadata only — it says nothing about
 * authenticity, importance, or cultural value.
 */
export function scoreCandidate(
  subject: {
    title: string;
    heritageType: string;
    languages: string[];
    region: { country?: string; state?: string; district?: string };
    tags: string[];
  },
  candidate: {
    title: string;
    heritageType: string;
    languages: string[];
    region: { country?: string; state?: string; district?: string };
    tags: string[];
  },
): { similarity: number; reasons: DuplicateReasonCode[] } {
  const subjectTitle = normalizeTitle(subject.title);
  const candidateTitle = normalizeTitle(candidate.title);

  const tokenScore = jaccard(tokenize(subject.title), tokenize(candidate.title));
  const charScore = dice(bigrams(subjectTitle), bigrams(candidateTitle));
  let similarity = tokenScore * 0.6 + charScore * 0.4;

  const reasons: DuplicateReasonCode[] = [];
  if (subjectTitle.length > 0 && subjectTitle === candidateTitle) {
    similarity = 1;
    reasons.push('identical_title');
  } else if (similarity >= 0.4) {
    reasons.push('similar_title');
  }

  if (
    subject.heritageType === candidate.heritageType &&
    sameRegion(subject.region, candidate.region)
  ) {
    reasons.push('same_type_and_region');
    similarity = Math.min(1, similarity + 0.05);
  }
  if (
    subject.heritageType === candidate.heritageType &&
    sameLanguageSet(subject.languages, candidate.languages)
  ) {
    reasons.push('same_type_and_language');
    similarity = Math.min(1, similarity + 0.05);
  }
  if (sharedTags(subject.tags, candidate.tags).length > 0) {
    reasons.push('shared_tags');
    similarity = Math.min(1, similarity + 0.03);
  }

  return { similarity: Math.round(similarity * 1000) / 1000, reasons };
}

function explain(reasons: DuplicateReasonCode[], similarity: number): string {
  const parts: string[] = [];
  if (reasons.includes('identical_title')) parts.push('the titles are identical');
  else if (reasons.includes('similar_title')) parts.push('the titles are similar');
  if (reasons.includes('same_type_and_region')) parts.push('same category and region');
  if (reasons.includes('same_type_and_language')) parts.push('same category and language');
  if (reasons.includes('shared_tags')) parts.push('shared tags');
  const because = parts.length > 0 ? `${parts.join(', ')}` : 'related metadata';
  const level =
    similarity >= DUPLICATE_MATCH.likelyDuplicateThreshold ? 'a close match' : 'a possible match';
  return `Suggested because it is ${level} (${because}).`;
}

/**
 * Finds possible duplicates of a record. Only publicly published records are
 * considered, the scan is bounded, and the result is advisory.
 */
export async function findDuplicateCandidates(
  recordId: string,
): Promise<DuplicateSuggestionResponse> {
  const subject = await HeritageRecordModel.findById(recordId).lean().exec();
  if (subject === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }

  const baseFilter = {
    ...PUBLIC_ELIGIBILITY_FILTER,
    _id: { $ne: subject._id },
  } as Record<string, unknown>;

  const candidates = new Map<string, HeritageRecordSummary & { tags: string[] }>();

  // Pass 1 — same category (indexed, cheap, bounded).
  const byType = await HeritageRecordModel.find({
    ...baseFilter,
    heritageType: subject.heritageType,
  })
    .limit(DUPLICATE_MATCH.maxCandidatesScanned)
    .lean()
    .exec();
  for (const doc of byType) {
    candidates.set(String(doc._id), {
      id: String(doc._id),
      slug: doc.slug,
      title: doc.title,
      heritageType: doc.heritageType,
      languages: [...doc.languages],
      region: {
        country: doc.region.country,
        state: doc.region.state,
        district: doc.region.district,
        locality: doc.region.locality,
      },
      communityName: doc.communityName,
      summary: doc.summary,
      isFictionalSample: doc.isFictionalSample,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      tags: [...doc.tags],
    });
  }

  // Pass 2 — full-text title search, when the text index is available.
  try {
    const byText = await HeritageRecordModel.find({
      ...baseFilter,
      $text: { $search: subject.title },
    })
      .limit(DUPLICATE_MATCH.maxCandidatesScanned)
      .lean()
      .exec();
    for (const doc of byText) {
      if (candidates.has(String(doc._id))) continue;
      candidates.set(String(doc._id), {
        id: String(doc._id),
        slug: doc.slug,
        title: doc.title,
        heritageType: doc.heritageType,
        languages: [...doc.languages],
        region: {
          country: doc.region.country,
          state: doc.region.state,
          district: doc.region.district,
          locality: doc.region.locality,
        },
        communityName: doc.communityName,
        summary: doc.summary,
        isFictionalSample: doc.isFictionalSample,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        tags: [...doc.tags],
      });
    }
  } catch {
    // The text index may be unavailable in a fresh database. The
    // category-based pass above is sufficient, so this is not an error.
  }

  const scored: DuplicateCandidate[] = [];
  for (const candidate of candidates.values()) {
    const { similarity, reasons } = scoreCandidate(
      {
        title: subject.title,
        heritageType: subject.heritageType,
        languages: [...subject.languages],
        region: {
          country: subject.region.country,
          state: subject.region.state,
          district: subject.region.district,
        },
        tags: [...subject.tags],
      },
      {
        title: candidate.title,
        heritageType: candidate.heritageType,
        languages: candidate.languages,
        region: candidate.region,
        tags: candidate.tags,
      },
    );
    if (similarity < DUPLICATE_MATCH.suggestionThreshold) continue;
    if (reasons.length === 0) continue;
    scored.push({
      id: candidate.id,
      slug: candidate.slug,
      title: candidate.title,
      heritageType: candidate.heritageType,
      languages: candidate.languages,
      region: candidate.region,
      communityName: candidate.communityName,
      summary: candidate.summary,
      similarity,
      reasons,
      explanation: explain(reasons, similarity),
    });
  }

  scored.sort((a, b) => b.similarity - a.similarity || a.title.localeCompare(b.title));

  return {
    recordId: String(subject._id),
    candidates: scored.slice(0, DUPLICATE_MATCH.maxResults),
    notes: [...DUPLICATE_DETECTION_NOTES],
  };
}

/**
 * Finds possible duplicates of a record the caller owns. Ownership is
 * enforced in the query so another contributor's record is indistinguishable
 * from a missing one.
 */
export async function findOwnedDuplicateCandidates(
  user: { id: string },
  recordId: string,
): Promise<DuplicateSuggestionResponse> {
  const owned = await HeritageRecordModel.exists({ _id: recordId, createdBy: user.id }).exec();
  if (owned === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }
  return findDuplicateCandidates(recordId);
}
