# Editorial imagery

EnteBharatham does not use generic stock photography to represent communities. Until an image has a clear licence, documented source, and community-appropriate context, story imagery is the original vector artwork in `apps/web/src/components/HeritageArtwork.tsx`.

## Adding an approved image

1. Confirm the licence permits use on the public archive and that the image does not expose a person or community without consent.
2. Place the optimised file under `apps/web/public/images/` (or use a stable absolute URL).
3. Add an entry to `APPROVED_IMAGERY` in `apps/web/src/lib/imagery.ts`, keyed by the record slug used as its `seed`.
4. Provide a meaningful `alt` description, a named `credit`, a `license` statement, and a `sourceUrl` when one exists.
5. Check the image at card, wide, portrait, and square crops. Focal points should remain legible when the artwork frame crops the image.

```ts
export const APPROVED_IMAGERY: Readonly<Record<string, ApprovedImagery>> = {
  'example-record-slug': {
    src: '/images/example-record-slug.jpg',
    alt: 'Description of what the photograph actually shows.',
    credit: 'Photographer or community archive',
    license: 'CC BY-SA 4.0',
    sourceUrl: 'https://example.org/source-record',
  },
};
```

`HeritageArtwork` displays the credit and licence over the image, and falls back to the original vector illustration if the file is missing or fails to load. Do not add invented credits, approximate licences, or images presented as a specific tradition when their provenance is unknown.
