import type {
  HeritageRecordPublic,
  HeritageRecordSummary,
  ProvenanceClaimState,
} from '@entebharatham/shared';
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin, ScrollText } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HeritageArtwork } from '../components/HeritageArtwork';
import { ReadingProgress } from '../components/ReadingProgress';
import { Reveal } from '../components/Reveal';
import { ReportButton } from '../components/ReportButton';
import { ShareActions } from '../components/ShareActions';
import { StoryCard } from '../components/StoryCard';
import { ErrorState } from '../components/ui/States';
import { ApiError } from '../lib/api';
import {
  fetchHeritageRecord,
  fetchRelatedHeritage,
  formatRegion,
  heritageTypeLabel,
} from '../lib/heritage';

type Status = 'loading' | 'ready' | 'notFound' | 'error';

const CLAIM_STATE_LABELS: Record<ProvenanceClaimState, string> = {
  contributor_provided: 'Contributed account',
  review_observed: 'Observed in review',
  community_confirmed: 'Community confirmed',
};

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

export function HeritageRecordPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [record, setRecord] = useState<HeritageRecordPublic | null>(null);
  const [related, setRelated] = useState<HeritageRecordSummary[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    document.title =
      status === 'ready' && record
        ? `${record.title} | EnteBharatham`
        : 'Heritage Record | EnteBharatham';
  }, [status, record]);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');

    fetchHeritageRecord(slug, controller.signal)
      .then((result) => {
        setRecord(result);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof ApiError && error.status === 404) {
          setStatus('notFound');
          return;
        }
        setStatus('error');
      });

    return () => controller.abort();
  }, [slug, retryToken]);

  useEffect(() => {
    if (!slug || status !== 'ready') return;
    const controller = new AbortController();
    fetchRelatedHeritage(slug, controller.signal, 3)
      .then((res) => setRelated(res.items || []))
      .catch(() => setRelated([]));
    return () => controller.abort();
  }, [slug, status]);

  if (status === 'loading') {
    return (
      <div>
        <div className="relative overflow-hidden bg-midnight py-14 text-ivory sm:py-20">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(44rem_32rem_at_88%_-10%,rgb(79_70_229_/_0.32),transparent_62%),radial-gradient(32rem_24rem_at_0%_110%,rgb(251_115_88_/_0.16),transparent_66%)]"
            aria-hidden="true"
          />
          <div className="container-page relative">
            <p role="status" className="sr-only">
              Loading heritage record…
            </p>
            <div
              aria-hidden="true"
              className="grid gap-12 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-16"
            >
              <div>
                <div className="h-3 w-28 animate-pulse rounded-full bg-ivory/20 motion-reduce:animate-none" />
                <div className="mt-7 h-12 w-4/5 animate-pulse rounded-lg bg-ivory/15 motion-reduce:animate-none" />
                <div className="mt-3 h-12 w-3/5 animate-pulse rounded-lg bg-ivory/10 motion-reduce:animate-none" />
                <div className="mt-7 h-3.5 w-full max-w-lg animate-pulse rounded-full bg-ivory/10 motion-reduce:animate-none" />
                <div className="mt-3 h-3.5 w-3/4 max-w-md animate-pulse rounded-full bg-ivory/10 motion-reduce:animate-none" />
                <div className="mt-9 flex flex-wrap gap-8 border-t border-ivory/15 pt-6">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="space-y-3">
                      <div className="h-2.5 w-16 animate-pulse rounded-full bg-ivory/15 motion-reduce:animate-none" />
                      <div className="h-3.5 w-24 animate-pulse rounded-full bg-ivory/20 motion-reduce:animate-none" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mx-auto aspect-[4/5] w-full max-w-[26rem] animate-pulse rounded-2xl border border-ivory/15 bg-ivory/10 motion-reduce:animate-none" />
            </div>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="container-page grid gap-14 py-14 lg:grid-cols-[minmax(0,42rem)_18rem] lg:justify-between lg:gap-20 lg:py-20"
        >
          <div className="space-y-10">
            <div className="h-8 w-52 animate-pulse rounded-full bg-line motion-reduce:animate-none" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-4 animate-pulse rounded-full bg-line/75 motion-reduce:animate-none"
                />
              ))}
            </div>
          </div>
          <div className="hidden h-64 animate-pulse rounded-xl border border-line bg-paper/60 lg:block" />
        </div>
      </div>
    );
  }

  if (status === 'notFound') {
    return (
      <div className="container-reading py-16 sm:py-24">
        <div className="relative overflow-hidden rounded-2xl border border-line/80 bg-paper px-6 py-10 shadow-panel sm:px-10">
          <div
            className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full border border-terracotta/15"
            aria-hidden="true"
          />
          <p className="eyebrow">The archive</p>
          <h1 className="display-title mt-4">Record not found</h1>
          <p className="body-copy mt-4">
            This heritage record is not available. It may not exist, or it may not be publicly
            available.
          </p>
          <Link to="/explore" className="btn-primary mt-8">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Explore
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'error' || record === null) {
    return (
      <div className="container-reading py-16">
        <ErrorState
          title="We could not load this heritage record."
          description="We could not load this record just now. Please try again."
          onRetry={() => setRetryToken((token) => token + 1)}
        />
      </div>
    );
  }

  const region = formatRegion(record.region);

  const contents = [
    ...(record.content !== undefined ? [{ href: '#the-record', label: 'The record' }] : []),
    ...(record.contributors.length > 0 ? [{ href: '#attribution', label: 'Attribution' }] : []),
    ...(record.sources.length > 0 ? [{ href: '#sources', label: 'Sources & provenance' }] : []),
    { href: '#rights', label: 'Consent & rights' },
  ];

  return (
    <article>
      <ReadingProgress />

      {/* ------------------------------------------------------------- Opening */}
      <header className="relative overflow-hidden bg-midnight text-ivory">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(48rem_36rem_at_88%_-8%,rgb(79_70_229_/_0.35),transparent_62%),radial-gradient(34rem_26rem_at_0%_100%,rgb(251_115_88_/_0.16),transparent_66%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-32 -top-32 h-[34rem] w-[34rem] rounded-full border border-ivory/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-48 left-1/4 h-[26rem] w-[26rem] rounded-full border border-ivory/[0.06]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-24 top-1/3 h-64 w-64 rounded-full bg-terracotta/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="container-page relative py-10 sm:py-14 lg:py-16">
          <nav aria-label="Breadcrumb" className="mb-9">
            <ol className="flex flex-wrap items-center gap-2 rounded-full border border-ivory/10 bg-ivory/[0.045] px-3.5 py-2 text-xs text-ivory/60 backdrop-blur-sm w-fit">
              <li>
                <Link to="/explore" className="font-medium transition-colors hover:text-ivory">
                  Explore
                </Link>
              </li>
              <li aria-hidden="true" className="text-ivory/20">
                /
              </li>
              <li>
                <Link
                  to={`/explore?heritageType=${record.heritageType}`}
                  className="font-medium transition-colors hover:text-ivory"
                >
                  {heritageTypeLabel(record.heritageType)}
                </Link>
              </li>
              <li aria-hidden="true" className="text-ivory/20">
                /
              </li>
              <li
                aria-current="page"
                className="max-w-[16rem] truncate text-ivory/60"
                title={record.title}
              >
                {record.title}
              </li>
            </ol>
          </nav>

          <div className="grid gap-12 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-16">
            <div className="min-w-0">
              <p className="flex items-center gap-3 text-[0.6875rem] font-bold uppercase tracking-[0.22em] text-gold">
                <span className="h-px w-7 bg-gold" aria-hidden="true" />
                {heritageTypeLabel(record.heritageType)}
              </p>

              <h1 className="mt-6 break-words font-display text-[clamp(2.6rem,5vw,4.6rem)] font-normal leading-[0.98] tracking-[-0.04em] text-ivory [overflow-wrap:anywhere]">
                {record.title}
              </h1>

              {record.isFictionalSample && (
                <p className="mt-6 inline-flex items-start gap-2 rounded-lg border border-gold/35 bg-gold/10 px-3 py-2 text-xs font-semibold leading-5 text-gold">
                  <ScrollText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Fictional demo record — not a real tradition
                </p>
              )}

              {record.summary !== undefined && (
                <p className="mt-6 max-w-2xl break-words text-[clamp(1.0625rem,1.25vw,1.2rem)] leading-[1.75] text-ivory/70 [overflow-wrap:anywhere]">
                  {record.summary}
                </p>
              )}

              <dl className="mt-9 flex flex-wrap gap-x-10 gap-y-5 border-t border-ivory/15 pt-6">
                <div>
                  <dt className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-ivory/60">
                    Languages
                  </dt>
                  <dd className="mt-1.5 text-sm font-semibold text-ivory">
                    {record.languages.join(', ')}
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-ivory/60">
                    Region
                  </dt>
                  <dd className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-ivory">
                    <MapPin className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                    {region}
                  </dd>
                </div>
                {record.communityName !== undefined && (
                  <div>
                    <dt className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-ivory/60">
                      Community
                    </dt>
                    <dd className="mt-1.5 text-sm font-semibold text-ivory">
                      {record.communityName}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-ivory/60">
                    Provenance
                  </dt>
                  <dd className="mt-1.5 text-sm font-semibold text-ivory">
                    {CLAIM_STATE_LABELS[record.provenance.claimState]}
                  </dd>
                </div>
              </dl>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <ShareActions title={record.title} tone="dark" compact />
                <span className="text-[0.625rem] uppercase tracking-[0.16em] text-ivory/60">
                  Public archive record
                </span>
              </div>
            </div>

            <figure className="relative mx-auto w-full max-w-[26rem] lg:ml-auto">
              <div
                className="absolute -inset-3 hidden rounded-[1.6rem] border border-ivory/10 sm:block"
                aria-hidden="true"
              />
              <div className="relative rounded-2xl border border-ivory/20 bg-paper p-2.5 shadow-panel">
                <div className="overflow-hidden rounded-xl">
                  <HeritageArtwork
                    seed={`${record.slug}-${record.heritageType}`}
                    heritageType={record.heritageType}
                    aspect="portrait"
                    label={`Original archive illustration for ${record.title}`}
                    decorative={false}
                  />
                </div>
                <figcaption className="flex items-start justify-between gap-4 px-2 pb-1 pt-3">
                  <p className="text-[0.625rem] font-bold uppercase leading-4 tracking-[0.16em] text-earth-ink">
                    Original archive artwork
                    <span className="block font-medium normal-case tracking-normal text-earth-ink">
                      Not a photograph of the tradition
                    </span>
                  </p>
                  <span className="mt-0.5 shrink-0 font-display text-xs italic text-forest">
                    {record.isFictionalSample ? 'Demo' : 'Illustrated'}
                  </span>
                </figcaption>
              </div>
            </figure>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------- Body */}
      <div className="container-page grid gap-14 py-14 lg:grid-cols-[minmax(0,42rem)_18rem] lg:justify-between lg:gap-20 lg:py-20">
        <div className="min-w-0 space-y-16">
          {record.content !== undefined && (
            <section id="the-record" aria-labelledby="content-heading" className="scroll-mt-28">
              <SectionHeading id="content-heading" number="01" title="The record" />
              <div className="prose-heritage mt-7 max-w-[42rem] whitespace-pre-line">
                {record.content}
              </div>
            </section>
          )}

          {record.contributors.length > 0 && (
            <section
              id="attribution"
              aria-labelledby="contributors-heading"
              className="scroll-mt-28"
            >
              <SectionHeading id="contributors-heading" number="02" title="Attribution" />
              <p className="body-copy mt-5 max-w-2xl">
                The people credited for this record, in the roles they chose to be named.
              </p>
              <ul className="mt-7 divide-y divide-line/80 overflow-hidden rounded-xl border border-line/80 bg-paper/55 shadow-card">
                {record.contributors.map((contributor) => (
                  <li
                    key={`${contributor.name}-${contributor.role}`}
                    className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta-soft font-display text-sm text-terracotta-deep"
                        aria-hidden="true"
                      >
                        {contributor.name.trim().charAt(0).toUpperCase()}
                      </span>
                      <p className="font-medium text-ink">{`${contributor.name} — ${contributor.role}`}</p>
                    </div>
                    <span className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-earth-ink">
                      Credited role
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {record.sources.length > 0 && (
            <section id="sources" aria-labelledby="sources-heading" className="scroll-mt-28">
              <SectionHeading
                id="sources-heading"
                number="03"
                title={<span>Sources &amp; provenance</span>}
              />
              <p className="body-copy mt-5 max-w-2xl">
                Where this telling came from. A source is a record of the account given to the
                contributor; it is not a claim that the tradition has been proven.
              </p>
              <ol className="mt-7 space-y-3">
                {record.sources.map((source, index) => (
                  <li
                    key={`${source.sourceType}-${index}`}
                    className="rounded-xl border border-line/80 bg-paper/55 p-5 shadow-card transition-colors hover:border-forest/20 hover:bg-paper"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-3">
                        <span
                          className="font-display text-xs leading-none text-terracotta"
                          aria-hidden="true"
                        >
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <h3 className="font-sans text-sm font-bold capitalize text-ink">
                          {source.sourceType.replace(/_/g, ' ')}
                        </h3>
                      </div>
                      {source.collectedOn !== undefined && (
                        <p className="meta">Collected {source.collectedOn}</p>
                      )}
                    </div>
                    <p className="mt-2.5 text-sm leading-6 text-earth-ink">{source.description}</p>
                    {source.context !== undefined && (
                      <p className="mt-2 text-xs leading-5 text-earth-ink">
                        Context: {source.context}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* -------------------------------------------------- Consent/rights */}
          <section id="rights" aria-labelledby="rights-heading" className="scroll-mt-28">
            <SectionHeading id="rights-heading" number="04" title="Consent and rights" />
            <p className="body-copy mt-5 max-w-2xl">
              What the contributor and community agreed to, and what the record&apos;s current
              rights status allows. A record is shared on its own terms — never as free raw
              material.
            </p>

            <dl className="mt-7 grid gap-px overflow-hidden rounded-xl border border-line/80 bg-line/80 sm:grid-cols-2">
              <RightRow
                label="Attribution permitted"
                value={yesNo(record.consent.allowAttribution)}
              />
              <RightRow
                label="Redistribution permitted"
                value={yesNo(record.consent.allowRedistribution)}
              />
              <RightRow label="Consent verification" value={record.consent.verification} />
              <RightRow label="Content rights status" value={record.license.rightsStatus} />
              {record.license.licenseName !== undefined && (
                <RightRow label="Content license" value={record.license.licenseName} />
              )}
              {record.license.holder !== undefined && (
                <RightRow label="Rights holder" value={record.license.holder} />
              )}
              {record.consent.restrictions !== undefined && (
                <RightRow
                  label="Restrictions"
                  value={record.consent.restrictions}
                  className="sm:col-span-2"
                />
              )}
            </dl>

            <div className="mt-7 rounded-r-xl border border-line/70 border-l-2 border-l-terracotta bg-cream/55 px-5 py-4">
              <p className="max-w-2xl break-words text-xs leading-5 text-earth-ink [overflow-wrap:anywhere]">
                Absence of a stated content licence is not permission to reuse. If something here is
                wrong or should not be public, tell the archive.
              </p>
              <div className="mt-4">
                <ReportButton recordId={record.id} />
              </div>
            </div>
          </section>
        </div>

        {/* --------------------------------------------------------- Sidebar */}
        <aside aria-label="Record details" className="min-w-0">
          <div className="space-y-5 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7.5rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
            <section className="rounded-xl border border-line/80 bg-paper/70 p-5 shadow-card backdrop-blur-[2px]">
              <h2 className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-earth-ink">
                On this page
              </h2>
              <nav aria-label="Record contents" className="mt-3">
                <ul className="space-y-0.5">
                  {contents.map((item) => (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        className="group flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm text-earth-ink transition-colors hover:bg-forest-soft/60 hover:text-forest"
                      >
                        {item.label}
                        <ArrowUpRight
                          className="h-3 w-3 shrink-0 opacity-0 transition-all group-hover:-translate-y-px group-hover:translate-x-px group-hover:opacity-100"
                          aria-hidden="true"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </section>

            <section className="rounded-xl border border-line/80 bg-paper/70 p-5 shadow-card backdrop-blur-[2px]">
              <h2 className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-earth-ink">
                At a glance
              </h2>
              <dl className="mt-4 divide-y divide-line/80 border-b border-line/80 text-sm">
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="shrink-0 text-xs text-earth-ink">Category</dt>
                  <dd className="min-w-0 break-words text-right font-semibold text-ink [overflow-wrap:anywhere]">
                    {heritageTypeLabel(record.heritageType)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="shrink-0 text-xs text-earth-ink">Languages</dt>
                  <dd className="min-w-0 break-words text-right font-semibold text-ink [overflow-wrap:anywhere]">
                    {record.languages.join(', ')}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="shrink-0 text-xs text-earth-ink">Region</dt>
                  <dd className="min-w-0 break-words text-right font-semibold text-ink [overflow-wrap:anywhere]">
                    {region}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="shrink-0 text-xs text-earth-ink">Provenance</dt>
                  <dd className="min-w-0 break-words text-right font-semibold text-ink [overflow-wrap:anywhere]">
                    {CLAIM_STATE_LABELS[record.provenance.claimState]}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-5 text-earth-ink">
                Provenance describes who supplied this account. It is not a claim that the tradition
                is historically verified.
              </p>
            </section>

            {record.tags.length > 0 && (
              <section
                aria-labelledby="tags-heading"
                className="rounded-xl border border-line/80 bg-paper/70 p-5 shadow-card backdrop-blur-[2px]"
              >
                <h2
                  id="tags-heading"
                  className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-earth-ink"
                >
                  Tags
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {record.tags.map((tag) => (
                    <li key={tag}>
                      <Link to={`/explore?tags=${encodeURIComponent(tag)}`} className="chip">
                        {tag}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rounded-xl border border-line/80 bg-paper/70 p-5 shadow-card backdrop-blur-[2px]">
              <h2 className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-earth-ink">
                Keep exploring
              </h2>
              <ul className="mt-3 space-y-2.5 text-sm">
                <li>
                  <Link
                    to={`/explore?heritageType=${record.heritageType}`}
                    className="group inline-flex items-center gap-1.5 font-medium text-forest transition-colors hover:text-terracotta-deep"
                  >
                    More {heritageTypeLabel(record.heritageType).toLowerCase()}
                    <ArrowUpRight
                      className="h-3.5 w-3.5 transition-transform motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
                <li>
                  <Link
                    to={`/explore?region=${encodeURIComponent(record.region.state ?? region)}`}
                    className="group inline-flex items-center gap-1.5 font-medium text-forest transition-colors hover:text-terracotta-deep"
                  >
                    Records from this region
                    <ArrowUpRight
                      className="h-3.5 w-3.5 transition-transform motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              </ul>
            </section>

            <Link to="/explore" className="btn-secondary w-full justify-start">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Explore
            </Link>
          </div>
        </aside>
      </div>

      {/* ------------------------------------------------------------ Related */}
      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="border-t border-line bg-cream">
          <div className="container-page py-16 sm:py-20">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Continue listening</p>
                  <h2 id="related-heading" className="display-section mt-4">
                    Related heritage
                  </h2>
                </div>
                <Link
                  to={`/explore?heritageType=${record.heritageType}`}
                  className="link-underline inline-flex items-center gap-1.5 text-sm"
                >
                  More in this category
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
              <ul className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item, index) => (
                  <li key={item.id} className="min-w-0">
                    <StoryCard record={item} index={index} variant="compact" />
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>
      )}

      <div className="container-page py-12">
        <div className="flex flex-col gap-5 rounded-2xl border border-line/80 bg-paper/60 p-6 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <p className="eyebrow">Keep wandering</p>
            <p className="mt-2 font-display text-[1.4rem] leading-snug tracking-[-0.02em] text-forest">
              Every record is one door into the archive.
            </p>
          </div>
          <Link to="/explore" className="btn-primary btn-arrow shrink-0">
            Explore more records
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function SectionHeading({ id, number, title }: { id: string; number: string; title: ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 border-b border-line/80 pb-4">
      <span className="font-display text-sm leading-none text-terracotta" aria-hidden="true">
        {number}
      </span>
      <h2
        id={id}
        className="font-display text-[clamp(1.6rem,2.4vw,2rem)] leading-none tracking-[-0.03em] text-ink"
      >
        {title}
      </h2>
    </div>
  );
}

function RightRow({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`bg-paper px-5 py-4 ${className}`}>
      <dt className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-earth-ink">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-ink [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}
