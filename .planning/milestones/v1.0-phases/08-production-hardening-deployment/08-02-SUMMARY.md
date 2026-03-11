---
phase: 08-production-hardening-deployment
plan: "02"
subsystem: security
tags: [ssrf, security, prompt-injection, env-config, nf1.3, nf1.4, nf1.5, nf1.6]
dependency_graph:
  requires: []
  provides: ["@social/security", "assertSafeUrl"]
  affects: ["extensions/media-library", "apps/backend/public-api"]
tech_stack:
  added: ["@social/security workspace package"]
  patterns: ["SSRF URL validation", "TDD RED-GREEN", "Input boundary protection"]
key_files:
  created:
    - extensions/security/package.json
    - extensions/security/tsconfig.json
    - extensions/security/tsconfig.spec.json
    - extensions/security/jest.config.ts
    - extensions/security/src/ssrf.guard.ts
    - extensions/security/src/__tests__/ssrf.guard.spec.ts
    - extensions/security/src/index.ts
  modified:
    - extensions/media-library/package.json
    - extensions/media-library/src/storage/minio.storage.ts
    - apps/backend/src/public-api/routes/v1/public.integrations.controller.ts
    - .env.example
decisions:
  - "assertSafeUrl throws distinct errors per category — callers catch and map to HTTP 400"
  - "assertSafeUrl added to MinioStorage.uploadSimple() and PublicIntegrationsController.uploadsFromUrl() — the two direct fetch-from-URL endpoints"
  - "Enterprise webhookUrl not guarded — comes from JWT-signed enterprise operator payload (service-to-service, not user input)"
  - "DISABLE_REGISTRATION documented as commented-out=true — operator uncomments for production"
  - "OPENAI_API_KEY deduplicated in .env.example (was listed twice)"
metrics:
  duration: "7min"
  completed_date: "2026-03-11"
  tasks: 3
  files: 11
---

# Phase 8 Plan 02: Security Hardening (SSRF, Prompt Injection, .env Audit) Summary

**One-liner:** SSRF protection utility with 31 tests wired into URL-accepting endpoints; NF1.3/NF1.5 audits confirmed clean; .env.example updated with production settings including DISABLE_REGISTRATION.

## Tasks Completed

### Task 1: SSRF Protection Utility (TDD)

Created `extensions/security/` as a new `@social/security` workspace package with:

- **`assertSafeUrl(rawUrl: string): void`** — throws on invalid URL, non-HTTPS, private IP ranges (RFC 1918: 10.x, 172.16-31.x, 192.168.x; loopback: 127.x; link-local: 169.254.x; IPv6: ::1, fc00::, fd00::), and internal hostnames (localhost, .internal, .local, metadata.google.internal).
- **31 unit tests** covering all block and allow cases with TDD RED-GREEN cycle.
- Package pattern matches other extension packages (jest.config.ts, tsconfig.spec.json, barrel index.ts).

### Task 2: Wire assertSafeUrl into Input Boundaries

Identified two endpoints where user-supplied URLs are fetched without validation:

1. **`extensions/media-library/src/storage/minio.storage.ts`** — `MinioStorage.uploadSimple(url)` calls `fetch(url)` directly. Added `assertSafeUrl(url)` before the fetch. Added `@social/security: workspace:*` to media-library's dependencies.

2. **`apps/backend/src/public-api/routes/v1/public.integrations.controller.ts`** — `uploadsFromUrl()` calls `axios.get(body.url, ...)`. Added `assertSafeUrl(body.url)` in a try/catch that returns HTTP 400 with the error message.

The enterprise webhook URL (`no.auth.integrations.controller.ts`) was intentionally excluded — it comes from a JWT-signed enterprise operator payload (service-to-service, not direct user input).

### Task 3: Security Audits and .env.example Updates

**NF1.3 Audit (Prompt Injection):** Confirmed user brief/captions go ONLY in `{ role: 'user', content: ... }` messages in `content-post.service.ts`. The system prompt contains only content type modifiers and brand voice — never user input. Decision "Brief in USER message only" is enforced as planned in Phase 5.

**NF1.5 Audit (No Hardcoded Secrets):** Grep for `sk-`, `Bearer [A-Za-z0-9]` patterns found only documentation comments. All sensitive values (API keys, tokens) come from `process.env`. Clean.

**NF1.6 (.env.example):**
- Added `DISABLE_REGISTRATION=true` with explanatory comment for single-user deployments
- Added `Production Settings` section with `NODE_ENV`, `LOG_LEVEL`, `DOMAIN`
- Deduplicated `OPENAI_API_KEY` (was listed in both AI section and Misc section)
- Consolidated AI section comments for clarity

## Verification Results

```
SSRF tests: 31/31 passed
assertSafeUrl in extensions/media-library/src/storage/minio.storage.ts: YES
assertSafeUrl in apps/backend/src/.../public.integrations.controller.ts: YES
.env.example DISABLE_REGISTRATION: 2 occurrences (comment + value)
.env.example ENCRYPTION_KEY: 1 occurrence
.env.example LOG_LEVEL: 2 occurrences (comment + value)
Hardcoded secrets: NONE found
```

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

| Decision | Outcome |
|----------|---------|
| assertSafeUrl error mapping | Distinct error messages per category — callers wrap in try/catch and return HTTP 400 |
| Enterprise webhookUrl | Not guarded — JWT-signed service-to-service, not user input |
| DISABLE_REGISTRATION format | Documented as commented-out with true value — operator uncomments for production |
| OPENAI_API_KEY deduplication | Removed from Misc section; consolidated in AI Service Layer section |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| extensions/security/src/ssrf.guard.ts | FOUND |
| extensions/security/src/__tests__/ssrf.guard.spec.ts | FOUND |
| extensions/security/src/index.ts | FOUND |
| 08-02-SUMMARY.md | FOUND |
| Commit d1dbebee (Task 1) | FOUND |
| Commit cead19cd (Task 2) | FOUND |
| Commit 30220f4c (Task 3) | FOUND |
