# Database Models

Mongoose models live here. Phase 2 adds `HeritageRecord.ts` — one extensible
document per cultural-heritage record (title, slug, summary, content,
heritage type, languages, region, community, contributors, sources, tags,
lifecycle status, visibility, consent, content license, and timestamps).

Conventions, per `docs/CONTENT-GOVERNANCE.md` and `docs/ARCHITECTURE.md`:

- Public API responses are built by explicit mappers
  (`services/heritage.mapper.ts`) — never by spreading raw documents. Internal
  fields (`consent.basis`, source `notes`, license `notes`, non-public
  contributors, `_id`, `__v`) are never serialized.
- Schema-level validation is present in addition to Zod request validation —
  required fields, enums, and array/nested-document limits.
- Unicode-safe string fields (Malayalam and other Indian scripts round-trip
  cleanly; `trim` is applied, nothing is ASCII-normalized).
- Consent is explicit: `permissionToPublish` is required and defaults to
  `false`; a missing value is never treated as consent.
- Public eligibility (`published` + `public` + consent) is enforced in query
  filters, not in application-layer post-filtering.
- Indexes exist only for measured query patterns: the public-listing
  eligibility/sort patterns, type/language/tag filters, and a text index on
  `title`/`summary`.

Future models (users, contributions, consent records, media, moderation
records) must follow the same conventions.
