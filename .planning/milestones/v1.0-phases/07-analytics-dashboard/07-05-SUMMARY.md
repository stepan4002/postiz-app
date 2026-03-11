---
phase: 07-analytics-dashboard
plan: 05
subsystem: database, ui
tags: [prisma, postgresql, react, swr, analytics, dashboard]

# Dependency graph
requires:
  - phase: 07-analytics-dashboard
    provides: "DashboardSummaryJob, DashboardCache, failed posts widget, use-dashboard hook"
provides:
  - "FailedPostSummary.lastPublishError field name corrected — error messages now render at runtime (R12.3)"
  - "PostVariant.companyId denormalized column with @@index([companyId, platform, status]) compound index (NF3.4)"
  - "Migration SQL with ALTER TABLE, backfill UPDATE, FK constraint, CREATE INDEX"
affects: ["08-production-hardening"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Denormalized companyId pattern on PostVariant following PostMetrics precedent"
    - "Nullable FK column for safe migration with backfill UPDATE"

key-files:
  created:
    - libraries/nestjs-libraries/src/database/prisma/migrations/20260311100000_postvariant_companyid_index/migration.sql
  modified:
    - apps/frontend/src/components/analytics/hooks/use-dashboard.ts
    - apps/frontend/src/components/dashboard/failed-posts-widget.tsx
    - libraries/nestjs-libraries/src/database/prisma/schema.prisma

key-decisions:
  - "companyId nullable on PostVariant — existing rows safe; backfill UPDATE in migration populates all existing rows before FK constraint is added"
  - "Company model gets postVariants PostVariant[] relation — Prisma requires both sides of relation to be declared"

patterns-established:
  - "Field name in frontend FailedPostSummary interface must match backend JSON serialization key exactly"
  - "Compound index for dashboard queries follows PostMetrics denormalization pattern"

requirements-completed: [R12.3, NF3.4]

# Metrics
duration: 8min
completed: 2026-03-11
---

# Phase 7 Plan 05: Verification Gap Closure Summary

**Fixed lastPublishError field name mismatch (R12.3) and added PostVariant.companyId denormalized column with compound index on (companyId, platform, status) (NF3.4)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-11T01:33:36Z
- **Completed:** 2026-03-11T01:41:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Fixed R12.3 runtime bug where failed post error messages never displayed — frontend was reading `lastError` but backend serializes `lastPublishError`
- Satisfied NF3.4 by adding denormalized `companyId` column to PostVariant and creating the 3-column compound index `@@index([companyId, platform, status])`
- Created migration SQL that safely adds the column, backfills existing rows from ContentPost, adds FK constraint, then creates the index
- Prisma schema validates cleanly with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix lastPublishError field name mismatch in frontend (R12.3)** - `a80ef9ca` (fix)
2. **Task 2: Add companyId column and compound index to PostVariant (NF3.4)** - `9d1f337c` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `apps/frontend/src/components/analytics/hooks/use-dashboard.ts` - `FailedPostSummary.lastError` renamed to `lastPublishError`
- `apps/frontend/src/components/dashboard/failed-posts-widget.tsx` - Widget reads `post.lastPublishError` instead of `post.lastError`
- `libraries/nestjs-libraries/src/database/prisma/schema.prisma` - PostVariant model gets `companyId String?`, `company Company?` relation, and `@@index([companyId, platform, status])`; Company model gets `postVariants PostVariant[]` relation
- `libraries/nestjs-libraries/src/database/prisma/migrations/20260311100000_postvariant_companyid_index/migration.sql` - ALTER TABLE, backfill UPDATE, FK constraint, CREATE INDEX

## Decisions Made
- `companyId` is nullable on PostVariant so existing rows are not broken by the migration; the backfill UPDATE populates all pre-existing rows before the FK constraint is applied
- Company model requires `postVariants PostVariant[]` to declare the inverse relation side — Prisma enforces both sides

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npx prisma validate` fails when DATABASE_URL env var is absent (P1012 error); workaround: pass dummy URL in environment. Schema structure itself validated cleanly.

## User Setup Required
None - no external service configuration required. Database migration SQL must be applied when Docker is running: `pnpm run dev:docker && pnpm run prisma:migrate`.

## Next Phase Readiness
- Phase 7 gap closure complete — R12.3 and NF3.4 both satisfied
- Phase 8 (Production Hardening & Deployment) can proceed; compound index improves dashboard query performance at scale
- When PostVariant rows are created in future operations, `companyId` should be populated from the parent ContentPost at insert time (application-side, not enforced by this migration)

---
*Phase: 07-analytics-dashboard*
*Completed: 2026-03-11*

## Self-Check: PASSED

- FOUND: apps/frontend/src/components/analytics/hooks/use-dashboard.ts
- FOUND: apps/frontend/src/components/dashboard/failed-posts-widget.tsx
- FOUND: libraries/nestjs-libraries/src/database/prisma/schema.prisma
- FOUND: libraries/nestjs-libraries/src/database/prisma/migrations/20260311100000_postvariant_companyid_index/migration.sql
- FOUND: .planning/phases/07-analytics-dashboard/07-05-SUMMARY.md
- FOUND commit: a80ef9ca (fix: lastPublishError field name)
- FOUND commit: 9d1f337c (feat: companyId column and compound index)
