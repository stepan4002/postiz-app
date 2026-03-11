# Phase 7: Analytics & Dashboard - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Engagement metrics collected per published post via background ingestion, personal dashboard shows the operator what needs attention across all companies. Covers R11.1-R11.5 (analytics ingestion) and R12.1-R12.6 (personal dashboard). This phase consumes published PostVariants from Phase 6 (with platformPostId) and pulls metrics from platform APIs. Dashboard reads pre-computed data only (R12.5) — no live API calls on page load.

</domain>

<decisions>
## Implementation Decisions

### Metrics Ingestion Worker
- @Cron poller pattern (consistent with Phases 2/4/6) — not BullMQ
- Pull metrics at T+1h, T+24h, T+7d post-publish (R11.1) — three snapshot types per PostVariant
- Store per-post metrics: impressions, reach, likes, comments, shares, saves, clicks (R11.2)
- Idempotent ingestion via upsert keyed on variantId + snapshotType (R11.3)
- Per-job error isolation: one variant's API failure doesn't block others (Phase 4/6 pattern)
- Decoupled from publishing — separate background pipeline (R11.5)
- Uses Phase 2 encrypted credentials (TokenEncryptionService) for platform API auth
- Cron runs every 5 minutes, queries PostVariants where status=PUBLISHED and next snapshot is due
- Batch size limit per tick (e.g., 20) to respect platform API rate limits
- New extension package: @social/analytics-dashboard in extensions/

### Platform Analytics Adapters
- Reuse Phase 6 PlatformAdapter pattern — AnalyticsAdapter interface per platform
- Each adapter: fetchPostMetrics(platformPostId, accessToken) -> MetricsSnapshot
- Platform-specific API calls: Meta Insights API (Instagram/Facebook), LinkedIn Analytics API, X engagement API
- Metrics not available on a platform stored as null (not 0) — e.g., saves only on Instagram
- Study Postiz's existing postAnalytics?() on SocialIntegration interface for API patterns but build fresh in extension zone
- Error handling: transient errors → retry next tick, permanent errors → log and skip

### Per-Post Analytics View
- Dedicated analytics panel accessible from post cards in review queue and scheduling calendar
- Shows all PostVariants for same ContentPost side by side — cross-platform comparison
- Metrics displayed as number cards (impressions, reach, likes, comments, shares, saves, clicks)
- Show all three snapshots (1h, 24h, 7d) as a time progression — operator sees growth trend
- Platform color coding: instagram=pink, facebook=blue, linkedin=sky, x=gray (Phase 5/6 pattern)
- Route: (app)/(site)/analytics — replace or extend existing Postiz analytics page

### Dashboard Layout & Widgets
- Dashboard is the operator's command centre — the landing page after login
- Four main widgets in card layout:
  1. **Today's Scheduled Posts** — list across all companies, sorted by time (R12.1)
  2. **Posts Pending Review** — count badge + list with quick-approve action (R12.2)
  3. **Recent Publish Failures** — FAILED + STALE posts requiring attention (R12.3)
  4. **Top Performing Posts** — last 7 days, ranked by engagement (R12.4)
- Company-scoped view by default (uses ?c= URL param pattern from Phase 1)
- Cross-company summary option: "All Companies" in company switcher shows aggregate (R12.6)
- Route: (app)/(site)/ root or dedicated /dashboard route

### Pre-Computed Data Strategy
- Dashboard reads from pre-computed summary tables — no live API calls (R12.5, NF3.1)
- DashboardSummary cron job runs every 15 minutes — computes counts and aggregates per company
- Pre-computed data: scheduled posts today count, pending review count, failed posts count, top posts with cached metrics
- DB indexes: company_id + created_at, company_id + platform + status (NF3.4)
- Top performers computed from PostMetrics table (sort by total engagement = likes + comments + shares)
- Summary stored in dedicated DashboardCache table or computed queries with DB indexes
- Dashboard page load target: < 2s (NF3.1)

### PostMetrics Data Model
- New PostMetrics entity: variantId, snapshotType (1h/24h/7d), impressions, reach, likes, comments, shares, saves, clicks, fetchedAt
- Unique constraint on variantId + snapshotType for idempotent upsert
- postId FK for efficient per-ContentPost aggregation
- companyId FK for company-scoped dashboard queries
- Platform stored on PostMetrics for cross-platform filtering
- createdAt for time-range queries

### Claude's Discretion
- Exact cron intervals for ingestion and dashboard refresh
- Analytics adapter implementation details for each platform API
- Chart library choice for analytics visualization (if any — number cards may suffice for MVP)
- Dashboard widget styling and responsive layout specifics
- Pagination strategy for dashboard lists (today's posts, failures, etc.)
- How to handle partial metrics (some platforms return subset of fields)
- Loading states and skeleton UI for dashboard
- Whether top performers include a mini sparkline or just numbers

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TokenEncryptionService` (extensions/credential-management): decrypt stored OAuth tokens for platform API calls
- `TokenRefreshJob` (extensions/credential-management): @Cron pattern with per-job error isolation — template for AnalyticsIngestionJob
- `MediaProcessingJob` (extensions/media-library): another @Cron poller pattern with batch processing
- `SchedulerTickJob` (extensions/scheduling-publishing): @Cron pattern for querying due items
- `PlatformAdapter` interface (extensions/scheduling-publishing): publish contract — pattern for AnalyticsAdapter
- `AdapterRegistry` (extensions/scheduling-publishing): eager instantiation of 4 platform adapters
- `ContentPostRepository` (extensions/content-generation): queries ContentPost/PostVariant — extend for analytics
- `FailedPostsController` (extensions/scheduling-publishing): surfaces FAILED+STALE posts — dashboard widget consumes this
- `ReviewQueueService` (extensions/content-generation): pending review count — dashboard widget consumes this
- Existing Postiz `PlatformAnalytics` component (apps/frontend/src/components/platform-analytics): study for patterns but build new
- Existing Postiz `social.integrations.interface.ts`: `analytics?()` and `postAnalytics?()` methods — study API patterns
- `AnalyticsData` interface in Postiz: `{ label, data: [{total, date}], percentageChange }` — reference shape

### Established Patterns
- @Cron poller with batch processing and per-job error isolation (Phases 2/4/6)
- Extension zone: all custom code in extensions/, @social/* path aliases
- Controller -> Service -> Repository layering (no shortcuts)
- Company scoping: explicit companyId parameter (not CLS)
- SWR hooks: each in separate file, useFetch for API calls
- Interface injection for cross-package deps (Phase 2)
- Platform color coding: instagram=pink, facebook=blue, linkedin=sky, x=gray
- Company switcher ?c= URL param for company-scoped views

### Integration Points
- Phase 2 credentials: OAuth tokens needed for platform analytics API calls
- Phase 5 content: ContentPost/PostVariant models — analytics attaches to PostVariant via variantId
- Phase 6 publishing: PostVariant.platformPostId is the key for fetching analytics from platforms
- Phase 6 scheduling: SchedulingRepository queries for today's scheduled posts (dashboard widget)
- Phase 6 failed posts: FailedPostsController data consumed by dashboard widget
- Phase 5 review queue: ReviewQueueService pending count consumed by dashboard widget
- Existing Postiz analytics route: (app)/(site)/analytics/ already exists — extend or replace

</code_context>

<specifics>
## Specific Ideas

No specific requirements from user — auto-mode. Key constraints:

- Dashboard is the operator's daily landing page — must surface what needs attention immediately
- Solo operator managing 5-15 companies: cross-company summary is essential for triage
- Metrics ingestion must not overwhelm platform API rate limits (Instagram 200/hr, Facebook 200/hr, LinkedIn 100/day, X 300/15min)
- Three snapshot intervals (1h, 24h, 7d) give operator a growth trajectory per post
- Top performers drive content strategy — operator sees what works and replicates it
- Failed posts and pending reviews are action items, not just FYI — need clear CTAs
- Existing Postiz analytics page exists but is account-level, not per-post — our analytics is per-published-post metrics

</specifics>

<deferred>
## Deferred Ideas

- Analytics summaries: weekly and monthly reports per company and platform — Milestone 2
- Growth detection: spot fastest-growing company, best-value platforms — Milestone 2
- Content gap detection (e.g., "this brand hasn't posted on LinkedIn for 10 days") — future phase
- AI-powered content performance insights — future phase
- Export analytics to CSV/PDF — future enhancement
- Platform audience demographics — future phase
- Engagement rate calculation (engagement / reach) — future enhancement (depends on reliable reach data)
- Historical trend charts across date ranges — Milestone 2

</deferred>

---

*Phase: 07-analytics-dashboard*
*Context gathered: 2026-03-11*
