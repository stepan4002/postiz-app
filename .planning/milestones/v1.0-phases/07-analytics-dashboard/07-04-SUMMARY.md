---
phase: 07-analytics-dashboard
plan: 04
subsystem: frontend-backend-integration
tags: [nestjs, module-wiring, react, swr, dashboard, analytics, tailwind, frontend]

# Dependency graph
requires:
  - phase: 07-analytics-dashboard
    plan: 02
    provides: AnalyticsRepository, AnalyticsService, AnalyticsIngestionJob, AnalyticsController
  - phase: 07-analytics-dashboard
    plan: 03
    provides: DashboardRepository, DashboardService, DashboardSummaryJob, DashboardController
  - phase: 02-credential-management-oauth
    provides: TokenEncryptionService, CredentialManagementModule
  - phase: 06-scheduling-publishing-engine
    provides: ScheduleModule, SchedulingPublishingModule pattern reference

provides:
  - "AnalyticsDashboardModule registered in AppModule with all providers via useFactory pattern"
  - "usePostAnalytics SWR hook for /analytics/posts/:postId endpoint"
  - "useDashboard SWR hook for /dashboard?companySlug= endpoint with 60s refresh"
  - "MetricsSnapshotRow: 7 metric cards per time-window snapshot, null renders as '--'"
  - "PostAnalyticsPanel: groups variants, shows 1h/24h/7d progression with platform badges"
  - "PostAnalyticsSection: client component with post ID input, routes to PostAnalyticsPanel"
  - "4 dashboard widgets: ScheduledTodayWidget, PendingReviewWidget, FailedPostsWidget, TopPerformersWidget"
  - "DashboardPage: 2x2 grid layout using useDashboard + useCompany hooks"
  - "/dashboard route page (Command Centre)"
  - "/analytics route updated with PostAnalyticsSection (R11.4)"

affects:
  - "End-user sees working Command Centre at /dashboard"
  - "End-user can view per-post analytics at /analytics via post ID input"
  - "Both Cron jobs (@5min analytics ingestion, @15min dashboard summary) active when RUN_CRON=true"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useFactory DI pattern for all providers (consistent with Phases 2-6 modules)"
    - "JSDoc block comment asterisk escaping — avoid */5 pattern inside /** */ blocks (TypeScript parses as end-of-comment)"
    - "SWR hook per file per CLAUDE.md rules-of-hooks compliance"
    - "useFetch from @gitroom/helpers/utils/custom.fetch for all SWR fetchers"
    - "Local response interfaces in frontend hooks to avoid importing NestJS backend types"
    - "Server component + client component composition for /analytics page (preserves metadata export)"

key-files:
  created:
    - extensions/analytics-dashboard/src/analytics-dashboard.module.ts
    - apps/frontend/src/components/analytics/hooks/use-post-analytics.ts
    - apps/frontend/src/components/analytics/hooks/use-dashboard.ts
    - apps/frontend/src/components/analytics/metrics-snapshot-row.tsx
    - apps/frontend/src/components/analytics/post-analytics-panel.tsx
    - apps/frontend/src/components/analytics/post-analytics-section.tsx
    - apps/frontend/src/components/dashboard/scheduled-today-widget.tsx
    - apps/frontend/src/components/dashboard/pending-review-widget.tsx
    - apps/frontend/src/components/dashboard/failed-posts-widget.tsx
    - apps/frontend/src/components/dashboard/top-performers-widget.tsx
    - apps/frontend/src/components/dashboard/dashboard-page.tsx
    - apps/frontend/src/app/(app)/(site)/dashboard/page.tsx
  modified:
    - extensions/analytics-dashboard/src/index.ts
    - apps/backend/src/app.module.ts
    - apps/frontend/src/app/(app)/(site)/analytics/page.tsx

key-decisions:
  - "JSDoc block comment avoids */5 pattern — TypeScript parser treats */ as end-of-block-comment inside /** */ blocks; escaped by removing cron schedule from JSDoc"
  - "PostAnalyticsSection as separate client component — /analytics page must remain a server component to export metadata; composition allows mixing server and client"
  - "Local DashboardResponse interface in use-dashboard.ts — avoids importing @social/analytics-dashboard backend types into frontend bundle"
  - "useDashboard refreshInterval 60000 — near-real-time dashboard updates without overwhelming the backend (cache already pre-computed)"

requirements-completed: [R11.4, R12.1, R12.2, R12.3, R12.4, R12.5, R12.6, NF3.1, NF3.2]

# Metrics
duration: 20min
completed: 2026-03-11
---

# Phase 7 Plan 04: NestJS Module Wiring and Frontend Dashboard Summary

**AnalyticsDashboardModule registered in AppModule with all providers via useFactory; complete frontend built with useDashboard/usePostAnalytics SWR hooks, 4 dashboard widgets (scheduled/review/failures/top-performers) in 2x2 grid, and per-post analytics panel accessible at /analytics route via post ID input**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-11T01:08:41Z
- **Completed:** 2026-03-11T01:28:00Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Created AnalyticsDashboardModule with all 9 providers via useFactory pattern matching Phase 6 reference
- Wired ScheduleModule.forRoot() for @Cron support on both ingestion and summary jobs
- Wired CredentialManagementModule for TokenEncryptionService injection into AnalyticsService
- Both controllers double-registered (controllers[] and providers[]) per NestJS routing + DI requirement
- Registered AnalyticsDashboardModule in AppModule after SchedulingPublishingModule
- Exported AnalyticsDashboardModule from barrel index.ts
- Created usePostAnalytics SWR hook: null key when postId empty, fetches /analytics/posts/:postId
- Created useDashboard SWR hook: 60s refresh interval, handles 'all' for cross-company (R12.6)
- Created MetricsSnapshotRow: 7 metric cards (impressions, reach, likes, comments, shares, saves, clicks); null values as '--'
- Created PostAnalyticsPanel: groups by variantId, shows platform badge + 1h/24h/7d snapshot rows; loading/error/empty states
- Created PostAnalyticsSection: client component with post ID input form and conditional PostAnalyticsPanel
- Updated /analytics page to include PostAnalyticsSection alongside existing PlatformAnalytics (server component preserved for metadata)
- Created 4 dashboard widgets with Tailwind-only styling using newBgColorInner/newTableBorder theme tokens
- ScheduledTodayWidget: sorted by scheduledAt asc, HH:MM UTC time, empty state
- PendingReviewWidget: amber count badge when >0, confidence score color coding (red<0.5, amber 0.5-0.7, green>0.7)
- FailedPostsWidget: red count badge when >0, FAILED=red/STALE=amber status badges, error message display
- TopPerformersWidget: ranked 1-5 with likes/comments/shares breakdown and prominent total engagement
- Created DashboardPage with 2x2 responsive grid, useCompany() for scoping, 'Updated X ago' indicator
- Created /dashboard route page (Command Centre)

## Task Commits

Each task was committed atomically:

1. **Task 1: AnalyticsDashboardModule wiring and AppModule registration** - `ec6e363e` (feat)
2. **Task 2: Frontend SWR hooks and per-post analytics components** - `e2f8d96b` (feat)
3. **Task 3: Dashboard widgets and dashboard route page** - `1f4b2ea4` (feat)

## Files Created/Modified

- `extensions/analytics-dashboard/src/analytics-dashboard.module.ts` - NestJS module wiring all analytics providers
- `extensions/analytics-dashboard/src/index.ts` - Added AnalyticsDashboardModule export
- `apps/backend/src/app.module.ts` - Registered AnalyticsDashboardModule in imports array
- `apps/frontend/src/components/analytics/hooks/use-post-analytics.ts` - SWR hook for /analytics/posts/:postId
- `apps/frontend/src/components/analytics/hooks/use-dashboard.ts` - SWR hook for /dashboard with 60s refresh
- `apps/frontend/src/components/analytics/metrics-snapshot-row.tsx` - 7-card metric row per snapshot
- `apps/frontend/src/components/analytics/post-analytics-panel.tsx` - Per-variant analytics display
- `apps/frontend/src/components/analytics/post-analytics-section.tsx` - Post ID input + analytics panel
- `apps/frontend/src/components/dashboard/scheduled-today-widget.tsx` - Today's scheduled posts card
- `apps/frontend/src/components/dashboard/pending-review-widget.tsx` - Pending review card with confidence scores
- `apps/frontend/src/components/dashboard/failed-posts-widget.tsx` - Publish failures card (FAILED + STALE)
- `apps/frontend/src/components/dashboard/top-performers-widget.tsx` - Top 5 posts by engagement
- `apps/frontend/src/components/dashboard/dashboard-page.tsx` - Command Centre 2x2 grid layout
- `apps/frontend/src/app/(app)/(site)/dashboard/page.tsx` - /dashboard route page
- `apps/frontend/src/app/(app)/(site)/analytics/page.tsx` - Updated with PostAnalyticsSection

## Decisions Made

- JSDoc block comment in analytics-dashboard.module.ts avoids `*/5` pattern (cron expression) — TypeScript parser treats `*/` inside `/** */` as end-of-block-comment; escaped by removing cron schedules from JSDoc
- PostAnalyticsSection as a separate 'use client' component — /analytics page must remain server component to preserve the `metadata` export; Next.js app router composition pattern enables mixing
- Local DashboardResponse interface in use-dashboard.ts — prevents importing @social/analytics-dashboard (NestJS deps) into the frontend bundle, which causes bundler errors
- useDashboard refreshInterval 60000ms — near-real-time dashboard without hammering backend; cache already pre-computed by DashboardSummaryJob every 15 minutes

## Deviations from Plan

**1. [Rule 1 - Bug] JSDoc cron expression caused TypeScript parse error**
- **Found during:** Task 1 (TypeScript compilation check)
- **Issue:** JSDoc block comment containing `*/5 * * * *` (cron schedule) causes TypeScript to interpret `*/` as the closing delimiter of the `/** */` block comment, then parse the remaining `5 * * * *` as source code
- **Fix:** Replaced cron expressions in JSDoc with plain English ("every 5 minutes", "every 15 minutes")
- **Files modified:** extensions/analytics-dashboard/src/analytics-dashboard.module.ts
- **Commit:** ec6e363e (Task 1 commit)

**2. [Rule 2 - Missing Critical] PostAnalyticsSection as separate client component**
- **Found during:** Task 2 (analytics page update)
- **Issue:** The existing /analytics page exports `metadata` which requires it to be a server component. Plan specified making the page 'use client', but that would break the metadata export causing a Next.js compilation error
- **Fix:** Created PostAnalyticsSection as a separate 'use client' component; server page imports and renders it (standard Next.js composition pattern)
- **Files modified:** analytics/page.tsx, created post-analytics-section.tsx
- **Commit:** e2f8d96b (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 TypeScript parse bug, 1 Next.js composition pattern)
**Impact on plan:** Both fixes maintain the original intent with technically correct implementations. No scope change.

## Requirements Satisfied

- **R11.4:** PostAnalyticsPanel accessible at /analytics route with post ID selection input — PASSED
- **R12.1:** ScheduledTodayWidget shows count + sorted post list from pre-computed cache — PASSED
- **R12.2:** PendingReviewWidget shows count badge (amber) + confidence score color coding — PASSED
- **R12.3:** FailedPostsWidget covers FAILED + STALE posts with status badges — PASSED
- **R12.4:** TopPerformersWidget shows top 5 ranked by totalEngagement with breakdown — PASSED
- **R12.5:** All dashboard data from useDashboard hook, which reads /dashboard (pre-computed cache only) — PASSED
- **R12.6:** useDashboard passes 'all' when no companySlug, enabling cross-company aggregation — PASSED
- **NF3.1:** Single DashboardCache row read in controller, served via useDashboard (60s SWR cache) — PASSED
- **NF3.2:** No live platform API calls in frontend — PostAnalyticsPanel reads from PostMetrics table — PASSED

## Self-Check: PASSED

All created files verified:
- extensions/analytics-dashboard/src/analytics-dashboard.module.ts: FOUND
- apps/frontend/src/components/analytics/hooks/use-post-analytics.ts: FOUND
- apps/frontend/src/components/analytics/hooks/use-dashboard.ts: FOUND
- apps/frontend/src/components/analytics/metrics-snapshot-row.tsx: FOUND
- apps/frontend/src/components/analytics/post-analytics-panel.tsx: FOUND
- apps/frontend/src/components/analytics/post-analytics-section.tsx: FOUND
- apps/frontend/src/components/dashboard/scheduled-today-widget.tsx: FOUND
- apps/frontend/src/components/dashboard/pending-review-widget.tsx: FOUND
- apps/frontend/src/components/dashboard/failed-posts-widget.tsx: FOUND
- apps/frontend/src/components/dashboard/top-performers-widget.tsx: FOUND
- apps/frontend/src/components/dashboard/dashboard-page.tsx: FOUND
- apps/frontend/src/app/(app)/(site)/dashboard/page.tsx: FOUND

Commits verified:
- ec6e363e (Task 1): FOUND
- e2f8d96b (Task 2): FOUND
- 1f4b2ea4 (Task 3): FOUND

---
*Phase: 07-analytics-dashboard*
*Completed: 2026-03-11*
