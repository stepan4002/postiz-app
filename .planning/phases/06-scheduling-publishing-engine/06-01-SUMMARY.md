---
phase: 06-scheduling-publishing-engine
plan: 01
subsystem: api
tags: [scheduling, publishing, state-machine, prisma, typescript, platform-adapter]

# Dependency graph
requires:
  - phase: 05-content-generation-pipeline
    provides: ContentPost, PostVariant models; ContentPostStatus, PostVariantStatus base types
  - phase: 04-media-library-processing
    provides: MediaVariant, PlatformMediaValidator for publish params

provides:
  - "@social/scheduling-publishing package with state machine and type contracts"
  - "PlatformAdapter interface (uniform publish contract for all platforms, NF4.3)"
  - "ContentPostStatus and PostVariantStatus extended with PUBLISHING, PUBLISHED, FAILED, STALE"
  - "PostStateMachine with VALID_TRANSITIONS enforcing all lifecycle states"
  - "Prisma migration: PostVariant extended with 8 scheduling/publishing fields"
  - "PublishAttempt model for full audit trail of every publish attempt (R10.6)"
  - "STALE state distinct from FAILED (window-expired vs API-error)"

affects:
  - 06-02-scheduler-tick-worker
  - 06-03-platform-adapters
  - 06-04-publishing-dashboard
  - 07-analytics-dashboard

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PlatformAdapter interface for uniform platform-specific publish contract"
    - "VALID_TRANSITIONS map for state machine enforcement"
    - "STALE vs FAILED distinction: STALE=window expired (SCHEDULED->STALE), FAILED=API error (PUBLISHING->FAILED)"
    - "consecutiveFailures pattern from Phase 2 token health applied to publishing"

key-files:
  created:
    - extensions/scheduling-publishing/package.json
    - extensions/scheduling-publishing/tsconfig.json
    - extensions/scheduling-publishing/tsconfig.spec.json
    - extensions/scheduling-publishing/jest.config.ts
    - extensions/scheduling-publishing/src/index.ts
    - extensions/scheduling-publishing/src/types/scheduling.types.ts
    - extensions/scheduling-publishing/src/types/publishing.types.ts
    - extensions/scheduling-publishing/src/state-machine/post-state-machine.ts
    - extensions/scheduling-publishing/src/__tests__/post-state-machine.spec.ts
    - libraries/nestjs-libraries/src/database/prisma/migrations/20260310200000_scheduling_publishing/migration.sql
  modified:
    - extensions/content-generation/src/types/content.types.ts
    - libraries/nestjs-libraries/src/database/prisma/schema.prisma
    - tsconfig.base.json
    - DIVERGENCE.md

key-decisions:
  - "STALE and FAILED are distinct states: STALE=publish window expired before any publish attempt (SCHEDULED->STALE), FAILED=platform API error occurred during publishing (PUBLISHING->FAILED)"
  - "PlatformAdapter.apiVersion field added for NF4.5 API version pinning"
  - "ContentPostStatus/PostVariantStatus extended directly in content.types.ts (our extension code, not upstream)"
  - "consecutiveFailures on PostVariant mirrors Phase 2 token health pattern for consistent failure tracking"
  - "PublishAttempt table has dual FK to both PostVariant and ContentPost for efficient audit queries"

patterns-established:
  - "State machine pattern: VALID_TRANSITIONS Record<Status, Status[]> with canTransition, assertTransition, getValidTransitions"
  - "Interface-based platform adapter: PlatformAdapter with platform, apiVersion, publish() — all adapters must conform"
  - "Publish idempotency: platformPostId field on PostVariant prevents double-publishing on retry"

requirements-completed:
  - R9.1
  - NF4.3
  - NF4.5

# Metrics
duration: 12min
completed: 2026-03-10
---

# Phase 6 Plan 01: Scheduling & Publishing Engine — Foundation Summary

**@social/scheduling-publishing package with PlatformAdapter interface, VALID_TRANSITIONS state machine (STALE distinct from FAILED), and Prisma migration adding 8 scheduling fields plus PublishAttempt audit log table**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-10T23:19:43Z
- **Completed:** 2026-03-10T23:32:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Scaffolded `@social/scheduling-publishing` extension package following media-library pattern (package.json, tsconfigs, jest.config.ts)
- Implemented post state machine with VALID_TRANSITIONS map covering 8 states; 16 tests all passing
- Created PlatformAdapter interface with apiVersion field for NF4.5 API version pinning (NF4.3 uniform contract)
- Extended ContentPostStatus and PostVariantStatus with SCHEDULING, PUBLISHING, PUBLISHED, FAILED, STALE states
- Extended Prisma PostVariant with 8 scheduling/publishing fields; created PublishAttempt audit model
- STALE (window expired, no attempt) is distinct from FAILED (API error during publish) — critical dashboard distinction

## Task Commits

Each task was committed atomically:

1. **Task 1: Extension scaffold, type contracts, and PlatformAdapter interface** - `33cd7556` (feat)
2. **Task 2: Prisma migration for scheduling and publishing fields** - `ca8516c0` (feat)

## Files Created/Modified

- `extensions/scheduling-publishing/package.json` - Package manifest for @social/scheduling-publishing
- `extensions/scheduling-publishing/tsconfig.json` - TypeScript config extending tsconfig.base.json
- `extensions/scheduling-publishing/tsconfig.spec.json` - Test-aware TypeScript config
- `extensions/scheduling-publishing/jest.config.ts` - Jest config with moduleNameMapper for path aliases
- `extensions/scheduling-publishing/src/index.ts` - Barrel exports for all types and state machine
- `extensions/scheduling-publishing/src/types/scheduling.types.ts` - Extended status types, SchedulePostDto, AutoSlotDto, PublishWindowConfig
- `extensions/scheduling-publishing/src/types/publishing.types.ts` - PlatformAdapter interface, PublishResult, ErrorClassification, PublishAttemptRecord
- `extensions/scheduling-publishing/src/state-machine/post-state-machine.ts` - VALID_TRANSITIONS map, canTransition, assertTransition, getValidTransitions
- `extensions/scheduling-publishing/src/__tests__/post-state-machine.spec.ts` - 16 tests covering all transitions including STALE
- `extensions/content-generation/src/types/content.types.ts` - Extended ContentPostStatus and PostVariantStatus with publishing states
- `libraries/nestjs-libraries/src/database/prisma/schema.prisma` - PostVariant extended (8 fields), ContentPost extended (scheduledAt), PublishAttempt model added
- `libraries/nestjs-libraries/src/database/prisma/migrations/20260310200000_scheduling_publishing/migration.sql` - Migration SQL with ALTER TABLE and CREATE TABLE
- `tsconfig.base.json` - Added @social/scheduling-publishing path alias
- `DIVERGENCE.md` - Phase 6 schema modification entry

## Decisions Made

- **STALE vs FAILED distinction:** STALE originates from SCHEDULED (window expired, never attempted publishing), FAILED originates from PUBLISHING (API returned error). Dashboard shows these differently: "never attempted" vs "attempted and errored". Both can return to SCHEDULED but via different triggers (automatic for FAILED retry, manual operator action for STALE reschedule).
- **apiVersion on PlatformAdapter:** NF4.5 requirement for API version pinning — each adapter declares which API version it targets; breaking changes require bumping the version.
- **Types extended in content.types.ts directly:** ContentPostStatus and PostVariantStatus are our extension code (not upstream), so extending the union types directly avoids re-export indirection.
- **consecutiveFailures mirrors Phase 2 pattern:** Same field semantics as Integration.consecutiveFailures for token health — consistent pattern for failure tracking across the system.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — migration `20260310200000_scheduling_publishing` must be applied when Docker is running:
```bash
pnpm run dev:docker
pnpm run prisma:migrate
```

## Next Phase Readiness

- State machine ready for scheduler_tick worker (Plan 02) to use `assertTransition` before any status change
- PlatformAdapter interface ready for platform-specific adapters (Plan 03) to implement
- Prisma fields ready: `scheduledAt`, `status`, `publishWindowExpiresAt` for scheduler queries
- `platformPostId` index ready for idempotency checks (R10.3)
- PublishAttempt table ready for publish attempt logging (R10.6)

---
*Phase: 06-scheduling-publishing-engine*
*Completed: 2026-03-10*
