import type { HeritageRecordSummary } from '@entebharatham/shared';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatRegion, heritageTypeLabel } from '../lib/heritage';
import { HeritageArtwork } from './HeritageArtwork';

type StoryCardVariant = 'default' | 'compact' | 'feature' | 'row';

/**
 * The archive's primary record card. The whole card is not a link: the title
 * is the single focusable target, which keeps keyboard navigation predictable
 * and lets people select the summary text.
 *
 * Artwork, a hairline rule, and the type hierarchy do the framing, so a grid
 * of records reads like an editorial index rather than a wall of interface
 * cards.
 */
export function StoryCard({
  record,
  index = 0,
  variant = 'default',
  tone = 'light',
}: {
  record: HeritageRecordSummary;
  index?: number;
  variant?: StoryCardVariant;
  tone?: 'light' | 'dark';
}) {
  if (variant === 'row') {
    return <StoryRow record={record} index={index} tone={tone} />;
  }

  const region = formatRegion(record.region);
  const isFeature = variant === 'feature';
  const isCompact = variant === 'compact';
  const artworkAspect = isFeature ? 'wide' : isCompact ? 'wide' : 'card';
  const dark = tone === 'dark';

  return (
    <article className="group relative flex h-full min-w-0 flex-col">
      <Link
        to={`/heritage/${record.slug}`}
        tabIndex={-1}
        aria-hidden="true"
        className={`group/art relative block overflow-hidden rounded-lg border shadow-card transition-all duration-500 ${
          dark
            ? 'border-ivory/15 bg-ivory/5 hover:border-ivory/30'
            : 'border-line bg-cream hover:border-forest/30 hover:shadow-lift'
        }`}
      >
        <HeritageArtwork
          seed={record.slug}
          heritageType={record.heritageType}
          aspect={artworkAspect}
          className="transition-transform duration-700 motion-safe:group-hover:scale-[1.035]"
        />
        <span
          className={`pointer-events-none absolute inset-0 bg-gradient-to-t to-transparent transition-opacity duration-500 ${
            dark
              ? 'from-forest-deep/45 via-transparent opacity-60 group-hover:opacity-90'
              : 'from-forest-deep/25 via-transparent opacity-0 group-hover:opacity-100'
          }`}
          aria-hidden="true"
        />
        <span
          className={`pointer-events-none absolute right-3 top-3 flex h-9 w-9 translate-y-1 items-center justify-center rounded-full opacity-0 shadow-sm backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 ${
            dark ? 'bg-ivory/95 text-forest-deep' : 'bg-paper/95 text-forest'
          }`}
          aria-hidden="true"
        >
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col pt-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className={dark ? 'eyebrow text-gold-light' : 'eyebrow-forest'}>
            {heritageTypeLabel(record.heritageType)}
          </p>
          {record.isFictionalSample && (
            <span
              className={`text-[0.625rem] font-bold uppercase tracking-[0.14em] ${
                dark ? 'text-gold-light' : 'text-warning'
              }`}
            >
              Fictional demo record
            </span>
          )}
        </div>

        <h3
          className={`mt-3 font-display leading-[1.08] tracking-[-0.025em] ${
            dark ? 'text-ivory' : 'text-ink'
          } ${
            isFeature
              ? 'text-[clamp(2rem,3.2vw,3.15rem)]'
              : isCompact
                ? 'text-[1.2rem]'
                : 'text-[1.5rem] sm:text-[1.65rem]'
          }`}
        >
          <Link
            to={`/heritage/${record.slug}`}
            className={`rounded-xs decoration-1 underline-offset-[0.16em] transition-colors ${
              dark
                ? 'decoration-gold/60 group-hover:text-gold-light hover:underline'
                : 'decoration-terracotta group-hover:text-forest-deep hover:underline'
            }`}
          >
            {record.title}
          </Link>
        </h3>

        {record.summary !== undefined && record.summary !== '' && (
          <p
            className={`mt-3 line-clamp-2 ${dark ? 'text-ivory/65' : 'text-earth-ink'} ${
              isFeature ? 'max-w-2xl text-[0.9875rem] leading-7' : 'text-sm leading-[1.7]'
            }`}
          >
            {record.summary}
          </p>
        )}

        <dl
          className={`mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t pt-4 text-xs transition-colors ${
            dark
              ? 'border-ivory/10 text-ivory/65'
              : 'border-line/70 text-earth-ink group-hover:border-forest/20'
          }`}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <dt className="sr-only">Languages</dt>
            <span
              className={`status-dot ${dark ? 'text-gold' : 'text-terracotta'}`}
              aria-hidden="true"
            />
            <dd className="truncate">{record.languages.join(', ')}</dd>
          </div>
          {region !== '' && (
            <div className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true" className={dark ? 'text-ivory/20' : 'text-line-strong'}>
                /
              </span>
              <dt className="sr-only">Region</dt>
              <dd className="truncate">{region}</dd>
            </div>
          )}
        </dl>
      </div>

      <span className="sr-only">{`Record ${index + 1}`}</span>
    </article>
  );
}

/** A quieter horizontal treatment for sidebars and secondary lists. */
function StoryRow({
  record,
  index,
  tone,
}: {
  record: HeritageRecordSummary;
  index: number;
  tone: 'light' | 'dark';
}) {
  const region = formatRegion(record.region);
  const dark = tone === 'dark';

  return (
    <article
      className={`group relative grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-4 border-t py-5 transition-colors first:border-t-0 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-5 ${
        dark ? 'border-ivory/10 hover:bg-ivory/[0.04]' : 'border-line hover:bg-paper/45'
      }`}
    >
      <Link
        to={`/heritage/${record.slug}`}
        tabIndex={-1}
        aria-hidden="true"
        className={`block self-start overflow-hidden rounded-md border shadow-card transition-all duration-500 ${
          dark ? 'border-ivory/15 bg-ivory/5' : 'border-line bg-cream group-hover:border-forest/25'
        }`}
      >
        <HeritageArtwork
          seed={record.slug}
          heritageType={record.heritageType}
          aspect="square"
          className="transition-transform duration-700 motion-safe:group-hover:scale-[1.035]"
        />
      </Link>

      <div className="flex min-w-0 flex-col">
        <p className={dark ? 'eyebrow text-gold-light' : 'eyebrow-forest'}>
          {heritageTypeLabel(record.heritageType)}
        </p>
        <h3
          className={`mt-2 font-display text-[1.15rem] leading-[1.12] tracking-[-0.02em] sm:text-[1.3rem] ${
            dark ? 'text-ivory' : 'text-ink'
          }`}
        >
          <Link
            to={`/heritage/${record.slug}`}
            className={`rounded-xs decoration-1 underline-offset-[0.16em] transition-colors ${
              dark
                ? 'decoration-gold/60 group-hover:text-gold-light hover:underline'
                : 'decoration-terracotta group-hover:text-forest-deep hover:underline'
            }`}
          >
            {record.title}
          </Link>
        </h3>
        <p
          className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${
            dark ? 'text-ivory/65' : 'text-earth-ink'
          }`}
        >
          <span className="truncate">{record.languages.join(', ')}</span>
          {region !== '' && (
            <>
              <span aria-hidden="true" className={dark ? 'text-ivory/20' : 'text-line-strong'}>
                /
              </span>
              <span className="truncate">{region}</span>
            </>
          )}
        </p>
        {record.isFictionalSample && (
          <p
            className={`mt-2 text-[0.625rem] font-bold uppercase tracking-[0.14em] ${
              dark ? 'text-gold-light' : 'text-warning'
            }`}
          >
            Fictional demo record
          </p>
        )}
      </div>
      <span className="sr-only">{`Record ${index + 1}`}</span>
    </article>
  );
}
