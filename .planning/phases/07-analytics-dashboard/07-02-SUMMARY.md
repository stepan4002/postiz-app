---
phase: 07-analytics-dashboard
plan: 02
subsystem: analytics-ingestion
tags: [nestjs, analytics, adapters, cron, postgresql, instagram, facebook, linkedin, x, extension-package]

# Dependency graph
requires:
  - phase: 07-analytics-dashboard
    plan: 01
    provides: PostMetrics Prisma model, AnalyticsAdapter interface, DueIngestionItem type, SnapshotType type
  - phase: 02-credential-management-oauth
    provides: TokenEncryptionService.decrypt() for token decryption before adapter dispatch
  - phase: 06-scheduling-publishing-engine
    provides: AdapterRegistry pattern, BaseAdapter pattern, PostVariant.publishedAt, PostVariant.platformPostId

provides:
  - "4 platform analytics adapters (Instagram, Facebook, LinkedIn, X) implementing AnalyticsAdapter interface"
  - "AnalyticsAdapterRegistry with getAdapter(platform) dispatch"
  - "AnalyticsRepository with upsertMetrics (idempotent on variantId_snapshotType) and findDueForIngestion"
  - "AnalyticsService.processVariant: decrypt -> adapter -> upsert pipeline"
  - "AnalyticsIngestionJob @Cron('*/5 * * * *') with RUN_CRON guard and per-item error isolation"
  - "AnalyticsController: GET /analytics/variants/:variantId and GET /analytics/posts/:postId"

affects:
  - 07-03-dashboard-cache-service (uses AnalyticsRepository for top performers query)
  - 07-04-dashboard-api (uses AnalyticsController endpoints)
  - 07-05-dashboard-frontend (consumes analytics REST endpoints)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BaseAnalyticsAdapter abstract class with buildMetrics() null-fill helper and handleApiError() classifier"
    - "5 parallel Promise.all calls for LinkedIn (one per queryType) — API requires separate calls"
    - "Instagram uses 'views' metric (not deprecated 'impressions') with 3 parallel calls"
    - "Facebook uses 'post_media_views' (not deprecated 'post_impressions')"
    - "X graceful 403 fallback for non_public_metrics on posts >30 days old"
    - "findDueForIngestion over-fetches (batchSize*3) then JS-filters elapsed-time windows"
    - "ITokenEncryptionService local interface avoids circular import from credential-management"

key-files:
  created:
    - extensions/analytics-dashboard/src/adapters/base.analytics.adapter.ts
    - extensions/analytics-dashboard/src/adapters/instagram.analytics.adapter.ts
    - extensions/analytics-dashboard/src/adapters/facebook.analytics.adapter.ts
    - extensions/analytics-dashboard/src/adapters/linkedin.analytics.adapter.ts
    - extensions/analytics-dashboard/src/adapters/x.analytics.adapter.ts
    - extensions/analytics-dashboard/src/adapters/analytics.adapter.registry.ts
    - extensions/analytics-dashboard/src/analytics/analytics.repository.ts
    - extensions/analytics-dashboard/src/analytics/analytics.service.ts
    - extensions/analytics-dashboard/src/analytics/analytics-ingestion.job.ts
    - extensions/analytics-dashboard/src/analytics/analytics.controller.ts
  modified:
    - extensions/analytics-dashboard/src/index.ts
    - extensions/analytics-dashboard/src/types/analytics.types.ts

key-decisions:
  - "ITokenEncryptionService local interface in analytics.service.ts avoids importing @social/credential-management — same pattern as Phase 2 IRefreshIntegrationService"
  - "findDueForIngestion fetches batchSize*3 candidates then JS-filters — Prisma cannot compute elapsed-time math in WHERE clause"
  - "XAnalyticsAdapter graceful 403 fallback: retry with public_metrics only when non_public_metrics unavailable (posts >30 days)"
  - "Instagram 3 parallel calls: insights (reach/shares/saves) + views (impressions) + basic fields (likes/comments)"
  - "LinkedIn 5 parallel calls per post: IMPRESSION/MEMBERS_REACHED/REACTION/COMMENT/RESHARE (API design requirement)"
  - "AnalyticsAdapter interface updated to include optional platformAccountId — required for page-scoped platforms"

requirements-completed: [R11.1, R11.3, R11.4, R11.5, NF3.2]

# Metrics
duration: 7min
completed: 2026-03-11
---

# Phase 7 Plan 02: Analytics Ingestion Pipeline Summary

**Analytics ingestion pipeline with 4 platform adapters (Instagram/Facebook/LinkedIn/X), AnalyticsAdapterRegistry, AnalyticsRepository (idempotent upsert via variantId_snapshotType), AnalyticsIngestionJob (@Cron 5-min with RUN_CRON guard), and REST endpoints for per-post and per-variant analytics**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-11T00:57:49Z
- **Completed:** 2026-03-11T01:04:31Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Created BaseAnalyticsAdapter with buildMetrics() null-fill helper and handleApiError() error classifier
- Created InstagramAnalyticsAdapter: 3 parallel calls, uses 'views' (not deprecated 'impressions'), saves from 'saved'
- Created FacebookAnalyticsAdapter: 3 parallel calls, uses 'post_media_views' (not deprecated 'post_impressions')
- Created LinkedInAnalyticsAdapter: 5 parallel Promise.all calls (IMPRESSION/MEMBERS_REACHED/REACTION/COMMENT/RESHARE)
- Created XAnalyticsAdapter: public+non_public_metrics with graceful 403 fallback for posts >30 days old
- Created AnalyticsAdapterRegistry with eager instantiation of all 4 adapters, Map-based dispatch
- Created AnalyticsRepository with idempotent upsertMetrics (@@unique variantId_snapshotType) and findDueForIngestion with SocialAccount->Integration join
- Created AnalyticsService with processVariant pipeline (decrypt -> adapter -> upsert)
- Created AnalyticsIngestionJob with @Cron('*/5 * * * *'), RUN_CRON guard, per-item error isolation
- Created AnalyticsController with GET /analytics/variants/:variantId and GET /analytics/posts/:postId

## Task Commits

Each task was committed atomically:

1. **Task 1: Platform analytics adapters and AnalyticsAdapterRegistry** - `bcec142b` (feat)
2. **Task 2: AnalyticsRepository, AnalyticsIngestionJob, AnalyticsService, and AnalyticsController** - `1ba82eb1` (feat)

## Files Created/Modified

- `extensions/analytics-dashboard/src/adapters/base.analytics.adapter.ts` - Abstract base with buildMetrics() and handleApiError()
- `extensions/analytics-dashboard/src/adapters/instagram.analytics.adapter.ts` - Meta Graph API v21.0, 'views' metric
- `extensions/analytics-dashboard/src/adapters/facebook.analytics.adapter.ts` - Meta Graph API v21.0, 'post_media_views' metric
- `extensions/analytics-dashboard/src/adapters/linkedin.analytics.adapter.ts` - LinkedIn REST API 202506, 5 parallel calls
- `extensions/analytics-dashboard/src/adapters/x.analytics.adapter.ts` - X API v2, graceful 403 fallback
- `extensions/analytics-dashboard/src/adapters/analytics.adapter.registry.ts` - Registry with Map-based dispatch
- `extensions/analytics-dashboard/src/analytics/analytics.repository.ts` - Prisma CRUD with idempotent upsert and due-item query
- `extensions/analytics-dashboard/src/analytics/analytics.service.ts` - Orchestrates decrypt -> adapter -> upsert
- `extensions/analytics-dashboard/src/analytics/analytics-ingestion.job.ts` - @Cron 5-min poller with RUN_CRON guard
- `extensions/analytics-dashboard/src/analytics/analytics.controller.ts` - GET endpoints for variant and post analytics
- `extensions/analytics-dashboard/src/index.ts` - Updated barrel with all Plan 02 exports
- `extensions/analytics-dashboard/src/types/analytics.types.ts` - Added optional platformAccountId to AnalyticsAdapter interface

## Decisions Made

- ITokenEncryptionService local interface in analytics.service.ts — avoids importing @social/credential-management (same pattern as Phase 2 IRefreshIntegrationService); actual service injected at module wiring
- findDueForIngestion over-fetches batchSize*3 candidates and JS-filters elapsed time — Prisma cannot express time arithmetic in WHERE clause
- XAnalyticsAdapter 403 graceful fallback — post >30 days returns 403 on non_public_metrics; we retry with public_metrics only and store clicks=null
- Instagram 3 parallel calls — views metric separate from insights endpoint per Meta API design
- LinkedIn 5 parallel calls — required by API design; no multi-metric batch endpoint available
- AnalyticsAdapter interface updated to add optional platformAccountId — Facebook/LinkedIn page-scoped APIs need account ID separate from token

## Deviations from Plan

**1. [Rule 1 - Bug] Added optional platformAccountId to AnalyticsAdapter interface**
- **Found during:** Task 2 (AnalyticsService TypeScript compile)
- **Issue:** Plan 01 AnalyticsAdapter interface only declared 2 parameters for fetchPostMetrics. Plan 02 specifies 3 parameters (adds optional platformAccountId) to support page-scoped platforms. TypeScript error: "Expected 2 arguments, but got 3."
- **Fix:** Added `platformAccountId?: string` as third optional parameter to AnalyticsAdapter.fetchPostMetrics() in analytics.types.ts
- **Files modified:** extensions/analytics-dashboard/src/types/analytics.types.ts
- **Commit:** 1ba82eb1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 interface signature mismatch)
**Impact on plan:** Interface extension only — adds optional parameter, backward compatible, no scope creep.

## Success Criteria Verification

- R11.1: AnalyticsIngestionJob @Cron('*/5 * * * *') pulls metrics at T+1h, T+24h, T+7d - PASSED
- R11.3: upsertMetrics uses Prisma upsert on variantId_snapshotType unique constraint - PASSED
- R11.4: AnalyticsController exposes GET /analytics/variants/:variantId and GET /analytics/posts/:postId - PASSED
- R11.5: AnalyticsIngestionJob is fully decoupled from PublishingWorkerJob (separate @Cron job) - PASSED
- NF3.2: No live platform API calls in controller — data served from PostMetrics table - PASSED
- TypeScript compiles without errors - PASSED

## Self-Check: PASSED

All created files verified:
- extensions/analytics-dashboard/src/adapters/base.analytics.adapter.ts: FOUND
- extensions/analytics-dashboard/src/adapters/instagram.analytics.adapter.ts: FOUND
- extensions/analytics-dashboard/src/adapters/facebook.analytics.adapter.ts: FOUND
- extensions/analytics-dashboard/src/adapters/linkedin.analytics.adapter.ts: FOUND
- extensions/analytics-dashboard/src/adapters/x.analytics.adapter.ts: FOUND
- extensions/analytics-dashboard/src/adapters/analytics.adapter.registry.ts: FOUND
- extensions/analytics-dashboard/src/analytics/analytics.repository.ts: FOUND
- extensions/analytics-dashboard/src/analytics/analytics.service.ts: FOUND
- extensions/analytics-dashboard/src/analytics/analytics-ingestion.job.ts: FOUND
- extensions/analytics-dashboard/src/analytics/analytics.controller.ts: FOUND

Commits verified:
- bcec142b (Task 1): FOUND
- 1ba82eb1 (Task 2): FOUND

---
*Phase: 07-analytics-dashboard*
*Completed: 2026-03-11*
