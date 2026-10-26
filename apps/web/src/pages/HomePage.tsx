import type { HeritageRecordSummary } from '@entebharatham/shared';
import { HERITAGE_TYPE_OPTIONS } from '@entebharatham/shared';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  MessagesSquare,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandMark } from '../components/Brand';
import { HeritageArtwork } from '../components/HeritageArtwork';
import { StoryCard } from '../components/StoryCard';
import { EmptyState, InlineNotice, SkeletonCard } from '../components/ui/States';
import { fetchDiscoveryFacets, fetchHeritageList, type DiscoveryFacets } from '../lib/heritage';

const CARE = [
  {
    title: 'Consent before publication',
    description:
      'Nothing becomes public without the contributor’s permission and a moderator’s check.',
    icon: ShieldCheck,
  },
  {
    title: 'Attribution stays visible',
    description:
      'Storytellers, translators, and communities are credited by the names they choose.',
    icon: BookOpenCheck,
  },
  {
    title: 'Corrections stay open',
    description:
      'Communities can report concerns, propose corrections, or ask for material to be withdrawn.',
    icon: MessagesSquare,
  },
];

const POPULAR_SEARCHES = [
  { to: '/explore?heritageType=folk_story', label: 'Folk stories' },
  { to: '/explore?heritageType=song', label: 'Songs' },
  { to: '/explore?heritageType=recipe', label: 'Recipes' },
];

type RecentStatus = 'loading' | 'ready' | 'error';

export function HomePage() {
  const navigate = useNavigate();
  const [recent, setRecent] = useState<HeritageRecordSummary[]>([]);
  const [recentStatus, setRecentStatus] = useState<RecentStatus>('loading');
  const [totalRecords, setTotalRecords] = useState<number | null>(null);
  const [facets, setFacets] = useState<DiscoveryFacets | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.title = "EnteBharatham — India's Living Heritage Archive";
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchHeritageList({ page: 1, limit: 3, sort: 'newest' }, controller.signal)
      .then((result) => {
        setRecent(result.items ?? []);
        if (typeof result.total === 'number') setTotalRecords(result.total);
        setRecentStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setRecentStatus('error');
      });

    fetchDiscoveryFacets(controller.signal)
      .then((result) => setFacets(result))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFacets(null);
      });

    return () => controller.abort();
  }, []);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed.length >= 2 ? `/explore?q=${encodeURIComponent(trimmed)}` : '/explore');
  };

  const counts = [
    { label: 'forms', value: '9' },
    {
      label: 'records',
      value: totalRecords === null ? '—' : String(totalRecords),
    },
    {
      label: 'languages',
      value: facets === null ? '—' : String(facets.languages?.length ?? 0),
    },
    {
      label: 'regions',
      value: facets === null ? '—' : String(facets.regions?.length ?? 0),
    },
  ];

  return (
    <div>
      {/* ---------------------------------------------------------------- Hero */}
      <section aria-labelledby="hero-heading" className="relative overflow-hidden bg-ivory">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(52rem_38rem_at_86%_-14%,rgb(79_70_229_/_0.12),transparent_62%),radial-gradient(38rem_30rem_at_-6%_106%,rgb(251_115_88_/_0.09),transparent_66%)]"
          aria-hidden="true"
        />
        <div className="container-page relative grid gap-10 pb-12 pt-8 sm:pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pb-16 lg:pt-14">
          <div className="min-w-0 max-w-[40rem]">
            <p className="inline-flex items-center gap-2 rounded-full border border-forest/15 bg-paper/85 px-3 py-1.5 text-[0.625rem] font-bold uppercase tracking-[0.18em] text-forest-deep shadow-xs backdrop-blur">
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-terracotta motion-reduce:animate-none" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-terracotta" />
              </span>
              India&apos;s Living Heritage Archive
            </p>

            <h1
              id="hero-heading"
              className="mt-5 font-display text-[clamp(2.55rem,5.2vw,3.9rem)] font-normal leading-[0.98] tracking-[-0.04em] text-ink"
            >
              <span className="sr-only">India&apos;s Living Heritage Archive — </span>
              <span className="block">Every story</span>
              <span className="block">matters.</span>
              <span className="mt-1 block italic text-forest">Every tradition lives on.</span>
            </h1>

            <p className="mt-5 max-w-xl text-[1rem] leading-7 text-earth-ink sm:text-[1.0625rem] sm:leading-8">
              A living archive of stories, songs, recipes, and crafts — recorded with consent and
              credited to the people who keep them alive.
            </p>

            <form
              onSubmit={handleSearch}
              role="search"
              aria-label="Search the archive"
              className="mt-7 max-w-xl"
            >
              <div className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-2 shadow-card transition-all focus-within:border-forest/40 focus-within:shadow-lift sm:flex-row sm:items-center sm:rounded-full">
                <div className="relative min-w-0 flex-1">
                  <label htmlFor="hero-search" className="sr-only">
                    Search stories, songs, languages, or places
                  </label>
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-earth"
                    aria-hidden="true"
                  />
                  <input
                    id="hero-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search stories, songs, languages…"
                    className="h-12 w-full rounded-full border border-transparent bg-cream/60 px-11 pr-4 text-[0.9375rem] text-ink shadow-none placeholder:text-earth-ink/80 focus:border-forest/30 focus:bg-paper focus:outline-none focus:ring-4 focus:ring-forest/10"
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-arrow min-h-12 shrink-0 bg-forest px-6 text-ivory hover:bg-forest-deep"
                >
                  Search
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="mr-1 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-earth-ink">
                Popular
              </span>
              {POPULAR_SEARCHES.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-full px-2 py-1 text-xs font-semibold text-forest transition-colors hover:bg-forest-soft hover:text-forest-deep"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <dl className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line/70 pt-5">
              {counts.map((count) => (
                <div key={count.label} className="flex items-baseline gap-1.5">
                  <dt className="order-2 text-xs text-earth-ink">{count.label}</dt>
                  <dd className="order-1 font-display text-lg leading-none text-ink">
                    {count.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <figure className="relative mx-auto hidden w-full max-w-[27rem] lg:ml-auto lg:block">
            <div
              className="pointer-events-none absolute -inset-5 rounded-[2.25rem] bg-[radial-gradient(circle_at_30%_20%,rgb(79_70_229_/_0.17),transparent_58%),radial-gradient(circle_at_78%_82%,rgb(251_115_88_/_0.18),transparent_60%)] blur-2xl"
              aria-hidden="true"
            />
            <div className="relative rounded-[1.75rem] border border-line bg-paper/90 p-2.5 shadow-panel backdrop-blur">
              <div className="relative overflow-hidden rounded-[1.35rem]">
                <HeritageArtwork
                  seed="entebharatham-archive-doorway"
                  heritageType="folk_story"
                  aspect="portrait"
                  label="Original archival illustration: a lit lamp framed by a gateway arch"
                  decorative={false}
                />
                <span className="absolute left-3 top-3 rounded-full bg-midnight/85 px-3 py-1.5 text-[0.5625rem] font-bold uppercase tracking-[0.18em] text-ivory/85 shadow-sm backdrop-blur">
                  Original artwork
                </span>
              </div>
              <figcaption className="flex items-center justify-between gap-5 px-2 pb-1 pt-4">
                <div className="min-w-0">
                  <p className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-earth-ink">
                    The archive door
                  </p>
                  <p className="mt-1 font-display text-[1.05rem] italic leading-snug text-ink">
                    An original illustration, held open.
                  </p>
                </div>
                <BrandMark className="h-6 w-6 shrink-0" />
              </figcaption>
            </div>
          </figure>
        </div>
      </section>

      {/* --------------------------------------------------------- Categories */}
      <section
        aria-labelledby="categories-heading"
        className="relative overflow-hidden border-t border-line/80 bg-cream py-16 sm:py-20 lg:py-24"
      >
        <div
          className="pointer-events-none absolute -right-32 top-10 h-[26rem] w-[26rem] rounded-full border border-terracotta/10"
          aria-hidden="true"
        />
        <div className="container-page relative">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">What the archive holds</p>
              <h2 id="categories-heading" className="display-section mt-3">
                Nine ways of remembering
              </h2>
              <p className="body-copy mt-3">
                Stories, songs, recipes, rituals, and crafts — each with its own rhythm and way of
                being shared.
              </p>
            </div>
            <Link to="/explore" className="btn-secondary btn-sm shrink-0">
              Browse every record
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <ul className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {HERITAGE_TYPE_OPTIONS.map((option, index) => (
              <li key={option.value} className="min-w-0">
                <Link
                  to={`/explore?heritageType=${option.value}`}
                  className="group flex h-full min-h-[8.5rem] flex-col rounded-xl border border-line/80 bg-paper/80 p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-forest/25 hover:bg-paper hover:shadow-lift"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span
                      className="font-display text-[0.6875rem] leading-none tracking-[0.16em] text-terracotta-deep"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <ArrowUpRight
                      className="h-3.5 w-3.5 text-line-strong transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-forest"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="mt-5 block font-display text-[1.0625rem] leading-tight tracking-[-0.015em] text-ink transition-colors group-hover:text-forest-deep sm:text-[1.15rem]">
                    {option.label}
                  </span>
                  <span
                    className="mt-1.5 block text-xs leading-snug text-terracotta-deep"
                    lang="ml"
                  >
                    {option.labelMalayalam}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------- Care strip */}
      <section aria-labelledby="care-heading" className="border-t border-line/80 bg-ivory">
        <div className="container-page py-12 sm:py-14">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Care, by design</p>
              <h2
                id="care-heading"
                className="mt-3 font-display text-[clamp(1.6rem,2.4vw,2rem)] leading-tight tracking-[-0.025em] text-ink"
              >
                A living archive, kept carefully
              </h2>
            </div>
            <Link to="/about#principles" className="link-underline shrink-0 text-sm">
              Read the principles
            </Link>
          </div>

          <ul className="mt-8 grid gap-6 sm:grid-cols-3">
            {CARE.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="border-t border-line/80 pt-5">
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-terracotta-deep" aria-hidden="true" />
                    <h3 className="font-sans text-sm font-bold text-ink">{item.title}</h3>
                  </div>
                  <p className="mt-2.5 text-sm leading-6 text-earth-ink">{item.description}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ Recent */}
      <section
        aria-labelledby="recent-heading"
        className="border-t border-line/80 bg-ivory py-16 sm:py-20 lg:py-24"
      >
        <div className="container-page">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">From the public shelves</p>
              <h2 id="recent-heading" className="display-section mt-3">
                Recently entered
              </h2>
              <p className="body-copy mt-3">
                Published records, newest first. Every card opens the record with its sources,
                attribution, and rights status.
              </p>
            </div>
            <Link to="/explore" className="btn-secondary btn-sm shrink-0">
              Explore all records
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-9">
            {recentStatus === 'loading' && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <SkeletonCard key={index} />
                ))}
              </div>
            )}

            {recentStatus === 'error' && (
              <InlineNotice tone="info">
                The archive index could not be reached just now.{' '}
                <Link to="/explore" className="link-underline">
                  Try the Explore page
                </Link>{' '}
                — the rest of the site is still available.
              </InlineNotice>
            )}

            {recentStatus === 'ready' && recent.length === 0 && (
              <EmptyState
                title="Published records will appear here"
                description="The public shelves are still being prepared. As records are approved, they will be collected here with their sources and attribution."
                action={
                  <Link to="/contribute" className="btn-secondary">
                    Learn how to contribute
                  </Link>
                }
              />
            )}

            {recentStatus === 'ready' && recent.length > 0 && (
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {recent.map((record, index) => (
                  <li key={record.id} className="min-w-0">
                    <StoryCard record={record} index={index} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="meta mt-8 max-w-3xl border-t border-line pt-5">
            Records marked{' '}
            <span className="font-semibold text-warning">“Fictional demo record”</span> are
            development fixtures used to test the archive. They are not real traditions, and they
            are never presented as community testimony.
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------------- Close */}
      <section
        aria-labelledby="close-heading"
        className="relative overflow-hidden bg-midnight text-ivory"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(44rem_32rem_at_92%_0%,rgb(79_70_229_/_0.35),transparent_64%),radial-gradient(32rem_26rem_at_4%_100%,rgb(251_115_88_/_0.16),transparent_66%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-24 top-0 h-[24rem] w-[24rem] rounded-full border border-ivory/10"
          aria-hidden="true"
        />
        <div className="container-page relative flex flex-col gap-8 py-14 sm:py-16 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
          <div className="max-w-2xl">
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.22em] text-gold-light">
              Share what you know
            </p>
            <h2
              id="close-heading"
              className="mt-4 font-display text-[clamp(1.9rem,3.4vw,3rem)] leading-[1.04] tracking-[-0.03em]"
            >
              If a story lives in your family or community, it belongs here too.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-ivory/75">
              Begin with what you know, credit the people who told you, and leave the rest open to
              correction. That is how a living archive stays alive.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
            <Link
              to="/contribute"
              className="btn min-h-13 justify-center border-ivory bg-ivory px-6 text-midnight hover:bg-paper"
            >
              Share your story
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/about"
              className="btn min-h-13 justify-center border-ivory/40 bg-transparent px-6 text-ivory hover:border-ivory hover:bg-ivory/10"
            >
              About the archive
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
