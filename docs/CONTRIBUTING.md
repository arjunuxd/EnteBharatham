# Contributing to EnteBharatham

Thank you for your interest in helping preserve India's living cultural
heritage. This document covers **code contributions**. Cultural content
contribution flows do not exist yet (the archive is read-only for the public;
Phase 2 added MongoDB integration and the heritage data model) and will be
governed by `docs/CONTENT-GOVERNANCE.md` when they arrive.

## Before you start

- Read `docs/ARCHITECTURE.md` and `docs/SECURITY.md`.
- For anything touching cultural data, also read `docs/CONTENT-GOVERNANCE.md`.
- Check existing issues and the project board (if any) before starting large
  work.

## Development setup

Prerequisites:

- Node.js ≥ 20.19 (Node 24 LTS recommended), npm ≥ 9
- MongoDB Community Server locally, **or** a MongoDB Atlas free cluster
  (the API needs `MONGODB_URI` to fully start; tests use an isolated in-memory
  MongoDB and do not require a running database)

```bash
git clone https://github.com/arjunuxd/EnteBharatham.git
cd EnteBharatham
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm run build -w @EnteBharatham/shared   # shared types must be built once
npm run seed -w @EnteBharatham/api       # optional fictional demo fixtures
npm run dev:api                          # terminal 1 (http://localhost:4000)
npm run dev:web                          # terminal 2 (http://localhost:5173)
```

## Quality gates (run before pushing)

```bash
npm run format:check   # Prettier
npm run lint           # ESLint
npm run typecheck      # TypeScript strict, all packages
npm run test           # Vitest, API + web
npm run build          # Production builds
npm run audit:deps     # npm audit (high+)
```

All of these also run in CI on pull requests. Do not disable failing tests,
type checks, or lint rules to make a build pass — fix the issue or discuss
it.

## Code standards

- TypeScript strict mode everywhere; no `any` without a written justification.
- Backend: follow the layering in `docs/ARCHITECTURE.md` (routes →
  controllers → services → models). Validate all request input with Zod.
- Frontend: semantic HTML and accessible patterns; visible focus states;
  keyboard-reachable controls; respect `prefers-reduced-motion`.
- Unicode first: no ASCII assumptions in new fields or logic; Malayalam and
  other Indian scripts must work.
- No secrets, tokens, or personal data in code, tests, fixtures, or commits.
- Keep pull requests focused and small; large unrelated reformatting is
  rejected.

## Commit and pull request expectations

- Write clear, imperative commit messages (e.g. "Add pagination validation
  schema").
- Reference the issue your PR resolves.
- Describe **what** changed, **why**, and how you verified it (commands
  run and results).
- Every PR must pass CI. Maintainers may ask for changes related to
  security, accessibility, or governance compliance.
- By contributing code, you agree your contribution is licensed under the
  repository's proprietary license. This does **not** apply to cultural content —
  do not add cultural stories, recordings, or fabricated sources to the
  codebase.

## Reporting bugs and security issues

- Bugs: open a GitHub issue with reproduction steps.
- Security: see the reporting process in `docs/SECURITY.md` — do not file
  public issues for exploitable vulnerabilities.

## Conduct

Be respectful and constructive. This project serves diverse communities;
harassment, discrimination, or dismissiveness toward contributors or the
communities represented in the archive is not acceptable. A formal Code of
Conduct file may be added in a later phase.
