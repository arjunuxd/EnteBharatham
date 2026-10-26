import type {
  HeritageListQuery,
  HeritageRecordPublic,
  HeritageRecordSummary,
  PaginatedResponse,
} from '@entebharatham/shared';
import { HeritageRecordModel, type HeritageRecordFields } from '../models/HeritageRecord.js';
import { TranslationModel } from '../models/Translation.js';
import { TtlCache } from '../utils/ttlCache.js';
import { toPublicDto, toSummaryDto } from './heritage.mapper.js';

/**
 * A record is publicly eligible only when ALL of these hold. Enforced in the
 * database query itself — restricted or unpublished records are never
 * fetched and filtered client-side, and a missing/false consent flag is
 * never treated as permission to publish.
 */
export const PUBLIC_ELIGIBILITY_FILTER = {
  status: 'published',
  visibility: 'public',
  'consent.permissionToPublish': true,
} as const;

/** A lean (plain-object) heritage record, as returned by Mongoose. */
type LeanRecord = HeritageRecordFields & { _id: unknown };

/** A facet aggregation row: a grouped value with its count. */
interface FacetRow {
  _id: { state?: string; district?: string } | string;
  count: number;
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface DiscoveryFacets {
  heritageTypes: FacetValue[];
  languages: FacetValue[];
  regions: FacetValue[];
  tags: FacetValue[];
}

/** Normalizes a facet row to `{ value, count }`. */
function toFacet(row: FacetRow): FacetValue {
  const id = row._id;
  const value = typeof id === 'string' ? id : (id?.state ?? id?.district ?? '');
  return { value, count: row.count };
}

/**
 * Short-lived caches for public read models. They collapse bursts of identical
 * exploration queries and facet aggregations into one database round trip.
 * Any action that can change public visibility clears them (audit.service),
 * so withdrawals and approvals take effect immediately; the short TTL is a
 * second line of defence.
 */
const LIST_TTL_MS = 30_000;
const DETAIL_TTL_MS = 30_000;
const RELATED_TTL_MS = 60_000;
const SUGGESTIONS_TTL_MS = 120_000;
const FACETS_TTL_MS = 300_000;

const listCache = new TtlCache<PaginatedResponse<HeritageRecordSummary>>(LIST_TTL_MS, 100);
const detailCache = new TtlCache<HeritageRecordPublic | null>(DETAIL_TTL_MS, 200);
const relatedCache = new TtlCache<HeritageRecordSummary[]>(RELATED_TTL_MS, 200);
const suggestionsCache = new TtlCache<SearchSuggestions>(SUGGESTIONS_TTL_MS, 100);
const facetsCache = new TtlCache<DiscoveryFacets>(FACETS_TTL_MS, 10);

export interface SearchSuggestions {
  titles: string[];
  tags: string[];
  regions: string[];
  languages: string[];
}

/** Clears every cached public read after a visibility/content change. */
export function invalidatePublicHeritageCache(): void {
  listCache.clear();
  detailCache.clear();
  relatedCache.clear();
  suggestionsCache.clear();
  facetsCache.clear();
}

function listQueryKey(query: HeritageListQuery): string {
  return JSON.stringify([
    query.page,
    query.limit,
    query.heritageType ?? '',
    query.language ?? '',
    query.translationLanguage ?? '',
    query.region ?? '',
    query.community ?? '',
    query.tags ?? [],
    query.sort ?? '',
    query.q ?? '',
  ]);
}

/** Escapes user text before it is embedded in an anchored regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive full-string match, built only from escaped scalars. */
function anchoredRegex(value: string): RegExp {
  return new RegExp(`^${escapeRegExp(value)}$`, 'i');
}

/**
 * Builds the MongoDB filter for public exploration queries from validated,
 * scalar query values only. No client-supplied operators or objects ever
 * reach the query — every condition is constructed here with fixed keys.
 */
export function buildPublicFilter(query: HeritageListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = { ...PUBLIC_ELIGIBILITY_FILTER };

  if (query.heritageType !== undefined) {
    filter.heritageType = query.heritageType;
  }
  if (query.language !== undefined) {
    filter.languages = anchoredRegex(query.language);
  }
  if (query.translationLanguage !== undefined) {
    filter.languages = anchoredRegex(query.translationLanguage);
  }
  if (query.region !== undefined) {
    const regionRegex = anchoredRegex(query.region);
    filter.$or = [
      { 'region.state': regionRegex },
      { 'region.district': regionRegex },
      { 'region.locality': regionRegex },
    ];
  }
  if (query.community !== undefined) {
    filter.communityName = anchoredRegex(query.community);
  }
  if (query.tags !== undefined && query.tags.length > 0) {
    filter.tags = { $all: query.tags.map(anchoredRegex) };
  }
  if (query.q !== undefined) {
    filter.$text = { $search: query.q };
  }

  return filter;
}

/**
 * Lists publicly eligible heritage records with stable pagination.
 * Supports relevance sorting when searching, and includes matches from
 * published translations where appropriate (parent must remain publicly eligible).
 */
async function queryPublicHeritage(
  query: HeritageListQuery,
): Promise<PaginatedResponse<HeritageRecordSummary>> {
  const baseFilter = { ...PUBLIC_ELIGIBILITY_FILTER };
  const filter = buildPublicFilter(query);

  // If we need to consider translations, merge parent IDs from published translations
  if (query.q !== undefined && query.q.trim().length >= 2) {
    try {
      // Bound both the number of parent ids carried into the parent query and
      // the time the translation search may run. A broad search must never
      // turn into an unbounded `$in` list or a multi-second query.
      const translationMatches = await TranslationModel.find({
        status: 'published',
        $text: { $search: query.q },
      })
        .select('parentRecordId')
        .limit(200)
        .maxTimeMS(2_000)
        .lean()
        .exec();

      if (translationMatches.length > 0) {
        const parentIds = translationMatches
          .map((t) => t.parentRecordId)
          .filter((id) => id !== undefined && id !== null);
        if (parentIds.length > 0) {
          // Ensure we only include publicly eligible parents
          // Combine existing filter conditions with OR for direct matches or translation matches
          const directOrTranslationFilter: Record<string, unknown> = {
            ...baseFilter,
          };
          // Merge other conditions (type, language, region, tags, etc.)
          if (query.heritageType !== undefined) {
            directOrTranslationFilter.heritageType = query.heritageType;
          }
          if (query.language !== undefined) {
            directOrTranslationFilter.languages = anchoredRegex(query.language);
          }
          if (query.translationLanguage !== undefined) {
            directOrTranslationFilter.languages = anchoredRegex(query.translationLanguage);
          }
          if (query.region !== undefined) {
            const regionRegex = anchoredRegex(query.region);
            directOrTranslationFilter.$or = [
              { 'region.state': regionRegex },
              { 'region.district': regionRegex },
              { 'region.locality': regionRegex },
            ];
          }
          if (query.community !== undefined) {
            directOrTranslationFilter.communityName = anchoredRegex(query.community);
          }
          if (query.tags !== undefined && query.tags.length > 0) {
            directOrTranslationFilter.tags = { $all: query.tags.map(anchoredRegex) };
          }

          // Either direct text match OR parent matches translation
          const combinedOr: Record<string, unknown>[] = [];
          // Direct matches
          if (query.q !== undefined) {
            combinedOr.push({ $text: { $search: query.q } });
          }
          // Translation matches - parents of published translations
          combinedOr.push({ _id: { $in: parentIds } });
          directOrTranslationFilter.$and = [{ $or: combinedOr }];

          const skip = (query.page - 1) * query.limit;
          const sortOption = query.sort ?? 'relevance';

          let findQuery = HeritageRecordModel.find(directOrTranslationFilter).lean();

          if (sortOption === 'title') {
            findQuery = findQuery.sort({ title: 1, _id: 1 });
          } else if (sortOption === 'newest') {
            findQuery = findQuery.sort({ createdAt: -1, _id: -1 });
          } else {
            // relevance - prefer text score if doing text search
            findQuery = findQuery.sort({ createdAt: -1, _id: -1 });
          }

          const [docs, total] = await Promise.all([
            findQuery.skip(skip).limit(query.limit).exec(),
            HeritageRecordModel.countDocuments(directOrTranslationFilter).exec(),
          ]);

          return {
            items: docs.map((doc) => toSummaryDto(doc)),
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
          };
        }
      }
    } catch {
      // Fall through to default behavior if translation search fails
    }
  }

  const skip = (query.page - 1) * query.limit;
  const sortOption = query.sort ?? (query.q !== undefined ? 'relevance' : 'newest');

  let findQuery = HeritageRecordModel.find(filter).lean();
  if (sortOption === 'title') {
    findQuery = findQuery.sort({ title: 1, _id: 1 });
  } else if (sortOption === 'relevance' && query.q !== undefined) {
    findQuery = findQuery.sort({ score: { $meta: 'textScore' }, createdAt: -1, _id: -1 });
  } else {
    findQuery = findQuery.sort({ createdAt: -1, _id: -1 });
  }

  // For text score sorting, we need to add projection
  let docs: LeanRecord[];
  if (sortOption === 'relevance' && query.q !== undefined && filter.$text) {
    const [d, total] = await Promise.all([
      HeritageRecordModel.find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' }, createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(query.limit)
        .lean()
        .exec(),
      HeritageRecordModel.countDocuments(filter).exec(),
    ]);
    docs = d as unknown as LeanRecord[];
    const totalPages = Math.ceil(total / query.limit);
    return {
      items: docs.map((doc) => toSummaryDto(doc)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
    };
  }

  const [d, total] = await Promise.all([
    findQuery.skip(skip).limit(query.limit).exec(),
    HeritageRecordModel.countDocuments(filter).exec(),
  ]);

  return {
    items: d.map((doc) => toSummaryDto(doc)),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
}

/**
 * Returns a single publicly eligible record by slug, or null. Missing,
 * restricted, draft, and consent-less records are indistinguishable to the
 * caller of the HTTP API — both produce an identical 404.
 */
async function queryPublicHeritageBySlug(slug: string): Promise<HeritageRecordPublic | null> {
  const doc = await HeritageRecordModel.findOne({
    ...PUBLIC_ELIGIBILITY_FILTER,
    slug,
  })
    .maxTimeMS(5_000)
    .lean()
    .exec();

  return doc === null ? null : toPublicDto(doc);
}

/**
 * Get related heritage records based on shared metadata.
 * Deterministic matching using tags, type, language, region.
 * Excludes the current record and ineligible records.
 */
async function queryRelatedHeritage(
  recordId: string,
  slug: string,
  options?: {
    limit?: number;
  },
): Promise<HeritageRecordSummary[]> {
  const limit = Math.min(options?.limit ?? 4, 10);

  // Get the base record first
  const base = await HeritageRecordModel.findOne({
    ...PUBLIC_ELIGIBILITY_FILTER,
    slug,
  })
    .lean()
    .exec();

  if (!base) {
    return [];
  }

  const orConditions: Record<string, unknown>[] = [];

  if (base.tags && base.tags.length > 0) {
    orConditions.push({ tags: { $in: base.tags } });
  }
  orConditions.push({ heritageType: base.heritageType });
  if (base.languages && base.languages.length > 0) {
    orConditions.push({ languages: { $in: base.languages } });
  }
  if (base.region?.state) {
    orConditions.push({ 'region.state': base.region.state });
  }
  if (base.region?.district) {
    orConditions.push({ 'region.district': base.region.district });
  }
  if (base.communityName) {
    orConditions.push({ communityName: base.communityName });
  }

  if (orConditions.length === 0) {
    return [];
  }

  const filter = {
    ...PUBLIC_ELIGIBILITY_FILTER,
    _id: { $ne: base._id },
    $or: orConditions,
  };

  const docs = await HeritageRecordModel.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean()
    .exec();

  return docs.map((doc) => toSummaryDto(doc));
}

/**
 * Get search suggestions based on actual public data.
 */
async function querySearchSuggestions(
  query: string,
  options?: { limit?: number },
): Promise<SearchSuggestions> {
  const limit = Math.min(options?.limit ?? 5, 10);
  const q = query.trim();
  if (q.length < 2) {
    return { titles: [], tags: [], regions: [], languages: [] };
  }

  const regex = new RegExp(escapeRegExp(q), 'i');

  const [titleDocs, tagDocs, langDocs] = await Promise.all([
    HeritageRecordModel.find({
      ...PUBLIC_ELIGIBILITY_FILTER,
      title: regex,
    })
      .select('title')
      .limit(limit)
      .lean()
      .exec(),
    HeritageRecordModel.find({
      ...PUBLIC_ELIGIBILITY_FILTER,
      tags: regex,
    })
      .select('tags')
      .limit(limit)
      .lean()
      .exec(),
    HeritageRecordModel.find({
      ...PUBLIC_ELIGIBILITY_FILTER,
      languages: regex,
    })
      .select('languages')
      .limit(limit)
      .lean()
      .exec(),
  ]);

  const titles = [...new Set(titleDocs.map((d) => d.title).filter(Boolean))].slice(0, limit);
  const tagsSet = new Set<string>();
  for (const doc of tagDocs) {
    for (const tag of doc.tags || []) {
      if (regex.test(tag)) {
        tagsSet.add(tag);
      }
    }
  }
  const tags = [...tagsSet].slice(0, limit);

  const langSet = new Set<string>();
  for (const doc of langDocs) {
    for (const lang of doc.languages || []) {
      if (regex.test(lang)) {
        langSet.add(lang);
      }
    }
  }
  const languages = [...langSet].slice(0, limit);

  // Get regions
  const regionDocs = await HeritageRecordModel.find({
    ...PUBLIC_ELIGIBILITY_FILTER,
    $or: [{ 'region.state': regex }, { 'region.district': regex }, { 'region.locality': regex }],
  })
    .select('region')
    .limit(limit)
    .lean()
    .exec();

  const regionSet = new Set<string>();
  for (const doc of regionDocs) {
    if (doc.region?.state && regex.test(doc.region.state)) regionSet.add(doc.region.state);
    if (doc.region?.district && regex.test(doc.region.district)) regionSet.add(doc.region.district);
    if (doc.region?.locality && regex.test(doc.region.locality)) regionSet.add(doc.region.locality);
  }
  const regions = [...regionSet].slice(0, limit);

  return { titles, tags, regions, languages };
}

/**
 * Computes discovery facets over publicly eligible records only.
 *
 * A single `$facet` pipeline replaces the four separate aggregations used
 * previously: the eligibility filter is applied once and all buckets are
 * derived from the same pass.
 */
async function queryDiscoveryFacets(): Promise<DiscoveryFacets> {
  const grouped = await HeritageRecordModel.aggregate<{
    heritageTypes: FacetRow[];
    languages: FacetRow[];
    tags: FacetRow[];
    regions: FacetRow[];
  }>([
    { $match: PUBLIC_ELIGIBILITY_FILTER },
    {
      $facet: {
        heritageTypes: [
          { $group: { _id: '$heritageType', count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
        ],
        languages: [
          { $unwind: '$languages' },
          { $group: { _id: '$languages', count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 50 },
        ],
        tags: [
          { $unwind: '$tags' },
          { $group: { _id: '$tags', count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 50 },
        ],
        regions: [
          {
            $group: {
              _id: { state: '$region.state', district: '$region.district' },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 100 },
        ],
      },
    },
  ])
    .option({ maxTimeMS: 10_000 })
    .exec();

  const result = grouped[0];
  const typeAgg = result?.heritageTypes ?? [];
  const langAgg = result?.languages ?? [];
  const tagAgg = result?.tags ?? [];
  const regionAgg = result?.regions ?? [];

  const regions: FacetValue[] = [];
  for (const r of regionAgg) {
    const id = r._id;
    const val = typeof id === 'string' ? id : (id?.state ?? id?.district);
    if (val) {
      regions.push({ value: val, count: r.count });
    }
  }
  // A record can contribute both its state and district bucket; merge labels
  // that repeat so the navigation list has one entry per region name.
  const regionMap = new Map<string, number>();
  for (const r of regions) {
    regionMap.set(r.value, (regionMap.get(r.value) || 0) + r.count);
  }
  const regionsUnique = [...regionMap.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, 50);

  return {
    heritageTypes: typeAgg.map(toFacet),
    languages: langAgg.map(toFacet),
    regions: regionsUnique,
    tags: tagAgg.map(toFacet),
  };
}

/* -------------------------------------------------------------------------- */
/* Cached public read API                                                     */
/* -------------------------------------------------------------------------- */

/** Lists publicly eligible records, reusing a short-lived cached page. */
export function listPublicHeritage(
  query: HeritageListQuery,
): Promise<PaginatedResponse<HeritageRecordSummary>> {
  return listCache.getOrLoad(listQueryKey(query), () => queryPublicHeritage(query));
}

/** Returns one publicly eligible record (or null) with a short cache. */
export function getPublicHeritageBySlug(slug: string): Promise<HeritageRecordPublic | null> {
  return detailCache.getOrLoad(slug, () => queryPublicHeritageBySlug(slug));
}

/** Related records for a public slug, cached per slug/limit pair. */
export function getRelatedHeritage(
  recordId: string,
  slug: string,
  options?: { limit?: number },
): Promise<HeritageRecordSummary[]> {
  const limit = Math.min(options?.limit ?? 4, 10);
  return relatedCache.getOrLoad(`${recordId}|${slug}|${limit}`, () =>
    queryRelatedHeritage(recordId, slug, options),
  );
}

/** Debounced suggestion values derived from public records only. */
export function getSearchSuggestions(
  query: string,
  options?: { limit?: number },
): Promise<SearchSuggestions> {
  const limit = Math.min(options?.limit ?? 5, 10);
  return suggestionsCache.getOrLoad(`${query.trim().toLowerCase()}|${limit}`, () =>
    querySearchSuggestions(query, options),
  );
}

/** Discovery counts for public navigation surfaces. */
export function getDiscoveryFacets(): Promise<DiscoveryFacets> {
  return facetsCache.getOrLoad('public-facets', queryDiscoveryFacets);
}
