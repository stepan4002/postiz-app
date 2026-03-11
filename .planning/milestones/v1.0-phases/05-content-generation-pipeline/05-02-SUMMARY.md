---
phase: 05-content-generation-pipeline
plan: 02
subsystem: api
tags: [nestjs, ai-pipeline, content-generation, confidence-gating, tdd, promise-allsettled]

# Dependency graph
requires:
  - phase: 03-ai-service-layer
    provides: AIProviderRouter.execute() and executeImageAnalysis() for all AI calls
  - phase: 04-media-library-processing
    provides: MediaProcessingService.generateVariants() for automatic media resizing
  - phase: 05-01
    provides: ContentPost/PostVariant Prisma models, type contracts, Zod schemas, prompt builders

provides:
  - "ContentPostService.generate(): full AI pipeline from media+brief to scored PostVariants per platform"
  - "ContentPostService.regenerateForPost(): variant-only regeneration for review queue"
  - "ContentPostRepository: CRUD for ContentPost and PostVariant including deleteVariantsByPostId"
  - "applyConfidenceGating: routes variants to APPROVED/PENDING_REVIEW based on score vs threshold"
  - "determinePostStatus: derives parent post status from all variant statuses"
  - "58 passing tests across 4 test suites"

affects:
  - 05-03-review-queue
  - 06-scheduling-publishing-engine

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise.allSettled for parallel platform adaptation — partial failures don't block successful platforms"
    - "Fire-and-forget media variant generation — caption pipeline starts immediately without waiting for image resizing"
    - "taskType-based mock dispatch in tests — handles concurrent Promise.allSettled without mock ordering issues"
    - "BudgetExceededError re-throw — propagated from AIProviderRouter to caller (not swallowed)"
    - "User brief in USER message only — NF1.3 prompt injection prevention enforced at service layer"

key-files:
  created:
    - extensions/content-generation/src/posts/confidence-gating.ts
    - extensions/content-generation/src/posts/content-post.repository.ts
    - extensions/content-generation/src/posts/content-post.service.ts
    - extensions/content-generation/src/__tests__/confidence-gating.spec.ts
    - extensions/content-generation/src/__tests__/post-variant.repository.spec.ts
    - extensions/content-generation/src/__tests__/content-post.service.spec.ts
  modified:
    - extensions/content-generation/src/index.ts

key-decisions:
  - "taskType-based mock dispatch in Jest tests — Promise.allSettled runs concurrent async functions so mockResolvedValueOnce queue order is non-deterministic; mockImplementation dispatching on context.taskType gives stable test behavior"
  - "Fire-and-forget MediaProcessingService.generateVariants — wrapped in try/catch, no await, captions start immediately; PostVariant.mediaVariantId linked later by Phase 6"
  - "Image analysis failure is non-fatal — console.warn and continue with null imageAnalysis; caption still generated without visual context"
  - "Re-throw when ALL platforms fail — if fulfilledVariants is empty after Promise.allSettled, the first rejection reason is re-thrown to surface BudgetExceededError"

patterns-established:
  - "TDD RED-GREEN: failing test files committed before implementations for both tasks"
  - "taskType context dispatch in mocks: handles concurrent Promise.allSettled without fragile call-order dependencies"

requirements-completed: [R5.1, R5.2, R5.3, R5.4, R5.5, R5.6, R6.1, R6.2]

# Metrics
duration: 10min
completed: 2026-03-10
---

# Phase 5 Plan 2: ContentPostService Generation Pipeline Summary

**ContentPostService with 9-step AI generation pipeline, confidence gating, ContentPostRepository, and regenerateForPost — all with 58 passing unit tests**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-10T21:52:25Z
- **Completed:** 2026-03-10T22:02:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Built `ContentPostService.generate()` orchestrating the full pipeline: image analysis via `AIProviderRouter.executeImageAnalysis`, base caption generation with brand voice injection, parallel per-platform adaptation + scoring via `Promise.allSettled`, confidence gating, and DB persistence
- Built `ContentPostService.regenerateForPost()` for review queue re-generation: reuses existing post, deletes old variants, re-runs Steps 2-9
- Created `ContentPostRepository` with full CRUD for ContentPost and PostVariant, including `deleteVariantsByPostId` for regeneration cleanup
- Created `applyConfidenceGating` and `determinePostStatus` pure functions with 16 tests covering all threshold/requireAllReview combinations
- 58 tests passing across 4 test suites with 0 failures

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: Failing tests for confidence gating and post-variant repository** - `18806570` (test)
2. **Task 1 GREEN: Confidence gating and ContentPostRepository** - `30109b94` (feat)
3. **Task 2 RED: Failing tests for ContentPostService** - `dacad06f` (test)
4. **Task 2 GREEN: ContentPostService + index.ts barrel** - `9d24197a` (feat)

_Note: TDD tasks have 2 commits each (test RED → feat GREEN)_

## Files Created/Modified

- `extensions/content-generation/src/posts/confidence-gating.ts` - applyConfidenceGating and determinePostStatus pure functions
- `extensions/content-generation/src/posts/content-post.repository.ts` - ContentPostRepository with full CRUD for ContentPost and PostVariant
- `extensions/content-generation/src/posts/content-post.service.ts` - ContentPostService with generate() and regenerateForPost() pipelines
- `extensions/content-generation/src/__tests__/confidence-gating.spec.ts` - 16 tests for gating logic and post status derivation
- `extensions/content-generation/src/__tests__/post-variant.repository.spec.ts` - 3 tests for repository variant operations
- `extensions/content-generation/src/__tests__/content-post.service.spec.ts` - 18 tests for full pipeline with mocked dependencies
- `extensions/content-generation/src/index.ts` - Updated barrel exports with ContentPostService, ContentPostRepository, applyConfidenceGating

## Decisions Made

- **taskType-based mock dispatch** — `Promise.allSettled` runs concurrent async functions so `mockResolvedValueOnce` queue order is non-deterministic across platforms. Using `mockImplementation` that dispatches on `context.taskType` gives stable test behavior regardless of execution order.
- **Fire-and-forget MediaProcessingService.generateVariants** — Wrapped in `.catch()`, no `await`. Caption generation starts immediately without waiting for image resizing. PostVariant.mediaVariantId links will be resolved by Phase 6 scheduling engine.
- **Image analysis failure is non-fatal** — `console.warn` and continue with `null` imageAnalysis. Caption still generated without visual context (graceful degradation).
- **Re-throw when ALL platforms fail** — If `fulfilledVariants` is empty after `Promise.allSettled`, the first rejection reason is re-thrown. Surfaces `BudgetExceededError` to the caller when budget is exceeded before any platform succeeds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed concurrent mock ordering in Jest tests**
- **Found during:** Task 2 GREEN phase
- **Issue:** `mockResolvedValueOnce` queue is consumed in call order. With `Promise.allSettled` running both platform async functions concurrently, the mock values were consumed in interleaved order (instagram adapt → facebook adapt → instagram score → facebook score), not sequential order (instagram adapt → instagram score → facebook adapt → facebook score). This caused facebook's `adaptForPlatform` call to receive `MOCK_SCORE_RESULT` (which has no `hashtags`), crashing `buildPlatformAdaptationPrompt`.
- **Fix:** Changed `setupHappyPath()` to use `mockImplementation()` dispatching on `context.taskType` — stable regardless of concurrent execution order.
- **Files modified:** `src/__tests__/content-post.service.spec.ts`
- **Commit:** `9d24197a`

## Issues Encountered

None beyond the mock ordering fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ContentPostService.generate()` ready for Phase 5 Plan 03 (review queue controller)
- `ContentPostRepository` ready for Phase 5 Plan 03 (review actions, status updates)
- `regenerateForPost()` ready for Phase 5 Plan 03 (regenerate action in review queue)
- `applyConfidenceGating` and `determinePostStatus` fully tested and exported

## Self-Check: PASSED

All files verified to exist. All commits verified in git log.

---
*Phase: 05-content-generation-pipeline*
*Completed: 2026-03-10*
