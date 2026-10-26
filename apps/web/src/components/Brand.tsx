import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface BrandMarkProps {
  className?: string;
  /** `dark` for ivory surfaces, `light` for forest or photographic surfaces. */
  tone?: 'dark' | 'light';
}

/**
 * The EnteBharatham emblem: a restrained gateway arch holding a lit lamp.
 *
 * It is drawn as a reusable vector so it stays crisp at every size and can be
 * used as the favicon, header mark, and footer mark without image assets.
 */
export function BrandMark({ className = 'h-9 w-9', tone = 'dark' }: BrandMarkProps) {
  const ink = tone === 'light' ? '#F6F7FB' : '#1E1B4B';
  const accent = tone === 'light' ? '#FFD479' : '#FB7358';

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false" fill="none">
      <path
        d="M14 49V27c0-10.5 8-18 18-18s18 7.5 18 18v22"
        stroke={ink}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M21.5 49V28.5C21.5 21.8 26.2 16.2 32 16.2s10.5 5.6 10.5 12.3V49"
        stroke={ink}
        strokeWidth="1.25"
        opacity="0.5"
      />
      <path
        d="M32 42.5c-3.9 0-6.5-2.8-6.5-6.3 0-4.5 6.5-11.1 6.5-11.1s6.5 6.6 6.5 11.1c0 3.5-2.6 6.3-6.5 6.3Z"
        fill={accent}
      />
      <path d="M12 49h40" stroke={ink} strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="32" cy="53.4" r="1.5" fill={accent} />
    </svg>
  );
}

export interface BrandLockupProps {
  tone?: 'dark' | 'light';
  /** Show the archive descriptor beneath the wordmark. */
  showTagline?: boolean;
  className?: string;
  markClassName?: string;
  /** Responsive visibility classes for the descriptor line. */
  taglineClassName?: string;
  /** Renders as a link to the home page by default. */
  asLink?: boolean;
}

export function BrandLockup({
  tone = 'dark',
  showTagline = true,
  className = '',
  markClassName = 'h-9 w-9',
  taglineClassName = 'hidden sm:block',
  asLink = true,
}: BrandLockupProps) {
  const content = (
    <>
      <BrandMark className={markClassName} tone={tone} />
      <span className="min-w-0">
        <span
          className={`block font-display text-[1.4rem] font-semibold leading-none tracking-[-0.035em] ${
            tone === 'light' ? 'text-ivory' : 'text-ink'
          }`}
        >
          EnteBharatham
        </span>
        {showTagline && (
          <span
            className={`mt-[0.32rem] max-w-[17rem] text-[0.5rem] font-semibold uppercase leading-[1.5] tracking-[0.18em] ${taglineClassName} ${
              tone === 'light' ? 'text-ivory/60' : 'text-earth-ink'
            }`}
          >
            India&apos;s Living Heritage Archive
          </span>
        )}
      </span>
    </>
  );

  const classes = `inline-flex items-center gap-3 ${className}`;

  if (!asLink) {
    return <span className={classes}>{content}</span>;
  }

  return (
    <Link
      to="/"
      className={`${classes} rounded-sm transition-opacity hover:opacity-85`}
      aria-label="EnteBharatham home"
    >
      {content}
    </Link>
  );
}

/** Small ornamental divider used between editorial sections. */
export function HeritageRule({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <svg viewBox="0 0 20 20" className="h-2.5 w-2.5 text-terracotta" fill="none">
        <path d="M10 1.5 18.5 10 10 18.5 1.5 10 10 1.5Z" stroke="currentColor" strokeWidth="1" />
        <circle cx="10" cy="10" r="1.6" fill="currentColor" />
      </svg>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function BrandStatement({ children }: { children: ReactNode }) {
  return <p className="font-display text-lg italic leading-relaxed text-forest">{children}</p>;
}
