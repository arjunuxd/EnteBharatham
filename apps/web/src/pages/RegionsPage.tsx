import { ArrowRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeritageArtwork } from '../components/HeritageArtwork';
import { Reveal } from '../components/Reveal';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState, ErrorState } from '../components/ui/States';
import { fetchDiscoveryFacets, type DiscoveryFacets } from '../lib/heritage';

export function RegionsPage() {
  useEffect(() => {
    document.title = 'Regions | EnteBharatham';
  }, []);
  const [facets, setFacets] = useState<DiscoveryFacets | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retryToken, setRetryToken] = useState(0);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    fetchDiscoveryFacets(controller.signal)
      .then((result) => {
        setFacets(result);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus('error');
      });
    return () => controller.abort();
  }, [retryToken]);

  const regions = facets?.regions ?? [];
  const trimmedFilter = filter.trim().toLowerCase();
  const filteredRegions =
    trimmedFilter === ''
      ? regions
      : regions.filter((region) => region.value.toLowerCase().includes(trimmedFilter));

  return (
    <div>
      <section className="relative overflow-hidden bg-midnight text-ivory">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(48rem_36rem_at_88%_-8%,rgb(79_70_229_/_0.35),transparent_62%),radial-gradient(34rem_26rem_at_0%_100%,rgb(251_115_88_/_0.16),transparent_66%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-[26rem] w-[26rem] rounded-full border border-ivory/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-40 left-1/4 h-[22rem] w-[22rem] rounded-full border border-ivory/[0.06]"
          aria-hidden="true"
        />
        <div className="container-page relative py-12 sm:py-16 lg:py-20">
          <PageHeader
            tone="dark"
            eyebrow="The archive by place"
            title="Explore by region"
            description="Browse publicly published heritage by the place it belongs to. A region is listed only when at least one eligible record names it."
            actions={
              <Link
                to="/explore"
                className="btn border-ivory/25 bg-transparent text-ivory hover:border-ivory/60 hover:bg-ivory/10"
              >
                All records
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />
        </div>
      </section>

      <div className="container-page pb-20">
        <div className="relative z-10 -mt-8 rounded-2xl border border-line/80 bg-paper p-4 shadow-panel sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2.5 text-sm text-earth-ink" aria-live="polite">
              <span className="status-dot text-terracotta" aria-hidden="true" />
              {status === 'ready'
                ? trimmedFilter === ''
                  ? `${regions.length} ${regions.length === 1 ? 'region' : 'regions'} represented in the public archive`
                  : `${filteredRegions.length} of ${regions.length} ${regions.length === 1 ? 'region' : 'regions'} shown`
                : 'Reading the archive index…'}
            </p>

            <div className="relative w-full sm:max-w-xs">
              <label htmlFor="region-filter" className="sr-only">
                Filter regions
              </label>
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-earth-ink"
                aria-hidden="true"
              />
              <input
                id="region-filter"
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Find a region…"
                className="input py-2 pl-10"
                disabled={status !== 'ready'}
              />
            </div>
          </div>
        </div>

        <div className="mt-12">
          {status === 'loading' && (
            <div>
              <p role="status" className="sr-only">
                Loading regions…
              </p>
              <div aria-hidden="true" className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="overflow-hidden rounded-xl border border-line/70 bg-paper/50 shadow-card"
                  >
                    <div className="aspect-[16/9] animate-pulse bg-forest-soft/60 motion-reduce:animate-none" />
                    <div className="space-y-3 p-5">
                      <div className="h-6 w-2/3 animate-pulse rounded-full bg-line motion-reduce:animate-none" />
                      <div className="h-3 w-24 animate-pulse rounded-full bg-line/70 motion-reduce:animate-none" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status === 'error' && (
            <ErrorState
              title="We could not load the regions."
              description="We could not load the regional index just now. Please try again."
              onRetry={() => setRetryToken((token) => token + 1)}
            />
          )}

          {status === 'ready' && regions.length === 0 && (
            <EmptyState
              title="No published records available for any region yet."
              description="Regions appear here when records naming them are approved for the public archive."
              action={
                <Link to="/contribute" className="btn-secondary">
                  Learn how to contribute
                </Link>
              }
            />
          )}

          {status === 'ready' && regions.length > 0 && filteredRegions.length === 0 && (
            <EmptyState
              title="No regions match that search."
              description="Try another spelling, or clear the filter to see every place represented in the archive."
              action={
                <button type="button" onClick={() => setFilter('')} className="btn-secondary">
                  Clear region filter
                </button>
              }
            />
          )}

          {status === 'ready' && filteredRegions.length > 0 && (
            <Reveal>
              <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {filteredRegions.map((region, index) => (
                  <li key={region.value} className="min-w-0">
                    <Link
                      to={`/explore?region=${encodeURIComponent(region.value)}`}
                      className="group flex h-full flex-col overflow-hidden rounded-xl border border-line/80 bg-paper/75 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-forest/25 hover:bg-paper hover:shadow-lift"
                    >
                      <div className="relative overflow-hidden">
                        <HeritageArtwork
                          seed={`region-${region.value}`}
                          heritageType={
                            index % 3 === 0
                              ? 'oral_history'
                              : index % 3 === 1
                                ? 'craft'
                                : 'folk_story'
                          }
                          aspect="wide"
                          className="transition-transform duration-700 motion-safe:group-hover:scale-[1.035]"
                        />
                        <span className="absolute left-3 top-3 rounded-full border border-ivory/20 bg-forest-deep/75 px-2.5 py-1 text-[0.5625rem] font-bold uppercase tracking-[0.16em] text-ivory/80 backdrop-blur-sm">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <div className="flex flex-1 items-start justify-between gap-4 p-5">
                        <div className="min-w-0">
                          <h2 className="break-words font-display text-[1.4rem] leading-[1.1] tracking-[-0.02em] text-ink transition-colors group-hover:text-forest-deep">
                            {region.value}
                          </h2>
                          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-earth-ink">
                            <span className="status-dot text-terracotta" aria-hidden="true" />
                            {typeof region.count === 'number'
                              ? `${region.count} ${region.count === 1 ? 'record' : 'records'}`
                              : 'Published records'}
                          </p>
                        </div>
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line/80 bg-cream/70 text-earth-ink transition-all duration-300 group-hover:border-forest/25 group-hover:bg-forest group-hover:text-ivory">
                          <ArrowRight
                            className="h-3.5 w-3.5 transition-transform motion-safe:group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>

        <section className="mt-16 rounded-2xl border border-line/70 bg-cream/50 px-6 py-6 sm:px-8">
          <p className="eyebrow">A note on place</p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-earth-ink">
            Region names follow the wording contributors recorded. The archive does not redraw
            boundaries or assign a tradition to a single place; a story can belong to more than one
            community and more than one region.
          </p>
        </section>
      </div>
    </div>
  );
}
