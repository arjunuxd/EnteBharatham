# Architecture

## Overview

EnteBharatham is a monorepo with:

- pps/api - Express 5 API (TypeScript, Mongoose, Zod)
- pps/web - React + Vite frontend (TypeScript, Tailwind)
- packages/shared - Shared types/schemas/constants

## Security boundaries

- Public API only returns records matching PUBLIC_ELIGIBILITY_FILTER at query time.
- AuthN/Z enforced server-side; sessions in MongoDB, CSRF synchronizer tokens.
- Governance actions (reports/corrections/withdrawals) are mediated by services with audit logging.

## Key services

- Heritage/search/discovery: public filtering, text search, facets, related, suggestions, sitemap.
- Contributions/moderation: draft workflow, atomic review decisions.
- Governance: community reports, corrections (whitelisted fields), withdrawals (never delete; restrict/archive).
- Media: upload with validation/rate limits, storage adapters (local dev, object-storage scaffold for prod).
- Email: verification/reset via token model, transports (dev/test in-memory, SMTP via Nodemailer).

## Phase 7 hardenings

- CastError/ValidationError mapped to 400.
- Shared MongoDB rate-limit store for multi-instance; Redis rejected in production.
- Media upload and account recovery rate-limited.
- SameSite=None forces Secure cookie.
- Password reset bumps credential version; tokens single-use.
- Email verification/reset responses are enumeration-safe.
- Media withdrawals validated/actioned (media lifecycle restricted/removed).
- Translations require publicly eligible parent and owner/mod authorization.
- Production env requires strong session secret, SMTP provider, shared rate limit store, object storage provider.
