# Project Update — EnteBharatham

**Last updated:** 26 October 2026

**Project:** EnteBharatham (Ente Bharatham / My India) — India's Living Heritage Archive

**Current stage:** Core platform feature-complete; pre-production hardening and deployment
verification.

**Latest verification:** All quality gates pass. The API suite has **227 tests across 17 files**,
the web suite has **106 tests across 12 files**, the production build succeeds, and `npm audit`
reports **0 advisories**. Details are in [Validation evidence](#7-validation-evidence).

---

## 1. Executive summary

EnteBharatham is a community-powered cultural heritage archive for India's living traditions. It
combines a public discovery experience with a complete contributor → moderation → publication →
withdrawal workflow. The platform is built as an npm-workspace monorepo with a React/Vite frontend,
an Express/MongoDB API, and a shared TypeScript package.

The core product is implemented: public exploration and record pages, accounts and session security,
contributor drafts with media and consent/rights metadata, quality and duplicate checks, moderator
review, governance (reports, corrections, withdrawals, translations), audit logging, search and
discovery, a sitemap, and an installable PWA.

The project is **not yet deployed to production**. Remaining work is primarily integration
verification against real MongoDB Atlas, S3-compatible storage, and SMTP credentials; operational
setup (monitoring, backups, load testing); accessibility validation with assistive technology; and
release-housekeeping such as the initial commit, a deployment guide, and documentation refreshes.

---

## 2. Current status at a glance

| Area                                | Status      | Notes                                                                      |
| ----------------------------------- | ----------- | -------------------------------------------------------------------------- |
| Public archive and record pages     | Done        | Search, filters, regions, languages, related records, profiles             |
| Accounts and authentication         | Done        | Register, login, logout, sessions, CSRF, verification, password reset      |
| Contributor workspace               | Done        | Drafts, media, quality checks, duplicates, feedback, submission            |
| Contributor deletion and withdrawal | Done        | Latest feature; server-enforced ownership and lifecycle rules              |
| Moderation                          | Done        | Queue, submission detail, approve/reject/request changes, own-record guard |
| Governance                          | Done        | Reports, corrections, withdrawals, translations, audit trail               |
| Media pipeline                      | Done        | Local and S3 adapters; live production storage verification pending        |
| Search, discovery, SEO, PWA         | Done        | Suggestions, facets, related records, sitemap, robots, offline shell       |
| Security controls                   | Implemented | Staging verification and operational hardening still required              |
| Automated quality gates             | Passing     | Format, lint, typecheck, tests, build, dependency audit                    |
| CI workflows                        | Configured  | First GitHub Actions run still pending                                     |
| Production deployment               | Not started | Render and Vercel configuration exists; no live deployment                 |
| Monitoring, backups, alerting       | Pending     | To be configured at the hosting/database layer                             |
| Real content operations             | Pending     | Consent verification, moderator staffing, editorial runbook                |
| Deployment documentation            | Pending     | `docs/DEPLOYMENT.md` is referenced but not yet written                     |
| Initial git commit and push         | Pending     | Working tree currently has no commit history                               |

---

## 3. What the project is

### Mission

Preserve and share India's living cultural heritage — folk stories, oral histories, songs, proverbs,
recipes, dialects, festivals, crafts, and other traditions — through a community-contributed,
consent-aware, publicly accessible archive.

### Audiences

- **Readers and researchers** exploring India's cultural heritage.
- **Contributors** documenting traditions with proper attribution and consent.
- **Moderators and administrators** reviewing submissions and handling governance requests.
- **Communities and rights holders** who need a clear path to correct, restrict, or withdraw content.

### Operating principles

- Consent and permission to publish are required before public display.
- The server, not the browser, decides authentication, ownership, roles, and record status.
- Published records are removed through an auditable withdrawal workflow rather than silent
  deletion.
- Corrections are suggestions limited to descriptive fields; consent, rights, and visibility are not
  changed through corrections.
- Every consequential action is recorded in an append-only audit trail.
- Public pages show only records that are published, public, and explicitly consented.

---

## 4. Feature inventory

### 4.1 Public archive — complete

- Home page with curated entry points and recently published heritage records.
- Explore page with text search, heritage-type/category filters, pagination, and result states.
- Regional discovery pages and language discovery pages.
- Record detail pages with summary, long-form content, media, provenance, sources, attribution,
  consent and rights information, and related records.
- Public contributor profiles, enabled per user.
- Share actions, reading progress, search combobox, and command palette.
- Sitemap and `robots.txt` generated by the API.
- PWA manifest, app icons, offline shell, install prompt, update prompt, and offline status banner.
- Friendly loading, empty, error, and not-found states; no technical error text shown to visitors.

### 4.2 Accounts and authentication — complete

- Registration with strict server-side validation.
- Login, logout, and current-session lookup.
- MongoDB-backed sessions; the session ID is regenerated at login and registration.
- CSRF synchronizer tokens with a single transparent retry after a stale token.
- Brute-force protection and account-recovery rate limits.
- Email verification and password reset with single-use, expiring tokens.
- Password reset invalidates older credentials.
- Profile editing limited to the caller's own account.
- Public profile visibility controlled by the account owner.
- Generic authentication errors avoid account enumeration.
- **Recent fix:** session-store callbacks pass `null` on success. Registration and login now treat
  only truthy values as errors, so successful session creation is no longer reported as a failure.

### 4.3 Contributor workspace — complete

- Personal dashboard with status filter, pagination, quality summaries, and draft creation.
- Draft editor for metadata, cultural content, languages, region, consent, licensing, sources,
  provenance, and media.
- Media upload for images, audio, and documents with server-side validation and size/count limits.
- Server-computed quality findings (blockers, warnings, informational items) before submission.
- Advisory duplicate-record candidates.
- Submission for review and resubmission after changes are requested.
- Moderator feedback threads visible to the record owner.
- Read-only views for records that are no longer editable.
- **Delete** for `draft`, `changes_requested`, `pending_review`, and `rejected` records, with a
  confirmation dialog and permanent media cleanup.
- **Request withdrawal** for published records, routed through the governance workflow.

### 4.4 Moderation — complete

- Review queue for submitted records.
- Submission detail with content, metadata, quality findings, duplicates, provenance, and feedback.
- Approve, reject, or request changes with an auditable decision.
- Moderators cannot review their own submissions.
- Publication requires consent, rights, provenance, and no blocking quality findings.
- Audit log page for moderators and administrators.
- Role-based route guards on the web and authoritative role checks on the API.

### 4.5 Governance — complete

- Community reports with moderator resolution.
- Correction proposals limited to whitelisted descriptive fields, with moderator review.
- Contributor, community, and moderator-initiated withdrawal requests.
- Withdrawal actions can restrict or unpublish records or remove media.
- **New guard:** duplicate open contributor withdrawal requests for the same record return
  `409 WITHDRAWAL_EXISTS` instead of flooding the moderation queue.
- Translation records for publicly eligible parent records, with owner/moderator authorization.
- All governance decisions write audit events.

### 4.6 Media — complete, production verification pending

- Local filesystem adapter for development and tests.
- Private S3-compatible adapter for production, with signed-access support.
- Server-side file type and size verification; no client-controlled storage keys.
- Authorized delivery: public only for eligible published records; owners and moderators may access
  draft media; withdrawn or restricted media is denied immediately.
- Media rows and stored objects are cleaned up when a record is deleted.
- Withdrawn media is removed or restricted through the governance flow.
- **Pending:** exercise the S3 adapter and signed URLs against a real bucket.

### 4.7 Search, discovery, and SEO — complete

- MongoDB-backed text search with bounded queries and timeouts.
- Search suggestions and facets.
- Discovery facets for heritage type, region, and language.
- Related-record recommendations.
- Public-only filtering across listings, search, suggestions, related records, profiles, media, and
  the sitemap.
- Short-lived in-process public caches invalidated by consequential actions.
- Cache headers that prevent browsers or intermediaries from retaining private or withdrawn content.
- Sitemap and crawler rules.

### 4.8 Accessibility and design — implemented, formal audit pending

- Semantic landmarks and headings.
- Labelled form fields, error associations, and live-region announcements.
- Keyboard-accessible dialogs with focus trapping and focus restoration.
- Visible focus styles and reduced-motion support.
- Responsive layouts for mobile and desktop.
- Palette: indigo, coral, midnight, and marigold, with cloud-white and archival-cream surfaces.
- **Pending:** manual screen-reader and keyboard audit across all major flows.

### 4.9 Security — implemented, staging verification pending

- Server-authoritative authentication, roles, ownership, and lifecycle transitions.
- Public eligibility filter enforced at the database query boundary.
- Ownership included in every contributor filter, including deletion and withdrawal requests.
- Strict Zod schemas reject privileged fields such as `role`, `accountStatus`, `createdBy`, and
  `status`.
- CSRF protection on state-changing requests.
- Separate rate limiters for authentication, drafts, submissions, moderation, reports, uploads,
  account recovery, and public reads.
- Helmet security headers, strict CORS, and a production Content Security Policy.
- Central error handler that never returns stack traces, driver messages, filesystem paths, or
  secrets.
- Append-only audit trail for accountability.
- Production configuration fails closed for weak session secrets, local storage, in-memory rate
  limiting, non-SMTP email, and non-HTTPS application URLs.
- **Pending:** verify real-domain cookies, CORS, rate limiting, email, storage, and proxy behavior.

### 4.10 Operations and CI — configured, first run pending

- GitHub Actions quality workflow: formatting, lint, typecheck, tests, production build, dependency
  audit.
- Scheduled security workflow: weekly dependency audit and CodeQL analysis.
- Dependabot configuration for dependency updates.
- Render blueprint for the API and Vercel configuration for the web app.
- Health and readiness endpoints.
- Database index-sync script and optional seed/admin-bootstrap scripts.
- **Pending:** first CI run, monitoring/alerting, backups, and deployment runbook.

---

## 5. Architecture and data model

### Monorepo

| Path                   | Responsibility                                                                |
| ---------------------- | ----------------------------------------------------------------------------- |
| `apps/api`             | Express 5 API, MongoDB models, services, validation, media, email, governance |
| `apps/web`             | React 18 SPA, Vite, Tailwind CSS, PWA assets, accessibility-focused UI        |
| `packages/shared`      | Shared TypeScript types, constants, and domain contracts                      |
| `docs`                 | Architecture, security, governance, testing, imagery, contribution notes      |
| `.github`              | CI, security scanning, and Dependabot configuration                           |
| `render.yaml`          | Render blueprint for the API                                                  |
| `apps/web/vercel.json` | Vercel build, SPA routing, headers, and caching                               |

### Request flow

```text
Route → Zod validation → Controller → Service → Mongoose model → MongoDB
                                  │
                                  ├── Audit event
                                  ├── Public cache invalidation
                                  └── Media/email/storage side effects
```

### Core data collections

| Collection             | Purpose                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `User`                 | Accounts, roles, account status, profile visibility, email verification state |
| `HeritageRecord`       | Cultural records, metadata, consent, rights, provenance, status, visibility   |
| `HeritageMedia`        | Uploaded media metadata, storage keys, lifecycle state                        |
| `ReviewFeedback`       | Contributor-facing feedback threads                                           |
| `CommunityReport`      | Reports submitted by users                                                    |
| `CorrectionProposal`   | Whitelisted correction suggestions and review state                           |
| `WithdrawalRequest`    | Contributor, community, and moderator withdrawal requests                     |
| `Translation`          | Translation records linked to eligible heritage records                       |
| `AuditEvent`           | Append-only accountability trail                                              |
| `Token`                | Email-verification and password-reset tokens                                  |
| Sessions / rate limits | MongoDB-backed session store and shared rate-limit counters                   |

### Record lifecycle

```text
draft ──submit──▶ pending_review ──approve──▶ published
  ▲                    │                          │
  │                    ├──request changes──▶ changes_requested
  │                    │                          │
  │                    └──reject──▶ rejected      │
  │                                               │
  └──────────── edit / resubmit ◀─────────────────┘
                                                  │
                                    withdrawal ───┴──▶ restricted / unpublished / removed
```

- Owners may edit `draft` and `changes_requested` records.
- Owners may submit from `draft` or `changes_requested`.
- Owners may delete `draft`, `changes_requested`, `pending_review`, and `rejected` records.
- Published records cannot be hard-deleted by contributors; they go through withdrawal governance.
- Moderators and administrators make review and governance decisions; the server enforces the same
  rules the UI presents.

---

## 6. Latest updates — 26 October 2026

### 6.1 Registration and sign-in fixed

**Problem:** Successful registrations and logins could be reported as failures because the
MongoDB session-store callback passes `null` on success, and the controller treated any non-`undefined`
value as an error.

**Fix:** `apps/api/src/controllers/auth.controller.ts` now treats only truthy callback values as
errors. `apps/api/tests/helpers/testApp.ts` mirrors the real `connect-mongo` callback semantics so
the regression cannot silently return.

**Verified:** registration, login, `/auth/me`, and logout work end to end. Temporary test accounts,
stale sessions, and test audit events were removed after verification.

### 6.2 Contributor deletion and withdrawal controls

**Server**

- Added `DELETE /api/v1/heritage/:id`.
- Ownership and deletable status are part of the atomic database delete, preventing a concurrent
  review approval from being bypassed.
- Deletable statuses: `draft`, `changes_requested`, `pending_review`, `rejected`.
- Published records return `409 WITHDRAWAL_REQUIRED` and are directed to the withdrawal flow.
- Deletion removes attached media rows and best-effort deletes stored objects.
- Each deletion writes a `record.deleted` audit event and invalidates public caches.
- Added `deleteRecordMedia` to the media service.
- Passed the storage adapter through the heritage routes so production cleanup uses the configured
  adapter.

**Web**

- New shared `RecordRemovalActions` component with accessible confirmation dialogs.
- Dashboard records support **Delete** for unpublished states and **Request withdrawal** for
  published records.
- Draft editor includes a matching removal section and returns to the dashboard after deletion.
- Published records remain read-only and offer only the withdrawal request path.
- Friendly error handling for `WITHDRAWAL_REQUIRED`, missing records, status changes, duplicate
  requests, permission errors, and rate limits.
- Success announcements are exposed to assistive technology.

**Governance**

- Duplicate open contributor withdrawal requests for the same record are rejected with
  `409 WITHDRAWAL_EXISTS`.
- Audit-log labels include `record.deleted`.

**Tests**

- API tests cover owner deletion, all deletable statuses, media-row cleanup, cross-owner access,
  published-record refusal, anonymous access, malformed IDs, and duplicate withdrawal requests.
- Web tests cover dashboard deletion, published-record withdrawal, editor deletion, and
  published-record read-only behavior.

### 6.3 Documentation and repository hygiene

- Rewrote `README.md` with the current product description, stack, setup, scripts, API surface,
  security rules, governance principles, deployment notes, and documentation links.
- Added this `projectupdate.md`.
- Audited environment handling: real `.env` files are ignored; only `.env.example` templates are
  committed; no environment files or secret values appear in build output.
- Added `/audit.json` to `.gitignore` so local dependency-audit output is not published accidentally.
- Re-ran formatting, lint, typecheck, full test suites, production build, and dependency audit.

---

## 7. Validation evidence

Verified on 26 October 2026 from a clean local run:

| Check            | Command                              | Result                           |
| ---------------- | ------------------------------------ | -------------------------------- |
| Formatting       | `npm run format:check`               | Passing                          |
| Lint             | `npm run lint`                       | Passing                          |
| API tests        | `npm run test -w @entebharatham/api` | **227 passed**, 17 files         |
| Web tests        | `npm run test -w @entebharatham/web` | **106 passed**, 12 files         |
| Typecheck        | `npm run typecheck`                  | Passing                          |
| Production build | `npm run build`                      | Passing for shared, API, and web |
| Dependency audit | `npm audit`                          | **0 advisories** at any severity |

Earlier recorded baseline: Phase 9 reported 216 API tests and 93 web tests. The suites have grown to
227 and 106 respectively with the authentication fix and removal-control coverage.

---

## 8. Current local development setup

| Item                 | Current state                                                                     |
| -------------------- | --------------------------------------------------------------------------------- |
| Node.js              | v24.18.0                                                                          |
| npm                  | 9.6.1                                                                             |
| API URL              | `http://localhost:4000`                                                           |
| Web URL              | `http://localhost:5173`                                                           |
| Database             | Local MongoDB via the default development URI                                     |
| Email                | Development console transport; verification/reset links print in the API terminal |
| Media storage        | Local filesystem; uploads directory is Git-ignored                                |
| Sessions             | MongoDB-backed                                                                    |
| SMTP credentials     | Not configured locally                                                            |
| S3 credentials       | Not configured locally                                                            |
| Local session secret | Custom strong value, not the example default                                      |
| Environment files    | Present locally and ignored by Git                                                |
| Version control      | Working tree has no commit history yet; files are untracked                       |

The local setup was verified with a successful API health check and web smoke test. No production
credentials are stored in the repository.

---

## 9. Security and secret-hygiene audit

### Verified protections

| Check                                                | Result                                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Real `.env` files ignored by Git                     | **Pass** — `git check-ignore` confirms `apps/api/.env` and `apps/web/.env`                     |
| Only templates kept for version control              | **Pass** — `.env.example` files contain placeholders and development defaults only             |
| `.env.*` coverage                                    | **Pass** — `.gitignore` excludes `.env` and `.env.*`, with `.env.example` allowed              |
| High-confidence secret patterns in source/docs/tests | **Pass** — no real keys found; matches were clearly fake test fixtures and validation messages |
| Assigned secrets outside `.env` files                | **Pass** — only environment-variable names and validation text                                 |
| `.env` files in production build output              | **Pass** — none found in `apps/api/dist` or `apps/web/dist`                                    |
| Local secret values in build output                  | **Pass** — checked session secret and MongoDB URI; not present in either build                 |
| Render blueprint credentials                         | **Pass** — secrets use `sync: false` or platform-generated values; nothing hard-coded          |
| GitHub Actions credentials                           | **Pass** — workflows reference no repository secrets and contain no credentials                |
| Dependency audit                                     | **Pass** — 0 advisories                                                                        |
| Local audit artifact                                 | **Addressed** — `/audit.json` is now Git-ignored                                               |
| Local phase report                                   | **Already ignored** — `phase.md` remains untracked/ignored                                     |

### Rules for contributors and operators

- Never commit `.env`, `.env.local`, `.env.production`, keys, tokens, certificates, or passwords.
- Never put secrets behind `VITE_*` variables — those values are bundled into public JavaScript.
- Use a unique production `SESSION_SECRET` of at least 32 characters; the example default is
  rejected in production.
- Store SMTP and S3 credentials in the hosting platform's secret manager.
- Rotate credentials after any suspected exposure and invalidate sessions when rotating the session
  secret.
- Report exploitable vulnerabilities privately to the maintainers; do not open a public issue.
- Do not paste secrets, session IDs, or personal data into issues, pull requests, screenshots, or
  logs.

---

## 10. Pending work and known limitations

### Priority 0 — before the first push or public sharing

- [ ] Review the initial commit contents and confirm `.env` files, `uploads/`, `phase.md`, and
      `audit.json` remain untracked.
- [ ] Rotate any credential that has ever been shared outside its intended environment.
- [ ] Decide the repository's visibility and confirm the proprietary license expectations.
- [ ] Create the initial commit and push to the chosen remote. This has intentionally not been done
      yet; the working tree currently has no commit history.
- [ ] Confirm no real cultural content, personal data, or test-account credentials are present in
      fixtures or screenshots.

### Priority 1 — before production launch

- [ ] Provision a staging environment with MongoDB Atlas, a private S3-compatible bucket, and an
      SMTP provider.
- [ ] Verify registration, email verification, password reset, and login against real email
      delivery.
- [ ] Verify media upload, validation, delivery, signed access, withdrawal, and deletion against the
      real bucket.
- [ ] Verify cross-domain session cookies, CORS, CSRF, and secure-cookie behavior on the production
      domains.
- [ ] Run `npm run db:indexes -w @entebharatham/api` against every new environment.
- [ ] Verify the MongoDB-backed rate-limit store and session store under multiple API instances.
- [ ] Run the access-control checklist and load-testing scenarios in `docs/SECURITY-TESTING.md`.
- [ ] Configure database backups, point-in-time recovery where available, and a restore drill.
- [ ] Configure uptime monitoring against `/api/v1/health/ready`, error tracking, and alerting.
- [ ] Tighten the production Content Security Policy: remove the development
      `http://localhost:4000` connect source and narrow `https:` image/media allowances where
      practical.
- [ ] Write `docs/DEPLOYMENT.md`; `render.yaml` already references this missing guide.
- [ ] Verify sitemap, `robots.txt`, canonical URLs, and social preview metadata on the real domain.
- [ ] Define the email-verification policy. Accounts can currently sign in without verification;
      decide whether production should require a verified address for contribution or moderation
      actions.
- [ ] Publish a private security-reporting channel and document it in `docs/SECURITY.md`; the
      current guide covers security controls but not a reporting contact.
- [ ] Document an incident-response and credential-rotation runbook.

### Priority 2 — quality, content, and operations

- [ ] Manual accessibility audit with keyboard-only navigation and at least one screen reader
      across public, contributor, and moderation flows.
- [ ] Cross-browser and mobile QA, including PWA installation and offline behavior.
- [ ] Update `docs/CONTRIBUTING.md`: it still says content contribution flows do not exist, uses
      the wrong workspace casing (`@enteBharatham` rather than `@entebharatham`), and should point
      to the published private security-reporting channel.
- [ ] Update `docs/ARCHITECTURE.md` phase notes so they reflect the current implementation and test
      counts.
- [ ] Create a moderator/administrator runbook covering review standards, governance decisions, and
      escalation paths.
- [ ] Define retention and deletion policies for audit events, withdrawn records, media, and
      account data.
- [ ] Plan content operations: seed vs. real records, consent verification, attribution checks,
      community outreach, and translation review.
- [ ] Add performance benchmarking for search, facets, record detail, and authenticated dashboard
      queries.
- [ ] Keep dependencies current through Dependabot and the scheduled security workflow.

---

## 11. Suggested next sequence

1. **Publish safely:** complete the Priority 0 review, create the initial commit, and push.
2. **Document deployment:** write `docs/DEPLOYMENT.md` and refresh `docs/CONTRIBUTING.md`.
3. **Stand up staging:** connect real MongoDB Atlas, S3-compatible storage, and SMTP.
4. **Verify end to end:** registration → verification → draft → media → submit → moderate →
   publish → withdraw, including password reset and deletion.
5. **Harden operations:** backups, monitoring, rate-limit/session store verification, load tests, and
   CSP tightening.
6. **Validate accessibility and content operations:** assistive-technology audit, moderator
   runbook, consent/attribution review.
7. **Launch:** production smoke test, health checks, sitemap submission, and a monitored rollout.

---

## 12. How to reproduce the current checks

```bash
npm install
npm run build -w @entebharatham/shared

npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run audit:deps
```

For local development:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm run dev:api   # terminal 1
npm run dev:web   # terminal 2
```

Never commit the resulting `.env` files. Full setup instructions are in [README.md](README.md).

---

## 13. Ownership and licensing

EnteBharatham is proprietary software. Unauthorized copying, redistribution, modification, or
commercial exploitation is prohibited. See [LICENSE](LICENSE) for the full terms.

Cultural content and contributor rights are governed separately by the platform's content
governance policies. The software license does not grant rights to community cultural content, and
real cultural stories, recordings, or fabricated sources should not be added to the codebase,
tests, or fixtures.
