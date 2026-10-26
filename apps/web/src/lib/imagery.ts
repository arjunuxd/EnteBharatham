import type { HeritageType } from '@entebharatham/shared';

/**
 * Visual configuration for archive artwork.
 *
 * EnteBharatham does not ship stock photography of communities. Until an
 * editorial image collection is licensed and documented, story imagery is
 * original vector artwork generated from a small, maintainable set of motifs
 * and archive palettes drawn from indigo, marigold, coral, and midnight.
 * Nothing here claims to depict a specific real community, person, or event.
 */

export interface ArtworkPalette {
  paper: string;
  wash: string;
  arch: string;
  hill: string;
  water: string;
  sun: string;
  accent: string;
  deep: string;
  mid: string;
}

export const ARTWORK_PALETTES: readonly ArtworkPalette[] = [
  {
    paper: '#EEF0FB',
    wash: '#E0E3F7',
    arch: '#312E81',
    hill: '#A5B4FC',
    water: '#E8EAF9',
    sun: '#F5B942',
    accent: '#FB7358',
    deep: '#1E1B4B',
    mid: '#6366F1',
  },
  {
    paper: '#FFF0E8',
    wash: '#FFE0D2',
    arch: '#9A3412',
    hill: '#FDBA9B',
    water: '#FFF4EC',
    sun: '#F5B942',
    accent: '#4F46E5',
    deep: '#7C2D12',
    mid: '#F97356',
  },
  {
    paper: '#FFF7E4',
    wash: '#FFEBC2',
    arch: '#4B3A12',
    hill: '#F3CC7A',
    water: '#FFF8E8',
    sun: '#E89B1C',
    accent: '#4F46E5',
    deep: '#2A2109',
    mid: '#C08C2C',
  },
  {
    paper: '#EEF2FA',
    wash: '#DFE6F5',
    arch: '#334155',
    hill: '#B7C4DA',
    water: '#E3EBF5',
    sun: '#F3B94C',
    accent: '#E2604A',
    deep: '#1E293B',
    mid: '#64748B',
  },
];

export type ArtworkMotif =
  'lamp' | 'hearth' | 'song' | 'recipe' | 'craft' | 'manuscript' | 'kolam' | 'landscape' | 'drum';

/** The motif used when a heritage type has no variant pool of its own. */
export const ARTWORK_BY_TYPE: Record<HeritageType, ArtworkMotif> = {
  folk_story: 'lamp',
  oral_history: 'landscape',
  song: 'song',
  recipe: 'recipe',
  dialect: 'manuscript',
  proverb: 'manuscript',
  custom: 'kolam',
  craft: 'craft',
  other: 'drum',
};

/**
 * Folk stories are the archive's broadest category, so a single lamp scene
 * made every story card look alike. Seeds rotate through three related
 * scenes instead: a remembered landscape, a hearth, and a lamp in an
 * archway. The order is deliberate — it keeps the homepage's "archive
 * doorway" hero on the lamp, its featured folk-story tile on the hearth, and
 * its newest record on the landscape.
 */
export const ARTWORK_VARIANTS: Partial<Record<HeritageType, readonly ArtworkMotif[]>> = {
  folk_story: ['landscape', 'hearth', 'lamp'],
};

/** Some scenes sit inside a dark frame; others are printed on light paper. */
export const ARTWORK_BACKGROUND: Record<ArtworkMotif, 'deep' | 'paper'> = {
  lamp: 'deep',
  hearth: 'deep',
  landscape: 'paper',
  song: 'deep',
  recipe: 'paper',
  craft: 'deep',
  manuscript: 'paper',
  kolam: 'deep',
  drum: 'deep',
};

/** Descriptions follow the motif, not the heritage type, so they stay true. */
export const ARTWORK_MOTIF_LABELS: Record<ArtworkMotif, string> = {
  lamp: 'Original illustration of a lamp glowing inside an archway',
  hearth: 'Original illustration of a cooking pot over a hearth fire',
  landscape: 'Original illustration of layered hills, a river, and a remembered path',
  song: 'Original illustration of a stringed instrument and sound rings',
  recipe: 'Original illustration of shared bowls, steam, and a woven table',
  manuscript: 'Original illustration of written language on an open manuscript',
  kolam: 'Original illustration of a kolam pattern and festival lights',
  craft: 'Original illustration of a loom and woven geometry',
  drum: 'Original illustration of a drum and festival pennants',
};

/**
 * Approved editorial imagery can be attached to a record by its stable seed
 * (usually the record slug). Entries are intentionally empty until a licensed,
 * documented image has been cleared for use.
 *
 * Required fields make provenance explicit at the point of configuration:
 * every photograph needs an alt description, a named source, and a licence.
 * When an entry is absent — or its file fails to load — HeritageArtwork falls
 * back to the original vector illustration. See docs/imagery.md.
 */
export interface ApprovedImagery {
  /** Public path or absolute URL of the approved image. */
  src: string;
  /** Meaningful description for assistive technology. */
  alt: string;
  /** Photographer, illustrator, archive, or community credit. */
  credit: string;
  /** Licence or permission statement, e.g. "CC BY-SA 4.0". */
  license: string;
  /** Link to the source or licence record. */
  sourceUrl?: string;
}

export const APPROVED_IMAGERY: Readonly<Record<string, ApprovedImagery>> = {};

export function approvedImageryFor(seed: string): ApprovedImagery | undefined {
  return APPROVED_IMAGERY[seed];
}

/** Small deterministic hash so a record always receives the same artwork. */
export function artworkSeed(seed: string): number {
  let value = 0;
  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return value;
}

export function artworkFor(
  seed: string,
  heritageType: HeritageType,
): {
  palette: ArtworkPalette;
  motif: ArtworkMotif;
  background: 'deep' | 'paper';
  variant: number;
} {
  const hash = artworkSeed(seed);
  const variants = ARTWORK_VARIANTS[heritageType];
  const motif =
    variants !== undefined && variants.length > 0
      ? (variants[hash % variants.length] ?? variants[0]!)
      : (ARTWORK_BY_TYPE[heritageType] ?? 'landscape');
  return {
    palette: ARTWORK_PALETTES[hash % ARTWORK_PALETTES.length] ?? ARTWORK_PALETTES[0]!,
    motif,
    background: ARTWORK_BACKGROUND[motif],
    /* Offset the internal variation so a motif does not always render with
       the same tilt, flame position, or weave pattern. */
    variant: Math.floor(hash / 3) % 3,
  };
}
