import { ArrowUpRight, BookOpen, Languages } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../components/Brand';
import { useReveal } from '../components/Reveal';

const PRINCIPLES = [
  {
    title: 'Consent before publication',
    body: 'A record becomes public only when the contributor confirms permission and a moderator checks it. Withdrawal is a supported outcome, not an exception.',
  },
  {
    title: 'Attribution, not extraction',
    body: 'Storytellers, translators, recorders, and communities are credited by the names they choose. A record is never treated as free raw material.',
  },
  {
    title: 'Restricted knowledge stays restricted',
    body: 'Sacred, sensitive, or community-controlled material can be withheld from public view. Privacy is the default, and minimal data is collected.',
  },
  {
    title: 'The original language leads',
    body: 'Records preserve their original language and script. Translations are separate accounts so a rendering never silently replaces a telling.',
  },
  {
    title: 'Communities can correct the record',
    body: 'Reports, correction proposals, and withdrawal requests remain open for as long as a record is live. The archive keeps listening.',
  },
  {
    title: 'No score for culture',
    body: 'There is no authenticity rating, popularity contest, or quality number. Automated checks speak to completeness, not cultural worth.',
  },
];

const NOT_THIS = [
  'Not a museum that freezes a tradition in a single authoritative version.',
  'Not a verification service that declares a story historically true.',
  'Not a leaderboard that ranks communities, languages, or traditions.',
  'Not a stock-image library with invented photo credits.',
];

export function AboutPage() {
  const missionReveal = useReveal<HTMLElement>();
  const principlesReveal = useReveal<HTMLElement>();
  const notReveal = useReveal<HTMLElement>();
  const statusReveal = useReveal<HTMLElement>();

  return (
    <div>
      {/* ------------------------------------------------------------- Opening */}
      <section className="relative overflow-hidden bg-midnight text-ivory">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(48rem_36rem_at_88%_-8%,rgb(79_70_229_/_0.35),transparent_62%),radial-gradient(34rem_26rem_at_0%_100%,rgb(251_115_88_/_0.16),transparent_66%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-32 -top-28 h-[32rem] w-[32rem] rounded-full border border-ivory/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-40 left-1/3 h-[26rem] w-[26rem] rounded-full border border-ivory/[0.06]"
          aria-hidden="true"
        />

        <div className="container-page relative grid gap-14 py-14 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-20 lg:py-24">
          <div className="max-w-3xl">
            <p className="flex items-center gap-3 text-[0.6875rem] font-bold uppercase tracking-[0.22em] text-gold">
              <span className="h-px w-8 bg-gold" aria-hidden="true" />
              About the archive
            </p>
            <h1 className="mt-6 font-display text-[clamp(2.8rem,5.6vw,5rem)] font-medium leading-[0.95] tracking-[-0.045em] text-ivory">
              About
              <span className="block italic text-gold/90">EnteBharatham</span>
            </h1>
            <p className="mt-7 max-w-2xl text-[1.0625rem] leading-8 text-ivory/70 sm:text-lg">
              EnteBharatham helps communities document and share folk stories, oral histories,
              songs, proverbs, recipes, dialects, customs, traditional knowledge, and other cultural
              expressions. It begins with Kerala and is designed for communities and languages
              across India.
            </p>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-ivory/60">
              The archive is a practice of care: record with consent, credit the people who shared,
              keep the original language visible, and leave room for correction.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/contribute"
                className="btn min-h-13 bg-terracotta-deep px-6 text-ivory hover:bg-forest"
              >
                Share your story
              </Link>
              <Link
                to="/explore"
                className="btn min-h-13 border-ivory/25 bg-transparent px-6 text-ivory hover:border-ivory/60 hover:bg-ivory/10"
              >
                Explore the archive
              </Link>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm">
            <div className="relative rounded-2xl border border-ivory/20 bg-paper p-6 text-ink shadow-panel">
              <div
                className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent"
                aria-hidden="true"
              />
              <div className="flex items-center justify-between gap-4">
                <BrandMark className="h-9 w-9" />
                <span className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-earth-ink">
                  Independent archive
                </span>
              </div>
              <p className="mt-10 font-display text-2xl leading-snug text-forest-deep" lang="ml">
                ഓരോ കഥയും പ്രധാനമാണ്.
              </p>
              <p className="mt-2 font-display text-xl italic leading-snug text-ink">
                Every story matters.
              </p>
              <div className="my-6 h-px w-full bg-line" aria-hidden="true" />
              <p className="text-xs leading-6 text-earth-ink">
                A personal, independent archive project. Built around consent, attribution, and the
                right to withdraw — not around growth for its own sake.
              </p>
            </div>
            <p className="mt-4 flex items-center gap-2 text-[0.625rem] font-bold uppercase tracking-[0.18em] text-ivory/60">
              <span className="h-px w-5 bg-gold" aria-hidden="true" />A living archive
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Mission */}
      <section
        ref={missionReveal.ref}
        style={missionReveal.style}
        aria-labelledby="mission-heading"
        className={`section-shell ${missionReveal.className}`}
      >
        <div className="container-page grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <div>
            <p className="eyebrow">Why it exists</p>
            <h2 id="mission-heading" className="display-section mt-4">
              A living archive, not a display case
            </h2>
          </div>
          <div className="max-w-3xl">
            <p className="body-lede">
              A tradition does not live only in a book or behind glass. It lives each time someone
              tells it, sings it, cooks it, or teaches it. The archive exists to hold the story in
              the language it was given — and to keep the people who shared it in view.
            </p>
            <p className="body-copy mt-6">
              This is being built for Kerala first, with an architecture designed to support
              communities and languages throughout India over time. It is not a ranking of cultures
              and it does not score authenticity. It is a careful place to keep records, and a way
              for communities to correct the record when it is wrong.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Principles */}
      <section
        ref={principlesReveal.ref}
        style={principlesReveal.style}
        id="principles"
        aria-labelledby="principles-heading"
        className={`section-shell scroll-mt-24 bg-cream ${principlesReveal.className}`}
      >
        <div className="container-page">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">What guides the work</p>
              <h2 id="principles-heading" className="display-section mt-4">
                Principles
              </h2>
            </div>
            <p className="body-copy max-w-sm sm:pb-1">
              These are commitments, not slogans. Each one shapes what the archive allows and what
              it refuses to do.
            </p>
          </div>

          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((principle, index) => (
              <li
                key={principle.title}
                className="group rounded-xl border border-line/80 bg-paper/60 p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-forest/25 hover:bg-paper hover:shadow-lift"
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="font-display text-2xl leading-none text-terracotta/85"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-terracotta-soft/70 text-terracotta-deep opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </span>
                </div>
                <h3 className="mt-5 font-sans text-sm font-bold text-ink">{principle.title}</h3>
                <p className="mt-2 text-sm leading-6 text-earth-ink">{principle.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------- What it is not */}
      <section
        ref={notReveal.ref}
        style={notReveal.style}
        aria-labelledby="not-heading"
        className={`relative overflow-hidden bg-midnight text-ivory ${notReveal.className}`}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(38rem_30rem_at_100%_0%,rgb(79_70_229_/_0.28),transparent_64%),radial-gradient(30rem_24rem_at_0%_100%,rgb(245_185_66_/_0.1),transparent_66%)]"
          aria-hidden="true"
        />
        <div className="container-page relative grid gap-10 py-20 sm:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="eyebrow text-gold-light">Boundaries</p>
            <h2 id="not-heading" className="display-section mt-4 text-ivory">
              What this archive is not
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-ivory/75">
              An archive is defined as much by what it declines to do as by what it collects.
            </p>
          </div>
          <ul className="grid gap-2.5">
            {NOT_THIS.map((item, index) => (
              <li
                key={item}
                className="flex items-start gap-5 rounded-xl border border-ivory/10 bg-ivory/[0.035] px-5 py-4 text-sm leading-6 text-ivory/70 transition-colors hover:border-gold/25 hover:bg-ivory/[0.06]"
              >
                <span
                  className="mt-0.5 shrink-0 font-display text-xs text-gold-light"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ Status */}
      <section
        ref={statusReveal.ref}
        style={statusReveal.style}
        id="status"
        aria-labelledby="status-heading"
        className={`section-shell scroll-mt-24 ${statusReveal.className}`}
      >
        <div className="container-page grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
          <div>
            <p className="eyebrow">Where the work stands</p>
            <h2 id="status-heading" className="display-section mt-4">
              Project status
            </h2>
            <div className="mt-6 space-y-4 text-sm leading-7 text-earth-ink">
              <p>
                EnteBharatham is in active development. Contributors can register, draft heritage
                records, record provenance and sources, and submit records for review. Moderators
                can work the review queue, request changes, approve or reject submissions, review
                provenance, and inspect an append-only audit log.
              </p>
              <p>
                Community reports, correction proposals, and withdrawal requests are part of the
                governance workflow. Records become public only after a moderator approves them, and
                only when consent, visibility, and rights checks pass.
              </p>
              <p>
                Records labelled{' '}
                <strong className="font-semibold text-warning">“fictional demo”</strong> are
                development fixtures used to test the platform. They are not real traditions and are
                never presented as community testimony.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-line/80 bg-paper p-6 shadow-card">
              <BookOpen className="h-5 w-5 text-forest" aria-hidden="true" />
              <h3 className="mt-3 font-display text-lg text-ink">A personal project</h3>
              <p className="mt-2 text-sm leading-6 text-earth-ink">
                EnteBharatham is independent and personally maintained. It is not a company or an
                institution, and it answers to the people whose traditions it holds.
              </p>
              <Link to="/contribute" className="link-underline mt-4 inline-block text-sm">
                How to contribute
              </Link>
            </div>

            <div className="rounded-xl border border-line/80 bg-cream p-6 shadow-card">
              <Languages className="h-5 w-5 text-terracotta-deep" aria-hidden="true" />
              <h3 className="mt-3 font-display text-lg text-ink">For contributors</h3>
              <p className="mt-2 text-sm leading-6 text-earth-ink">
                You do not need to be a writer or historian. Begin with a story you know, credit the
                person who told you, and record only the consent you can confirm.
              </p>
              <Link to="/contribute" className="link-underline mt-4 inline-block text-sm">
                Read the contribution guide
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Close */}
      <section className="relative overflow-hidden bg-terracotta-deep text-ivory">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full border border-ivory/15"
          aria-hidden="true"
        />
        <div className="container-page relative flex flex-col gap-7 py-16 sm:flex-row sm:items-center sm:justify-between sm:py-20">
          <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.22em] text-ivory/90">
              The archive is a practice
            </p>
            <h2 className="mt-4 max-w-2xl font-display text-[clamp(1.9rem,3.2vw,2.8rem)] leading-[1.06] tracking-[-0.03em]">
              If a story lives in your family or community, it belongs here too.
            </h2>
          </div>
          <Link
            to="/contribute"
            className="btn inline-flex min-h-13 shrink-0 justify-center border-ivory bg-ivory px-6 text-terracotta-deep hover:bg-paper"
          >
            Share your story
          </Link>
        </div>
      </section>
    </div>
  );
}
