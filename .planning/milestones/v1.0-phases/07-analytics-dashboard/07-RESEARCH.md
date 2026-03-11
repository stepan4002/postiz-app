# Phase 7: Analytics & Dashboard - Research

**Researched:** 2026-03-11
**Domain:** Analytics ingestion workers, platform metrics APIs, pre-computed dashboard data
**Confidence:** HIGH (established patterns from Phases 2-6 verified by reading actual code)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Metrics Ingestion Worker**
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

**Platform Analytics Adapters**
- Reuse Phase 6 PlatformAdapter pattern — AnalyticsAdapter interface per platform
- Each adapter: fetchPostMetrics(platformPostId, accessToken) -> MetricsSnapshot
- Platform-specific API calls: Meta Insights API (Instagram/Facebook), LinkedIn Analytics API, X engagement API
- Metrics not available on a platform stored as null (not 0) — e.g., saves only on Instagram
- Study Postiz's existing postAnalytics?() on SocialIntegration interface for API patterns but build fresh in extension zone
- Error handling: transient errors -> retry next tick, permanent errors -> log and skip

**Per-Post Analytics View**
- Dedicated analytics panel accessible from post cards in review queue and scheduling calendar
- Shows all PostVariants for same ContentPost side by side — cross-platform comparison
- Metrics displayed as number cards (impressions, reach, likes, comments, shares, saves, clicks)
- Show all three snapshots (1h, 24h, 7d) as a time progression — operator sees growth trend
- Platform color coding: instagram=pink, facebook=blue, linkedin=sky, x=gray (Phase 5/6 pattern)
- Route: (app)/(site)/analytics — replace or extend existing Postiz analytics page

**Dashboard Layout & Widgets**
- Dashboard is the operator's command centre — the landing page after login
- Four main widgets in card layout:
  1. Today's Scheduled Posts — list across all companies, sorted by time (R12.1)
  2. Posts Pending Review — count badge + list with quick-approve action (R12.2)
  3. Recent Publish Failures — FAILED + STALE posts requiring attention (R12.3)
  4. Top Performing Posts — last 7 days, ranked by engagement (R12.4)
- Company-scoped view by default (uses ?c= URL param pattern from Phase 1)
- Cross-company summary option: "All Companies" in company switcher shows aggregate (R12.6)
- Route: (app)/(site)/ root or dedicated /dashboard route

**Pre-Computed Data Strategy**
- Dashboard reads from pre-computed summary tables — no live API calls (R12.5, NF3.1)
- DashboardSummary cron job runs every 15 minutes — computes counts and aggregates per company
- Pre-computed data: scheduled posts today count, pending review count, failed posts count, top posts with cached metrics
- DB indexes: company_id + created_at, company_id + platform + status (NF3.4)
- Top performers computed from PostMetrics table (sort by total engagement = likes + comments + shares)
- Summary stored in dedicated DashboardCache table or computed queries with DB indexes
- Dashboard page load target: < 2s (NF3.1)

**PostMetrics Data Model**
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

### Deferred Ideas (OUT OF SCOPE)
- Analytics summaries: weekly and monthly reports per company and platform — Milestone 2
- Growth detection: spot fastest-growing company, best-value platforms — Milestone 2
- Content gap detection (e.g., "this brand hasn't posted on LinkedIn for 10 days") — future phase
- AI-powered content performance insights — future phase
- Export analytics to CSV/PDF — future enhancement
- Platform audience demographics — future phase
- Engagement rate calculation (engagement / reach) — future enhancement
- Historical trend charts across date ranges — Milestone 2
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| R11.1 | Analytics ingestion worker: pull metrics at T+1h, T+24h, T+7d post-publish | @Cron pattern verified in TokenRefreshJob and PublishingWorkerJob; snapshotType enum on PostMetrics |
| R11.2 | Store per-post metrics: impressions, reach, likes, comments, shares, saves, clicks | PostMetrics schema; null for unavailable metrics per platform (not 0) |
| R11.3 | Idempotent ingestion (upsert, not insert) | Prisma upsert on unique(variantId, snapshotType) |
| R11.4 | Per-post analytics view in UI | Analytics panel component; SWR hook per CLAUDE.md rules |
| R11.5 | Analytics decoupled from publishing (separate background pipeline) | Separate AnalyticsIngestionJob; no coupling to PublishingWorkerJob |
| R12.1 | Today's scheduled posts across all companies | DashboardRepository query; DashboardCache pre-compute |
| R12.2 | Posts pending review (review queue count + list) | ReviewQueueService.count() already exported from Phase 5 |
| R12.3 | Recent publish failures requiring attention | FailedPostsController data already available from Phase 6 |
| R12.4 | Top performing posts from last 7 days | PostMetrics aggregate sort by likes+comments+shares |
| R12.5 | All data from pre-computed DB queries (no live API calls on dashboard load) | DashboardCache table + DashboardSummaryJob cron |
| R12.6 | Company-scoped view with cross-company summary option | ?c= param pattern from Phase 1; "All Companies" aggregate query |
| NF3.1 | Dashboard loads from pre-aggregated data (< 2s page load) | DashboardCache eliminates live queries; DB indexes on company_id |
| NF3.2 | No live platform API calls in request path | AnalyticsIngestionJob is background only; dashboard reads cache |
| NF3.4 | Database indexes on company_id + created_at, company_id + platform + status | Already established in schema; PostMetrics needs same indexes |
</phase_requirements>

---

## Summary

Phase 7 has two distinct sub-systems: an analytics ingestion pipeline that pulls post metrics from platform APIs in background, and a pre-computed dashboard that surfaces the operator's daily action items. Both follow deeply established patterns from Phases 2-6.

The ingestion pipeline is a straightforward extension of the @Cron poller pattern from Phases 2, 4, and 6. The core structure is identical to TokenRefreshJob (cron guard, per-item error isolation, batch size, encrypted token decryption) and PublishingWorkerJob (batch processing, platform adapter dispatch). A new AnalyticsAdapter interface mirrors PlatformAdapter from Phase 6, with four platform-specific implementations calling each platform's metrics API.

The dashboard avoids live platform API calls entirely by relying on a DashboardSummaryJob cron that pre-computes counts and aggregates into a DashboardCache table every 15 minutes. The frontend reads only from this cache, guaranteeing sub-2s page loads. All four dashboard widgets have clear data sources already established in prior phases (SchedulingRepository, ReviewQueueService, FailedPostsController, PostMetrics table).

**Primary recommendation:** Build @social/analytics-dashboard in extensions/ following established Phase 6 module pattern. AnalyticsIngestionJob and DashboardSummaryJob are two separate @Cron workers. PostMetrics is the single source of truth for both per-post views and top performers widget.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @nestjs/schedule | Already installed (Phases 2/4/6) | @Cron decorators for ingestion and dashboard jobs | Consistent with all prior cron patterns in codebase |
| @nestjs/common | Already installed | Injectable, Controller, Logger | Core NestJS DI |
| @prisma/client | Already installed | PostMetrics upsert, DashboardCache queries | Project's ORM |
| swr | Already installed (frontend) | usePostAnalytics, useDashboard SWR hooks | CLAUDE.md requirement |
| @gitroom/helpers | Already installed | useFetch for SWR hooks | CLAUDE.md requirement |

### No New Dependencies Required
All required libraries are already installed in the project. Phase 7 adds new extension package `@social/analytics-dashboard` but uses only existing project dependencies.

### Extension Package
```
extensions/analytics-dashboard/
  package.json          @social/analytics-dashboard
  tsconfig.json
  jest.config.ts
  src/
    index.ts
    analytics-dashboard.module.ts
    analytics/          (ingestion side)
    dashboard/          (pre-compute and serve side)
    adapters/           (platform analytics adapters)
    types/
```

---

## Architecture Patterns

### Recommended Extension Structure
```
extensions/analytics-dashboard/src/
├── adapters/                    # Platform analytics API callers
│   ├── analytics.adapter.ts     # AnalyticsAdapter interface
│   ├── base.analytics.adapter.ts
│   ├── instagram.analytics.adapter.ts
│   ├── facebook.analytics.adapter.ts
│   ├── linkedin.analytics.adapter.ts
│   └── x.analytics.adapter.ts
├── analytics/                   # Metrics ingestion
│   ├── analytics-ingestion.job.ts   # @Cron poller
│   ├── analytics.repository.ts      # PostMetrics CRUD
│   ├── analytics.controller.ts      # GET /variants/:id/analytics
│   └── analytics.service.ts         # orchestrate ingestion per variant
├── dashboard/                   # Pre-computed dashboard
│   ├── dashboard-summary.job.ts     # @Cron pre-compute job
│   ├── dashboard.repository.ts      # DashboardCache reads/writes
│   ├── dashboard.controller.ts      # GET /dashboard
│   └── dashboard.service.ts         # assemble dashboard data
├── types/
│   └── analytics.types.ts           # SnapshotType, MetricsSnapshot, DashboardData
└── analytics-dashboard.module.ts
```

### Frontend Structure
```
apps/frontend/src/
├── app/(app)/(site)/
│   ├── analytics/page.tsx              # Extended analytics page (per-post view)
│   └── dashboard/page.tsx             # New: operator dashboard page
├── components/
│   ├── analytics/
│   │   ├── hooks/
│   │   │   ├── use-post-analytics.ts   # SWR: GET /variants/:id/analytics
│   │   │   └── use-dashboard.ts        # SWR: GET /dashboard?c=...
│   │   ├── post-analytics-panel.tsx    # Per-post metrics number cards
│   │   └── metrics-snapshot-row.tsx    # 1h/24h/7d progression display
│   └── dashboard/
│       ├── dashboard-page.tsx          # Top-level layout
│       ├── scheduled-today-widget.tsx  # Widget 1
│       ├── pending-review-widget.tsx   # Widget 2
│       ├── failed-posts-widget.tsx     # Widget 3 (reuses FailedPostsPanel)
│       └── top-performers-widget.tsx   # Widget 4
```

### Pattern 1: AnalyticsIngestionJob (@Cron Poller)
**What:** Every 5 minutes, finds PUBLISHED variants where next snapshot is due, fetches metrics from platform, upserts PostMetrics.
**When to use:** Replaces any other approach — proven pattern from Phases 2/4/6.

```typescript
// Source: Mirrors TokenRefreshJob + PublishingWorkerJob patterns
// extensions/analytics-dashboard/src/analytics/analytics-ingestion.job.ts

@Injectable()
export class AnalyticsIngestionJob {
  private readonly logger = new Logger(AnalyticsIngestionJob.name);
  private static readonly BATCH_SIZE = 20;

  constructor(
    private readonly analyticsRepo: AnalyticsRepository,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly adapterRegistry: AnalyticsAdapterRegistry,
    private readonly prisma: any,
  ) {}

  @Cron('*/5 * * * *')  // Every 5 minutes
  async ingestPendingMetrics(): Promise<void> {
    if (!process.env.RUN_CRON) return;

    const due = await this.analyticsRepo.findDueForIngestion(
      AnalyticsIngestionJob.BATCH_SIZE
    );

    for (const item of due) {
      await this.processVariant(item);  // per-item error isolation
    }
  }

  private async processVariant(item: DueIngestionItem): Promise<void> {
    try {
      const adapter = this.adapterRegistry.getAdapter(item.platform);
      const decryptedToken = this.tokenEncryption.decrypt(item.accessToken);
      const metrics = await adapter.fetchPostMetrics(item.platformPostId, decryptedToken);
      await this.analyticsRepo.upsertMetrics(item.variantId, item.snapshotType, metrics);
      await this.analyticsRepo.markSnapshotDone(item.variantId, item.snapshotType);
    } catch (err) {
      this.logger.error(`Analytics ingestion failed for variant ${item.variantId}: ${err}`);
      // Do NOT rethrow — per-item isolation
    }
  }
}
```

### Pattern 2: AnalyticsAdapter Interface
**What:** Mirrors Phase 6 PlatformAdapter. Each platform implements fetchPostMetrics().

```typescript
// Source: Mirrors PlatformAdapter from extensions/scheduling-publishing/src/types/publishing.types.ts
// extensions/analytics-dashboard/src/types/analytics.types.ts

export type SnapshotType = '1h' | '24h' | '7d';

export interface MetricsSnapshot {
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;     // Instagram only
  clicks: number | null;
}

export interface AnalyticsAdapter {
  platform: string;
  apiVersion: string;
  fetchPostMetrics(platformPostId: string, accessToken: string): Promise<MetricsSnapshot>;
}
```

### Pattern 3: PostMetrics Prisma Model
**What:** New Prisma model with unique constraint on (variantId, snapshotType) for idempotent upsert.

```prisma
// Add to schema.prisma (Phase 7)
model PostMetrics {
  id           String   @id @default(uuid())
  variantId    String
  postId       String
  companyId    String
  platform     String
  snapshotType String   // '1h' | '24h' | '7d'
  impressions  Int?
  reach        Int?
  likes        Int?
  comments     Int?
  shares       Int?
  saves        Int?
  clicks       Int?
  fetchedAt    DateTime @default(now())
  createdAt    DateTime @default(now())
  variant      PostVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  post         ContentPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  company      Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([variantId, snapshotType])           // idempotent upsert key
  @@index([companyId, createdAt])               // NF3.4
  @@index([companyId, platform])                // cross-platform filtering
  @@index([postId])                             // per-ContentPost aggregation
  @@index([companyId, fetchedAt])              // top performers last 7 days
}
```

### Pattern 4: DashboardCache Prisma Model
**What:** Pre-computed summary per company, refreshed every 15 minutes by DashboardSummaryJob.

```prisma
// Add to schema.prisma (Phase 7)
model DashboardCache {
  id                  String   @id @default(uuid())
  companyId           String   @unique    // one cache per company
  scheduledTodayCount Int      @default(0)
  pendingReviewCount  Int      @default(0)
  failedPostsCount    Int      @default(0)
  topPostsJson        Json     @default("[]")  // serialized top performers
  computedAt          DateTime @default(now())
  company             Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([computedAt])
}
```

### Pattern 5: Idempotent Upsert via Prisma
**What:** Prevents duplicate records when ingestion runs multiple times.

```typescript
// Source: Prisma upsert pattern used in seed script (Phase 1)
// extensions/analytics-dashboard/src/analytics/analytics.repository.ts

async upsertMetrics(
  variantId: string,
  snapshotType: SnapshotType,
  metrics: MetricsSnapshot,
  postId: string,
  companyId: string,
  platform: string,
): Promise<void> {
  await this.prisma.postMetrics.upsert({
    where: { variantId_snapshotType: { variantId, snapshotType } },
    create: {
      variantId,
      postId,
      companyId,
      platform,
      snapshotType,
      fetchedAt: new Date(),
      ...metrics,
    },
    update: {
      fetchedAt: new Date(),
      ...metrics,
    },
  });
}
```

### Pattern 6: "Due for Ingestion" Query
**What:** Determines which PUBLISHED variants need their next snapshot fetched. Uses publishedAt + elapsed time to decide which snapshotType is due.

```typescript
// extensions/analytics-dashboard/src/analytics/analytics.repository.ts

async findDueForIngestion(batchSize: number): Promise<DueIngestionItem[]> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Fetch PUBLISHED variants where publishedAt is old enough for some snapshot
  // but that snapshot hasn't been fetched yet
  // Raw query or JS-side filter (similar to JS-side 75% lifetime filter in Phase 2)
  const variants = await this.prisma.postVariant.findMany({
    where: {
      status: 'PUBLISHED',
      platformPostId: { not: null },
      publishedAt: { lte: oneHourAgo },  // at least 1h old
    },
    include: {
      post: { select: { companyId: true, brandId: true } },
      metrics: { select: { snapshotType: true } },
      // Join to SocialAccount -> Integration for access token
    },
    take: batchSize * 3,  // over-fetch, JS-filter for exact snapshot due
  });

  // JS-side: determine which snapshotType is due for each variant
  return variants.flatMap((v) => {
    const dueSnapshots: DueIngestionItem[] = [];
    const existingTypes = new Set(v.metrics.map((m: any) => m.snapshotType));
    const publishedAt = v.publishedAt!.getTime();
    const elapsed = now.getTime() - publishedAt;

    if (elapsed >= 60 * 60 * 1000 && !existingTypes.has('1h')) {
      dueSnapshots.push(buildDueItem(v, '1h'));
    }
    if (elapsed >= 24 * 60 * 60 * 1000 && !existingTypes.has('24h')) {
      dueSnapshots.push(buildDueItem(v, '24h'));
    }
    if (elapsed >= 7 * 24 * 60 * 60 * 1000 && !existingTypes.has('7d')) {
      dueSnapshots.push(buildDueItem(v, '7d'));
    }
    return dueSnapshots;
  }).slice(0, batchSize);
}
```

### Pattern 7: DashboardSummaryJob (@Cron Pre-Compute)
**What:** Runs every 15 minutes. Computes per-company counts from existing tables (no platform API calls). Writes to DashboardCache.

```typescript
// extensions/analytics-dashboard/src/dashboard/dashboard-summary.job.ts

@Cron('*/15 * * * *')  // Every 15 minutes
async refreshDashboardCache(): Promise<void> {
  if (!process.env.RUN_CRON) return;

  const companies = await this.prisma.company.findMany({ select: { id: true } });

  for (const company of companies) {
    await this.refreshForCompany(company.id);
  }
}

private async refreshForCompany(companyId: string): Promise<void> {
  try {
    const today = startOfDayUtc();
    const sevenDaysAgo = subDays(today, 7);

    const [scheduledCount, pendingCount, failedCount, topPosts] = await Promise.all([
      // R12.1: today's scheduled posts
      this.prisma.postVariant.count({
        where: {
          post: { companyId },
          status: { in: ['SCHEDULED', 'PUBLISHING'] },
          scheduledAt: { gte: today, lt: addDays(today, 1) },
        },
      }),
      // R12.2: pending review
      this.prisma.postVariant.count({
        where: { post: { companyId }, status: 'PENDING_REVIEW' },
      }),
      // R12.3: recent failures
      this.prisma.postVariant.count({
        where: { post: { companyId }, status: { in: ['FAILED', 'STALE'] } },
      }),
      // R12.4: top performers last 7 days
      this.prisma.postMetrics.findMany({
        where: { companyId, snapshotType: '7d', fetchedAt: { gte: sevenDaysAgo } },
        orderBy: [
          { likes: 'desc' },
          { comments: 'desc' },
          { shares: 'desc' },
        ],
        take: 5,
        include: { variant: { select: { caption: true, platform: true } } },
      }),
    ]);

    await this.dashboardRepo.upsertCache(companyId, {
      scheduledTodayCount: scheduledCount,
      pendingReviewCount: pendingCount,
      failedPostsCount: failedCount,
      topPostsJson: topPosts,
      computedAt: new Date(),
    });
  } catch (err) {
    this.logger.error(`Dashboard cache refresh failed for company ${companyId}: ${err}`);
  }
}
```

### Pattern 8: SWR Hooks (Frontend)
**What:** Each SWR call in its own hook, using useFetch from @gitroom/helpers. Per CLAUDE.md rules.

```typescript
// Source: Mirrors use-failed-posts.ts from Phase 6
// apps/frontend/src/components/analytics/hooks/use-post-analytics.ts

'use client';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export const usePostAnalytics = (variantId: string) => {
  const fetch = useFetch();
  const key = variantId ? `post-analytics-${variantId}` : null;
  return useSWR(key, async () => {
    const res = await fetch(`/variants/${variantId}/analytics`);
    return res.json();
  });
};

// apps/frontend/src/components/analytics/hooks/use-dashboard.ts
export const useDashboard = (companySlug: string) => {
  const fetch = useFetch();
  const key = companySlug ? `dashboard-${companySlug}` : null;
  return useSWR(key, async () => {
    const res = await fetch(`/companies/${companySlug}/dashboard`);
    return res.json();
  });
};
```

### Pattern 9: NestJS Module Wiring (useFactory)
**What:** Consistent with all prior extension modules. useFactory in providers array for all services.

```typescript
// Source: Mirrors SchedulingPublishingModule structure
// extensions/analytics-dashboard/src/analytics-dashboard.module.ts

@Module({
  imports: [ScheduleModule.forRoot(), CredentialManagementModule],
  controllers: [AnalyticsController, DashboardController],
  providers: [
    { provide: AnalyticsRepository, useFactory: (p) => new AnalyticsRepository(p), inject: [PrismaService] },
    { provide: DashboardRepository, useFactory: (p) => new DashboardRepository(p), inject: [PrismaService] },
    { provide: AnalyticsAdapterRegistry, useFactory: () => new AnalyticsAdapterRegistry() },
    { provide: AnalyticsService, useFactory: (repo, enc, reg) => new AnalyticsService(repo, enc, reg),
      inject: [AnalyticsRepository, TokenEncryptionService, AnalyticsAdapterRegistry] },
    { provide: DashboardService, useFactory: (repo, p) => new DashboardService(repo, p), inject: [DashboardRepository, PrismaService] },
    { provide: AnalyticsIngestionJob, useFactory: (repo, enc, reg, p) =>
        new AnalyticsIngestionJob(repo, enc, reg, p),
      inject: [AnalyticsRepository, TokenEncryptionService, AnalyticsAdapterRegistry, PrismaService] },
    { provide: DashboardSummaryJob, useFactory: (repo, p) => new DashboardSummaryJob(repo, p), inject: [DashboardRepository, PrismaService] },
  ],
})
export class AnalyticsDashboardModule {}
```

### Anti-Patterns to Avoid
- **Live platform API calls in dashboard controller:** Dashboard must only read DashboardCache — no on-demand metric fetching per request.
- **Blocking ingestion job:** Ingestion for one variant must never block others; keep per-item try/catch.
- **0 for unavailable metrics:** Use null (not 0) when a platform doesn't support a metric — prevents false "zero engagement" in rankings.
- **SWR violation:** Never nest useSWR calls or put them in conditional branches. Each hook is its own named function.
- **Missing RUN_CRON guard:** Both @Cron jobs must check `if (!process.env.RUN_CRON) return;` — only orchestrator context should run crons.
- **Importing Prisma types in extension packages:** Use `(prisma as any)` pattern consistent with all prior extensions, or local interface aliases.

---

## Platform Analytics API Reference

### Instagram (Meta Graph API v21.0)

**Endpoint:** `GET /{ig-media-id}/insights`

**Available metrics:**
| Metric | Description | Available on |
|--------|-------------|-------------|
| `impressions` | DEPRECATED as of April 2025 for some content types | Use `views` for Reels |
| `reach` | Unique users who viewed the content | All post types |
| `likes` | Likes count | All post types |
| `comments` | Comments count | All post types |
| `shares` | Shares count | All post types |
| `saves` | Saves count | All post types |
| `views` | Views (replaces impressions for Reels) | Reels |
| `total_interactions` | Combined interactions | All post types |

**CRITICAL — April 2025 Deprecation:** `impressions` metric has been deprecated for Reels content in Graph API v21+. Use `views` instead. For regular image/video posts, `impressions` still works. Store the value in the `impressions` column regardless of which field name was used.

**Rate limits:** Application-level limits apply; specific numbers not disclosed by Meta. The 200/hr figure in CONTEXT.md refers to DM limits, not Insights API. Insights API limits are application-scoped with 429 responses on breach.

**Access:** Requires `instagram_basic`, `instagram_manage_insights` permissions.

**Implementation note:** Make separate calls per metric or use `fields` parameter: `GET /{media-id}/insights?metric=reach,comments,shares,saves&period=lifetime`

### Facebook (Meta Graph API v21.0)

**Endpoint:** `GET /{post-id}/insights`

**Available metrics:**
| Metric | Available |
|--------|----------|
| `post_impressions` | Was deprecated Nov 2025; use `post_media_views` |
| `post_reach` | Available |
| `post_reactions_like_total` | Available (reactions, not just likes) |
| `post_comments` | Available |
| `post_engaged_users` | Available |
| `post_clicks` | Available |

**CRITICAL — November 2025 Deprecation:** `post_impressions` and `page_posts_impressions` were deprecated November 15, 2025. Use `post_media_views` instead. Map to `impressions` column in PostMetrics.

**Shares:** Facebook shares are not available at post-level via Insights API — store as null.

### LinkedIn (REST API, version 202506+)

**Endpoint:** `GET /rest/memberCreatorPostAnalytics?q=entity&entity=...&queryType=...`

**Available queryType values (one request per metric):**
| queryType | Maps to |
|-----------|--------|
| `IMPRESSION` | impressions |
| `MEMBERS_REACHED` | reach |
| `REACTION` | likes (reactions) |
| `COMMENT` | comments |
| `RESHARE` | shares |

**CRITICAL:** LinkedIn requires a separate API call for each metric type. For 5 metrics, that is 5 API calls per post snapshot. This is important for rate limit planning.

**NOT available:** saves, clicks — store as null.

**Rate limits:** LinkedIn does not publish exact limits. Application-level daily limits reset at midnight UTC. Monitor the Developer Portal Analytics tab. Treat as a daily budget, not per-hour.

**Access:** Requires `r_member_postAnalytics` permission.

**Version note:** Marketing Version 202502 was sunset. Use 202506+ (specify in LinkedIn-Version header).

### X (Twitter API v2)

**Endpoint:** `GET /2/tweets/{id}?tweet.fields=public_metrics,non_public_metrics`

**Available metrics:**

Public metrics (any auth):
| Field | Maps to |
|-------|--------|
| `public_metrics.impression_count` | impressions |
| `public_metrics.like_count` | likes |
| `public_metrics.reply_count` | comments |
| `public_metrics.retweet_count` | shares |

Non-public metrics (user auth, 30-day limit only):
| Field | Maps to |
|-------|--------|
| `non_public_metrics.url_link_clicks` | clicks |

**CRITICAL — 30-day limit:** Non-public metrics (impression_count via non_public_metrics, url_link_clicks) are only available for posts created within the last 30 days. For the T+7d snapshot this is fine. For older posts, store the previously fetched value and do not re-query.

**NOT available:** reach, saves — store as null.

**Rate limits:** Per-15-minute windows. Free tier is extremely limited. Basic tier ($200/month) required for production use. Handle 429 as transient error → retry next tick.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom interval loops | @nestjs/schedule @Cron | Already in project, battle-tested across Phases 2/4/6 |
| Token decryption | Custom decrypt before API calls | TokenEncryptionService | Already built in Phase 2, injected same way as Phase 6 |
| Upsert logic | Manual check-then-insert | Prisma `upsert()` with @@unique | Prevents race conditions, atomic |
| Platform adapter dispatch | Switch statement in job | AnalyticsAdapterRegistry | Same pattern as AdapterRegistry in Phase 6 |
| Company scoping | Global filters | Explicit companyId parameter | Established isolation contract across all phases |

**Key insight:** Every element of this phase has a direct precedent in prior phases. Copy patterns, not code.

---

## Common Pitfalls

### Pitfall 1: Instagram Impressions Deprecation
**What goes wrong:** Calling `GET /{media-id}/insights?metric=impressions` returns empty or error for Reels content.
**Why it happens:** Meta deprecated the `impressions` metric for Reels content in April 2025 (Graph API v21+). Use `views` for Reels.
**How to avoid:** In InstagramAnalyticsAdapter, check content type or try `views` first and fall back; store result in `impressions` column regardless. Alternatively, always fetch `views` and store in impressions for all Instagram content.
**Warning signs:** Empty insights response or 400 error with "metric not supported."

### Pitfall 2: LinkedIn 5-Calls-Per-Post
**What goes wrong:** Assuming LinkedIn analytics is one API call per post. It is one call per metric type.
**Why it happens:** LinkedIn's `memberCreatorPostAnalytics` takes a `queryType` parameter and returns only one metric per call.
**How to avoid:** Make 5 parallel fetch calls per post snapshot (Promise.all). Count 5 API calls per variant per snapshotType in rate limit budget. Batch of 20 variants = 100 LinkedIn API calls per tick.
**Warning signs:** Missing metric data when only single API call is made.

### Pitfall 3: X 30-Day Metric Expiry
**What goes wrong:** Trying to fetch non-public metrics (impression_count, url_link_clicks) for posts older than 30 days returns 403.
**Why it happens:** X API non-public metrics have a 30-day lookback limit.
**How to avoid:** For T+7d snapshots (always within 30 days), this is fine. Design the ingestion to prioritize fetching before the 30-day window. Do not retry permanently failed non-public metric calls on old posts — store null.
**Warning signs:** 403 responses on non_public_metrics for older posts.

### Pitfall 4: Facebook Post_Impressions Deprecated
**What goes wrong:** Calling `post_impressions` returns empty or error after November 2025.
**Why it happens:** Meta deprecated this metric November 15, 2025 and replaced with `post_media_views`.
**How to avoid:** Use `post_media_views` for Facebook impressions and map to `impressions` column.
**Warning signs:** Empty or error response from Facebook post insights.

### Pitfall 5: Dashboard Cache Staleness
**What goes wrong:** Dashboard shows stale data from 14 minutes ago when an action was just taken.
**Why it happens:** DashboardSummaryJob runs every 15 minutes — there is a lag window.
**How to avoid:** Accept 15-minute staleness as a product decision (pre-compute for speed is the requirement). Document this in UI as "Updated Xm ago" using `computedAt` timestamp. Do NOT add live queries to compensate.
**Warning signs:** Operator confusion when pending review count doesn't drop immediately after approving from another page.

### Pitfall 6: Missing RUN_CRON Guard
**What goes wrong:** Both backend and orchestrator run the cron jobs, causing duplicate metric fetches.
**Why it happens:** NestJS modules are imported in both app contexts; without guard, both fire.
**How to avoid:** Both AnalyticsIngestionJob and DashboardSummaryJob must start with `if (!process.env.RUN_CRON) return;` — identical to every prior cron job.
**Warning signs:** Duplicate PostMetrics rows (Prisma upsert prevents duplicate records, but double API calls waste rate limit budget).

### Pitfall 7: Null vs Zero for Missing Metrics
**What goes wrong:** Storing 0 for unsupported metrics (saves on LinkedIn, reach on X) causes false rankings in top performers.
**Why it happens:** Platform metrics are platform-specific; null means "not measured" while 0 means "none."
**How to avoid:** AnalyticsAdapter returns `null` for metrics the platform doesn't provide. Top performers sort ignores null fields.
**Warning signs:** LinkedIn or X posts appearing at top of "top performers" because saves=0 on other platforms.

---

## Code Examples

### Instagram Analytics Adapter
```typescript
// Source: Mirrors InstagramAdapter + Meta Insights API docs
// extensions/analytics-dashboard/src/adapters/instagram.analytics.adapter.ts

export class InstagramAnalyticsAdapter extends BaseAnalyticsAdapter {
  readonly platform = 'instagram';
  readonly apiVersion = 'v21.0';

  async fetchPostMetrics(platformPostId: string, accessToken: string): Promise<MetricsSnapshot> {
    // Fetch reach, comments, shares, saves (and views for impressions)
    const url = `https://graph.facebook.com/${this.apiVersion}/${platformPostId}/insights` +
      `?metric=reach,comments,shares,saves,views,total_interactions` +
      `&access_token=${accessToken}`;

    const response = await this.fetchWithTimeout(url);
    if (!response.ok) {
      const body = await response.text();
      const { retryable } = this.classifyError(response.status, body);
      throw new AnalyticsApiError(body, retryable);
    }

    const data = await response.json();
    const byMetric = Object.fromEntries(
      (data.data ?? []).map((d: any) => [d.name, d.values?.[0]?.value ?? null])
    );

    return {
      impressions: byMetric['views'] ?? null,     // views replaces impressions for Reels
      reach: byMetric['reach'] ?? null,
      likes: null,                                  // Instagram: likes not in /insights, use /reactions
      comments: byMetric['comments'] ?? null,
      shares: byMetric['shares'] ?? null,
      saves: byMetric['saves'] ?? null,
      clicks: null,
    };
  }
}
```

### LinkedIn Analytics Adapter (parallel calls)
```typescript
// Source: LinkedIn memberCreatorPostAnalytics API + parallel Promise.all pattern
// extensions/analytics-dashboard/src/adapters/linkedin.analytics.adapter.ts

export class LinkedInAnalyticsAdapter extends BaseAnalyticsAdapter {
  readonly platform = 'linkedin';
  readonly apiVersion = '202506';

  async fetchPostMetrics(platformPostId: string, accessToken: string): Promise<MetricsSnapshot> {
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'LinkedIn-Version': this.apiVersion,
      'X-Restli-Protocol-Version': '2.0.0',
    };

    // LinkedIn requires one call per metric type (5 calls total)
    const metricTypes = ['IMPRESSION', 'MEMBERS_REACHED', 'REACTION', 'COMMENT', 'RESHARE'];
    const results = await Promise.allSettled(
      metricTypes.map((queryType) =>
        this.fetchSingleMetric(platformPostId, queryType, headers)
      )
    );

    const [impressions, reach, likes, comments, shares] = results.map((r) =>
      r.status === 'fulfilled' ? r.value : null
    );

    return { impressions, reach, likes, comments, shares, saves: null, clicks: null };
  }

  private async fetchSingleMetric(
    postUrn: string, queryType: string, headers: Record<string, string>
  ): Promise<number | null> {
    const encodedUrn = encodeURIComponent(postUrn);
    const url = `https://api.linkedin.com/rest/memberCreatorPostAnalytics` +
      `?q=entity&entity=(ugcPost:${encodedUrn})&queryType=${queryType}&aggregation=TOTAL`;
    const res = await this.fetchWithTimeout(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data.elements?.[0]?.count ?? null;
  }
}
```

### X Analytics Adapter
```typescript
// Source: X API v2 tweet metrics docs
// extensions/analytics-dashboard/src/adapters/x.analytics.adapter.ts

export class XAnalyticsAdapter extends BaseAnalyticsAdapter {
  readonly platform = 'x';
  readonly apiVersion = 'v2';

  async fetchPostMetrics(platformPostId: string, accessToken: string): Promise<MetricsSnapshot> {
    // Fetch public + non_public metrics in one request
    const url = `https://api.twitter.com/2/tweets/${platformPostId}` +
      `?tweet.fields=public_metrics,non_public_metrics`;

    const response = await this.fetchWithTimeout(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const body = await response.text();
      // 403 on non_public_metrics for >30-day-old posts: fall back to public only
      if (response.status === 403) {
        return this.fetchPublicOnly(platformPostId, accessToken);
      }
      const { retryable } = this.classifyError(response.status, body);
      throw new AnalyticsApiError(body, retryable);
    }

    const data = await response.json();
    const pub = data.data?.public_metrics ?? {};
    const nonPub = data.data?.non_public_metrics ?? {};

    return {
      impressions: pub.impression_count ?? null,
      reach: null,              // X does not provide reach
      likes: pub.like_count ?? null,
      comments: pub.reply_count ?? null,
      shares: pub.retweet_count ?? null,
      saves: null,              // X does not provide saves
      clicks: nonPub.url_link_clicks ?? null,
    };
  }
}
```

### Dashboard Controller
```typescript
// Source: Mirrors FailedPostsController pattern from Phase 6
// extensions/analytics-dashboard/src/dashboard/dashboard.controller.ts

@Controller('companies/:companySlug/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@Param('companySlug') companySlug: string) {
    return this.dashboardService.getForCompany(companySlug);
  }
}

// DashboardService reads from DashboardCache — no live DB aggregation on request
async getForCompany(companySlug: string): Promise<DashboardData> {
  const company = await this.resolveCompany(companySlug);
  const cache = await this.dashboardRepo.findByCompanyId(company.id);
  if (!cache) {
    // Cache not yet populated — return empty structure, not error
    return this.emptyDashboard(company.id);
  }
  return {
    scheduledToday: cache.scheduledTodayCount,
    pendingReview: cache.pendingReviewCount,
    failedPosts: cache.failedPostsCount,
    topPosts: cache.topPostsJson as TopPerformer[],
    computedAt: cache.computedAt,
  };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Instagram `impressions` metric | `views` metric (Reels) | April 2025 | Must use `views` for Reels insights; `impressions` still works for image posts |
| Facebook `post_impressions` | `post_media_views` | November 2025 | Direct replacement, same semantic meaning |
| LinkedIn Marketing API v202502 | v202506+ | February 2025 sunset | Must use current version string in header |
| X API free tier | Basic tier minimum ($200/mo) | 2024 | Non-public metrics require paid plan |

**Deprecated/outdated to avoid:**
- Instagram `impressions` metric for Reels (April 2025): use `views`
- Facebook `post_impressions` (Nov 2025): use `post_media_views`
- LinkedIn `202502` version string: use `202506` or later
- X non_public_metrics on posts >30 days old: always returns 403, store null

---

## Open Questions

1. **Credential resolution for analytics adapters**
   - What we know: PostVariant has platform, postId, platformPostId. SocialAccount has integrationId FK to Integration which holds encrypted tokens.
   - What's unclear: The join chain from PostVariant -> ContentPost -> CompanyId -> Brand -> SocialAccount -> Integration needs to be verified (the schema shows ContentPost has companyId and brandId; SocialAccount is on brandId).
   - Recommendation: In AnalyticsRepository.findDueForIngestion(), join through ContentPost -> Brand -> SocialAccount -> Integration. Read the join carefully from schema before writing the query.

2. **Instagram likes via Insights API**
   - What we know: The Instagram `/insights` endpoint returns comments, shares, saves, reach but NOT likes directly.
   - What's unclear: Likes on media may require a separate `GET /{media-id}?fields=like_count` call, not the insights endpoint.
   - Recommendation: Use two-call approach in InstagramAnalyticsAdapter: one for insights, one for like_count field. Store both.

3. **Cross-company dashboard scope**
   - What we know: R12.6 requires "All Companies" aggregate option; DashboardCache stores per-company.
   - What's unclear: Should DashboardSummaryJob also compute a global aggregate, or should the controller sum cached per-company rows on request?
   - Recommendation: Sum per-company DashboardCache rows at request time for "All Companies" — avoids another table. Fast enough since it's cached counts (not raw rows).

4. **Dashboard route conflict**
   - What we know: CONTEXT.md says "Route: (app)/(site)/ root or dedicated /dashboard route." The existing Postiz root route may already exist.
   - What's unclear: Does replacing or adding to the root route require upstream file modification (must track in DIVERGENCE.md)?
   - Recommendation: Use a dedicated /dashboard route to avoid touching upstream root — cleaner separation. Link from navigation.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.x with ts-jest |
| Config file | `extensions/analytics-dashboard/jest.config.ts` (Wave 0 gap — doesn't exist yet) |
| Quick run command | `pnpm --filter @social/analytics-dashboard test` |
| Full suite command | `pnpm --filter @social/analytics-dashboard test --coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R11.1 | Ingestion finds due variants at T+1h/24h/7d intervals | unit | `pnpm --filter @social/analytics-dashboard test -- --testPathPattern=analytics-ingestion` | Wave 0 gap |
| R11.2 | Metrics stored with null for unavailable platform fields | unit | `pnpm --filter @social/analytics-dashboard test -- --testPathPattern=analytics.repository` | Wave 0 gap |
| R11.3 | Upsert idempotency: second upsert updates, not inserts | unit | `pnpm --filter @social/analytics-dashboard test -- --testPathPattern=analytics.repository` | Wave 0 gap |
| R11.4 | Analytics controller returns per-post metrics | unit | `pnpm --filter @social/analytics-dashboard test -- --testPathPattern=analytics.controller` | Wave 0 gap |
| R11.5 | Ingestion job isolated from publishing (no shared state) | unit | Verified by module structure (no import of publishing module) | N/A |
| R12.1-R12.4 | Dashboard cache returns correct counts | unit | `pnpm --filter @social/analytics-dashboard test -- --testPathPattern=dashboard` | Wave 0 gap |
| R12.5 | Dashboard controller reads only DashboardCache (no live queries) | unit | Mock prisma in DashboardService test | Wave 0 gap |
| NF3.1 | Dashboard response time < 2s | manual | Monitor response time via logs | manual-only |
| NF3.2 | No platform API calls in request path | unit | Verify DashboardService makes 0 adapter calls | Wave 0 gap |
| NF3.4 | Indexes present on PostMetrics | smoke | `pnpm prisma validate` after migration | Wave 0 gap (migration) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @social/analytics-dashboard test`
- **Per wave merge:** `pnpm --filter @social/analytics-dashboard test --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `extensions/analytics-dashboard/` — package scaffolding (package.json, tsconfig.json, jest.config.ts, src/index.ts)
- [ ] `extensions/analytics-dashboard/src/__tests__/analytics-ingestion.job.spec.ts` — covers R11.1
- [ ] `extensions/analytics-dashboard/src/__tests__/analytics.repository.spec.ts` — covers R11.2, R11.3
- [ ] `extensions/analytics-dashboard/src/__tests__/dashboard.service.spec.ts` — covers R12.1-R12.5
- [ ] `extensions/analytics-dashboard/src/__tests__/instagram.analytics.adapter.spec.ts` — covers adapter pattern
- [ ] Prisma migration for PostMetrics and DashboardCache models

---

## Sources

### Primary (HIGH confidence)
- Code read: `extensions/credential-management/src/refresh/token.refresh.job.ts` — @Cron pattern with RUN_CRON guard, per-item error isolation, batch processing
- Code read: `extensions/scheduling-publishing/src/publishing/publishing-worker.job.ts` — batch size, per-variant error isolation, @Cron pattern
- Code read: `extensions/scheduling-publishing/src/adapters/base.adapter.ts` — adapter pattern to mirror for AnalyticsAdapter
- Code read: `extensions/scheduling-publishing/src/types/publishing.types.ts` — PlatformAdapter interface to mirror
- Code read: `extensions/scheduling-publishing/src/scheduling-publishing.module.ts` — module wiring pattern with useFactory
- Code read: `libraries/nestjs-libraries/src/database/prisma/schema.prisma` — PostVariant, ContentPost, Company schema
- Code read: `apps/frontend/src/components/scheduling/use-failed-posts.ts` — SWR hook pattern to replicate
- Official docs: [LinkedIn memberCreatorPostAnalytics API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics?view=li-lms-2025-11) — verified metric names: IMPRESSION, MEMBERS_REACHED, REACTION, COMMENT, RESHARE
- Official docs: [X API v2 Metrics](https://docs.x.com/x-api/fundamentals/metrics) — verified public_metrics and non_public_metrics fields

### Secondary (MEDIUM confidence)
- Instagram Graph API insights endpoint — `GET /{media-id}/insights?metric=...` with `reach,comments,shares,saves,views` fields
- April 2025 Instagram deprecation of `impressions` for Reels: use `views` — verified via multiple sources but exact deprecation scope varies by content type
- Facebook November 2025 deprecation of `post_impressions` in favor of `post_media_views` — reported by multiple third-party sources

### Tertiary (LOW confidence)
- Instagram likes available via `GET /{media-id}?fields=like_count` (separate from /insights endpoint) — not directly verified via official docs page, based on Meta Graph API field documentation patterns
- X API rate limits per 15-minute windows — specific per-endpoint limits not verified for Basic tier analytics endpoints

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, verified by reading package.json files
- Architecture: HIGH — patterns copied directly from verified Phase 2/4/6 code
- Platform API specifics: MEDIUM — verified LinkedIn and X via official docs; Instagram/Facebook via official docs with noted deprecations
- Pitfalls: HIGH — deprecations verified via official sources (LinkedIn sunset notice, Meta deprecation blog, X 30-day limit confirmed in official docs)

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (platform APIs change frequently; verify Instagram/Facebook metrics before final implementation)
