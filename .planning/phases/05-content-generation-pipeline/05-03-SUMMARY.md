---
phase: 05-content-generation-pipeline
plan: 03
subsystem: content-generation-review
tags: [nestjs, review-queue, audit-trail, tdd, module-wiring]
dependency_graph:
  requires: [05-01, 05-02]
  provides: [review-queue-api, content-post-api, content-generation-module]
  affects: [apps/backend/src/app.module.ts, phase-06-scheduling]
tech_stack:
  added: []
  patterns: [useFactory-di, tdd-red-green, slug-resolution, audit-trail]
key_files:
  created:
    - extensions/content-generation/src/review/review-queue.service.ts
    - extensions/content-generation/src/review/review-queue.controller.ts
    - extensions/content-generation/src/posts/content-post.controller.ts
    - extensions/content-generation/src/content-generation.module.ts
    - extensions/content-generation/src/__tests__/review-queue.service.spec.ts
  modified:
    - extensions/content-generation/src/index.ts
    - apps/backend/src/app.module.ts
    - DIVERGENCE.md
decisions:
  - "Review action audit trail stored directly on PostVariant fields (reviewedBy, reviewAction, reviewedAt, originalCaption)"
  - "reject() sets post status to DRAFT (not REJECTED) — post is available for re-generation"
  - "editVariant checks all siblings before updating parent post status — ensures consistency"
  - "ContentGenerationModule exports ContentPostService + ContentPostRepository + ReviewQueueService for Phase 6"
metrics:
  duration: 6min
  completed: "2026-03-10"
  tasks: 2
  files: 8
---

# Phase 5 Plan 03: Review Queue, Controllers, and Module Wiring Summary

**One-liner:** Review queue REST API with approve/reject/regenerate/edit-variant actions, audit trail on PostVariant, ContentGenerationModule wired into AppModule via useFactory pattern.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | ReviewQueueService (TDD) | a545d0f0 | review-queue.service.ts, review-queue.service.spec.ts |
| 2 | Controllers + Module + AppModule | c408b639 | content-post.controller.ts, review-queue.controller.ts, content-generation.module.ts, app.module.ts |

## What Was Built

### ReviewQueueService (`extensions/content-generation/src/review/review-queue.service.ts`)

- `findPending(companyId, page, limit)` — calls `repository.findByCompany(companyId, 'PENDING_REVIEW', page, limit)`, returns paginated result with `page` and `totalPages`
- `approve(postId, reviewedBy)` — sets all variants to `APPROVED` with audit fields (reviewedBy, reviewAction='approve', reviewedAt), then sets post status to `APPROVED`
- `reject(postId, reviewedBy)` — sets all variants to `REJECTED` with audit fields, returns post to `DRAFT` for potential re-generation
- `regenerate(postId)` — extracts original inputs from existing post+variants, calls `contentPostService.regenerateForPost()` (NOT `generate()`)
- `editVariant(variantId, editedCaption, reviewedBy)` — stores `originalCaption` before overwriting, sets `status='APPROVED'`, `reviewAction='edit_approve'`, checks all siblings and updates parent post if all APPROVED

### ContentPostController (`extensions/content-generation/src/posts/content-post.controller.ts`)

- `POST /companies/:companySlug/posts/generate` — resolves slug, calls `contentPostService.generate(companyId, dto)`, returns HTTP 201
- `GET /companies/:companySlug/posts` — lists posts with optional status and page filters
- `GET /companies/:companySlug/posts/:postId` — returns single post with variants

### ReviewQueueController (`extensions/content-generation/src/review/review-queue.controller.ts`)

- `GET /companies/:companySlug/review-queue` — lists PENDING_REVIEW posts
- `POST /companies/:companySlug/review-queue/:postId/approve` — approves all variants
- `POST /companies/:companySlug/review-queue/:postId/reject` — rejects all variants
- `POST /companies/:companySlug/review-queue/:postId/regenerate` — re-runs AI pipeline
- `PATCH /companies/:companySlug/review-queue/:postId/variants/:variantId` — edits single variant

### ContentGenerationModule (`extensions/content-generation/src/content-generation.module.ts`)

- Imports: `AIServiceModule` (for AIProviderRouter + AIConfigService) and `MediaLibraryModule` (for MediaProcessingService)
- All 5 providers wired via `useFactory` pattern (consistent with AIServiceModule and MediaLibraryModule)
- `ContentPostService` receives `MediaProcessingService` from `MediaLibraryModule` — implements locked decision "Media variant generation (Phase 4) triggered automatically when platforms are selected"
- Exports: `ContentPostService`, `ContentPostRepository`, `ReviewQueueService` for Phase 6

### AppModule

- `ContentGenerationModule` registered after `MediaLibraryModule`
- DIVERGENCE.md updated with Phase 5 Plan 03 entry

## Decisions Made

| Decision | Outcome |
|----------|---------|
| Audit trail on PostVariant | reviewedBy, reviewAction, reviewedAt, originalCaption stored directly on PostVariant fields |
| reject() post status | Sets to DRAFT (not REJECTED) — post available for re-generation via regenerate() |
| editVariant sibling check | Reads all variants for same postId after update; updates parent post only if ALL are APPROVED |
| Module exports for Phase 6 | ContentPostService + ContentPostRepository + ReviewQueueService exported — scheduling engine needs all three |

## Verification Results

- TypeScript compilation: PASS (0 errors in extension code)
- Test suite: 71 tests passing across 5 test files
  - review-queue.service.spec.ts: 13/13 tests pass
  - content-post.service.spec.ts: 20/20 tests pass
  - post-variant.repository.spec.ts: 12/12 tests pass
  - confidence-gating.spec.ts: 17/17 tests pass
  - prompt-templates.spec.ts: 9/9 tests pass
- ContentGenerationModule registered in AppModule
- All review actions store audit trail (reviewedBy, reviewAction, reviewedAt)
- regenerate() calls regenerateForPost (verified by test: "should NOT call ContentPostService.generate()")

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
