---
phase: 07-analytics-dashboard
plan: 03
subsystem: backend
tags: [nestjs, prisma, cron, dashboard, analytics, pre-computed-cache, extension-package]

# Dependency graph
requires:
  - phase: 07-01
    provides: PostMetrics and DashboardCache Prisma models, type contracts
  - phase: 06-scheduling-publishing-engine
    provides: PostVariant status fields (SCHEDULED, PUBLISHING, FAILED, STALE, PENDING_REVIEW), consecutiveFailures, lastPublishError

provides:
  - "DashboardRepository: upsertCache/getByCompanyId/getAllCaches CRUD for DashboardCache"
  - "DashboardSummaryJob: @Cron('*/15 * * * *') pre-computes per-company dashboard data with RUN_CRON guard"
  - "DashboardService: getDashboard(companyId), getDashboardAllCompanies() (R12.6), resolveCompanyId(slug)"
  - "DashboardController: GET /dashboard?companySlug=, GET /dashboard/companies/:slug"
  - "FullDashboardData type with counts + detail lists for all 4 dashboard widgets"

affects:
  - 07-04-dashboard-api (if exists)
  - 07-05-dashboard-frontend (frontend consumes /dashboard endpoint)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-compute cron pattern: DashboardSummaryJob refreshes every 15 minutes, controller reads cache only"
    - "RUN_CRON guard: process.env.RUN_CRON prevents cron from running outside orchestrator"
    - "Per-company error isolation: try/catch inside company loop prevents one failure blocking others"
    - "7 parallel Prisma queries per company via Promise.all for cache refresh"
    - "Cross-company aggregation: getAllCaches() -> sum counts, merge top performers by totalEngagement"
    - "FullDashboardData extends DashboardData: adds scheduledPosts/failedPosts/pendingReview detail lists"

key-files:
  created:
    - extensions/analytics-dashboard/src/dashboard/dashboard.repository.ts
    - extensions/analytics-dashboard/src/dashboard/dashboard-summary.job.ts
    - extensions/analytics-dashboard/src/dashboard/dashboard.service.ts
    - extensions/analytics-dashboard/src/dashboard/dashboard.controller.ts
  modified:
    - extensions/analytics-dashboard/src/index.ts

key-decisions:
  - "FullDashboardData extends DashboardData with detail lists — base type had only topPosts; service returns full arrays for all 4 widgets"
  - "oldestComputedAt for cross-company freshness — getDashboardAllCompanies() uses min(computedAt) across caches to surface least-fresh entry"
  - "EMPTY_DASHBOARD zero-value constant — returned when no cache computed yet, avoids null checks in controller"
  - "resolveCompanyId in DashboardService not DashboardController — keeps controller thin; controller resolves before calling service"

# Metrics
duration: 8min
completed: 2026-03-11
---

# Phase 7 Plan 03: Dashboard Cache Service Summary

**Pre-computed dashboard pipeline with DashboardRepository (upsertCache/getByCompanyId/getAllCaches), DashboardSummaryJob (@Cron every 15 minutes, RUN_CRON guard, 7 parallel queries per company), DashboardService (cache read + cross-company aggregation), and DashboardController (GET /dashboard + GET /dashboard/companies/:slug serving only pre-computed data)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-11T00:51:19Z
- **Completed:** 2026-03-11T00:59:56Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created DashboardRepository with upsertCache (Prisma upsert by companyId), getByCompanyId, getAllCaches
- Created DashboardSummaryJob with @Cron('*/15 * * * *'), RUN_CRON guard as first line, per-company error isolation
- 7 parallel Prisma queries in Promise.all per company: 3 counts + 4 detail lists with correct field selection
- Maps raw Prisma rows to typed interfaces: TopPerformerEntry[], ScheduledPostSummary[], FailedPostSummary[], PendingReviewSummary[]
- Created DashboardService with cache-only reads (no live DB aggregation queries)
- getDashboardAllCompanies() aggregates across all company caches, re-sorts top performers by totalEngagement, takes top 5
- DashboardController serves /dashboard?companySlug= (all-company or per-company) and /dashboard/companies/:slug
- All 4 widget data types available from cache: scheduled posts, pending reviews, failures, top performers
- Updated barrel index.ts to export all dashboard classes and types

## Task Commits

Each task was committed atomically:

1. **Task 1: DashboardRepository and DashboardSummaryJob cron** - `b9c0ff1c` (feat)
2. **Task 2: DashboardService, DashboardController, and barrel exports** - `d30488f0` (feat)

## Files Created/Modified

- `extensions/analytics-dashboard/src/dashboard/dashboard.repository.ts` - DashboardCache CRUD: upsertCache, getByCompanyId, getAllCaches
- `extensions/analytics-dashboard/src/dashboard/dashboard-summary.job.ts` - @Cron job refreshing all company caches every 15 minutes
- `extensions/analytics-dashboard/src/dashboard/dashboard.service.ts` - Cache assembly, cross-company aggregation, slug resolution
- `extensions/analytics-dashboard/src/dashboard/dashboard.controller.ts` - GET /dashboard and GET /dashboard/companies/:slug endpoints
- `extensions/analytics-dashboard/src/index.ts` - Barrel exports updated with all dashboard pipeline classes

## Decisions Made

- FullDashboardData interface extends the base DashboardData from Plan 01 to include detail lists (scheduledPosts, failedPosts, pendingReview) — the base type only had topPosts
- EMPTY_DASHBOARD zero-value constant returned when DashboardCache not yet computed — avoids null propagation to the controller
- Cross-company freshness indicator uses oldest computedAt (min across all caches) — surfaces the least-fresh entry to the consumer
- companySlug === 'all' treated same as no slug for cross-company aggregation route

## Deviations from Plan

**1. [Rule 2 - Missing Critical] Added FullDashboardData interface with detail lists**
- **Found during:** Task 2 (DashboardService implementation)
- **Issue:** Plan called for DashboardService to return DashboardData (from Plan 01), but that type only includes topPosts detail list. The 3 other widgets (scheduledPosts, failedPosts, pendingReview) needed detail list fields alongside their counts.
- **Fix:** Defined FullDashboardData extending DashboardData with the 3 additional list fields. Exported from both service and barrel.
- **Files modified:** dashboard.service.ts, index.ts
- **Commit:** d30488f0 (Task 2)

**2. [Rule 2 - Missing Critical] Added EMPTY_DASHBOARD zero-value constant**
- **Found during:** Task 2 (getDashboard implementation)
- **Issue:** Plan specified returning zeroed data when no cache exists, but returning an inline object literal risks forgetting a field as types evolve.
- **Fix:** Defined EMPTY_DASHBOARD constant at module scope — spread with fresh computedAt on return.
- **Files modified:** dashboard.service.ts
- **Commit:** d30488f0 (Task 2)

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing critical structure for correctness)
**Impact on plan:** Both fixes are correctness improvements with no scope creep. The FullDashboardData type is the documented return type; EMPTY_DASHBOARD prevents subtle omission bugs.

## Requirements Satisfied

- **R12.1:** Today's scheduled posts pre-computed (count + detail list) and served from cache
- **R12.2:** Pending review count and list pre-computed from DashboardCache
- **R12.3:** Failed + stale posts pre-computed (count + detail list)
- **R12.4:** Top performers from last 7 days ranked by totalEngagement (likes+comments+shares)
- **R12.5:** All dashboard data from pre-computed cache — controller has zero live queries
- **R12.6:** Cross-company summary via getDashboardAllCompanies() on GET /dashboard (no slug)
- **NF3.1:** Single-row DashboardCache read + JSON parse in service = sub-2s page load achievable

## Self-Check: PASSED

All created files verified:
- extensions/analytics-dashboard/src/dashboard/dashboard.repository.ts: FOUND
- extensions/analytics-dashboard/src/dashboard/dashboard-summary.job.ts: FOUND
- extensions/analytics-dashboard/src/dashboard/dashboard.service.ts: FOUND
- extensions/analytics-dashboard/src/dashboard/dashboard.controller.ts: FOUND
- extensions/analytics-dashboard/src/index.ts: FOUND (modified)

Commits verified:
- b9c0ff1c (Task 1): FOUND
- d30488f0 (Task 2): FOUND

---
*Phase: 07-analytics-dashboard*
*Completed: 2026-03-11*
