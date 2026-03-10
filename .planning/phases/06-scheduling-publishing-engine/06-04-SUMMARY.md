---
phase: 06-scheduling-publishing-engine
plan: 04
subsystem: api
tags: [publishing, retry, exponential-backoff, cron, nestjs, platform-adapter, attempt-logging, failed-posts, calendar, schedule-api]

# Dependency graph
requires:
  - phase: 06-scheduling-publishing-engine
    plan: 01
    provides: "PlatformAdapter interface, PublishParams, PublishResult, PublishAttemptRecord types"
  - phase: 06-scheduling-publishing-engine
    plan: 02
    provides: "SchedulingRepository, ScheduleResolverService, SchedulerTickJob (SCHEDULED->PUBLISHING transitions)"
  - phase: 06-scheduling-publishing-engine
    plan: 03
    provides: "AdapterRegistry, all 4 platform adapters (Instagram, Facebook, LinkedIn, X)"
  - phase: 05-content-generation-pipeline
    plan: 03
    provides: "ContentGenerationModule with ContentPostService, ContentPostRepository, ReviewQueueService exported"
  - phase: 04-media-library-processing
    plan: 04
    provides: "MediaLibraryModule with PlatformMediaValidator"
  - phase: 02-credential-management-oauth
    plan: 03
    provides: "CredentialManagementModule with TokenEncryptionService"

provides:
  - "PublishAttemptLogger: non-blocking attempt audit logging to PublishAttempt table (R10.6)"
  - "PublishingRepository: DB operations for PUBLISHING variants, result updates, parent status"
  - "PublishingService: single-variant publish via SocialAccount->Integration credential resolution, token decryption, adapter dispatch"
  - "PublishingWorkerJob: cron every 30s, RUN_CRON guard, exponential backoff (60s/300s/900s), max 3 retries, permanent failures skip retry, parent ContentPost status update, per-variant error isolation"
  - "SchedulingController: REST endpoints for schedule/auto-slot/cancel/calendar/retry (company-scoped)"
  - "FailedPostsController: REST endpoints for FAILED/STALE variant listing and attempt history (R10.7)"
  - "SchedulingPublishingModule: full module wiring with all 10 providers via useFactory"
  - "AppModule registration of SchedulingPublishingModule"

affects:
  - "07-analytics-dashboard (uses ScheduleResolverService, PublishingService, SchedulingRepository exports)"
  - "08-production-hardening (worker reliability, retry guarantees verified here)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-blocking logger pattern: logAttempt wraps DB write in try/catch, console.warn on failure — identical to AICostLogger from Phase 3"
    - "Exponential backoff with jitter: base * 2^(attempt-1) + random(0, base*0.5), base delays [60s, 300s, 900s]"
    - "Per-variant error isolation: try/catch in for loop, never rethrow — one variant failure never blocks others"
    - "Parent ContentPost status derived from variant terminal states: all PUBLISHED = PUBLISHED, any FAILED/STALE = FAILED"
    - "Backoff window check via PublishAttemptLogger.getAttemptsForVariant(): compare last attempt timestamp to now"
    - "Credential resolution: SocialAccount.findFirst({ where: { provider, brandId }, include: { integration } })"
    - "Controller slug resolution: prisma.company.findUnique({ where: { slug } }) before service calls"

key-files:
  created:
    - "extensions/scheduling-publishing/src/publishing/publish-attempt-logger.ts"
    - "extensions/scheduling-publishing/src/publishing/publishing.repository.ts"
    - "extensions/scheduling-publishing/src/publishing/publishing.service.ts"
    - "extensions/scheduling-publishing/src/publishing/publishing-worker.job.ts"
    - "extensions/scheduling-publishing/src/scheduling/scheduling.controller.ts"
    - "extensions/scheduling-publishing/src/publishing/failed-posts.controller.ts"
    - "extensions/scheduling-publishing/src/scheduling-publishing.module.ts"
    - "extensions/scheduling-publishing/src/__tests__/publish-attempt-logger.spec.ts"
    - "extensions/scheduling-publishing/src/__tests__/publishing-worker.job.spec.ts"
  modified:
    - "extensions/scheduling-publishing/src/index.ts (added publishing + controller + module exports)"
    - "apps/backend/src/app.module.ts (added SchedulingPublishingModule)"
    - "DIVERGENCE.md (documented Phase 6 Plan 04 app.module.ts change)"

key-decisions:
  - "Logging responsibility in worker not service: PublishingWorkerJob calls attemptLogger after getting result from PublishingService — single authority for attempt logging; service focuses only on publish execution"
  - "Backoff enforced via timestamp check: compare last attempt timestamp (from PublishAttemptLogger.getAttemptsForVariant) to now; skip tick if within window"
  - "FailedPostsController includes STALE status: STALE posts (window expired before publish) surface alongside FAILED posts in the dashboard — both require operator attention"
  - "Retry endpoint resets publishAttempts to 0: fresh retry restarts the 3-attempt counter and recalculates 4-hour publish window from now"
  - "PublishingService focuses on single-try: no retry logic in service — retry orchestration is worker's responsibility"

patterns-established:
  - "Publishing pipeline: SchedulerTickJob (SCHEDULED->PUBLISHING) -> PublishingWorkerJob (calls PublishingService) -> PublishAttemptLogger (audit)"
  - "Terminal state propagation: worker updates parent ContentPost after each variant completes; checks all sibling variants before updating parent"
  - "useFactory for all module providers: consistent with Phase 3/4/5 module patterns"

requirements-completed: [R10.1, R10.4, R10.6, R10.7, R10.8, NF2.1]

# Metrics
duration: 20min
completed: 2026-03-11
---

# Phase 6 Plan 04: Publishing Worker & API Layer Summary

**Publishing worker with 3-attempt exponential backoff (60s/300s/900s), attempt audit logging, failed posts API, and SchedulingPublishingModule wired into AppModule**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-10T23:43:36Z
- **Completed:** 2026-03-11T00:53:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Implemented PublishingWorkerJob with retry logic: max 3 attempts, exponential backoff with jitter (60s/5min/15min), permanent failures immediately FAILED
- Created PublishAttemptLogger following the non-blocking AICostLogger pattern — DB failures never block publishing flow
- Built SchedulingController (schedule/auto-slot/cancel/calendar/retry) and FailedPostsController (failed listing + attempt history)
- Wired SchedulingPublishingModule with all 10 providers into AppModule — Phase 6 is now end-to-end: APPROVED -> SCHEDULED -> PUBLISHING -> PUBLISHED/FAILED
- 95 tests passing across all extension test suites (26 new tests in this plan)

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD RED - failing tests** - `c09827a6` (test)
2. **Task 1: TDD GREEN - PublishingService, PublishAttemptLogger, PublishingRepository, PublishingWorkerJob** - `68cd5212` (feat)
3. **Task 2: Controllers and SchedulingPublishingModule wiring** - `92107fcf` (feat)

**Plan metadata:** (docs commit follows)

_Note: Task 1 was TDD — tests written first (RED), then implementation (GREEN) per TDD protocol._

## Files Created/Modified

- `extensions/scheduling-publishing/src/publishing/publish-attempt-logger.ts` - Non-blocking attempt audit logger: logAttempt catches all DB errors and console.warns; getAttemptsForVariant for backoff and dashboard
- `extensions/scheduling-publishing/src/publishing/publishing.repository.ts` - DB layer for publishing: findPublishingVariants (status=PUBLISHING), updateVariantPublishResult, findVariantsByPostId, updateContentPostStatus
- `extensions/scheduling-publishing/src/publishing/publishing.service.ts` - Single-variant publish: SocialAccount->Integration credential resolution, AES-256-GCM token decryption, adapter dispatch, media buffer download
- `extensions/scheduling-publishing/src/publishing/publishing-worker.job.ts` - Cron every 30s: backoff check, publishVariant call, success/retry/failed state machine, parent post status update, per-variant error isolation
- `extensions/scheduling-publishing/src/scheduling/scheduling.controller.ts` - REST: POST schedule, POST auto-slot, DELETE schedule, GET calendar, POST retry (with FAILED/STALE validation)
- `extensions/scheduling-publishing/src/publishing/failed-posts.controller.ts` - REST: GET paginated failed posts (FAILED+STALE, optional platform filter), GET variant attempt history
- `extensions/scheduling-publishing/src/scheduling-publishing.module.ts` - Module: 10 providers (all useFactory), imports ContentGenerationModule+MediaLibraryModule+CredentialManagementModule, exports 3 for Phase 7
- `extensions/scheduling-publishing/src/__tests__/publish-attempt-logger.spec.ts` - 7 tests: record creation, field mapping, error handling, warn-on-failure
- `extensions/scheduling-publishing/src/__tests__/publishing-worker.job.spec.ts` - 19 tests: guard, batch query, success path, retry < 3, retry >= 3, permanent fail, parent status, error isolation, backoff window
- `extensions/scheduling-publishing/src/index.ts` - Added publishing service, controller, and module exports
- `apps/backend/src/app.module.ts` - Registered SchedulingPublishingModule after ContentGenerationModule
- `DIVERGENCE.md` - Documented Phase 6 Plan 04 app.module.ts modification

## Decisions Made

- **Logging responsibility in worker**: PublishingService focuses on executing the publish; PublishingWorkerJob calls attemptLogger after receiving the result. This avoids double-logging and keeps service pure.
- **Backoff via timestamp check**: isInBackoffWindow() queries getAttemptsForVariant() to find the last attempt timestamp. If elapsed < required backoff, skip this tick.
- **FailedPostsController includes STALE**: Both FAILED and STALE variants surface in the dashboard — both need operator attention even though their causes differ (STALE = window expired; FAILED = platform error).
- **Retry resets counters**: POST /retry resets publishAttempts to 0 and consecutiveFailures to 0 — fresh slate; also recalculates publishWindowExpiresAt to 4h from now.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Architecture Clarification] Moved attempt logging from PublishingService to PublishingWorkerJob**
- **Found during:** Task 1 (TDD GREEN — test for "should log the successful attempt" failed)
- **Issue:** Plan action listed logging in both service and worker. Having the service log internally and the worker also mock-test it caused 0 calls when service was mocked. Architecturally cleaner for the worker (which manages retry state) to be the single authority for attempt logging.
- **Fix:** Removed logging from PublishingService.publishVariant(); worker calls attemptLogger.logAttempt() after receiving the PublishResult. Service is now a pure "publish executor."
- **Files modified:** `publishing.service.ts`, `publishing-worker.job.ts`
- **Verification:** All 26 tests passing after fix
- **Committed in:** `68cd5212` (Task 1 feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - architectural clarification for cleaner separation of concerns)
**Impact on plan:** No functional change — logging still happens for every attempt. Now it's architecturally cleaner (worker manages all state including audit trail).

## Issues Encountered

- Pre-existing TS7018 errors in `linkedin.adapter.ts` (from Plan 03) and `libraries/nestjs-libraries/src/emails/empty.provider.ts` (upstream) — not introduced by this plan. Excluded from verification.

## User Setup Required

None - no external service configuration required. All credentials and env vars already documented from prior phases.

## Next Phase Readiness

- Full scheduling/publishing pipeline complete: APPROVED -> SCHEDULED -> PUBLISHING -> PUBLISHED/FAILED
- SchedulingPublishingModule exports ScheduleResolverService, PublishingService, SchedulingRepository for Phase 7
- AdapterRegistry ready for new platform adapters without touching PublishingWorkerJob
- Retry guarantees (3 attempts, backoff) and audit trail (PublishAttempt) in place for Phase 8 production hardening review

---
*Phase: 06-scheduling-publishing-engine*
*Completed: 2026-03-11*
