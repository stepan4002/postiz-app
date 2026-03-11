---
phase: 06-scheduling-publishing-engine
plan: 02
subsystem: api
tags: [scheduling, cron, timezone, dayjs, nestjs, typescript, state-machine]

# Dependency graph
requires:
  - phase: 06-scheduling-publishing-engine/06-01
    provides: PostStateMachine, ContentPostStatus/PostVariantStatus types, Prisma migration with scheduledAt/publishWindowExpiresAt/platformPostId fields
  - phase: 05-content-generation-pipeline
    provides: ContentPost, PostVariant models; APPROVED status as entry point for scheduling

provides:
  - "SchedulingRepository: DB operations for scheduling engine (findDueVariants, markVariantPublishing, markVariantStale, findPostWithVariants, findCompanyTimezone, findCompanyPostingTimes)"
  - "ScheduleResolverService: schedulePost with timezone conversion (dayjs.tz), autoSlot for next available preferred window, cancelSchedule"
  - "SchedulerTickJob: @Cron('*/1 * * * *') every-minute poller, finds SCHEDULED variants due for publish, transitions to PUBLISHING or STALE"
  - "Idempotent tick: platformPostId check prevents double-publishing (R10.3)"
  - "STALE vs FAILED enforcement: window-expired variants get STALE, platform API errors get FAILED"

affects:
  - 06-03-platform-adapters
  - 06-04-publishing-worker
  - 06-05-publishing-dashboard
  - 07-analytics-dashboard

# Tech tracking
tech-stack:
  added:
    - dayjs with UTC + timezone plugins (require() CJS interop pattern)
  patterns:
    - "dayjs.tz(localDateStr, timezone).utc().toDate() for wall-clock-to-UTC conversion"
    - "@Cron('*/1 * * * *') with RUN_CRON guard (every-minute poller pattern)"
    - "Per-variant try/catch in cron loop — one error never blocks others"
    - "prisma.any cast pattern (consistent with Phase 4/5)"

key-files:
  created:
    - extensions/scheduling-publishing/src/scheduling/scheduling.repository.ts
    - extensions/scheduling-publishing/src/scheduling/schedule-resolver.service.ts
    - extensions/scheduling-publishing/src/scheduling/scheduler-tick.job.ts
    - extensions/scheduling-publishing/src/__tests__/schedule-resolver.service.spec.ts
    - extensions/scheduling-publishing/src/__tests__/scheduler-tick.job.spec.ts
  modified:
    - extensions/scheduling-publishing/src/index.ts

key-decisions:
  - "dayjs required via require() not import * — CJS interop in Jest environment requires require() to get dayjs as callable function"
  - "schedulePost uses getUTCHours() to extract wall-clock values from Date for timezone conversion — consistent behavior across system timezones"
  - "schedulePost UTC shortcut: when timezone='UTC', use Date directly without dayjs.tz conversion — autoSlot uses this to pass pre-computed UTC slots"
  - "autoSlot checks ±30min window around each slot for conflicts (not exact match) — prevents near-duplicate scheduling"
  - "SchedulerTickJob does not call platform adapters — only SCHEDULED->PUBLISHING or SCHEDULED->STALE; PublishingWorkerJob (Plan 04) handles actual API calls"
  - "BATCH_SIZE=50 variants per tick to prevent overwhelming platform APIs"

patterns-established:
  - "Timezone conversion pattern: extract date/time components via getUTC*() then dayjs.tz(localStr, tz).utc().toDate()"
  - "Cron RUN_CRON guard pattern: first line of cron method checks process.env.RUN_CRON"
  - "findDueVariants query: status=SCHEDULED AND scheduledAt <= now AND platformPostId IS NULL"
  - "Window expiry check in tick: publishWindowExpiresAt < now -> STALE, else -> PUBLISHING"

requirements-completed:
  - R9.2
  - R9.3
  - R9.4
  - R9.5

# Metrics
duration: 18min
completed: 2026-03-11
---

# Phase 6 Plan 02: Scheduling Service Layer Summary

**ScheduleResolverService with dayjs timezone conversion, SchedulingRepository with idempotent findDueVariants, and SchedulerTickJob @Cron every-minute poller transitioning SCHEDULED variants to PUBLISHING or STALE**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-10T23:29:00Z
- **Completed:** 2026-03-11T00:38:54Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- SchedulingRepository provides all DB operations needed by scheduling engine: findDueVariants (SCHEDULED + scheduledAt <= now + platformPostId IS NULL for idempotency), markVariantPublishing, markVariantStale, findPostWithVariants, findCompanyTimezone, findCompanyPostingTimes (defaults [9,12,17])
- ScheduleResolverService: schedulePost converts company timezone to UTC via dayjs.tz, calculates publishWindowExpiresAt = scheduledAt + windowHours, updates all APPROVED/SCHEDULED variants and parent ContentPost
- autoSlot finds next available preferred posting window checking ±30min conflicts, supports up to 14 days lookahead
- cancelSchedule reverts SCHEDULED post back to APPROVED, clears all scheduling fields
- SchedulerTickJob runs every minute with RUN_CRON guard, batch 50, per-variant error isolation, STALE for window-expired (not FAILED), PUBLISHING for open window
- 24 new tests (13 schedule-resolver + 11 scheduler-tick), 69 total across all test files

## Task Commits

Each task was committed atomically (TDD: test commit + feat commit per task):

1. **Task 1 RED: ScheduleResolverService tests** - `a8b3577d` (test)
2. **Task 1 GREEN: ScheduleResolverService + SchedulingRepository implementation** - `242f1da0` (feat)
3. **Task 2 RED: SchedulerTickJob tests** - `27fd8096` (test)
4. **Task 2 GREEN: SchedulerTickJob implementation** - `55db0c28` (feat)

_Note: TDD workflow results in test + feat commits per task_

## Files Created/Modified

- `extensions/scheduling-publishing/src/scheduling/scheduling.repository.ts` - DB operations: findPostWithVariants, updateVariantSchedule, updatePostSchedule, findDueVariants, markVariantPublishing, markVariantStale, findScheduledPostsForCompany, findCompanyTimezone, findCompanyPostingTimes
- `extensions/scheduling-publishing/src/scheduling/schedule-resolver.service.ts` - schedulePost (TZ conversion via dayjs), autoSlot (next available window), cancelSchedule (revert to APPROVED)
- `extensions/scheduling-publishing/src/scheduling/scheduler-tick.job.ts` - @Cron every-minute poller, RUN_CRON guard, batch 50, STALE vs PUBLISHING logic, per-variant error isolation
- `extensions/scheduling-publishing/src/__tests__/schedule-resolver.service.spec.ts` - 13 tests covering all 9 required behaviors
- `extensions/scheduling-publishing/src/__tests__/scheduler-tick.job.spec.ts` - 11 tests covering all 7 required behaviors
- `extensions/scheduling-publishing/src/index.ts` - Added SchedulingRepository, ScheduleResolverService, SchedulerTickJob exports

## Decisions Made

- **dayjs require() not import \***: Jest CJS environment requires `const dayjs = require('dayjs')` pattern — `import * as dayjs` doesn't give a callable function in CommonJS modules
- **UTC getter extraction for timezone conversion**: `schedulePost` uses `getUTCHours()` to extract wall-clock values from the Date parameter; callers pass `new Date('...Z')` where UTC values = intended local time
- **UTC timezone shortcut**: When `timezone='UTC'`, Date is used directly without dayjs.tz conversion; `autoSlot` exploits this to pass pre-computed UTC slot times to `schedulePost`
- **±30min conflict window in autoSlot**: Uses ±30min window around each slot when checking for conflicts (not exact-minute match) — prevents near-duplicate posts from slipping through
- **SchedulerTickJob scope**: Job does NOT call platform APIs; it only transitions SCHEDULED->PUBLISHING or SCHEDULED->STALE; the actual publishing (PublishingWorkerJob, Plan 04) polls for PUBLISHING variants and calls platform adapters

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **dayjs CJS import**: `import * as dayjs from 'dayjs'` does not expose dayjs as a callable function in Jest's CommonJS environment. Fixed using `const dayjs = require('dayjs')` pattern. This is the standard CJS interop approach for dayjs.
- **Timezone test consistency**: Tests initially used system-timezone-dependent `new Date('2026-03-11T09:00:00')` (no Z suffix, parsed as local time). Updated tests to use explicit UTC `new Date('...Z')` strings so UTC getters return predictable values regardless of test environment timezone.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SchedulingRepository `findDueVariants` query is ready for PublishingWorkerJob (Plan 04) to consume
- `markVariantPublishing` provides the atomic lease pattern needed before platform API calls
- `markVariantStale` correctly surfaces window-expired variants in the dashboard
- SchedulerTickJob transitions SCHEDULED->PUBLISHING every minute, giving PublishingWorkerJob a fresh batch each minute
- Company timezone support complete (R9.5): schedulePost respects per-company timezone
- Auto-slot (R9.2): next available preferred posting window with conflict avoidance
- idempotency (R10.3): platformPostId check in findDueVariants WHERE clause and SchedulerTickJob skip logic

## Self-Check: PASSED

All created files verified:
- FOUND: extensions/scheduling-publishing/src/scheduling/scheduling.repository.ts
- FOUND: extensions/scheduling-publishing/src/scheduling/schedule-resolver.service.ts
- FOUND: extensions/scheduling-publishing/src/scheduling/scheduler-tick.job.ts
- FOUND: extensions/scheduling-publishing/src/__tests__/schedule-resolver.service.spec.ts
- FOUND: extensions/scheduling-publishing/src/__tests__/scheduler-tick.job.spec.ts
- FOUND: .planning/phases/06-scheduling-publishing-engine/06-02-SUMMARY.md

All commits verified:
- a8b3577d: test(06-02): add failing tests for ScheduleResolverService and SchedulingRepository
- 242f1da0: feat(06-02): implement ScheduleResolverService, SchedulingRepository, and barrel exports
- 27fd8096: test(06-02): add failing tests for SchedulerTickJob cron
- 55db0c28: feat(06-02): implement SchedulerTickJob every-minute cron and update barrel exports

---
*Phase: 06-scheduling-publishing-engine*
*Completed: 2026-03-11*
