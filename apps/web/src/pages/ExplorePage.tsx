import type {
  HeritageRecordSummary,
  HeritageSortOption,
  HeritageType,
  PaginatedResponse,
} from '@entebharatham/shared';
import { HERITAGE_TYPE_OPTIONS, HERITAGE_TYPES } from '@entebharatham/shared';
import {
  ChevronDown,
  LayoutGrid,
  Rows3,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SearchCombobox, type SearchSuggestion } from '../components/SearchCombobox';
import { StoryCard } from '../components/StoryCard';
import { Pagination } from '../components/ui/Pagination';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState, ErrorState, SkeletonCard } from '../components/ui/States';
import { useSearchSuggestions } from '../components/search/useSearchSuggestions';
import {
  fetchHeritageList,
  fetchDiscoveryFacets,
  heritageTypeLabel,
  type DiscoveryFacets,
} from '../lib/heritage';

const PAGE_SIZE = 12;

type Status = 'loading' | 'ready' | 'error';

const SORT_LABELS: Record<HeritageSortOption, string> = {
  relevance: 'Relevance',
  newest: 'Newest first',
  title: 'Title (A–Z)',
};

/** Reads the category filter, discarding values outside the controlled taxonomy. */
function parseHeritageType(value: string | null): HeritageType | '' {
  return value !== null && (HERITAGE_TYPES as readonly string[]).includes(value)
    ? (value as HeritageType)
    : '';
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function shortCategoryLabel(label: string): string {
  return label.split(' & ')[0]?.split(',')[0] ?? label;
}

export function ExplorePage() {
  useEffect(() => {
    document.title = 'Explore | EnteBharatham';
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const filtersId = useId();

  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const heritageType = parseHeritageType(searchParams.get('heritageType'));
  const q = searchParams.get('q') ?? '';
  const language = searchParams.get('language') ?? '';
  const region = searchParams.get('region') ?? '';
  const community = searchParams.get('community') ?? '';
  const tagsParam = searchParams.get('tags') ?? '';
  const sort = searchParams.get('sort') ?? (q ? 'relevance' : 'newest');
  const translationLanguage = searchParams.get('translationLanguage') ?? '';

  const [searchText, setSearchText] = useState(q);
  const [data, setData] = useState<PaginatedResponse<HeritageRecordSummary> | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [retryToken, setRetryToken] = useState(0);
  const [facets, setFacets] = useState<DiscoveryFacets | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const { suggestions, loading: suggestionsLoading } = useSearchSuggestions(searchText);

  const tags = parseTags(tagsParam);

  useEffect(() => {
    fetchDiscoveryFacets()
      .then((result) => setFacets(result))
      .catch(() => setFacets(null));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');

    fetchHeritageList(
      {
        page,
        limit: PAGE_SIZE,
        heritageType: heritageType || undefined,
        q: q || undefined,
        language: language || undefined,
        region: region || undefined,
        community: community || undefined,
        tags: tags.length > 0 ? tags : undefined,
        sort: (sort as HeritageSortOption) || undefined,
        translationLanguage: translationLanguage || undefined,
      },
      controller.signal,
    )
      .then((result) => {
        setData(result);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus('error');
      });

    return () => controller.abort();
  }, [
    page,
    heritageType,
    q,
    language,
    region,
    community,
    tagsParam,
    sort,
    translationLanguage,
    retryToken,
  ]);

  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    setSearchParams(next);
  };

  const applySearch = () => {
    const trimmed = searchText.trim();
    updateParams({ q: trimmed.length >= 2 ? trimmed : null, page: null });
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applySearch();
  };

  const handleSuggestion = (suggestion: SearchSuggestion) => {
    if (suggestion.type === 'title') {
      setSearchText(suggestion.value);
      updateParams({ q: suggestion.value.trim(), page: null });
    } else if (suggestion.type === 'tag') {
      const nextTags = [...new Set([...tags, suggestion.value])].slice(0, 5).join(',');
      updateParams({ tags: nextTags || null, page: null });
    } else if (suggestion.type === 'language') {
      updateParams({ language: suggestion.value, page: null });
    } else {
      updateParams({ region: suggestion.value, page: null });
    }
  };

  const hasFilters =
    heritageType !== '' ||
    q !== '' ||
    language !== '' ||
    region !== '' ||
    community !== '' ||
    tags.length > 0 ||
    translationLanguage !== '';

  const activeFilterCount =
    (heritageType !== '' ? 1 : 0) +
    (q !== '' ? 1 : 0) +
    (language !== '' ? 1 : 0) +
    (region !== '' ? 1 : 0) +
    (community !== '' ? 1 : 0) +
    (tags.length > 0 ? 1 : 0) +
    (translationLanguage !== '' ? 1 : 0);

  const clearAll = () => {
    setSearchText('');
    updateParams({
      heritageType: null,
      q: null,
      page: null,
      language: null,
      region: null,
      community: null,
      tags: null,
      translationLanguage: null,
      sort: null,
    });
  };

  return (
    <div>
      <section className="relative overflow-hidden bg-midnight text-ivory">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(48rem_36rem_at_88%_-8%,rgb(79_70_229_/_0.35),transparent_62%),radial-gradient(34rem_26rem_at_0%_100%,rgb(251_115_88_/_0.16),transparent_66%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-20 -top-28 h-[28rem] w-[28rem] rounded-full border border-ivory/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-40 left-1/4 h-[22rem] w-[22rem] rounded-full border border-ivory/[0.06]"
          aria-hidden="true"
        />
        <div className="container-page relative py-10 sm:py-12 lg:py-14">
          <PageHeader
            tone="dark"
            border={false}
            eyebrow="The public archive"
            title="Explore the archive"
            description={
              <>
                Browse published records from across India. Each one carries its own languages,
                region, attribution, sources, and rights status.
              </>
            }
            actions={
              <Link
                to="/contribute"
                className="btn border-ivory/25 bg-transparent text-ivory hover:border-ivory/60 hover:bg-ivory/10"
              >
                Share a story
              </Link>
            }
            className="max-w-4xl"
          >
            <p className="max-w-3xl text-xs leading-5 text-ivory/60">
              Records labelled{' '}
              <span className="font-semibold text-gold">“Fictional demo record”</span> are
              development fixtures, not real traditions.
            </p>
          </PageHeader>
        </div>
      </section>

      <div className="container-page pb-20">
        <form
          className="relative z-10 -mt-8 rounded-2xl border border-line/80 bg-paper p-4 shadow-panel sm:p-6"
          onSubmit={handleSearchSubmit}
          aria-label="Filter heritage records"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <SearchCombobox
              value={searchText}
              onChange={setSearchText}
              onSubmit={applySearch}
              onSelect={handleSuggestion}
              suggestions={suggestions}
              loading={suggestionsLoading}
            />

            <div className="grid grid-cols-2 items-end gap-2 sm:flex">
              <button
                type="submit"
                className="btn-primary min-h-[3.125rem] shrink-0"
                aria-label="Apply search"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                Apply
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
                aria-expanded={filtersOpen}
                aria-controls={filtersId}
                className="btn-secondary min-h-[3.125rem] shrink-0"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 rounded-full bg-forest px-1.5 text-[0.625rem] leading-4 text-ivory">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div
            role="group"
            aria-label="Quick categories"
            className="no-scrollbar -mx-4 mt-4 flex items-center gap-1.5 overflow-x-auto border-t border-line/70 px-4 pb-1 pt-4 sm:mx-0 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0.5"
          >
            <span className="shrink-0 pr-1 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-earth-ink">
              Quick forms
            </span>
            {HERITAGE_TYPE_OPTIONS.map((option) => {
              const active = heritageType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    updateParams({ heritageType: active ? null : option.value, page: null })
                  }
                  className={`chip shrink-0 ${active ? 'chip-active' : ''}`}
                >
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  {shortCategoryLabel(option.label)}
                </button>
              );
            })}
          </div>

          <div
            id={filtersId}
            className={`${filtersOpen ? 'grid' : 'hidden'} mt-4 gap-x-5 gap-y-4 rounded-xl border border-line/70 bg-cream/45 p-4 sm:grid-cols-2 lg:grid-cols-12 lg:p-5`}
          >
            <div className="sm:col-span-2 lg:col-span-3">
              <label htmlFor="filter-type" className="field-label">
                Category
              </label>
              <div className="relative">
                <select
                  id="filter-type"
                  value={heritageType}
                  onChange={(event) =>
                    updateParams({ heritageType: event.target.value, page: null })
                  }
                  className="select"
                >
                  <option value="">All categories</option>
                  {HERITAGE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-earth-ink"
                  aria-hidden="true"
                />
              </div>
            </div>

            <div className="lg:col-span-3">
              <label htmlFor="filter-language" className="field-label">
                Language
              </label>
              <input
                id="filter-language"
                type="text"
                value={language}
                onChange={(event) =>
                  updateParams({ language: event.target.value || null, page: null })
                }
                placeholder="e.g. Malayalam"
                list="language-facets"
                className="input"
              />
              <datalist id="language-facets">
                {(facets?.languages ?? []).map((facet) => (
                  <option key={facet.value} value={facet.value} />
                ))}
              </datalist>
            </div>

            <div className="lg:col-span-3">
              <label htmlFor="filter-region" className="field-label">
                Region
              </label>
              <input
                id="filter-region"
                type="text"
                value={region}
                onChange={(event) =>
                  updateParams({ region: event.target.value || null, page: null })
                }
                placeholder="e.g. Kerala"
                list="region-facets"
                className="input"
              />
              <datalist id="region-facets">
                {(facets?.regions ?? []).map((facet) => (
                  <option key={facet.value} value={facet.value} />
                ))}
              </datalist>
            </div>

            <div className="lg:col-span-3">
              <label htmlFor="filter-community" className="field-label">
                Community
              </label>
              <input
                id="filter-community"
                type="text"
                value={community}
                onChange={(event) =>
                  updateParams({ community: event.target.value || null, page: null })
                }
                placeholder="Community name"
                className="input"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <label htmlFor="filter-tags" className="field-label">
                Tags
              </label>
              <input
                id="filter-tags"
                type="text"
                value={tagsParam}
                onChange={(event) =>
                  updateParams({ tags: event.target.value.trim() || null, page: null })
                }
                placeholder="harvest, monsoon"
                className="input"
              />
            </div>

            <div className="lg:col-span-4">
              <label htmlFor="sort-by" className="field-label">
                Sort by
              </label>
              <div className="relative">
                <select
                  id="sort-by"
                  value={sort}
                  onChange={(event) =>
                    updateParams({ sort: event.target.value || null, page: null })
                  }
                  className="select"
                >
                  <option value={q ? 'relevance' : 'newest'}>
                    {q ? 'Relevance / newest' : 'Newest first'}
                  </option>
                  <option value="relevance">Relevance</option>
                  <option value="newest">Newest first</option>
                  <option value="title">Title (A–Z)</option>
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-earth-ink"
                  aria-hidden="true"
                />
              </div>
            </div>

            <div className="lg:col-span-4">
              <label htmlFor="filter-translation" className="field-label">
                Translation language
              </label>
              <input
                id="filter-translation"
                type="text"
                value={translationLanguage}
                onChange={(event) =>
                  updateParams({ translationLanguage: event.target.value || null, page: null })
                }
                placeholder="Find translated records"
                className="input"
              />
            </div>

            {hasFilters && (
              <div className="sm:col-span-2 lg:col-span-12">
                <button
                  type="button"
                  onClick={clearAll}
                  className="btn-ghost btn-sm -ml-3"
                  aria-label="Clear all filters"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </form>

        {hasFilters && (
          <div
            className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line/70 bg-paper/50 px-3.5 py-3"
            aria-label="Active filters"
          >
            <span className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-earth-ink">
              Active
            </span>
            {heritageType !== '' && (
              <FilterChip
                label={`Category: ${heritageTypeLabel(heritageType)}`}
                onRemove={() => updateParams({ heritageType: null, page: null })}
              />
            )}
            {q !== '' && (
              <FilterChip
                label={`Search: ${q}`}
                onRemove={() => {
                  setSearchText('');
                  updateParams({ q: null, page: null });
                }}
              />
            )}
            {language !== '' && (
              <FilterChip
                label={`Language: ${language}`}
                onRemove={() => updateParams({ language: null, page: null })}
              />
            )}
            {region !== '' && (
              <FilterChip
                label={`Region: ${region}`}
                onRemove={() => updateParams({ region: null, page: null })}
              />
            )}
            {community !== '' && (
              <FilterChip
                label={`Community: ${community}`}
                onRemove={() => updateParams({ community: null, page: null })}
              />
            )}
            {tags.map((tag) => (
              <FilterChip
                key={tag}
                label={`Tag: ${tag}`}
                onRemove={() =>
                  updateParams({
                    tags: tags.filter((item) => item !== tag).join(',') || null,
                    page: null,
                  })
                }
              />
            ))}
            {translationLanguage !== '' && (
              <FilterChip
                label={`Translation: ${translationLanguage}`}
                onRemove={() => updateParams({ translationLanguage: null, page: null })}
              />
            )}
            <button
              type="button"
              onClick={clearAll}
              className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-earth-ink transition-colors hover:bg-forest-soft hover:text-forest"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Clear
            </button>
          </div>
        )}

        <section aria-labelledby="results-heading" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5 border-b border-line pb-5">
            <div className="min-w-0 flex-1">
              <h2
                id="results-heading"
                className="break-words font-display text-[clamp(1.6rem,4.4vw,2.4rem)] leading-[1.05] tracking-[-0.03em] text-ink [overflow-wrap:anywhere]"
              >
                {q !== '' ? `Results for “${q}”` : 'Records'}
              </h2>
              <div className="mt-2.5 flex flex-wrap items-center gap-2" aria-live="polite">
                {status === 'ready' && data !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-line/80 bg-cream/70 px-2.5 py-1 text-xs font-medium text-earth-ink">
                    <span className="status-dot text-terracotta" aria-hidden="true" />
                    {typeof data.total === 'number'
                      ? `${data.total} ${data.total === 1 ? 'record' : 'records'} found`
                      : 'Records loaded'}
                  </span>
                )}
                {hasFilters && (
                  <span className="text-xs text-earth-ink">
                    {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'} active
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <p className="text-xs text-earth-ink">
                {SORT_LABELS[(sort as HeritageSortOption) ?? 'newest'] ?? 'Sorted for browsing'}
              </p>
              <div
                role="group"
                aria-label="Result layout"
                className="hidden items-center gap-0.5 rounded-full border border-line/80 bg-paper/70 p-1 sm:flex"
              >
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={view === 'grid'}
                  onClick={() => setView('grid')}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                    view === 'grid'
                      ? 'bg-forest text-ivory'
                      : 'text-earth-ink hover:bg-forest-soft hover:text-forest'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={view === 'list'}
                  onClick={() => setView('list')}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                    view === 'list'
                      ? 'bg-forest text-ivory'
                      : 'text-earth-ink hover:bg-forest-soft hover:text-forest'
                  }`}
                >
                  <Rows3 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8">
            {status === 'loading' && (
              <div>
                <p role="status" className="sr-only">
                  Loading heritage records…
                </p>
                <div
                  aria-hidden="true"
                  className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {Array.from({ length: 6 }).map((_, index) => (
                    <SkeletonCard key={index} />
                  ))}
                </div>
              </div>
            )}

            {status === 'error' && (
              <ErrorState
                title="We could not load heritage records."
                description="We could not load these records just now. Please try again."
                onRetry={() => setRetryToken((token) => token + 1)}
              />
            )}

            {status === 'ready' && data !== null && (
              <>
                {data.items.length === 0 ? (
                  <EmptyState
                    title="No heritage records match these filters."
                    description="Try a broader search, remove a filter, or browse another category."
                    action={
                      hasFilters ? (
                        <button type="button" onClick={clearAll} className="btn-secondary">
                          Clear all filters
                        </button>
                      ) : (
                        <Link to="/explore/regions" className="btn-secondary">
                          Browse by region
                        </Link>
                      )
                    }
                  />
                ) : view === 'grid' ? (
                  <ul className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                    {data.items.map((record, index) => (
                      <li key={record.id} className="min-w-0">
                        <StoryCard record={record} index={index} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="border-y border-line/70">
                    {data.items.map((record, index) => (
                      <li
                        key={record.id}
                        className="min-w-0 border-b border-line/70 last:border-b-0"
                      >
                        <StoryCard record={record} index={index} variant="row" />
                      </li>
                    ))}
                  </ul>
                )}

                {data.items.length > 0 && (
                  <div className="mt-10">
                    <Pagination
                      page={data.page}
                      totalPages={data.totalPages}
                      total={data.total}
                      onChange={(nextPage) => updateParams({ page: String(nextPage) })}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full min-h-8 items-center gap-1 rounded-full border border-forest/20 bg-forest-soft/70 py-0.5 pl-3 pr-0.5 text-xs font-medium text-forest-deep">
      <span className="min-w-0 break-words py-1 [overflow-wrap:anywhere]">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-forest/70 transition-colors after:absolute after:-inset-2 after:rounded-full hover:bg-forest/10 hover:text-forest"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}
