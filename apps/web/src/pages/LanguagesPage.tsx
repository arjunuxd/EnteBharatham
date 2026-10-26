import { ArrowRight, Languages as LanguagesIcon, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '../components/Reveal';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState, ErrorState } from '../components/ui/States';
import { fetchDiscoveryFacets, type DiscoveryFacets } from '../lib/heritage';

export function LanguagesPage() {
  useEffect(() => {
    document.title = 'Languages | EnteBharatham';
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

  const languages = facets?.languages ?? [];
  const trimmedFilter = filter.trim().toLowerCase();
  const filteredLanguages =
    trimmedFilter === ''
      ? languages
      : languages.filter((language) => language.value.toLowerCase().includes(trimmedFilter));

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
            eyebrow="The archive by language"
            title="Explore by language"
            description="Browse publicly published heritage by the language it was shared in. Records keep their original language and script; translations are separate accounts."
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
                  ? `${languages.length} ${languages.length === 1 ? 'language' : 'languages'} represented in the public archive`
                  : `${filteredLanguages.length} of ${languages.length} ${languages.length === 1 ? 'language' : 'languages'} shown`
                : 'Reading the archive index…'}
            </p>

            <div className="relative w-full sm:max-w-xs">
              <label htmlFor="language-filter" className="sr-only">
                Filter languages
              </label>
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-earth-ink"
                aria-hidden="true"
              />
              <input
                id="language-filter"
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Find a language…"
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
                Loading languages…
              </p>
              <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 rounded-xl border border-line/70 bg-paper/50 p-4 shadow-card"
                  >
                    <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-forest-soft/70 motion-reduce:animate-none" />
                    <div className="flex-1 space-y-2.5">
                      <div className="h-5 w-1/2 animate-pulse rounded-full bg-line motion-reduce:animate-none" />
                      <div className="h-3 w-24 animate-pulse rounded-full bg-line/70 motion-reduce:animate-none" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status === 'error' && (
            <ErrorState
              title="We could not load the languages."
              description="We could not load the language index just now. Please try again."
              onRetry={() => setRetryToken((token) => token + 1)}
            />
          )}

          {status === 'ready' && languages.length === 0 && (
            <EmptyState
              title="No published records available for any language yet."
              description="Languages appear here when records naming them are approved for the public archive."
              action={
                <Link to="/contribute" className="btn-secondary">
                  Learn how to contribute
                </Link>
              }
            />
          )}

          {status === 'ready' && languages.length > 0 && filteredLanguages.length === 0 && (
            <EmptyState
              title="No languages match that search."
              description="Try another spelling, or clear the filter to see every language represented in the archive."
              action={
                <button type="button" onClick={() => setFilter('')} className="btn-secondary">
                  Clear language filter
                </button>
              }
            />
          )}

          {status === 'ready' && filteredLanguages.length > 0 && (
            <Reveal>
              <ul className="grid gap-4 sm:grid-cols-2">
                {filteredLanguages.map((language, index) => {
                  const initial = language.value.trim().charAt(0).toUpperCase() || '?';
                  return (
                    <li key={language.value} className="min-w-0">
                      <Link
                        to={`/explore?language=${encodeURIComponent(language.value)}`}
                        className="group flex h-full items-center gap-4 rounded-xl border border-line/80 bg-paper/75 p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-forest/25 hover:bg-paper hover:shadow-lift sm:gap-5 sm:p-5"
                      >
                        <span
                          aria-hidden="true"
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-line/80 bg-cream font-display text-2xl leading-none text-terracotta-deep transition-colors group-hover:border-terracotta/35 group-hover:bg-terracotta-soft"
                        >
                          {initial}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block break-words font-display text-[1.35rem] leading-snug tracking-[-0.02em] text-ink transition-colors group-hover:text-forest-deep">
                            {language.value}
                          </span>
                          <span className="mt-1 block text-xs text-earth-ink">
                            {typeof language.count === 'number'
                              ? `${language.count} ${language.count === 1 ? 'record' : 'records'}`
                              : 'Published records'}
                          </span>
                        </span>
                        <span
                          className="hidden font-display text-xs text-earth-ink sm:block"
                          aria-hidden="true"
                        >
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line/80 bg-cream/70 text-earth-ink transition-all duration-300 group-hover:border-forest/25 group-hover:bg-forest group-hover:text-ivory">
                          <ArrowRight
                            className="h-3.5 w-3.5 transition-transform motion-safe:group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Reveal>
          )}
        </div>

        <section className="mt-16 grid gap-5 border-t border-line/70 pt-10 lg:grid-cols-2 lg:gap-6">
          <div className="rounded-2xl border border-line/70 bg-cream/50 p-6 sm:p-8">
            <p className="eyebrow">Scripts are not decoration</p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-earth-ink">
              Names and record text stay in their original script wherever the archive displays
              them. Transliteration is offered only as a convenience, never as a replacement.
            </p>
          </div>
          <div className="rounded-2xl border border-forest/15 bg-forest-soft/60 p-6 sm:p-8">
            <LanguagesIcon className="h-5 w-5 text-forest" aria-hidden="true" />
            <p
              className="mt-4 font-display text-[clamp(2rem,3.2vw,2.8rem)] leading-none text-forest"
              lang="ml"
            >
              മലയാളം
            </p>
            <p className="mt-3 text-sm leading-7 text-earth-ink">
              The archive is being built with Malayalam and other Indian scripts in mind from the
              start — fonts, layout, and search all need to hold them without breaking.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
