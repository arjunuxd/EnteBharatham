import type { HeritageType } from '@entebharatham/shared';
import { HERITAGE_TYPE_OPTIONS } from '@entebharatham/shared';
import { ArrowRight, Check, HeartHandshake, Users } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HeritageArtwork } from '../components/HeritageArtwork';
import { useReveal } from '../components/Reveal';
import { InlineNotice } from '../components/ui/States';

const PREPARE = [
  {
    title: 'The story itself',
    body: 'A title, a short summary, and the full account in the words you were given. Include variants or translations when you know them.',
  },
  {
    title: 'Language and place',
    body: 'The original language and script, the state or region, and the community the material belongs to — named as the community prefers.',
  },
  {
    title: 'Sources and people',
    body: 'Who told it, who recorded or translated it, and where the material comes from. Credit every person you can name, with their permission.',
  },
  {
    title: 'Consent and rights',
    body: 'What you were permitted to record, whether the record may be published, and any restrictions that must stay in place.',
  },
];

const STEPS = [
  {
    number: '01',
    title: 'Create a free account',
    body: 'Every contribution starts with a named contributor account so the archive knows who to ask about edits and corrections.',
  },
  {
    number: '02',
    title: 'Build the draft',
    body: 'Add the record, its language and place, provenance, sources, consent details, and optional media. Drafts stay private while you work.',
  },
  {
    number: '03',
    title: 'Submit for review',
    body: 'A moderator checks consent, attribution, provenance, and rights. You can reply to feedback and revise the draft before a decision.',
  },
  {
    number: '04',
    title: 'Stay reachable',
    body: 'After publication, reports and correction requests can still reach you. The record remains open to the people it came from.',
  },
];

const CARE = [
  'Ask before recording. Explain what the archive is, who will be able to see the record, and how it can be withdrawn.',
  'Do not publish sacred, restricted, or private knowledge. If you are unsure, leave it out and say so in the draft.',
  'Keep the original language and spelling. A translation is a separate rendering, not a replacement.',
  'Credit storytellers, singers, translators, recorders, and communities by the names and spellings they choose.',
  'Never invent a source, a permission, or an attribution. An incomplete record is better than a false one.',
];

const ACCEPTED_MEDIA = [
  'Images: JPEG, PNG, or WebP',
  'Audio: MP3, WAV, M4A, or AAC',
  'Documents: PDF',
];

const ARTWORK_TYPES = HERITAGE_TYPE_OPTIONS.slice(0, 5).map((option) => option.value);

export function ContributePage() {
  useEffect(() => {
    document.title = 'Contribute a story — EnteBharatham';
  }, []);

  const belongsReveal = useReveal<HTMLElement>();
  const prepareReveal = useReveal<HTMLElement>();
  const processReveal = useReveal<HTMLElement>();
  const careReveal = useReveal<HTMLElement>();
  const disclosureReveal = useReveal<HTMLElement>();

  return (
    <div>
      {/* ------------------------------------------------------------- Opening */}
      <section className="relative overflow-hidden bg-midnight text-ivory">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(46rem_34rem_at_88%_-6%,rgb(79_70_229_/_0.32),transparent_62%),radial-gradient(34rem_26rem_at_0%_104%,rgb(251_115_88_/_0.18),transparent_66%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-28 -top-32 h-[30rem] w-[30rem] rounded-full border border-ivory/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-40 left-1/4 h-[24rem] w-[24rem] rounded-full border border-ivory/[0.06]"
          aria-hidden="true"
        />

        <div className="container-page relative grid gap-12 py-12 sm:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-16 lg:py-20">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="mb-8">
              <ol className="flex flex-wrap items-center gap-2 text-xs text-ivory/60">
                <li>
                  <Link to="/" className="font-medium transition-colors hover:text-ivory">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true" className="text-ivory/20">
                  /
                </li>
                <li aria-current="page" className="text-ivory/60">
                  Contribute
                </li>
              </ol>
            </nav>

            <p className="flex items-center gap-3 text-[0.6875rem] font-bold uppercase tracking-[0.22em] text-gold">
              <span className="h-px w-8 bg-gold" aria-hidden="true" />
              Add to the archive
            </p>
            <h1 className="mt-6 font-display text-[clamp(2.7rem,5.4vw,4.9rem)] font-medium leading-[0.95] tracking-[-0.045em] text-ivory">
              Share a story
              <span className="block italic text-gold/90">with care.</span>
            </h1>
            <p className="mt-7 max-w-xl text-[1.0625rem] leading-8 text-ivory/70">
              The archive grows through people who are willing to record, translate, and credit the
              traditions they know. You do not need to be a writer or a historian — you need the
              permission of the people whose story it is.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/dashboard/drafts/new"
                className="btn min-h-13 bg-terracotta-deep px-6 text-ivory hover:bg-forest"
              >
                Start a draft
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/login"
                className="btn min-h-13 border-ivory/25 bg-transparent px-6 text-ivory hover:border-ivory/60 hover:bg-ivory/10"
              >
                Sign in
              </Link>
            </div>

            <p className="mt-6 max-w-lg text-xs leading-5 text-ivory/60">
              Drafts are private until you submit them. Nothing becomes public without consent and a
              moderator&apos;s review.
            </p>
          </div>

          <div className="relative mx-auto w-full min-w-0 max-w-[27rem] lg:ml-auto">
            <div
              className="pointer-events-none absolute -inset-5 rounded-[2.2rem] bg-[radial-gradient(circle_at_30%_20%,rgb(79_70_229_/_0.28),transparent_58%),radial-gradient(circle_at_76%_84%,rgb(251_115_88_/_0.2),transparent_60%)] blur-2xl"
              aria-hidden="true"
            />
            <div className="relative rounded-[1.9rem] border border-ivory/20 bg-paper/95 p-2.5 shadow-panel">
              <div className="relative overflow-hidden rounded-[1.4rem]">
                <HeritageArtwork
                  seed="contribute-opening-manuscript"
                  heritageType="dialect"
                  aspect="portrait"
                  label="Original illustration of an open manuscript"
                  decorative={false}
                />
                <span className="absolute left-3 top-3 rounded-full bg-midnight/85 px-3 py-1.5 text-[0.5625rem] font-bold uppercase tracking-[0.18em] text-ivory/85 shadow-sm backdrop-blur">
                  Begin here
                </span>
              </div>
              <div className="flex items-end justify-between gap-4 px-2 pb-1 pt-4">
                <p className="min-w-0 text-[0.625rem] font-bold uppercase leading-4 tracking-[0.16em] text-earth-ink">
                  Original archive artwork
                  <span className="mt-0.5 block font-medium normal-case tracking-normal text-earth-ink">
                    Not a photograph of a community
                  </span>
                </p>
                <span className="shrink-0 font-display text-xs italic text-forest">Begin here</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-ivory/15 bg-ivory/[0.05] p-2.5">
              <div className="overflow-hidden rounded-xl">
                <HeritageArtwork
                  seed="contribute-opening-recipe"
                  heritageType="recipe"
                  aspect="square"
                />
              </div>
              <div className="min-w-0 pr-2">
                <p className="text-[0.5625rem] font-bold uppercase tracking-[0.16em] text-gold">
                  Recipes &amp; memory
                </p>
                <p className="mt-1.5 text-xs leading-5 text-ivory/70">
                  A draft begins with the people, places, and permissions behind a telling.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- What belongs */}
      <section
        ref={belongsReveal.ref}
        style={belongsReveal.style}
        aria-labelledby="belongs-heading"
        className={`section-shell ${belongsReveal.className}`}
      >
        <div className="container-page grid gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-20">
          <div>
            <p className="eyebrow">What belongs here</p>
            <h2 id="belongs-heading" className="display-section mt-4 max-w-xl">
              Living traditions, told by the people who keep them
            </h2>
            <p className="body-lede mt-6 max-w-xl">
              EnteBharatham documents cultural expressions that communities want recorded and
              shared. It is not a place for material taken without permission, and it is not a
              competition for the most authentic version.
            </p>

            <ul className="mt-10 grid border-t border-line sm:grid-cols-2 sm:gap-x-10">
              {HERITAGE_TYPE_OPTIONS.map((option, index) => (
                <li
                  key={option.value}
                  className="flex items-baseline justify-between gap-3 border-b border-line py-3"
                >
                  <span className="flex min-w-0 items-baseline gap-2.5">
                    <span
                      className="font-display text-[0.6875rem] text-terracotta"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm font-medium text-ink">{option.label}</span>
                  </span>
                  <span className="shrink-0 font-display text-sm text-terracotta-deep" lang="ml">
                    {option.labelMalayalam}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative lg:pt-10">
            <div className="grid grid-cols-2 gap-3">
              {ARTWORK_TYPES.map((type, index) => (
                <HeritageArtwork
                  key={type}
                  seed={`contribute-${type}`}
                  heritageType={type as HeritageType}
                  aspect={index === 0 ? 'square' : 'card'}
                  className={
                    index === 0
                      ? 'col-span-2 rounded-xl border border-line'
                      : 'rounded-xl border border-line'
                  }
                />
              ))}
            </div>
            <p className="meta mt-4 border-t border-line pt-3">
              Original vector illustrations made for this archive. They depict places, objects, and
              gestures — never real people or communities.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Prepare */}
      <section
        ref={prepareReveal.ref}
        style={prepareReveal.style}
        aria-labelledby="prepare-heading"
        className={`section-shell bg-cream ${prepareReveal.className}`}
      >
        <div className="container-page">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-20">
            <div>
              <p className="eyebrow">Before you begin</p>
              <h2 id="prepare-heading" className="display-section mt-4">
                What to bring to a draft
              </h2>
            </div>
            <p className="body-copy max-w-2xl lg:pb-1">
              You can save a draft at any point and return to it. The more of this you can record
              accurately, the smoother the review will be.
            </p>
          </div>

          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PREPARE.map((item, index) => (
              <li
                key={item.title}
                className="rounded-xl border border-line/80 bg-paper/70 p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-forest/25 hover:bg-paper hover:shadow-lift"
              >
                <span
                  className="font-display text-2xl leading-none text-terracotta"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-4 font-sans text-sm font-bold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-earth-ink">{item.body}</p>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <InlineNotice tone="info">
              Media is optional and uploaded after the draft exists. You can add up to 10 files per
              record, each no larger than 10&nbsp;MB. {ACCEPTED_MEDIA.join(' · ')}.
            </InlineNotice>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Process */}
      <section
        ref={processReveal.ref}
        style={processReveal.style}
        aria-labelledby="process-heading"
        className={`section-shell bg-paper ${processReveal.className}`}
      >
        <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 id="process-heading" className="display-section mt-4">
              From draft to published record
            </h2>
            <p className="body-copy mt-5 max-w-md">
              Nothing becomes public automatically. Consent and attribution are reviewed before a
              record can appear in the archive.
            </p>
            <Link to="/about#principles" className="link-underline mt-6 inline-flex text-sm">
              Read the archive principles
              <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <ol className="grid gap-4 sm:grid-cols-2">
            {STEPS.map((step) => (
              <li
                key={step.number}
                className="rounded-xl border border-line/80 bg-paper/60 p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-forest/25 hover:bg-paper hover:shadow-lift"
              >
                <span className="font-display text-2xl leading-none text-terracotta/85">
                  {step.number}
                </span>
                <h3 className="mt-4 font-sans text-sm font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-earth-ink">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* --------------------------------------------------------------- Care */}
      <section
        ref={careReveal.ref}
        style={careReveal.style}
        aria-labelledby="care-heading"
        className={`relative overflow-hidden bg-midnight text-ivory ${careReveal.className}`}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(38rem_30rem_at_100%_0%,rgb(79_70_229_/_0.28),transparent_64%),radial-gradient(30rem_24rem_at_0%_100%,rgb(245_185_66_/_0.1),transparent_66%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-[26rem] w-[26rem] rounded-full border border-ivory/10"
          aria-hidden="true"
        />
        <div className="container-page relative grid gap-12 py-20 sm:py-24 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <p className="eyebrow text-gold-light">A practice of care</p>
            <h2
              id="care-heading"
              className="mt-5 max-w-md font-display text-[clamp(2rem,3.6vw,3.1rem)] leading-[1.02] tracking-[-0.035em] text-ivory"
            >
              Permission is part of the story
            </h2>
            <p className="mt-6 max-w-md text-sm leading-7 text-ivory/75">
              Recording something does not make it yours to publish. The archive is built around
              consent, attribution, and the right to withdraw.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/dashboard/drafts/new"
                className="btn min-h-13 border-ivory bg-ivory text-midnight hover:bg-paper"
              >
                Start a draft
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/about"
                className="btn min-h-13 border-ivory/30 bg-transparent text-ivory hover:border-ivory/60 hover:bg-ivory/5"
              >
                About the project
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-ivory/15 bg-ivory/[0.035] p-5 backdrop-blur-sm sm:p-6">
            <div className="flex items-center gap-3 border-b border-ivory/15 pb-4">
              <HeartHandshake className="h-5 w-5 text-gold" aria-hidden="true" />
              <h3 className="font-sans text-sm font-bold text-ivory">
                Five commitments when you record
              </h3>
            </div>
            <ul className="divide-y divide-ivory/10">
              {CARE.map((item) => (
                <li key={item} className="flex gap-3 py-4 text-sm leading-6 text-ivory/70">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Disclosure */}
      <section
        ref={disclosureReveal.ref}
        style={disclosureReveal.style}
        aria-labelledby="disclosure-heading"
        className={`section-shell ${disclosureReveal.className}`}
      >
        <div className="container-page grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <p className="eyebrow">An honest note</p>
            <h2 id="disclosure-heading" className="display-section mt-4">
              What is in the archive today
            </h2>
          </div>
          <div className="max-w-2xl">
            <p className="body-copy">
              EnteBharatham is under active development. Records may be marked{' '}
              <span className="font-semibold text-warning">“Fictional demo record”</span> — these
              are test fixtures, not real traditions, and they are never presented as community
              testimony.
            </p>
            <p className="body-copy mt-4">
              Content licensing and consent terms for community contributions are still being
              decided. Nothing shared here is treated as free to reuse, and communities can ask for
              a record to be corrected or withdrawn.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link to="/explore" className="link-underline text-sm">
                Explore published records
              </Link>
              <span className="text-line-strong" aria-hidden="true">
                /
              </span>
              <Link to="/register" className="link-underline text-sm">
                Create a contributor account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Close */}
      <section className="border-t border-line bg-cream">
        <div className="container-page flex flex-col gap-6 py-14 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-paper text-forest shadow-xs">
              <Users className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-xl leading-snug text-ink">Ready when you are.</p>
              <p className="mt-1 text-sm text-earth-ink">
                Drafts are private and can be edited until you submit them for review.
              </p>
            </div>
          </div>
          <Link to="/dashboard/drafts/new" className="btn-primary shrink-0">
            Start a draft
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
