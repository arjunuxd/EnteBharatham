import type { HeritageType } from '@entebharatham/shared';
import { useEffect, useState, type CSSProperties } from 'react';
import {
  approvedImageryFor,
  artworkFor,
  ARTWORK_MOTIF_LABELS,
  type ArtworkMotif,
} from '../lib/imagery';

export interface HeritageArtworkProps {
  /** A stable seed (usually the record slug) so a story keeps one artwork. */
  seed: string;
  heritageType: HeritageType;
  className?: string;
  /** `card` is 4:3, `wide` is 16:9, `portrait` is 4:5, `square` is 1:1, `banner` is 21:9. */
  aspect?: 'card' | 'wide' | 'portrait' | 'square' | 'banner';
  /** Supply a label to expose the artwork to assistive technology. */
  label?: string;
  /** Decorative artwork is hidden from assistive technology (the default). */
  decorative?: boolean;
}

const ASPECTS: Record<NonNullable<HeritageArtworkProps['aspect']>, string> = {
  card: 'aspect-[4/3]',
  wide: 'aspect-[16/9]',
  portrait: 'aspect-[4/5]',
  square: 'aspect-square',
  banner: 'aspect-[21/9]',
};

/**
 * Original vector artwork for the archive.
 *
 * These illustrations stand in for community photography until a documented,
 * licensed editorial collection exists. They deliberately depict places,
 * objects, and gestures rather than real people or communities, so no image
 * claims a false attribution.
 */
export function HeritageArtwork({
  seed,
  heritageType,
  className = '',
  aspect = 'card',
  label,
  decorative = label === undefined,
}: HeritageArtworkProps) {
  const { palette, motif, background, variant } = artworkFor(seed, heritageType);
  const accessibleLabel = label ?? ARTWORK_MOTIF_LABELS[motif];
  const approvedImage = approvedImageryFor(seed);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [seed]);

  const visibleImage = approvedImage !== undefined && !imageFailed ? approvedImage : undefined;
  const isDeep = background === 'deep';

  return (
    <div
      className={`relative isolate overflow-hidden ${ASPECTS[aspect]} ${className}`}
      style={
        {
          '--artwork-paper': palette.paper,
          '--artwork-wash': palette.wash,
          '--artwork-arch': palette.arch,
          '--artwork-hill': palette.hill,
          '--artwork-water': palette.water,
          '--artwork-sun': palette.sun,
          '--artwork-accent': palette.accent,
          '--artwork-deep': palette.deep,
          '--artwork-mid': palette.mid,
          '--artwork-bg': isDeep ? palette.deep : palette.paper,
          '--artwork-fg': isDeep ? palette.paper : palette.arch,
        } as CSSProperties
      }
      role={visibleImage !== undefined || decorative ? undefined : 'img'}
      aria-label={visibleImage !== undefined || decorative ? undefined : accessibleLabel}
      aria-hidden={visibleImage === undefined && decorative ? true : undefined}
    >
      {visibleImage !== undefined ? (
        <>
          <img
            src={visibleImage.src}
            alt={decorative ? '' : visibleImage.alt}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/65 to-transparent px-2.5 pb-1.5 pt-6 text-[0.5625rem] leading-4 text-ivory/85">
            {visibleImage.sourceUrl === undefined ? (
              <>
                {visibleImage.credit} · {visibleImage.license}
              </>
            ) : (
              <a
                href={visibleImage.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-ivory/35 underline-offset-2 hover:text-ivory"
              >
                {visibleImage.credit} · {visibleImage.license}
              </a>
            )}
          </span>
        </>
      ) : (
        <svg
          viewBox="0 0 400 300"
          className="h-full w-full"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <rect width="400" height="300" fill="var(--artwork-bg)" />
          <circle
            cx="348"
            cy="42"
            r="92"
            fill={isDeep ? 'var(--artwork-paper)' : 'var(--artwork-wash)'}
            opacity={isDeep ? 0.045 : 0.55}
          />
          <circle
            cx="24"
            cy="290"
            r="104"
            fill="var(--artwork-wash)"
            opacity={isDeep ? 0.07 : 0.42}
          />

          <Motif motif={motif} variant={variant} />

          <Grain dark={isDeep} />
          <rect
            x="0.5"
            y="0.5"
            width="399"
            height="299"
            stroke="var(--artwork-fg)"
            strokeWidth="1"
            opacity="0.16"
          />
        </svg>
      )}
    </div>
  );
}

function Grain({ dark }: { dark: boolean }) {
  return (
    <g fill={dark ? 'var(--artwork-paper)' : 'var(--artwork-arch)'} opacity={dark ? 0.12 : 0.1}>
      {Array.from({ length: 34 }).map((_, index) => (
        <circle
          key={index}
          cx={16 + ((index * 61) % 368)}
          cy={14 + ((index * 43) % 272)}
          r={index % 4 === 0 ? 1.1 : 0.6}
        />
      ))}
    </g>
  );
}

function Motif({ motif, variant }: { motif: ArtworkMotif; variant: number }) {
  switch (motif) {
    case 'lamp':
      return <Lamp variant={variant} />;
    case 'hearth':
      return <Hearth variant={variant} />;
    case 'landscape':
      return <Landscape variant={variant} />;
    case 'song':
      return <Song variant={variant} />;
    case 'recipe':
      return <Recipe variant={variant} />;
    case 'craft':
      return <Craft variant={variant} />;
    case 'manuscript':
      return <Manuscript variant={variant} />;
    case 'kolam':
      return <Kolam variant={variant} />;
    case 'drum':
      return <Drum variant={variant} />;
  }
}

/* ------------------------------------------------------------------ Lamp */
function Lamp({ variant }: { variant: number }) {
  const flameX = 200 + (variant - 1) * 5;

  return (
    <g>
      <path d="M62 272V150c0-72 61-114 138-114s138 42 138 114v122Z" fill="var(--artwork-paper)" />
      <path
        d="M80 272V154c0-62 53-100 120-100s120 38 120 100v118"
        stroke="var(--artwork-arch)"
        strokeWidth="1.1"
        opacity="0.28"
      />
      <path
        d="M104 272V160c0-50 43-82 96-82s96 32 96 82v112"
        stroke="var(--artwork-arch)"
        strokeWidth="0.8"
        opacity="0.15"
      />

      <circle cx="200" cy="132" r="76" fill="var(--artwork-sun)" opacity="0.32" />
      <circle cx="200" cy="132" r="56" fill="var(--artwork-sun)" opacity="0.24" />

      <path
        d={`M${flameX} 62v44`}
        stroke="var(--artwork-arch)"
        strokeWidth="1.2"
        strokeDasharray="2 5"
        opacity="0.65"
      />
      <path
        d={`M${flameX} 174c-30 0-50-21-50-48 0-33 50-79 50-79s50 46 50 79c0 27-20 48-50 48Z`}
        fill="var(--artwork-accent)"
      />
      <path
        d={`M${flameX} 164c-15 0-27-12-27-27 0-18 27-43 27-43s27 25 27 43c0 15-12 27-27 27Z`}
        fill="var(--artwork-sun)"
      />
      <path
        d="M150 180h100c8 0 13 6 11 13l-9 32c-2 8-9 13-17 13h-70c-8 0-15-5-17-13l-9-32c-2-7 3-13 11-13Z"
        fill="var(--artwork-paper)"
        stroke="var(--artwork-arch)"
        strokeWidth="2.2"
      />
      <path d="M146 202h108" stroke="var(--artwork-arch)" strokeWidth="1.1" opacity="0.55" />
      <circle cx="200" cy="248" r="4" fill="var(--artwork-accent)" />
      <ellipse cx="200" cy="268" rx="86" ry="7" fill="var(--artwork-arch)" opacity="0.12" />
      <path d="M136 272h128" stroke="var(--artwork-arch)" strokeWidth="1.4" opacity="0.35" />

      <g fill="var(--artwork-sun)">
        <circle cx="44" cy="86" r="2.2" />
        <circle cx="352" cy="116" r="2.6" />
        <circle cx="54" cy="204" r="1.8" />
        <circle cx="344" cy="226" r="2" />
        <circle cx="72" cy="142" r="1.2" />
        <circle cx="330" cy="64" r="1.4" />
      </g>
      <g stroke="var(--artwork-sun)" strokeWidth="1" opacity="0.55">
        <path d="M36 124h12M42 118v12" />
        <path d="M356 174h10M361 169v10" />
      </g>
    </g>
  );
}

/* --------------------------------------------------------------- Hearth */
function Hearth({ variant }: { variant: number }) {
  const potX = 200 + (variant - 1) * 5;

  return (
    <g>
      <circle cx="200" cy="204" r="132" fill="var(--artwork-sun)" opacity="0.07" />
      <circle cx="200" cy="200" r="88" fill="var(--artwork-sun)" opacity="0.1" />

      <path
        d="M40 252V112c0-32 25-56 58-56h204c33 0 58 24 58 56v140"
        stroke="var(--artwork-paper)"
        strokeWidth="1.2"
        opacity="0.15"
      />
      <path
        d="M58 252V120c0-26 21-46 48-46h188c27 0 48 20 48 46v132"
        stroke="var(--artwork-paper)"
        strokeWidth="0.8"
        opacity="0.07"
      />

      <path d="M74 80h252" stroke="var(--artwork-paper)" strokeWidth="1.4" opacity="0.3" />
      <path d="M86 80v8M314 80v8" stroke="var(--artwork-paper)" strokeWidth="1" opacity="0.2" />

      <g stroke="var(--artwork-paper)" opacity="0.5">
        <path d="M108 80v30" strokeWidth="1" />
        <circle cx="108" cy="117" r="7" strokeWidth="1.2" fill="var(--artwork-deep)" />
      </g>

      <g stroke="var(--artwork-sun)" strokeWidth="1" opacity="0.55" fill="none">
        <path d="M206 80v26M206 92c-7-6-12-4-15 2M206 88c7-6 12-4 15 2M206 102c-6-5-11-3-14 3" />
      </g>

      <g>
        <path d="M292 80v18" stroke="var(--artwork-paper)" strokeWidth="1" opacity="0.4" />
        <path d="M280 98h24l-3 18c-1 5-5 8-9 8s-8-3-9-8Z" fill="var(--artwork-mid)" opacity="0.9" />
        <path d="M278 98h28" stroke="var(--artwork-paper)" strokeWidth="1.2" opacity="0.6" />
      </g>

      <path d="M24 252h352" stroke="var(--artwork-paper)" strokeWidth="1.4" opacity="0.24" />
      <path d="M40 264h320" stroke="var(--artwork-paper)" strokeWidth="1" opacity="0.09" />

      <g strokeLinecap="round">
        <path d="M150 236 250 248" stroke="var(--artwork-mid)" strokeWidth="7" opacity="0.9" />
        <path d="M250 236 150 248" stroke="var(--artwork-arch)" strokeWidth="7" opacity="0.95" />
      </g>

      <path
        d="M200 244c-26 0-40-16-40-34 0-20 22-32 40-46 18 14 40 26 40 46 0 18-14 34-40 34Z"
        fill="var(--artwork-accent)"
        opacity="0.95"
      />
      <path
        d="M200 240c-14 0-22-10-22-20 0-12 12-20 22-30 10 10 22 18 22 30 0 10-8 20-22 20Z"
        fill="var(--artwork-sun)"
      />
      <path
        d="M200 238c-6 0-10-5-10-10 0-7 6-12 10-17 4 5 10 10 10 17 0 5-4 10-10 10Z"
        fill="var(--artwork-paper)"
        opacity="0.8"
      />

      <g fill="var(--artwork-hill)" stroke="var(--artwork-paper)" strokeWidth="0.8" opacity="0.62">
        <ellipse cx="138" cy="246" rx="18" ry="9" />
        <ellipse cx="262" cy="246" rx="18" ry="9" />
        <ellipse cx="166" cy="253" rx="10" ry="6" opacity="0.8" />
        <ellipse cx="234" cy="253" rx="10" ry="6" opacity="0.8" />
      </g>

      <g
        stroke="var(--artwork-paper)"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.72"
        fill="none"
      >
        <path d="M148 250 186 148M252 250 214 148M200 252V148" />
      </g>
      <path
        d="M184 148h32"
        stroke="var(--artwork-paper)"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.82"
      />
      <path d={`M${potX} 148v16`} stroke="var(--artwork-paper)" strokeWidth="1.3" opacity="0.55" />

      <g>
        <path
          d={`M${potX - 38} 168c-8 0-8 12 0 12M${potX + 38} 168c8 0 8 12 0 12`}
          stroke="var(--artwork-arch)"
          strokeWidth="2"
          fill="none"
        />
        <path
          d={`M${potX - 34} 164h68c3 0 5 3 4 6l-6 29c-2 9-10 15-19 15h-26c-9 0-17-6-19-15l-6-29c-1-3 1-6 4-6Z`}
          fill="var(--artwork-paper)"
          stroke="var(--artwork-arch)"
          strokeWidth="2"
        />
        <path
          d={`M${potX - 38} 164h76`}
          stroke="var(--artwork-arch)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d={`M${potX - 34} 184h68`}
          stroke="var(--artwork-accent)"
          strokeWidth="2"
          opacity="0.65"
        />
      </g>

      <g
        stroke="var(--artwork-paper)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.35"
        fill="none"
      >
        <path d={`M${potX - 14} 158c-8-10 8-16 0-26`} />
        <path d={`M${potX} 154c-9-12 9-18 0-30`} />
        <path d={`M${potX + 14} 158c-8-10 8-16 0-26`} />
      </g>

      <g>
        <rect x="56" y="210" width="64" height="5" fill="var(--artwork-paper)" opacity="0.28" />
        <path
          d="M64 215 58 250M112 215 118 250"
          stroke="var(--artwork-paper)"
          strokeWidth="1.6"
          opacity="0.45"
        />
        <path
          d="M68 200c2 9 8 13 16 13s14-4 16-13Z"
          fill="var(--artwork-paper)"
          stroke="var(--artwork-arch)"
          strokeWidth="1.4"
        />
        <ellipse cx="84" cy="200" rx="16" ry="3.4" fill="var(--artwork-sun)" opacity="0.8" />
      </g>

      <g>
        <ellipse cx="320" cy="244" rx="26" ry="8" fill="var(--artwork-hill)" opacity="0.5" />
        <path
          d="M294 244v6c0 6 12 11 26 11s26-5 26-11v-6"
          fill="var(--artwork-hill)"
          opacity="0.38"
        />
        <path
          d="M294 238c0 6 12 11 26 11s26-5 26-11"
          stroke="var(--artwork-paper)"
          strokeWidth="1"
          opacity="0.5"
          fill="none"
        />
        <ellipse cx="320" cy="228" rx="22" ry="7" fill="var(--artwork-hill)" opacity="0.68" />
        <path d="M298 228v5c0 5 10 9 22 9s22-4 22-9v-5" fill="var(--artwork-hill)" opacity="0.5" />
        <path
          d="M298 223c0 5 10 9 22 9s22-4 22-9"
          stroke="var(--artwork-paper)"
          strokeWidth="1"
          opacity="0.55"
          fill="none"
        />
        <g stroke="var(--artwork-paper)" strokeWidth="0.8" opacity="0.25">
          <path d="M300 232c6 4 34 4 40 0M302 240c5 3 31 3 36 0" />
        </g>
      </g>

      <g fill="var(--artwork-sun)" opacity="0.85">
        <circle cx="118" cy="194" r="2.2" />
        <circle cx="282" cy="188" r="2.6" />
        <circle cx="98" cy="226" r="1.6" />
        <circle cx="304" cy="222" r="1.8" />
        <circle cx="178" cy="170" r="1.3" />
        <circle cx="226" cy="164" r="1.1" />
      </g>
    </g>
  );
}

/* ------------------------------------------------------------- Landscape */
function Landscape({ variant }: { variant: number }) {
  const sunX = 292 - variant * 20;

  return (
    <g>
      <circle cx={sunX} cy="88" r="36" fill="var(--artwork-sun)" opacity="0.95" />
      <circle cx={sunX} cy="88" r="48" stroke="var(--artwork-sun)" strokeWidth="1" opacity="0.3" />

      <path
        d="M0 194c46-50 84-60 124-42 25 11 38 25 58 25 30 0 45-38 82-38 33 0 58 27 84 57v70H0Z"
        fill="var(--artwork-hill)"
        opacity="0.8"
      />
      <path
        d="M0 224c50-38 90-42 132-22 26 12 42 25 66 25 31 0 52-29 86-29 34 0 64 20 116 46v56H0Z"
        fill="var(--artwork-mid)"
        opacity="0.9"
      />
      <path
        d="M0 252c58-17 102-18 146-4 44 14 86 14 132 0 42-12 82-10 122 4v48H0Z"
        fill="var(--artwork-arch)"
      />

      <path
        d="M252 166c-20 16-32 30-28 46 4 15 21 23 19 40-2 15-19 23-28 38"
        stroke="var(--artwork-water)"
        strokeWidth="16"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M246 174c-15 13-24 25-21 37 3 13 17 22 15 36-2 11-13 18-21 29"
        stroke="var(--artwork-paper)"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.55"
      />

      <g transform="translate(108 168)">
        <rect
          x="0"
          y="9"
          width="31"
          height="23"
          fill="var(--artwork-paper)"
          stroke="var(--artwork-arch)"
          strokeWidth="1.2"
        />
        <path d="M-5 9 15.5-4 36 9Z" fill="var(--artwork-accent)" />
        <rect x="12" y="19" width="7" height="13" fill="var(--artwork-deep)" />
        <rect x="23" y="15" width="4" height="5" fill="var(--artwork-sun)" />
      </g>

      <g stroke="var(--artwork-paper)" strokeWidth="1" opacity="0.28">
        <path d="M38 238c30-8 58-8 86 0M268 246c28-6 54-6 80 0M52 260c26-5 52-5 78 0" />
      </g>
      <g stroke="var(--artwork-arch)" strokeWidth="0.9" opacity="0.28">
        <path d="M22 212c24-6 48-6 72 0M300 204c26-5 50-5 74 0" />
      </g>

      <g stroke="var(--artwork-arch)" strokeWidth="1.1" opacity="0.45" fill="none">
        <path d="M72 84c7-8 15-8 22 0M108 70c6-7 13-7 19 0M64 104c5-6 11-6 16 0" />
      </g>
      <g fill="var(--artwork-sun)">
        <circle cx="46" cy="128" r="1.5" />
        <circle cx="342" cy="150" r="1.8" />
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ Song */
function Song({ variant }: { variant: number }) {
  const tilt = -18 + variant * 3;

  return (
    <g>
      <g stroke="var(--artwork-paper)" fill="none">
        <circle cx="202" cy="150" r="104" opacity="0.1" />
        <circle cx="202" cy="150" r="82" opacity="0.14" />
        <circle cx="202" cy="150" r="60" opacity="0.2" />
      </g>
      <circle cx="202" cy="150" r="44" fill="var(--artwork-accent)" opacity="0.22" />
      <circle cx="202" cy="150" r="8" fill="var(--artwork-sun)" />

      <g transform={`rotate(${tilt} 202 150)`}>
        <rect x="196" y="38" width="11" height="162" rx="5" fill="var(--artwork-paper)" />
        <path d="M196 44c0-10 11-10 11 0v18h-11Z" fill="var(--artwork-sun)" />
        <rect x="193" y="60" width="17" height="5" rx="2" fill="var(--artwork-accent)" />
        <ellipse cx="201" cy="226" rx="42" ry="32" fill="var(--artwork-accent)" />
        <ellipse cx="201" cy="226" rx="25" ry="18" fill="var(--artwork-deep)" opacity="0.45" />
        <ellipse cx="201" cy="226" rx="12" ry="8" fill="var(--artwork-sun)" opacity="0.85" />
        <g stroke="var(--artwork-sun)" strokeWidth="1.2" opacity="0.85">
          <path d="M199 78v138M204 78v138" />
        </g>
        <g stroke="var(--artwork-deep)" strokeWidth="1.2" opacity="0.5">
          <path d="M194 104h16M194 122h16M194 140h16M194 158h16" />
        </g>
        <path
          d="M162 226c0 18 17 31 39 31s39-13 39-31"
          stroke="var(--artwork-paper)"
          strokeWidth="1.1"
          opacity="0.4"
        />
      </g>

      <g fill="var(--artwork-sun)">
        <circle cx="86" cy="92" r="4" />
        <circle cx="112" cy="72" r="2.4" />
        <circle cx="318" cy="96" r="3.2" />
        <circle cx="338" cy="128" r="2" />
        <circle cx="76" cy="212" r="2.4" />
      </g>
      <g
        stroke="var(--artwork-gold, var(--artwork-sun))"
        strokeWidth="1.4"
        opacity="0.55"
        fill="none"
      >
        <path d="M70 132c-10 14-10 28 0 42M330 116c12 16 12 34 0 50" />
        <path d="M88 116c-7 10-7 20 0 30M312 148c8 12 8 24 0 36" />
      </g>
      <path
        d="M118 250c24 12 50 18 84 18s60-6 84-18"
        stroke="var(--artwork-paper)"
        strokeWidth="1"
        opacity="0.22"
      />
    </g>
  );
}

/* ---------------------------------------------------------------- Recipe */
function Recipe({ variant }: { variant: number }) {
  return (
    <g>
      <rect
        x="46"
        y="46"
        width="308"
        height="214"
        rx="4"
        fill="var(--artwork-wash)"
        opacity="0.65"
      />
      <g stroke="var(--artwork-arch)" strokeWidth="0.7" opacity="0.16">
        {Array.from({ length: 9 }).map((_, index) => (
          <path key={`v-${index}`} d={`M${64 + index * 34} 46v214`} />
        ))}
        {Array.from({ length: 7 }).map((_, index) => (
          <path key={`h-${index}`} d={`M46 ${64 + index * 30}h308`} />
        ))}
      </g>

      <circle
        cx="200"
        cy="160"
        r="78"
        fill="var(--artwork-paper)"
        stroke="var(--artwork-arch)"
        strokeWidth="1.6"
      />
      <circle cx="200" cy="160" r="64" fill="var(--artwork-accent)" opacity="0.92" />
      <circle cx="200" cy="160" r="50" fill="var(--artwork-deep)" opacity="0.18" />
      <path
        d="M166 154c12-10 28-10 40 0 12 10 28 10 40 0"
        stroke="var(--artwork-sun)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M172 174c10-8 22-8 32 0 10 8 22 8 32 0"
        stroke="var(--artwork-paper)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.55"
      />
      <g fill="var(--artwork-sun)">
        <circle cx="182" cy="140" r="3" />
        <circle cx="206" cy="136" r="2.2" />
        <circle cx="220" cy="148" r="2.8" />
      </g>

      <g
        stroke="var(--artwork-arch)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
        fill="none"
      >
        <path d="M170 112c-9-12 9-18 0-30M198 110c-9-13 9-19 0-32M226 114c-9-12 9-18 0-30" />
      </g>

      <g>
        <circle
          cx="94"
          cy="94"
          r="25"
          fill="var(--artwork-paper)"
          stroke="var(--artwork-arch)"
          strokeWidth="1.2"
        />
        <circle cx="94" cy="94" r="15" fill="var(--artwork-sun)" />
        <circle cx="94" cy="94" r="7" fill="var(--artwork-accent)" opacity="0.7" />
      </g>
      <g>
        <circle
          cx="310"
          cy="222"
          r="23"
          fill="var(--artwork-paper)"
          stroke="var(--artwork-arch)"
          strokeWidth="1.2"
        />
        <circle cx="310" cy="222" r="13" fill="var(--artwork-mid)" />
        <circle cx="310" cy="222" r="5" fill="var(--artwork-sun)" />
      </g>

      <g fill="var(--artwork-accent)">
        <circle cx="132" cy="238" r="2.6" />
        <circle cx="148" cy="248" r="2" />
        <circle cx="122" cy="252" r="1.6" />
        <circle cx="268" cy="84" r="2.4" />
        <circle cx="284" cy="94" r="1.7" />
        <circle cx="252" cy="72" r="1.4" />
      </g>
      <g fill="var(--artwork-sun)">
        <circle cx="144" cy="78" r="2" />
        <circle cx="266" cy="246" r="2.2" />
        <circle cx="82" cy="196" r="1.8" />
      </g>

      <g transform={`rotate(${variant === 0 ? -12 : variant === 1 ? 8 : 0} 320 120)`}>
        <path
          d="M304 88h28c5 0 8 4 7 9l-8 40c-1 5-5 8-10 8h-6c-5 0-9-3-10-8l-8-40c-1-5 2-9 7-9Z"
          fill="var(--artwork-paper)"
          stroke="var(--artwork-arch)"
          strokeWidth="1.2"
        />
        <path d="M322 88V66" stroke="var(--artwork-arch)" strokeWidth="3" strokeLinecap="round" />
        <path d="M304 112h28" stroke="var(--artwork-accent)" strokeWidth="1" opacity="0.55" />
      </g>

      <path d="M60 260h280" stroke="var(--artwork-arch)" strokeWidth="1" opacity="0.25" />
    </g>
  );
}

/* ----------------------------------------------------------------- Craft */
function Craft({ variant }: { variant: number }) {
  return (
    <g>
      <rect
        x="76"
        y="46"
        width="248"
        height="208"
        stroke="var(--artwork-paper)"
        strokeWidth="2.4"
        opacity="0.9"
      />
      <rect x="88" y="58" width="224" height="184" fill="var(--artwork-paper)" opacity="0.08" />
      <g stroke="var(--artwork-paper)" strokeWidth="0.8" opacity="0.28">
        {Array.from({ length: 13 }).map((_, index) => (
          <path key={`warp-${index}`} d={`M${100 + index * 17} 58v184`} />
        ))}
        {Array.from({ length: 8 }).map((_, index) => (
          <path key={`weft-${index}`} d={`M88 ${76 + index * 23}h224`} />
        ))}
      </g>

      <g>
        {[0, 1, 2].map((row) =>
          [0, 1, 2, 3].map((col) => {
            const x = 130 + col * 46;
            const y = 94 + row * 46;
            const filled = (row + col + variant) % 3 === 0;
            return (
              <g key={`${row}-${col}`} transform={`translate(${x} ${y}) rotate(45)`}>
                <rect
                  x="-15"
                  y="-15"
                  width="30"
                  height="30"
                  fill={filled ? 'var(--artwork-accent)' : 'var(--artwork-sun)'}
                  opacity={filled ? 0.95 : 0.75}
                  stroke="var(--artwork-paper)"
                  strokeWidth="0.8"
                />
                <rect
                  x="-6"
                  y="-6"
                  width="12"
                  height="12"
                  fill={filled ? 'var(--artwork-sun)' : 'var(--artwork-accent)'}
                  opacity="0.8"
                />
              </g>
            );
          }),
        )}
      </g>

      <path d="M76 46h248M76 254h248" stroke="var(--artwork-sun)" strokeWidth="2" opacity="0.7" />
      <g stroke="var(--artwork-paper)" strokeWidth="1.2" opacity="0.5">
        <path d="M104 254v26M296 254v26" />
      </g>

      <g transform="translate(146 266)">
        <rect x="0" y="0" width="108" height="12" rx="6" fill="var(--artwork-paper)" />
        <rect x="10" y="3" width="40" height="6" rx="3" fill="var(--artwork-accent)" />
        <path d="M108 6h26" stroke="var(--artwork-sun)" strokeWidth="1.4" />
        <circle cx="140" cy="6" r="6" stroke="var(--artwork-sun)" strokeWidth="1.4" />
      </g>

      <g fill="var(--artwork-sun)">
        <circle cx="60" cy="88" r="2" />
        <circle cx="342" cy="196" r="2.4" />
        <circle cx="58" cy="216" r="1.6" />
      </g>
    </g>
  );
}

/* ------------------------------------------------------------ Manuscript */
function Manuscript({ variant }: { variant: number }) {
  return (
    <g>
      <circle cx="200" cy="150" r="104" fill="var(--artwork-wash)" opacity="0.55" />
      <g transform={`rotate(${variant === 0 ? -4 : variant === 1 ? 3 : 0} 200 156)`}>
        <rect x="76" y="66" width="248" height="180" rx="5" fill="var(--artwork-arch)" />
        <rect x="86" y="76" width="112" height="160" fill="var(--artwork-paper)" />
        <rect x="202" y="76" width="112" height="160" fill="var(--artwork-paper)" />
        <path d="M198 76h8v160h-8Z" fill="var(--artwork-wash)" />
        <path d="M198 78v156" stroke="var(--artwork-arch)" strokeWidth="1" opacity="0.3" />

        <g stroke="var(--artwork-arch)" strokeWidth="1.6" strokeLinecap="round" opacity="0.5">
          <path d="M104 100h66M104 114h74M104 128h58M104 142h70M104 156h48M104 170h62M104 184h72M104 198h40" />
          <path d="M222 100h64M222 114h72M222 128h54M222 142h68M222 156h44M222 170h60M222 184h70M222 198h38" />
        </g>

        <circle cx="264" cy="218" r="13" stroke="var(--artwork-accent)" strokeWidth="1.4" />
        <path d="M264 207v22M253 218h22" stroke="var(--artwork-accent)" strokeWidth="1" />
        <circle cx="138" cy="220" r="3" fill="var(--artwork-accent)" />
      </g>

      <g transform="rotate(-38 320 84)">
        <rect x="312" y="34" width="8" height="78" rx="4" fill="var(--artwork-accent)" />
        <path d="M312 112h8l-4 16Z" fill="var(--artwork-sun)" />
        <path d="M316 120v10" stroke="var(--artwork-arch)" strokeWidth="1.2" />
      </g>
      <circle cx="306" cy="142" r="3" fill="var(--artwork-accent)" />

      <g fill="var(--artwork-sun)">
        <circle cx="64" cy="92" r="2" />
        <circle cx="342" cy="202" r="2.4" />
        <circle cx="70" cy="214" r="1.4" />
      </g>
    </g>
  );
}

/* ----------------------------------------------------------------- Kolam */
function Kolam({ variant }: { variant: number }) {
  const dots = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      dots.push([132 + col * 34, 106 + row * 30]);
    }
  }

  return (
    <g>
      <g fill="var(--artwork-sun)" opacity="0.8">
        {dots.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" />
        ))}
      </g>

      <g stroke="var(--artwork-paper)" strokeWidth="1.5" opacity="0.72" fill="none">
        <path d="M200 106c30 0 54 24 54 54s-24 54-54 54-54-24-54-54 24-54 54-54Z" />
        <path d="M200 92c38 0 68 30 68 68s-30 68-68 68-68-30-68-68 30-68 68-68Z" opacity="0.55" />
        <path
          d="M132 160c0-38 30-68 68-68 18 0 34 7 46 18-12-4-26-2-36 6-16 12-20 34-8 50 12 16 34 20 50 8 8-6 12-14 14-24 3 8 4 16 4 24 0 38-30 68-68 68s-68-30-68-68Z"
          opacity="0.5"
        />
      </g>

      <g transform={`rotate(${variant * 30} 200 160)`}>
        {[0, 45, 90, 135].map((angle) => (
          <ellipse
            key={angle}
            cx="200"
            cy="160"
            rx="14"
            ry="34"
            stroke="var(--artwork-accent)"
            strokeWidth="1.6"
            opacity="0.8"
            transform={`rotate(${angle} 200 160)`}
          />
        ))}
      </g>
      <circle cx="200" cy="160" r="13" fill="var(--artwork-accent)" />
      <circle cx="200" cy="160" r="5" fill="var(--artwork-sun)" />

      <g fill="var(--artwork-accent)">
        <circle cx="92" cy="92" r="5" />
        <circle cx="308" cy="92" r="4" />
        <circle cx="92" cy="228" r="4" />
        <circle cx="308" cy="228" r="5" />
      </g>
      <g stroke="var(--artwork-sun)" strokeWidth="1" opacity="0.5">
        <path d="M64 160h22M314 160h22M200 62v18M200 240v18" />
      </g>
      <path d="M84 262h232" stroke="var(--artwork-paper)" strokeWidth="1" opacity="0.3" />
    </g>
  );
}

/* ------------------------------------------------------------------ Drum */
function Drum({ variant }: { variant: number }) {
  return (
    <g>
      <path d="M126 82v20M274 82v20" stroke="var(--artwork-sun)" strokeWidth="1.4" opacity="0.6" />
      <g fill="var(--artwork-accent)">
        <path d="M126 82l20 8-20 8Z" opacity="0.85" />
        <path d="M274 82l-20 8 20 8Z" opacity="0.85" />
      </g>

      <path
        d="M136 94c0 15 29 24 64 24s64-9 64-24"
        stroke="var(--artwork-paper)"
        strokeWidth="2"
        fill="var(--artwork-wash)"
      />
      <path
        d="M136 94v108c0 15 29 24 64 24s64-9 64-24V94"
        fill="var(--artwork-paper)"
        stroke="var(--artwork-paper)"
        strokeWidth="2"
      />
      <ellipse
        cx="200"
        cy="94"
        rx="64"
        ry="23"
        fill="var(--artwork-wash)"
        stroke="var(--artwork-paper)"
        strokeWidth="2"
      />

      <g fill="var(--artwork-accent)" opacity="0.9">
        <path d="M136 118c38 12 90 12 128 0v13c-38 12-90 12-128 0Z" />
        <path d="M136 172c38 12 90 12 128 0v13c-38 12-90 12-128 0Z" />
      </g>
      <g stroke="var(--artwork-sun)" strokeWidth="1.4" opacity="0.8">
        <path d="M136 136c38 12 90 12 128 0M136 154c38 12 90 12 128 0M136 190c38 12 90 12 128 0" />
      </g>

      <g stroke="var(--artwork-arch)" strokeWidth="1" opacity="0.35">
        <path d="M136 108l-18 28M264 108l18 28M136 166l-16 26M264 166l16 26" />
      </g>

      <g transform={`rotate(${variant === 0 ? -32 : -20} 200 220)`}>
        <path
          d="M96 244 168 156"
          stroke="var(--artwork-sun)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="168" cy="156" r="5" fill="var(--artwork-accent)" />
      </g>
      <g transform={`rotate(${variant === 0 ? 32 : 20} 200 220)`}>
        <path
          d="M304 244 232 156"
          stroke="var(--artwork-sun)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="232" cy="156" r="5" fill="var(--artwork-accent)" />
      </g>

      <g stroke="var(--artwork-sun)" strokeWidth="1.2" opacity="0.55" fill="none">
        <path d="M84 150c-8 12-8 26 0 38M316 150c8 12 8 26 0 38" />
        <path d="M68 136c-12 18-12 38 0 56M332 136c12 18 12 38 0 56" />
      </g>

      <g fill="var(--artwork-accent)">
        <circle cx="86" cy="88" r="2.4" />
        <circle cx="316" cy="98" r="2" />
        <circle cx="74" cy="220" r="2" />
        <circle cx="326" cy="214" r="2.6" />
      </g>
    </g>
  );
}
