---
phase: 07-analytics-dashboard
verified: 2026-03-11T03:00:00Z
status: passed
score: 14/14 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 12/14
  gaps_closed:
    - "Failed posts error message surfaces in dashboard widget — field name mismatch resolved (lastError -> lastPublishError)"
    - "NF3.4 compound index on companyId + platform + status added to PostVariant with dedicated migration"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to /dashboard in a running instance with data"
    expected: "4 widget cards in 2x2 grid; failed posts widget shows lastPublishError text; Updated X minutes ago shows correct time"
    why_human: "Visual correctness, responsive layout, and live data rendering cannot be verified statically"
  - test: "Navigate to /analytics, enter a valid post ID, click Load Analytics"
    expected: "PostAnalyticsPanel appears showing per-variant metric rows for 1h/24h/7d snapshots; null values display as --"
    why_human: "Interactive form flow and data rendering require running app with real PostMetrics data"
  - test: "Set RUN_CRON=true, wait 5 minutes, check logs and PostMetrics table"
    expected: "Analytics ingestion complete: N/M variants ingested log appears; PostMetrics rows created for PUBLISHED variants"
    why_human: "Requires running Docker environment with live data"
  - test: "Verify platform adapter API calls use correct non-deprecated field names"
    expected: "No 400 errors from platform APIs; Instagram uses views not impressions; Facebook uses post_media_views not post_impressions"
    why_human: "Requires live platform API credentials and published posts to test"
---

# Phase 7: Analytics Dashboard Verification Report

**Phase Goal:** Engagement metrics collected per post, personal dashboard shows operator what needs attention.
**Verified:** 2026-03-11T03:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (previous score 12/14, now 14/14)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PostMetrics model exists with variantId+snapshotType unique constraint for idempotent upsert | VERIFIED | `schema.prisma` line 503: `@@unique([variantId, snapshotType])` — R11.3 key present |
| 2 | DashboardCache model exists with one cache per company (companyId unique) | VERIFIED | `schema.prisma` line 514: `companyId String @unique` |
| 3 | DB indexes exist on companyId+createdAt and companyId+platform for PostMetrics | VERIFIED | `schema.prisma` lines 504-505: both indexes present; migration.sql confirms creation |
| 4 | @social/analytics-dashboard package resolves in pnpm workspace | VERIFIED | `pnpm-workspace.yaml` has `extensions/**`; `tsconfig.base.json` has path alias |
| 5 | Type contracts define SnapshotType, MetricsSnapshot, AnalyticsAdapter, DashboardData interfaces | VERIFIED | `analytics.types.ts` exports all 9 required types with correct signatures |
| 6 | AnalyticsIngestionJob runs every 5 minutes via @Cron with RUN_CRON guard and per-item error isolation | VERIFIED | `analytics-ingestion.job.ts` line 40: `@Cron('*/5 * * * *')`, RUN_CRON guard, per-item try/catch |
| 7 | Metrics ingestion is idempotent via Prisma upsert on variantId+snapshotType | VERIFIED | `analytics.repository.ts`: `prisma.postMetrics.upsert` with `where: { variantId_snapshotType: { variantId, snapshotType } }` |
| 8 | DashboardSummaryJob pre-computes per-company data every 15 minutes | VERIFIED | `dashboard-summary.job.ts` line 26: `@Cron('*/15 * * * *')`, line 28: RUN_CRON guard, per-company try/catch |
| 9 | Dashboard controller serves pre-computed data only — no live API calls or expensive queries | VERIFIED | `dashboard.controller.ts` calls only `dashboardService.getDashboard()` / `getDashboardAllCompanies()` which read only from `DashboardCache` |
| 10 | AnalyticsDashboardModule is registered in AppModule with all providers | VERIFIED | `app.module.ts` line 35 (import) and line 58 (imports array): `AnalyticsDashboardModule` |
| 11 | Per-post analytics panel shows 1h/24h/7d snapshots accessible at /analytics route | VERIFIED | `post-analytics-panel.tsx` renders `MetricsSnapshotRow` per snapshot; `/analytics/page.tsx` includes `PostAnalyticsSection` |
| 12 | Dashboard page has 4 widgets: scheduled today, pending review, failed posts, top performers | VERIFIED | `dashboard-page.tsx` renders all 4 widgets from `useDashboard` hook in 2x2 grid |
| 13 | Failed posts error message surfaces in dashboard widget | VERIFIED | `use-dashboard.ts` line 33: `FailedPostSummary.lastPublishError` now matches backend JSON key; `failed-posts-widget.tsx` line 79: reads `post.lastPublishError` — field chain consistent end-to-end |
| 14 | NF3.4 compound index on companyId + platform + status exists on PostVariant | VERIFIED | `schema.prisma` line 454: `@@index([companyId, platform, status])` on PostVariant; migration `20260311100000_postvariant_companyid_index/migration.sql` creates `PostVariant_companyId_platform_status_idx` |

**Score:** 14/14 truths verified

---

## Gap Closure Details

### Gap 1 Closed: FailedPostSummary field name mismatch

**Previous state:** `FailedPostSummary.lastError` in `use-dashboard.ts` did not match the JSON key `lastPublishError` stored by `dashboard-summary.job.ts`. The widget read `post.lastError` which was always `undefined`.

**Fix applied:**
- `use-dashboard.ts` line 33: field renamed from `lastError` to `lastPublishError`
- `failed-posts-widget.tsx` lines 79, 81: reads `post.lastPublishError` (was `post.lastError`)

**Verified field chain:**
1. `PostVariant.lastPublishError` (schema.prisma line 437)
2. Stored as `lastPublishError` in `DashboardCache.failedPostsJson` (dashboard-summary.job.ts lines 159, 218)
3. Typed as `FailedPostSummary.lastPublishError` in `use-dashboard.ts` line 33
4. Rendered as `post.lastPublishError` in `failed-posts-widget.tsx` line 79

### Gap 2 Closed: NF3.4 compound index on companyId + platform + status

**Previous state:** `@@index([companyId, platform])` existed on PostMetrics (2 columns, no status). PostVariant had `@@index([platform, status])` (no companyId prefix). The 3-column compound was missing.

**Fix applied:**
- `schema.prisma` line 444: Added `companyId String?` denormalized column to PostVariant
- `schema.prisma` line 454: Added `@@index([companyId, platform, status])` to PostVariant
- New migration `20260311100000_postvariant_companyid_index/migration.sql`:
  - `ALTER TABLE "PostVariant" ADD COLUMN "companyId" TEXT`
  - Backfill UPDATE from ContentPost
  - FK constraint to Company with ON DELETE CASCADE
  - `CREATE INDEX "PostVariant_companyId_platform_status_idx" ON "PostVariant"("companyId", "platform", "status")`

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/analytics-dashboard/package.json` | @social/analytics-dashboard package definition | VERIFIED | name: "@social/analytics-dashboard", private: true |
| `extensions/analytics-dashboard/src/types/analytics.types.ts` | 9 type contracts exported | VERIFIED | All 9 types present including corrected FailedPostSummary.lastPublishError |
| `extensions/analytics-dashboard/src/index.ts` | Barrel exports for all classes | VERIFIED | Exports all types + pipeline classes + AnalyticsDashboardModule |
| `libraries/nestjs-libraries/src/database/prisma/schema.prisma` | PostMetrics and DashboardCache models + NF3.4 indexes | VERIFIED | Both models present; PostVariant now has @@index([companyId, platform, status]) at line 454 |
| `libraries/nestjs-libraries/src/database/prisma/migrations/20260311000000_analytics_dashboard/migration.sql` | Migration SQL for PostMetrics and DashboardCache | VERIFIED | Creates both tables, unique indexes, performance indexes, FK constraints |
| `libraries/nestjs-libraries/src/database/prisma/migrations/20260311100000_postvariant_companyid_index/migration.sql` | Gap-closure migration for NF3.4 compound index | VERIFIED | Adds companyId to PostVariant, backfills, adds FK, creates 3-column index |
| `extensions/analytics-dashboard/src/adapters/analytics.adapter.registry.ts` | AnalyticsAdapterRegistry with getAdapter() | VERIFIED | Registry eagerly instantiates 4 adapters, Map-based dispatch |
| `extensions/analytics-dashboard/src/analytics/analytics-ingestion.job.ts` | @Cron poller every 5 minutes | VERIFIED | `@Cron('*/5 * * * *')`, RUN_CRON guard, BATCH_SIZE=20, per-item error isolation |
| `extensions/analytics-dashboard/src/analytics/analytics.repository.ts` | PostMetrics CRUD with upsertMetrics | VERIFIED | Idempotent upsert on variantId_snapshotType |
| `extensions/analytics-dashboard/src/analytics/analytics.controller.ts` | GET /analytics/variants/:variantId and GET /analytics/posts/:postId | VERIFIED | Both endpoints present |
| `extensions/analytics-dashboard/src/dashboard/dashboard-summary.job.ts` | @Cron every 15 minutes | VERIFIED | Stores lastPublishError correctly in failedPostsJson |
| `extensions/analytics-dashboard/src/dashboard/dashboard.repository.ts` | DashboardCache CRUD | VERIFIED | upsertCache, getByCompanyId, getAllCaches all present |
| `extensions/analytics-dashboard/src/dashboard/dashboard.controller.ts` | GET /dashboard?companySlug= | VERIFIED | Returns pre-computed cache only; 404 on unknown slug |
| `extensions/analytics-dashboard/src/dashboard/dashboard.service.ts` | Cache assembly + cross-company aggregation | VERIFIED | getDashboard reads cache only; EMPTY_DASHBOARD fallback |
| `extensions/analytics-dashboard/src/analytics-dashboard.module.ts` | NestJS module wiring all providers | VERIFIED | 9 providers via useFactory, ScheduleModule.forRoot() |
| `apps/backend/src/app.module.ts` | AnalyticsDashboardModule registered | VERIFIED | Line 35 (import), line 58 (imports array) |
| `apps/frontend/src/components/analytics/hooks/use-post-analytics.ts` | SWR hook for /analytics/posts/:postId | VERIFIED | useFetch from @gitroom/helpers, separate hook file, CLAUDE.md compliant |
| `apps/frontend/src/components/analytics/hooks/use-dashboard.ts` | SWR hook for /dashboard endpoint | VERIFIED | FailedPostSummary.lastPublishError now correct; 60s refreshInterval; 'all' fallback |
| `apps/frontend/src/components/analytics/post-analytics-panel.tsx` | Per-post analytics panel | VERIFIED | Groups by variantId, shows 1h/24h/7d via MetricsSnapshotRow |
| `apps/frontend/src/components/analytics/post-analytics-section.tsx` | Post ID input + analytics panel | VERIFIED | Client component with input form, conditional PostAnalyticsPanel render |
| `apps/frontend/src/app/(app)/(site)/analytics/page.tsx` | Analytics route page | VERIFIED | Server component, renders PostAnalyticsSection |
| `apps/frontend/src/components/dashboard/dashboard-page.tsx` | Dashboard layout with 4 widgets | VERIFIED | 2x2 grid, useCompany() scoping, useDashboard() data, "Updated X ago" indicator |
| `apps/frontend/src/app/(app)/(site)/dashboard/page.tsx` | /dashboard route page | VERIFIED | 'use client', renders DashboardPage |
| `apps/frontend/src/components/dashboard/scheduled-today-widget.tsx` | Today's schedule widget | VERIFIED | Sorted by scheduledAt, HH:MM UTC format, platform color coding |
| `apps/frontend/src/components/dashboard/pending-review-widget.tsx` | Pending review widget | VERIFIED | Confidence score color coding, empty state |
| `apps/frontend/src/components/dashboard/failed-posts-widget.tsx` | Publish failures widget | VERIFIED | Reads post.lastPublishError — now correctly matches backend JSON key |
| `apps/frontend/src/components/dashboard/top-performers-widget.tsx` | Top performers widget | VERIFIED | Ranked 1-5 with engagement breakdown |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `analytics-ingestion.job.ts` | `analytics.adapter.registry.ts` | `adapterRegistry.getAdapter(platform)` | WIRED | Job -> service -> registry chain intact |
| `analytics-ingestion.job.ts` | `analytics.repository.ts` | `analyticsRepo.upsertMetrics` | WIRED | Job calls analyticsService.processVariant -> repo.upsertMetrics |
| `analytics.repository.ts` | `schema.prisma` | `prisma.postMetrics.upsert` with variantId_snapshotType | WIRED | Prisma upsert on composite unique key |
| `dashboard-summary.job.ts` | `dashboard.repository.ts` | `dashboardRepo.upsertCache` | WIRED | Job line 236: await this.dashboardRepo.upsertCache(companyId, {...}) |
| `dashboard.controller.ts` | `dashboard.service.ts` | `dashboardService.getDashboard` | WIRED | Controller delegates to service; service reads only from DashboardCache |
| `dashboard-summary.job.ts` | `schema.prisma` | `prisma.postVariant.count` and PostVariant queries | WIRED | 7 parallel Prisma queries via Promise.all; now also queries via companyId column |
| `app.module.ts` | `analytics-dashboard.module.ts` | `import AnalyticsDashboardModule` | WIRED | Line 35: import; line 58: imports array |
| `dashboard-page.tsx` | `use-dashboard.ts` | `useDashboard` SWR hook | WIRED | import + call: `const { data, isLoading, error } = useDashboard(companySlug ?? null)` |
| `post-analytics-panel.tsx` | `use-post-analytics.ts` | `usePostAnalytics` SWR hook | WIRED | import + call: `const { data, isLoading, error } = usePostAnalytics(postId)` |
| `analytics/page.tsx` | `post-analytics-section.tsx` | renders `PostAnalyticsSection` | WIRED | import + render: `<PostAnalyticsSection />` |
| `use-dashboard.ts` | `dashboard.controller.ts` | `fetch /dashboard?companySlug=` | WIRED | Line 67: fetch with companySlug param |
| `failed-posts-widget.tsx` | `use-dashboard.ts` (FailedPostSummary.lastPublishError) | `post.lastPublishError` reads JSON field | WIRED | Field name now consistent: backend stores lastPublishError, interface declares lastPublishError, widget reads lastPublishError |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R11.1 | 07-02 | Analytics ingestion worker: pull metrics at T+1h, T+24h, T+7d | SATISFIED | `analytics-ingestion.job.ts`: `@Cron('*/5 * * * *')`, findDueForIngestion filters by elapsed time |
| R11.2 | 07-01 | Store per-post metrics: impressions, reach, likes, comments, shares, saves, clicks | SATISFIED | `PostMetrics` model has all 7 metric columns (nullable Int); migration confirms |
| R11.3 | 07-01, 07-02 | Idempotent ingestion (upsert, not insert) | SATISFIED | `@@unique([variantId, snapshotType])` in schema; `prisma.postMetrics.upsert` with composite where key |
| R11.4 | 07-02, 07-04 | Per-post analytics view in UI | SATISFIED | `PostAnalyticsPanel` at `/analytics` route via `PostAnalyticsSection`; 1h/24h/7d per variant |
| R11.5 | 07-02 | Analytics decoupled from publishing | SATISFIED | `AnalyticsIngestionJob` is a separate `@Cron` class; no dependency on `PublishingWorkerJob` |
| R12.1 | 07-03, 07-04 | Today's scheduled posts across all companies | SATISFIED | `DashboardSummaryJob` pre-computes scheduled count + list; `ScheduledTodayWidget` renders |
| R12.2 | 07-03, 07-04 | Posts pending review (count + list) | SATISFIED | `DashboardSummaryJob` pre-computes pendingReviewCount + pendingReviewJson; `PendingReviewWidget` renders |
| R12.3 | 07-03, 07-04 | Recent publish failures requiring attention | SATISFIED | Count, list, and error messages all pre-computed correctly; field name mismatch resolved; `FailedPostsWidget` renders lastPublishError |
| R12.4 | 07-03, 07-04 | Top performing posts from last 7 days | SATISFIED | `DashboardSummaryJob` fetches PostMetrics ordered by engagement; `TopPerformersWidget` shows top 5 |
| R12.5 | 07-03, 07-04 | All data from pre-computed DB queries (no live API calls on dashboard load) | SATISFIED | `DashboardController` reads only from `DashboardCache`; no live platform calls in request path |
| R12.6 | 07-03, 07-04 | Company-scoped view with cross-company summary option | SATISFIED | `getDashboardAllCompanies()` aggregates all caches; `useDashboard` passes 'all' when no slug |
| NF3.1 | 07-03, 07-04 | Dashboard loads from pre-aggregated data (< 2s page load) | SATISFIED | Single DashboardCache row read + JSON parse; SWR 60s cache on frontend |
| NF3.2 | 07-02, 07-04 | No live platform API calls in request path | SATISFIED | Analytics from PostMetrics table; dashboard from DashboardCache; all live calls in background @Cron |
| NF3.4 | 07-01 | DB indexes on `company_id + created_at`, `company_id + platform + status` | SATISFIED | `company_id + created_at`: present on PostMetrics. `company_id + platform + status` (3-column): present on PostVariant via migration 20260311100000 |

---

## Anti-Patterns Found

None. Previously identified blockers in `use-dashboard.ts` and `failed-posts-widget.tsx` have been resolved. No new anti-patterns introduced in gap-closure changes.

---

## Human Verification Required

### 1. Dashboard visual layout and failed posts error display

**Test:** Navigate to `/dashboard` in a running instance with data including at least one failed post.
**Expected:** 4 widget cards in 2x2 grid; failed posts widget shows the `lastPublishError` text in red beneath the post caption; "Updated X minutes ago" reflects recent DashboardCache computedAt.
**Why human:** Visual correctness and the specific rendering of error text require running app with real data.

### 2. Analytics panel post ID UX

**Test:** Navigate to `/analytics`, enter a valid post ID, click "Load Analytics".
**Expected:** `PostAnalyticsPanel` appears below input showing per-variant metric rows for 1h/24h/7d snapshots. Null values display as '--'.
**Why human:** Interactive form flow and data rendering require running app with real PostMetrics data.

### 3. @Cron job execution verification

**Test:** Set `RUN_CRON=true`, wait 5 minutes, check logs and PostMetrics table.
**Expected:** `Analytics ingestion complete: N/M variants ingested` log appears; PostMetrics rows created for PUBLISHED variants.
**Why human:** Requires running Docker environment with live data.

### 4. Platform adapter API calls

**Test:** Verify that adapters call correct non-deprecated endpoints (Instagram 'views' not 'impressions', Facebook 'post_media_views' not 'post_impressions').
**Expected:** No 400 errors from platform APIs on deprecated metric names.
**Why human:** Requires live platform API credentials and published posts to test.

---

## Gaps Summary

No gaps remain. Both previously identified gaps have been closed:

**Gap 1 closed:** `FailedPostSummary.lastError` renamed to `lastPublishError` in `use-dashboard.ts`; `failed-posts-widget.tsx` updated to read `post.lastPublishError`. The full field chain from `PostVariant.lastPublishError` (schema) through `DashboardCache.failedPostsJson` (backend JSON key) to `FailedPostSummary.lastPublishError` (frontend type) to `post.lastPublishError` (widget render) is now consistent.

**Gap 2 closed:** A new dedicated migration (`20260311100000_postvariant_companyid_index`) adds a denormalized `companyId` column to `PostVariant` (with FK and backfill), then creates the `PostVariant_companyId_platform_status_idx` index on `(companyId, platform, status)`. The `schema.prisma` PostVariant model reflects this with `@@index([companyId, platform, status])` at line 454.

Phase 7 goal is fully achieved: engagement metrics are collected per post via the idempotent ingestion pipeline, and the dashboard correctly surfaces scheduled posts, pending reviews, publish failures (with error messages), and top performers to the operator.

---

_Verified: 2026-03-11T03:00:00Z_
_Verifier: Claude (gsd-verifier)_
