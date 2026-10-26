# Security and load testing

This document describes the operational tests that complement the automated
checks in CI. Run them against an isolated staging environment, never against
production without written authorization and a coordinated window.

## Automated checks (every change)

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run audit:deps
```

CI runs the same sequence. The scheduled **Security** workflow adds a weekly
dependency audit and CodeQL analysis.

## Access-control regression checklist

Use two accounts with different roles plus an anonymous browser. For each item,
confirm the server rejects the request even when the UI is bypassed.

1. Anonymous requests cannot read `/heritage/mine`, drafts, moderation queues,
   audit logs, or non-public media.
2. A contributor cannot read or edit another contributor's draft, feedback,
   media, provenance, or withdrawal request.
3. A moderator cannot review their own submission and cannot publish a record
   with missing consent, rights, provenance, or blocking quality findings.
4. Withdrawing or restricting a record removes it from list, detail, search,
   suggestions, related records, profiles, media delivery, and the sitemap on the
   next request (cache invalidation).
5. A suspended account loses both its session and its public profile.
6. A user-supplied `next` parameter cannot redirect outside the web origin.
7. Uploads above the size limit return a friendly 413; unsupported types return
   a safe 4xx; oversized or malformed JSON returns a safe 4xx.
8. Error responses contain no stack trace, driver text, filesystem path, or
   secret. A 5xx may include a request reference only.

## Anonymous and authenticated load testing

Use a staging database seeded with production-shaped data (not production
data). Record latency percentiles, error rate, database CPU, and rate-limit
behaviour.

Suggested tools: `k6`, `autocannon`, or a managed load-testing service. Example
k6 scenario outline:

```js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

export default function () {
  const list = http.get(`${__ENV.BASE_URL}/api/v1/heritage?limit=12`);
  check(list, { 'list ok': (r) => r.status === 200 });
  const facets = http.get(`${__ENV.BASE_URL}/api/v1/discovery/facets`);
  check(facets, { 'facets ok': (r) => r.status === 200 });
  sleep(1);
}
```

Run separate scenarios for search suggestions, a record detail plus related
records, authenticated draft saves, and media uploads. Stay below the public
read limiter when measuring raw capacity, then repeat above it to confirm a
clean 429 rather than a 500. Verify that the shared rate-limit store and session
store do not become hotspots.

## Authorized penetration testing

Scope at minimum:

- authentication, session fixation, CSRF, and password recovery;
- horizontal and vertical privilege escalation;
- injection through search filters, tags, corrections, feedback, and uploads;
- stored/reflected XSS in every user-supplied text field and external URL;
- open redirects through `next` and any link-building helper;
- cache poisoning or leakage of authenticated responses;
- object-storage key traversal and signed-URL leakage;
- denial of service through unbounded search, pagination, uploads, and report
  creation;
- transport and header configuration (HSTS, CSP, CORS, cookies).

Provide the tester with staging accounts for each role, a written scope, and an
out-of-band contact. Do not test third-party services (MongoDB Atlas, S3, SMTP)
without their provider's approval. Retest every finding before closing it and
record accepted residual risks in the release review.

## Operational controls outside this repository

- Enable MongoDB Atlas encryption at rest and require TLS for all connections.
- Use a least-privilege database user and rotate credentials.
- Terminate TLS at the hosting provider and keep certificates auto-renewed.
- Centralize logs, alert on 5xx/429 spikes and failed authentication bursts, and
  set a retention period that excludes unnecessary personal data.
- Schedule external penetration tests and dependency reviews at least annually
  and after major architectural changes.
