import type {
  HeritageListQuery,
  HeritageRecordPublic,
  HeritageRecordSummary,
  HeritageType,
  PaginatedResponse,
  Region,
} from '@entebharatham/shared';
import { HERITAGE_TYPE_OPTIONS } from '@entebharatham/shared';
import { apiGet } from './api';

/** Human-readable label for a controlled heritage type. */
export function heritageTypeLabel(type: HeritageType): string {
  return HERITAGE_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

/** Formats a region for display, skipping missing parts. */
export function formatRegion(region: Region): string {
  return [region.locality, region.district, region.state, region.country]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(', ');
}

/** Builds the query path for the public heritage listing endpoint. */
export function buildHeritageListPath(params: HeritageListQuery): string {
  const search = new URLSearchParams();
  search.set('page', String(params.page));
  search.set('limit', String(params.limit));
  if (params.heritageType) search.set('heritageType', params.heritageType);
  if (params.language) search.set('language', params.language);
  if (params.region) search.set('region', params.region);
  if (params.tags && params.tags.length > 0) search.set('tags', params.tags.join(','));
  if (params.q) search.set('q', params.q);
  if (params.sort) search.set('sort', params.sort);
  if (params.community) search.set('community', params.community);
  if (params.translationLanguage) search.set('translationLanguage', params.translationLanguage);
  return `/heritage?${search.toString()}`;
}

export function fetchHeritageList(
  params: HeritageListQuery,
  signal?: AbortSignal,
): Promise<PaginatedResponse<HeritageRecordSummary>> {
  return apiGet<PaginatedResponse<HeritageRecordSummary>>(buildHeritageListPath(params), signal);
}

export function fetchHeritageRecord(
  slug: string,
  signal?: AbortSignal,
): Promise<HeritageRecordPublic> {
  return apiGet<HeritageRecordPublic>(`/heritage/${encodeURIComponent(slug)}`, signal);
}

export function fetchRelatedHeritage(
  slug: string,
  signal?: AbortSignal,
  limit?: number,
): Promise<{ items: HeritageRecordSummary[] }> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  return apiGet<{ items: HeritageRecordSummary[] }>(
    `/heritage/${encodeURIComponent(slug)}/related${qs ? `?${qs}` : ''}`,
    signal,
  );
}

/** A facet value with the number of publicly eligible records behind it. */
export interface FacetValue {
  value: string;
  count: number;
}

/** The discovery facet buckets, computed over publicly eligible records only. */
export interface DiscoveryFacets {
  heritageTypes: FacetValue[];
  languages: FacetValue[];
  regions: FacetValue[];
  tags: FacetValue[];
}

export function fetchDiscoveryFacets(signal?: AbortSignal): Promise<DiscoveryFacets> {
  return apiGet('/discovery/facets', signal);
}
