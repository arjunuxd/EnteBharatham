# EnteBharatham

**Ente Bharatham (My India)** — a community-powered archive for India's living cultural heritage.

EnteBharatham is a public platform for preserving and sharing folk stories, oral histories, songs,
proverbs, recipes, dialects, festivals, crafts, and other living traditions. Community members can
create an account, contribute records with consent and rights information, upload media, and work
with moderators to publish accurate, well-attributed material. Approved records are publicly
discoverable through search, regional and language browsing, and related-record recommendations.

> **Status:** Active development. The core platform is feature-complete and in pre-production
> hardening. Latest verification: **26 October 2026**. See
> [projectupdate.md](projectupdate.md) for the full current status, latest changes, and pending
> work.

---

## What the platform offers

### Public archive

- Explore published records with search, heritage-type filters, region and language browsing, and
  related-record recommendations.
- Read full record pages with media, provenance, sources, attribution, consent status, and rights
  information.
- Browse public contributor profiles and view regional and language discovery pages.
- Shareable record pages, a generated sitemap, and an installable progressive web app (PWA) with an
  offline shell for interrupted connections.

### Contributor workspace

- Register, sign in, verify an email address, recover a password, and manage a public profile.
- Create and edit drafts, upload images, audio, and documents, and run server-side quality checks
  before submission.
- See duplicate-record candidates, read moderator feedback, and resubmit requested changes.
- Track records through `draft`, `pending_review`, `changes_requested`, `published`, and `rejected`
  states from a personal dashboard.
- **Delete** drafts and other unpublished records permanently, including attached media.
- **Request withdrawal** of a published record through the governance workflow so the archive keeps
  an auditable record of the change.

### Moderation and governance

- Review queue with submission detail, quality findings, duplicate candidates, provenance, and
  contributor feedback.
- Approve, reject, or request changes. Moderators cannot review their own submissions.
- Handle community reports, correction proposals, withdrawal requests, and translation records from
  a dedicated governance queue.
- Append-only audit log of registrations, submissions, review decisions, role changes, deletions,
  withdrawals, and other consequential actions.
- Role-based access for contributors, moderators, and administrators.

### Accessibility and design

- Semantic HTML, visible focus states, keyboard-reachable controls, labelled form fields, and
  screen-reader announcements for loading, error, empty, and confirmation states.
- Responsive layouts that respect `prefers-reduced-motion`.
- A contemporary archive palette built around indigo, coral, midnight, and marigold.

---

## Technology stack

| Layer      | Technology                                                                            |
| ---------- | ------------------------------------------------------------------------------------- |
| Monorepo   | npm workspaces, TypeScript strict mode                                                |
| Web        | React 18, Vite 7, React Router 7, Tailwind CSS 4, Lucide icons                        |
| API        | Node.js, Express 5, Mongoose 8, Zod 4                                                 |
| Database   | MongoDB (records, users, sessions, audit events, rate limits)                         |
| Shared     | `@entebharatham/shared` — domain types, constants, and shared contracts               |
| Email      | Development console transport, in-memory test transport, SMTP via Nodemailer          |
| Media      | Local filesystem for development, private S3-compatible object storage for production |
| Testing    | Vitest, Supertest, Testing Library, `mongodb-memory-server`                           |
| CI         | GitHub Actions (quality gates, dependency audit, CodeQL), Dependabot                  |
| Deployment | Render blueprint for the API, Vercel configuration for the web app                    |

---

## Repository layout

```text
EnteBharatham/
├── apps/
│   ├── api/                  Express API, MongoDB models, services, and tests
│   │   ├── src/
│   │   │   ├── config/       Environment validation and database connection
│   │   │   ├── controllers/  HTTP request/response handlers
│   │   │   ├── middleware/   Auth, CSRF, validation, rate limiting, errors
│   │   │   ├── models/       Mongoose schemas
│   │   │   ├── routes/       Versioned API route groups
│   │   │   ├── services/     Business logic, workflow, governance, media, email
│   │   │   ├── validation/   Zod request schemas
│   │   │   └── scripts/      Seed, admin bootstrap, and index sync
│   │   └── tests/            Integration and regression suites
│   └── web/                  React single-page application
│       ├── public/           PWA manifest, icons, and offline shell
│       └── src/
│           ├── components/   Shared UI, dialogs, states, feedback, media
│           ├── context/      Authentication context
│           ├── layouts/      Application shell
│           ├── lib/          Typed API clients and helpers
│           ├── pages/        Public, contributor, account, and moderation screens
│           └── test/         Test setup and API mocks
├── packages/
│   └── shared/               Shared TypeScript types and constants
├── docs/                     Architecture, security, governance, and testing notes
├── .github/                  CI, security workflow, and Dependabot configuration
├── render.yaml               Render blueprint for the API service
└── apps/web/vercel.json      Vercel build, routing, and security headers
```

---

## Architecture at a glance

```text
Browser
   │
   ├── apps/web  (React SPA, Vite, Tailwind)
   │        │  HTTPS · session cookie · CSRF header
   │        ▼
   ├── apps/api  (Express 5)
   │        ├── MongoDB — records, users, sessions, audit, governance
   │        ├── S3-compatible storage — private media objects
   │        └── SMTP — verification and password-reset email
   │
   └── packages/shared  (types, constants, shared contracts)
```

- Requests follow **route → controller → service → model**; request input is validated with Zod
  before it reaches a service.
- The **server is authoritative** for authentication, role, ownership, record lifecycle, and
  visibility. Frontend route guards only shape navigation.
- Public eligibility is enforced in database queries:
  `status: 'published'`, `visibility: 'public'`, and `consent.permissionToPublish: true`.
- Sessions live in MongoDB. State-changing requests use CSRF synchronizer tokens, and rate limits
  are applied per action.
- Published records are withdrawn through governance rather than hard-deleted. Unpublished records
  can be deleted directly by their owner. Both paths write audit events and invalidate public
  caches.
- Media access is authorized through the API before delivery. Production storage is private and uses
  short-lived signed URLs where supported; public, private, and withdrawn states are re-checked on
  every request.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SECURITY.md](docs/SECURITY.md).

---

## Getting started

### Prerequisites

- **Node.js** 20.19 or newer — Node 24 LTS is recommended (the CI workflow uses Node 24)
- **npm** 9 or newer
- **MongoDB** Community Server locally, or a MongoDB Atlas cluster
- Optional: SMTP credentials if you want real email delivery; development mode prints verification
  and password-reset links in the API terminal instead

### Local setup

```bash
git clone https://github.com/arjunuxd/EnteBharatham.git
cd EnteBharatham

npm install

# Copy the example environment files. Never commit the resulting .env files.
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Shared types must be built once before the apps run or typecheck.
npm run build -w @entebharatham/shared

# Optional: load fictional demo fixtures.
npm run seed -w @entebharatham/api

# Terminal 1 — API
npm run dev:api

# Terminal 2 — web app
npm run dev:web
```

On Windows PowerShell, use `Copy-Item apps/api/.env.example apps/api/.env` and
`Copy-Item apps/web/.env.example apps/web/.env` instead of `cp`.

| Service       | URL                                         |
| ------------- | ------------------------------------------- |
| Web app       | <http://localhost:5173>                     |
| API           | <http://localhost:4000>                     |
| API health    | <http://localhost:4000/api/v1/health>       |
| API readiness | <http://localhost:4000/api/v1/health/ready> |

The default development configuration uses a local MongoDB database, the console email transport,
and local media storage under `uploads/` (ignored by Git).

### Optional admin bootstrap

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME`, and optionally `ADMIN_ROLE` in
`apps/api/.env`, then run:

```bash
npm run bootstrap:admin -w @entebharatham/api
```

These variables are read only by the one-time CLI and never by the HTTP server. Use a long, unique
password and never commit the file that contains it.

### First production-style database setup

After pointing the API at a real database, create or verify indexes:

```bash
npm run db:indexes -w @entebharatham/api
```

---

## Environment configuration and secrets

Configuration lives in `apps/api/.env` and `apps/web/.env`. Both real files are ignored by Git;
only the `.env.example` templates are committed.

**Rules that keep the project safe:**

- Never commit a real `.env`, key, token, certificate, or password. `.gitignore` excludes `.env`
  and `.env.*`, with `.env.example` explicitly allowed.
- Treat every `VITE_*` variable as **public**. Vite embeds those values in the browser bundle, so
  never put a secret, private API key, or database credential behind a `VITE_` name.
- Use a unique `SESSION_SECRET` of at least 32 characters in production. The development default in
  `.env.example` is rejected when `NODE_ENV=production`.
- Rotate session secrets and SMTP/S3 credentials if they are ever exposed, and invalidate active
  sessions when rotating the session secret.
- Production configuration is fail-closed: the API refuses to start with a weak or default session
  secret, the local filesystem storage provider, the in-memory rate-limit store, a non-SMTP email
  provider, or a non-HTTPS `APP_BASE_URL`.
- Do not open public issues for exploitable vulnerabilities. Report them privately to the maintainers
  and never include secrets or personal data in the report.

The committed examples cover runtime, database, CORS, session, cookie, rate-limit, media, email,
and optional admin-bootstrap settings. SMTP and S3 credentials belong in the deployment platform's
secret manager, not in the repository.

---

## Available scripts

Run these from the repository root.

| Command                | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev:api`      | Start the API with TypeScript watch mode             |
| `npm run dev:web`      | Start the Vite development server                    |
| `npm run build`        | Build shared types, API, and web app for production  |
| `npm run typecheck`    | Strict TypeScript checks for every workspace         |
| `npm test`             | Build shared types, then run API and web test suites |
| `npm run lint`         | ESLint across the repository                         |
| `npm run format`       | Format with Prettier                                 |
| `npm run format:check` | Verify formatting without writing                    |
| `npm run audit:deps`   | Dependency audit at high and critical severity       |

Workspace-specific commands:

```bash
# API
npm run dev -w @entebharatham/api
npm run build -w @entebharatham/api
npm run start -w @entebharatham/api
npm run seed -w @entebharatham/api
npm run bootstrap:admin -w @entebharatham/api
npm run db:indexes -w @entebharatham/api
npm run test -w @entebharatham/api

# Web
npm run dev -w @entebharatham/web
npm run build -w @entebharatham/web
npm run preview -w @entebharatham/web
npm run test -w @entebharatham/web
```

---

## Testing and quality gates

```bash
npm run format:check   # Prettier
npm run lint           # ESLint
npm run typecheck      # TypeScript strict mode, all workspaces
npm test               # Vitest — API and web suites
npm run build          # Production builds
npm run audit:deps     # npm audit (high+)
```

The API suite uses an isolated in-memory MongoDB, so it does not need a running database. The web
suite uses Vitest with jsdom and Testing Library.

**Latest verified run — 26 October 2026:**

| Gate             | Result                       |
| ---------------- | ---------------------------- |
| API tests        | 227 passing across 17 files  |
| Web tests        | 106 passing across 12 files  |
| Formatting       | Clean                        |
| ESLint           | Clean                        |
| Typecheck        | Clean                        |
| Production build | Passing                      |
| Dependency audit | 0 advisories at any severity |

CI runs the same gates on pushes and pull requests. A separate scheduled workflow runs a weekly
dependency audit and CodeQL analysis. See [docs/SECURITY-TESTING.md](docs/SECURITY-TESTING.md) for
manual access-control, load, and security-testing scenarios.

---

## API surface

API routes are served under `/api/v1`; the sitemap and robots file are served at the site root.
Write requests require an authenticated session and a valid CSRF token; ownership and role checks
are always enforced server-side.

| Group           | Prefix                                                      | Purpose                                                       |
| --------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| Health          | `/health`                                                   | Liveness and readiness probes                                 |
| Authentication  | `/auth`                                                     | CSRF token, register, login, logout, current session          |
| Account         | `/account`                                                  | Email verification and password reset                         |
| Profile         | `/profile`                                                  | Update the signed-in user's profile                           |
| Heritage        | `/heritage`, `/explore`                                     | Public reads, owner list/detail, drafts, submission, deletion |
| Search          | `/search`                                                   | Suggestions and search facets                                 |
| Discovery       | `/discovery`                                                | Facets, regions, languages, related records                   |
| Media           | `/media`                                                    | Authorized upload, listing, delivery, and removal             |
| Moderation      | `/moderation`                                               | Review queue, submission detail, decisions, audit log         |
| Governance      | `/reports`, `/corrections`, `/withdrawals`, `/translations` | Community reports, corrections, withdrawals, translations     |
| Public profiles | `/profiles/:userId`                                         | Opt-in public contributor profiles                            |
| Sitemap         | `/sitemap.xml`, `/robots.txt`                               | Public sitemap and crawler rules                              |

---

## Content governance principles

- Consent and permission to publish are required before a record appears publicly.
- Published records are removed through a withdrawal request and moderator action, not by direct
  contributor deletion. Drafts and other unpublished records may be deleted outright by their
  owner.
- Corrections are limited to whitelisted descriptive fields. Consent, rights, and visibility cannot
  be changed through a correction.
- Duplicate detection is advisory; it never blocks a submission automatically.
- Every moderation and governance action is written to an append-only audit trail.
- Cultural content and contributor rights are governed separately from the software license.

Read more in [docs/CONTENT-GOVERNANCE.md](docs/CONTENT-GOVERNANCE.md).

---

## Deployment

The repository includes deployment configuration for a split frontend/API deployment:

- `render.yaml` defines the API web service, health check, build command, and production environment
  variable **names** (secrets are marked for manual entry or generated by the platform).
- `apps/web/vercel.json` defines the Vercel build, SPA rewrites, caching, and security headers.

Production requirements:

- A managed MongoDB database (for example, MongoDB Atlas) with backups enabled.
- A private S3-compatible bucket for media.
- An SMTP provider for verification and password-reset email.
- A shared MongoDB-backed rate-limit store (`RATE_LIMIT_STORE=mongo`).
- A unique session secret of at least 32 characters and HTTPS `APP_BASE_URL`.
- `TRUST_PROXY_HOPS` set correctly for the hosting proxy.
- Index synchronization after the first deploy and after schema changes:
  `npm run db:indexes -w @entebharatham/api`.
- Health-check monitoring against `/api/v1/health/ready`.

Before going live, verify cookies, CORS, email delivery, media upload and playback, sitemap output,
and rate limiting against the real domains and credentials. A dedicated deployment guide is on the
documentation roadmap.

---

## Documentation

| Document                                                 | Contents                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [projectupdate.md](projectupdate.md)                     | Current status, latest changes, validation evidence, and pending work            |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)             | System structure, services, and security boundaries                              |
| [docs/SECURITY.md](docs/SECURITY.md)                     | Authentication, authorization, privacy, validation, rate limiting, and reporting |
| [docs/SECURITY-TESTING.md](docs/SECURITY-TESTING.md)     | Access-control checklist, load-testing guidance, and operational tests           |
| [docs/CONTENT-GOVERNANCE.md](docs/CONTENT-GOVERNANCE.md) | Consent, withdrawals, corrections, duplicates, and audit principles              |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)             | Code contribution workflow, standards, and quality gates                         |
| [docs/imagery.md](docs/imagery.md)                       | Visual direction and imagery guidance                                            |

---

## License and content rights

**EnteBharatham is proprietary software.** Unauthorized copying, redistribution, modification, or
commercial exploitation is prohibited. See [LICENSE](LICENSE) for the full terms.

Third-party dependencies retain their respective licenses.

Cultural content submitted by community members remains subject to the platform's content
governance policies. The software license does not grant rights to community cultural content, and
contributors should not add real cultural stories, recordings, or fabricated sources to the
codebase, tests, or fixtures.

---

## Reporting security issues

Please do not open public issues for exploitable vulnerabilities. Report them privately to the
maintainers and never include secrets, session identifiers, or personal data in a report, pull
request, or screenshot. See [docs/SECURITY.md](docs/SECURITY.md) for the security model and
operational expectations.
