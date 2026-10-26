# Security

EnteBharatham treats the server as the single source of truth for authentication
and authorization. Public surfaces expose only explicitly eligible published
records, and destructive or visibility-changing actions are restricted to
authorized roles and recorded in an append-only audit log.

## Authentication and sessions

- Passwords are hashed with bcrypt (cost 10). Login failures are generic to
  prevent account enumeration; a dummy hash equalizes timing for unknown emails.
- Sessions are stored in MongoDB via `connect-mongo`, never silently in process
  memory in production. `SameSite=None` requires `Secure`, enforced by
  configuration validation.
- The session id is regenerated on login and registration. Suspended or deleted
  accounts are rejected on every request through a live-account lookup.
- CSRF protection uses synchronizer tokens. State-changing requests send the
  token in `x-csrf-token`; the client retries exactly once after refreshing a
  stale token. Safe methods are exempt, and CORS alone is never treated as CSRF
  protection.
- Session and authentication responses are sent with `Cache-Control: no-store`.

## Authorization and ownership

- Roles (`contributor`, `moderator`, `admin`) and account status come from the
  database, never from client input. Strict schemas reject privileged keys such
  as `role`, `accountStatus`, `createdBy`, and `status`.
- All state-changing routes are protected server-side; frontend route guards are
  UX only.
- Ownership is part of every database filter for drafts, media, feedback, and
  contributor withdrawal requests. Ownership checks fail closed: a record with
  no recorded owner cannot be withdrawn by an ordinary contributor.
- Moderators and admins use dedicated review and governance endpoints. A
  moderator cannot review their own submission.

## Public privacy

- Public eligibility is enforced at the query boundary:
  `status: 'published'`, `visibility: 'public'`, and
  `consent.permissionToPublish: true`.
- Private, draft, pending, restricted, and consent-less records are excluded from
  listings, search, suggestions, related records, public profiles, media
  delivery, and the sitemap.
- A public profile requires `publicProfileEnabled: true` **and** an `active`
  account, so a suspended account disappears immediately even if its profile
  flag was previously enabled.
- Public read caches are in-process, bounded, and short-lived. Any audited
  action that can change visibility clears them, so approvals and withdrawals
  take effect on the next request rather than at the next TTL expiry.
- Public list and detail responses use `Cache-Control: public, no-cache` so a
  browser revalidates instead of retaining withdrawn content. Media remains
  `private, no-store` because revocation must be immediate.

## Input validation and errors

- Request bodies, queries, and path identifiers are validated with Zod. Write
  schemas are `.strict()` (unknown keys are rejected), ObjectIds are validated
  before use, and stored URLs must use `http:` or `https:`.
- Mongoose queries are built from fixed keys and validated scalar values; no
  client-supplied operators reach a query. Text searches are bounded and carry
  query timeouts.
- Malformed ObjectIds, Mongoose cast/validation errors, invalid JSON, oversized
  bodies, and upload errors (`MulterError`, including file-size limits) map to
  safe 4xx responses with plain-language messages.
- The central error handler never returns stack traces, driver messages, or
  internal descriptions. Unexpected 5xx responses include a request reference
  that support can use without exposing the underlying error.
- CORS is strict and production rejects wildcard origins.

## Rate limiting

- Authentication, draft creation, submissions, moderation actions, reports,
  media uploads, account recovery, and anonymous public reads each have a
  dedicated limiter. Public reads default to 300 requests per minute per IP.
- Development and tests may use an in-process store. Production requires a
  shared MongoDB-backed store (`RATE_LIMIT_STORE=mongo`); the process fails
  configuration validation otherwise.
- Expired rate-limit counters are reset atomically and removed by a TTL index on
  `resetTime`. A store outage fails closed (HTTP 500), never falls back to an
  unbounded per-process counter.

## HTTP security headers

The web host (see `apps/web/vercel.json`) sends:

- `Content-Security-Policy` with `default-src 'self'`, no framing, no objects,
  same-origin scripts, Google Fonts allowed for styles/fonts, and a narrowly
  scoped `connect-src` for the API.
- `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  a restrictive `Permissions-Policy`, and cross-origin isolation headers.
- `Cache-Control` policies: immutable for hashed build assets, one day for
  icons and the manifest, `no-cache` for the service worker and app shell.

The API uses Helmet, disables `x-powered-by`, and sends
`Cross-Origin-Resource-Policy: cross-origin` only on the authorization-aware
media endpoint so the separately hosted web app can embed it.

## Media and storage

- Uploads are authenticated, rate-limited, size-limited, MIME/signature checked,
  and stored under server-generated opaque keys. Clients cannot choose a path.
- Delivery is authorization-aware: public media is served only while both the
  record and the media item remain publicly eligible. Restricted or withdrawn
  media is denied even through a direct URL.
- Production uses private S3-compatible object storage. Media responses are
  sandboxed and marked `no-store`; signed URLs are short-lived.

## Email and account recovery

- Email verification and password reset use single-use, hashed tokens with
  expiry. Consumption is atomic so a token cannot be used twice.
- Password reset increments a credential version, invalidating older sessions.
- Request endpoints return identical responses whether or not an account exists.
- Production requires authenticated SMTP with certificate validation enabled.

## Database security

- All access goes through Mongoose models with parameterized queries; no raw
  string interpolation is used for user input.
- Public-query indexes include the consent flag, so eligibility is never
  enforced only in application memory.
- MongoDB Atlas should provide encryption at rest and TLS in transit. The
  application requires a remote MongoDB in production and never logs the
  connection string.
- Use a dedicated database user scoped to the application database with
  read/write (not administrative) privileges. Run `npm run db:indexes -w
@entebharatham/api` during deployment.
- MongoDB does not provide native row-level security. Ownership is enforced by
  including the authenticated user id in every owner-scoped query; this design
  choice is covered by integration tests.

## Secrets management

- Secrets come from environment variables and are never committed. `.env` files
  are ignored; only `.env.example` templates are tracked.
- Production rejects the development session secret, short secrets, local
  MongoDB, local storage, memory rate limiting, and non-SMTP email.
- Logs redact credential-bearing URIs, tokens, cookies, authorization headers,
  and passwords.

## Dependency and security automation

- Every push and pull request runs formatting, linting, type checks, the full
  test suite, a production build, and `npm run audit:deps`.
- `.github/workflows/security.yml` runs a scheduled dependency audit and CodeQL
  analysis. Dependabot proposes weekly npm and GitHub Actions updates.
- `npm audit --audit-level=high` currently reports zero vulnerabilities. Treat
  audit output as the source of truth rather than historical advisory notes.

## Security testing

Repository checks are necessary but not sufficient. Before a public launch and
after significant architecture changes, run the operational programme in
[SECURITY-TESTING.md](./SECURITY-TESTING.md): dependency review, authenticated
and anonymous load tests, and an authorized third-party penetration test.
