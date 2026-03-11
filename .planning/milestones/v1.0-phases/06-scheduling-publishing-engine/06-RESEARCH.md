# Phase 6: Scheduling & Publishing Engine - Research

**Researched:** 2026-03-10
**Domain:** NestJS cron scheduling, platform API publishing adapters, state machine, calendar UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Post State Machine**
- States: DRAFT → APPROVED → SCHEDULED → PUBLISHING → PUBLISHED / FAILED
- ContentPost already has status field (Phase 5) — extend with SCHEDULED, PUBLISHING, PUBLISHED, FAILED states
- PostVariant gets its own publish status (independent per platform — one can succeed while another fails)
- State transitions enforced in service layer — no skipping states
- FAILED posts can be retried (transition back to SCHEDULED)

**Schedule Resolver**
- Operator picks exact date/time OR selects "auto-slot" for AI-suggested optimal time
- Auto-slot: simple rule-based initially (per-company preferred posting windows stored in Company settings)
- Per-company timezone stored on Company model (already has timezone field from Phase 1)
- All scheduling logic works in company timezone, stored as UTC in DB
- Schedule resolver creates a ScheduledPost record linking ContentPost → publish time → target platforms

**Scheduler Tick (Cron)**
- `@Cron('*/1 * * * *')` — runs every minute, consistent with Phase 4's @Cron pattern
- Queries PostVariants where status=SCHEDULED AND scheduledAt <= now
- Enqueues each due variant as a publish job
- Batch size limit per tick (e.g., 50) to prevent overwhelming platform APIs
- Idempotent: checks platform_post_id before enqueuing (R10.3)
- Extension zone: new @social/scheduling-publishing extension package

**Platform Adapter Layer**
- Uniform `PlatformAdapter` interface: `publish(variant: PostVariant): Promise<PublishResult>`
- Adapters for 4 MVP platforms: Instagram (Meta Business API), Facebook (Graph API), LinkedIn (Marketing API), X (API v2)
- Each adapter uses credentials from Phase 2's CredentialManagement (encrypted tokens, auto-refreshed)
- PublishResult: { success, platformPostId, platformUrl, error?, retryable? }
- Adapters handle platform-specific payload formatting (caption, media upload, hashtags)
- Media uploaded to platform from MinIO (Phase 4) — download from S3 then upload to platform API

**Publishing Worker**
- One job per PostVariant — platform-specific publishing
- Uses @Cron poller pattern (consistent with Phase 4 MediaProcessingJob) — not BullMQ
- Per-job error isolation: one variant failure doesn't block others (Phase 4 pattern)
- Updates PostVariant with platformPostId and platformUrl on success
- Updates ContentPost parent status based on all variant outcomes

**Retry & Error Classification**
- 3 attempts maximum per PostVariant
- Exponential backoff with jitter: 1min, 5min, 15min
- Error classification in adapter response: Transient (retryable) or Permanent (non-retryable)
- consecutiveFailures counter on PostVariant (same pattern as Phase 2 token health)
- Publish attempt log: timestamp, attempt number, response code, error details, full payload

**Publish Window & Staleness**
- Configurable publish window per company (default: 4 hours after scheduled time)
- If post not published within window → escalate to STALE status, surface in dashboard
- Stale posts require manual operator action (reschedule or cancel)

**Scheduling Calendar UI**
- Calendar view showing all scheduled posts across platforms per company
- Day/week view toggle
- Posts shown as cards on calendar with platform icons, media thumbnail, scheduled time
- Click to view post details, edit schedule, or cancel
- Drag-to-reschedule is deferred (future enhancement)
- Color-coded by platform (instagram=pink, facebook=blue, linkedin=sky, x=gray)
- Uses existing Postiz calendar infrastructure where possible

**Failed Posts Dashboard**
- Failed posts surface prominently — not buried in logs (R10.7)
- Failed post card: media thumbnail, caption preview, platform, error message, retry button
- Filterable by platform, error type (transient/permanent), date range
- Retry action re-enqueues the variant for publishing

### Claude's Discretion
- Exact cron job configuration and batch tuning
- Calendar component library choice (build custom or adapt existing Postiz calendar)
- Publish attempt log table schema details
- Auto-slot algorithm specifics (time windows, platform-specific optimal times)
- Loading states and optimistic UI updates for schedule/publish actions
- How to handle concurrent publishes to same platform (rate limiting strategy)

### Deferred Ideas (OUT OF SCOPE)
- Drag-to-reschedule on calendar — future enhancement
- Evergreen post recycling — future phase
- Bulk scheduling (schedule 20 posts at once) — future enhancement
- Cross-posting optimization (stagger same content across platforms) — future enhancement
- Publish preview (show how post will look on each platform) — Milestone 2
- Content calendar with AI-suggested content gaps — Phase 7 or later
- Temporal workflow orchestration (replace @Cron) — production hardening concern
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| R9.1 | Post states: DRAFT → APPROVED → SCHEDULED → PUBLISHING → PUBLISHED / FAILED | Extend ContentPostStatus + PostVariantStatus type unions; new fields on PostVariant (scheduledAt, publishedAt, publishAttempts, platformPostId, platformUrl) |
| R9.2 | Schedule resolver: assign publish time based on operator selection or auto-slot | ScheduleService.schedule() method; ScheduledPost table linking ContentPost to scheduledAt + platforms; dayjs timezone conversion (UTC storage) |
| R9.3 | Scheduling calendar UI showing all scheduled posts across platforms | Custom React calendar grid (week/day); GET /companies/:slug/schedule?from=&to= SWR hook; post cards with platform badges |
| R9.4 | scheduler_tick cron job (every minute): enqueue due posts for publishing | @Cron('*/1 * * * *') with RUN_CRON guard; batch of 50; status=SCHEDULED AND scheduledAt <= now query; idempotency check on platformPostId |
| R9.5 | Per-company timezone support | Company.timezone field already exists (Phase 1); dayjs.tz() to convert operator-selected time to UTC; scheduledAt stored as UTC |
| R10.1 | Publishing worker: one job per PostVariant per platform | PublishingJob @Cron poller (same pattern as MediaProcessingJob); PublishVariantJob table with status=pending/processing/completed/failed |
| R10.2 | Platform adapter layer: uniform PlatformAdapter interface for all platforms | PlatformAdapter interface (publish method); 4 concrete adapters (InstagramAdapter, FacebookAdapter, LinkedInAdapter, XAdapter); token decryption via TokenEncryptionService |
| R10.3 | Idempotent publishing: check for existing platform_post_id before re-publishing | platformPostId field on PostVariant; check before enqueuing in scheduler_tick; check again before publishing in worker |
| R10.4 | Retry policy: 3 attempts, exponential backoff (1min, 5min, 15min) | publishAttempts counter on PostVariant; nextRetryAt DateTime field; worker skips if nextRetryAt > now |
| R10.5 | Error classification: transient (retry) vs permanent (alert operator) | PublishResult.retryable boolean; handleErrors() pattern from upstream SocialAbstract; transient → increment attempts, set nextRetryAt; permanent → FAILED immediately |
| R10.6 | Every publish attempt logged: timestamp, response code, payload, error details | PublishAttemptLog table: variantId, attemptNumber, status, responseCode, errorMessage, payload (JSON), attemptedAt |
| R10.7 | Failed posts surface prominently in dashboard | GET /companies/:slug/schedule/failed endpoint; React FailedPostsDashboard with filter controls; retry button re-enqueues |
| R10.8 | Publish window concept: if post not published within window, escalate rather than publish stale | publishWindowHours on Company (default 4); scheduler_tick checks scheduledAt + publishWindowHours > now before enqueuing; expired → STALE status |
| NF2.1 | Publishing worker retry with exponential backoff and jitter | Jitter = Math.random() * 30 seconds added to backoff; nextRetryAt = now + backoff + jitter |
| NF4.3 | Platform logic in PlatformAdapter implementations, not scattered across features | Single PlatformAdapter interface in adapters/platform-adapter.interface.ts; each platform in its own file |
| NF4.5 | Pinned API version strings on all platform API calls | API_VERSION constants per adapter: Instagram/Facebook GRAPH_API_VERSION='v21.0', LinkedIn API_VERSION='202502', X API_VERSION='2' |
</phase_requirements>

---

## Summary

Phase 6 builds the "last mile" pipeline: approved PostVariants flow from APPROVED → SCHEDULED → PUBLISHING → PUBLISHED (or FAILED with retry). The architecture is a direct extension of patterns established in Phases 2 and 4 — the @Cron poller from MediaProcessingJob becomes the scheduler_tick and publishing worker, the consecutiveFailures pattern from Phase 2 becomes the retry counter, and interface injection from Phase 2 keeps platform adapters decoupled.

The core challenge is coordinating two cron jobs: `scheduler_tick` (every minute) enqueues due PostVariants into a `PublishVariantJob` table, and `publishing_worker` (every 30 seconds) polls that table and calls platform adapters. This two-stage design prevents the scheduler from blocking on slow API calls and enables per-job error isolation. The publishing adapter for each platform downloads media from MinIO via GetObjectCommand, formats the payload per platform spec, and calls the platform API with a decrypted OAuth token from Phase 2's TokenEncryptionService.

The calendar UI builds on dayjs (already used throughout the app) for date arithmetic and timezone conversion, renders a custom week/day grid using Tailwind CSS classes consistent with the existing design system (customColor* and newBgColor variables), and uses individual SWR hooks per data concern following the established CLAUDE.md rules. The failed posts dashboard is a simple filtered list with retry buttons that POST to re-enqueue endpoints.

**Primary recommendation:** Implement the extension package `@social/scheduling-publishing` with: (1) Prisma schema additions for ScheduledPost + PublishVariantJob + PublishAttemptLog tables, (2) scheduler_tick and publishing_worker @Cron jobs, (3) four PlatformAdapter implementations, and (4) React calendar + failed-posts-dashboard components following existing hook and UI patterns exactly.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @nestjs/schedule | ^4.0.0 | @Cron decorator for scheduler_tick and publishing_worker | Already used in Phase 2 (TokenRefreshJob) and Phase 4 (MediaProcessingJob) — established pattern |
| dayjs | ^1.11.10 | Timezone conversion (company TZ → UTC), date arithmetic for nextRetryAt | Already used throughout frontend (calendar.tsx, time.table.tsx) and backend |
| dayjs/plugin/utc | (bundled) | UTC normalization for scheduledAt storage | Required for company timezone → UTC conversion |
| dayjs/plugin/timezone | (bundled) | company.timezone conversion | Required for operator-facing time display |
| @aws-sdk/client-s3 | ^3.787.0 | Download processed media from MinIO for platform upload | Already used in Phase 4 MediaProcessingService |
| uuid | ^9.0.0 | Job ID and log record ID generation | Already used in Phase 5 ContentPostService |
| swr | (existing) | Data fetching for calendar, failed posts hooks | Established CLAUDE.md requirement, used in all frontend hooks |
| useFetch hook | @gitroom/helpers | Auth-aware fetch wrapper | Required by CLAUDE.md: always use useFetch from custom.fetch.tsx |

### Platform API Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| twitter-api-v2 | (existing in upstream) | X (Twitter) API v2 posting | Already used by XProvider in upstream — study usage pattern |
| Native fetch | (runtime) | Instagram/Facebook Graph API, LinkedIn Marketing API | Meta and LinkedIn use REST+JSON — no SDK needed, native fetch sufficient (proven in Phase 3 Ollama adapter) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | (existing) | Conditional Tailwind class joining in calendar UI | Used in existing calendar.tsx and review-queue components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @Cron poller table | BullMQ queue | BullMQ adds Redis queue complexity; @Cron table pattern is already established and sufficient for single-operator scale |
| Native fetch for platform APIs | Dedicated API SDKs (meta-business-sdk, linkedin-api-client) | SDKs are heavy, not maintained in pnpm lock, and often lag API versions; native fetch proven in Phase 3 |
| Custom calendar grid | react-big-calendar or FullCalendar | External calendar libraries conflict with existing Postiz calendar infrastructure and Tailwind design system; custom grid is simple (week = 7 columns) |

**Installation (new extension package):**
```bash
# New package: extensions/scheduling-publishing
# package.json inherits deps from root node_modules via pnpm workspace
# Only add net-new dependencies that aren't already in root package.json
# No new dependencies expected — all needed libs already installed
```

---

## Architecture Patterns

### Recommended Project Structure
```
extensions/scheduling-publishing/
├── src/
│   ├── adapters/                         # Platform-specific publishing adapters
│   │   ├── platform-adapter.interface.ts # PlatformAdapter interface + PublishResult type
│   │   ├── instagram.adapter.ts          # Meta Business API (Graph API v21.0)
│   │   ├── facebook.adapter.ts           # Facebook Graph API (pages_manage_posts)
│   │   ├── linkedin.adapter.ts           # LinkedIn Marketing API (UGC Posts)
│   │   └── x.adapter.ts                 # X API v2 (twitter-api-v2 lib)
│   ├── jobs/
│   │   ├── scheduler-tick.job.ts         # @Cron every minute — enqueue due PostVariants
│   │   └── publishing-worker.job.ts      # @Cron every 30s — process PublishVariantJob table
│   ├── scheduling/
│   │   ├── schedule.controller.ts        # POST schedule, GET calendar, GET failed, POST retry
│   │   ├── schedule.service.ts           # schedule(), reschedule(), cancel(), getCalendar()
│   │   └── schedule.repository.ts        # Prisma queries for ScheduledPost, PostVariant scheduling fields
│   ├── publishing/
│   │   ├── publishing.service.ts         # processVariant() — calls adapter, logs attempt, updates status
│   │   └── publishing.repository.ts      # Prisma queries for PublishVariantJob, PublishAttemptLog
│   ├── types/
│   │   └── scheduling.types.ts           # SchedulePostDto, CalendarQueryDto, PublishStatus type unions
│   ├── __tests__/
│   │   ├── scheduler-tick.job.spec.ts
│   │   ├── publishing.service.spec.ts
│   │   ├── instagram.adapter.spec.ts
│   │   └── schedule.service.spec.ts
│   ├── index.ts                          # Barrel exports
│   └── scheduling-publishing.module.ts   # NestJS module
└── package.json                          # @social/scheduling-publishing
```

```
apps/frontend/src/components/scheduling/
├── hooks/
│   ├── use-calendar.ts           # SWR: GET /companies/:slug/schedule?from=&to=
│   ├── use-failed-posts.ts       # SWR: GET /companies/:slug/schedule/failed
│   └── use-schedule-post.ts      # mutation: POST /companies/:slug/schedule
├── scheduling-calendar.tsx       # Week/day grid calendar component
├── scheduling-post-card.tsx      # Post card shown in calendar cell
├── failed-posts-dashboard.tsx    # Failed posts list with filter + retry
└── schedule-modal.tsx            # DateTime picker for scheduling
```

### Pattern 1: @Cron Poller with Job Table (From Phase 4)

**What:** A @Cron job polls a DB table for pending jobs, marks each as 'processing' before working (lease pattern), then marks 'completed' or 'failed'. Per-job try/catch ensures one failure never blocks others.

**When to use:** Background async processing where jobs must survive app restarts; proven in MediaProcessingJob.

```typescript
// Source: extensions/media-library/src/processing/media-processing.job.ts (established pattern)

@Injectable()
export class PublishingWorkerJob {
  private readonly logger = new Logger('PublishingWorkerJob');

  constructor(
    private readonly publishingService: PublishingService,
    private readonly prisma: any
  ) {}

  @Cron('*/30 * * * * *') // Every 30 seconds
  async processPendingJobs(): Promise<void> {
    if (!process.env.RUN_CRON) return;

    const pendingJobs = await this.prisma.publishVariantJob.findMany({
      where: {
        status: 'pending',
        nextRetryAt: { lte: new Date() },  // Respects exponential backoff
      },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });

    for (const job of pendingJobs) {
      await this.processJob(job);
    }
  }

  private async processJob(job: any): Promise<void> {
    try {
      await this.prisma.publishVariantJob.update({
        where: { id: job.id },
        data: { status: 'processing' },
      });
      await this.publishingService.processVariant(job.variantId, job.platform);
      await this.prisma.publishVariantJob.update({
        where: { id: job.id },
        data: { status: 'completed' },
      });
    } catch (err: any) {
      // Per-job error isolation — never rethrows
      this.logger.error(`PublishingWorkerJob: job ${job.id} failed: ${err?.message}`);
      await this.prisma.publishVariantJob.update({
        where: { id: job.id },
        data: { status: 'failed', error: err?.message ?? String(err) },
      }).catch(() => {});
    }
  }
}
```

### Pattern 2: Scheduler Tick — Enqueue Due Variants

**What:** Every minute, find PostVariants where status=SCHEDULED and scheduledAt <= now (and within publish window), then insert PublishVariantJob records. Idempotent via platformPostId check.

**When to use:** The bridge between scheduling (user action) and publishing (worker action).

```typescript
// Source: Phase context decisions + MediaProcessingJob pattern
@Cron('*/1 * * * *') // Every minute
async schedulerTick(): Promise<void> {
  if (!process.env.RUN_CRON) return;

  const now = new Date();
  const dueVariants = await this.prisma.postVariant.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
      platformPostId: null,    // Idempotent: not already published (R10.3)
    },
    take: 50,                  // Batch limit per tick
    orderBy: { scheduledAt: 'asc' },
    include: { post: { select: { companyId: true } } },
  });

  for (const variant of dueVariants) {
    // Check publish window (R10.8)
    const company = await this.prisma.company.findUnique({
      where: { id: variant.post.companyId },
      select: { publishWindowHours: true },
    });
    const windowHours = company?.publishWindowHours ?? 4;
    const windowExpiry = new Date(variant.scheduledAt!.getTime() + windowHours * 60 * 60 * 1000);

    if (now > windowExpiry) {
      // Post is stale — mark STALE, don't publish (R10.8)
      await this.prisma.postVariant.update({
        where: { id: variant.id },
        data: { status: 'STALE' },
      });
      continue;
    }

    // Enqueue for publishing (upsert prevents duplicates if tick overlaps)
    await this.prisma.publishVariantJob.upsert({
      where: { variantId: variant.id },
      create: { variantId: variant.id, platform: variant.platform, status: 'pending', nextRetryAt: now },
      update: {},  // No-op if already enqueued
    });

    await this.prisma.postVariant.update({
      where: { id: variant.id },
      data: { status: 'PUBLISHING' },
    });
  }
}
```

### Pattern 3: PlatformAdapter Interface

**What:** Uniform interface for all 4 platforms. Decouples publishing service from platform-specific API details. Follows NF4.3.

**When to use:** All platform publishing calls go through this interface — never call platform APIs directly from service layer.

```typescript
// Source: Phase context decision + upstream social.integrations.interface.ts study
// extensions/scheduling-publishing/src/adapters/platform-adapter.interface.ts

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  platformUrl?: string;
  error?: string;
  retryable?: boolean;    // true = transient (rate limit, 5xx), false = permanent (auth, policy)
  responseCode?: number;
}

export interface PostVariantPayload {
  variantId: string;
  platform: string;
  caption: string;
  hashtags: string[];
  mediaPath?: string;       // S3 key in MinIO
  accessToken: string;      // Decrypted OAuth token
  accountId: string;        // Platform account/page ID
  attemptNumber: number;    // 1, 2, or 3
}

export interface PlatformAdapter {
  readonly platform: string;
  readonly apiVersion: string;   // NF4.5: pinned version string
  publish(payload: PostVariantPayload): Promise<PublishResult>;
}
```

### Pattern 4: Retry with Exponential Backoff + Jitter (NF2.1)

**What:** Three attempts with delays of 1min, 5min, 15min (with ±30s jitter). nextRetryAt field on PublishVariantJob controls when worker picks it up next.

**When to use:** Any transient publish failure (rate limit, 5xx, timeout).

```typescript
// Source: Phase context decision (NF2.1, R10.4)
const BACKOFF_DELAYS_MS = [
  1 * 60 * 1000,   // 1 min
  5 * 60 * 1000,   // 5 min
  15 * 60 * 1000,  // 15 min
];

function computeNextRetryAt(attemptNumber: number): Date {
  const baseDelay = BACKOFF_DELAYS_MS[attemptNumber - 1] ?? BACKOFF_DELAYS_MS[2];
  const jitterMs = Math.random() * 30 * 1000;  // Up to 30 seconds jitter (NF2.1)
  return new Date(Date.now() + baseDelay + jitterMs);
}
```

### Pattern 5: SWR Hook Per Data Concern (From CLAUDE.md)

**What:** Each SWR call lives in its own hook. Mutations use useState + useFetch (no SWR caching for mutations). Per CLAUDE.md rules.

```typescript
// Source: established Phase 5 pattern (use-review-queue.ts, use-generate-post.ts)
// apps/frontend/src/components/scheduling/hooks/use-calendar.ts

'use client';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export const useSchedulingCalendar = (companySlug: string, from: string, to: string) => {
  const fetch = useFetch();
  const key = companySlug ? `calendar-${companySlug}-${from}-${to}` : null;
  return useSWR(key, async () => {
    const res = await fetch(`/companies/${companySlug}/schedule?from=${from}&to=${to}`);
    return res.json();
  });
};
```

### Pattern 6: Media Download from MinIO for Platform Upload

**What:** Download processed variant from MinIO as Buffer, then upload to platform API (multipart where required).

**When to use:** All platform adapters that publish media — download locally first, then POST to platform.

```typescript
// Source: Phase 4 MediaProcessingService pattern + AWS SDK v3 GetObjectCommand
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

async function downloadFromMinio(s3Key: string): Promise<Buffer> {
  const client = new S3Client({
    endpoint: process.env.MINIO_ENDPOINT!,
    region: 'us-east-1',
    forcePathStyle: true,  // CRITICAL for MinIO — see Phase 4 decision
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY!,
      secretAccessKey: process.env.MINIO_SECRET_KEY!,
    },
  });
  const cmd = new GetObjectCommand({ Bucket: process.env.MINIO_BUCKET!, Key: s3Key });
  const response = await client.send(cmd);
  return Buffer.from(await response.Body!.transformToByteArray());  // Phase 4 pattern
}
```

### Pattern 7: Token Decryption for Platform API Calls

**What:** Use TokenEncryptionService from @social/credential-management to decrypt stored OAuth tokens before API calls.

**When to use:** Every platform adapter must decrypt the stored token before calling the platform API.

```typescript
// Source: Phase 2 token.refresh.job.ts pattern
// Adapters receive decrypted token via PublishingService (service decrypts, adapter gets plaintext)
const encryptedToken = integration.token;
const decryptedToken = this.tokenEncryptionService.isEncrypted(encryptedToken)
  ? this.tokenEncryptionService.decrypt(encryptedToken)
  : encryptedToken;
```

### Anti-Patterns to Avoid
- **Calling platform APIs directly from controller or service:** ALL platform calls go through PlatformAdapter implementations — never inline API calls in PublishingService
- **Missing RUN_CRON guard:** Both @Cron jobs must check `if (!process.env.RUN_CRON) return;` — prevents cron from running in web API process
- **Storing publish time in company timezone:** Always convert to UTC with dayjs.tz() before writing scheduledAt to DB; display in company timezone in UI
- **Re-using the SWR key across components:** Calendar, failed posts, and schedule mutation hooks must each have unique SWR keys
- **Mixing SWR and mutations in same hook:** Mutation hooks (schedule, retry, cancel) must use useState + useFetch, NOT useSWR — per established Phase 5 pattern
- **Skipping idempotency check:** platformPostId must be checked in BOTH scheduler_tick (before enqueuing) AND publishing worker (before calling adapter) — two-layer defense
- **Throwing from processJob loop:** Per-job errors must be caught inside the loop — throw breaks the entire batch

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UTC/timezone conversion | Custom timezone parsing | dayjs.tz() + dayjs.utc() | Timezone edge cases (DST, named zones) are a known minefield; dayjs plugins handle all IANA zones |
| Cron job scheduling | setTimeout/setInterval loops | @nestjs/schedule @Cron | NestJS Cron integrates with DI lifecycle, survives restarts, tested pattern in Phase 2 and 4 |
| Idempotency on publishes | Custom "already published" flag | platformPostId field + upsert | Two-level check (scheduler_tick + worker) ensures no duplicate publish even if tick runs twice |
| Exponential backoff computation | Binary search or lookup | Simple array + Math.random | Three fixed delays are sufficient; complexity of adaptive backoff not warranted at this scale |
| Platform API error parsing | Generic HTTP status check | handleErrors() pattern from SocialAbstract | Platform errors are in response BODY not HTTP status — Instagram returns 200 with error JSON |
| Media upload to platforms | Streaming from MinIO | Download to Buffer then upload | Platforms require Content-Length; streaming without buffering requires chunked transfer not all platforms support |

**Key insight:** The upstream Postiz codebase has production-proven social provider implementations (instagram.provider.ts, facebook.provider.ts, linkedin.provider.ts, x.provider.ts). Study their `post()` implementations and `handleErrors()` patterns closely — they encode years of platform API quirks. The new adapters should build on these learnings without importing the upstream providers directly (extension zone separation).

---

## Common Pitfalls

### Pitfall 1: Platform API Errors in Response Body, Not HTTP Status
**What goes wrong:** Adapter returns `success: true` because HTTP 200, but post was actually rejected by platform.
**Why it happens:** Instagram and Facebook Graph API return 200 OK with error JSON inside the body (error.code, error.message). LinkedIn and X are more standard.
**How to avoid:** Parse response body as JSON regardless of HTTP status; check for `error` key in response. Pattern from upstream `handleErrors(body: string)` in SocialAbstract — check body string for known error codes.
**Warning signs:** platformPostId is null/undefined after "successful" 200 response.

### Pitfall 2: Instagram Requires Media Container → Publish Two-Step Flow
**What goes wrong:** Directly POSTing to `/media/publish` without creating container first — returns error 9007.
**Why it happens:** Instagram Media Publishing API requires: (1) Create container POST /media → get creation_id, (2) Wait for container ready, (3) Publish POST /media/publish?creation_id=
**How to avoid:** InstagramAdapter.publish() must implement the two-step flow. Study upstream instagram.provider.ts `post()` method for the exact flow.
**Warning signs:** Immediate publish fails with error 9007 or "Media not ready."

### Pitfall 3: Scheduler Tick Overlap — Two Processes Enqueuing Same Variant
**What goes wrong:** If two orchestrator instances run (or if a tick is slow), the same PostVariant gets enqueued twice, causing duplicate publishes.
**Why it happens:** @Cron ticks don't use distributed locks; if the minute-1 tick is still running when minute-2 fires, both can pick up the same SCHEDULED variants.
**How to avoid:** Two defenses: (1) Use `upsert` with unique constraint on `variantId` in PublishVariantJob (not `create`) — concurrent upserts are safe; (2) Update PostVariant status to PUBLISHING immediately before inserting job — subsequent tick won't pick up PUBLISHING variants.
**Warning signs:** Same post appears twice on the social platform.

### Pitfall 4: dayjs Timezone Conversion Edge Cases
**What goes wrong:** Post scheduled for "9:00 AM" in company timezone publishes at the wrong UTC time.
**Why it happens:** `dayjs('2026-03-15 09:00').tz('America/New_York')` vs `dayjs.tz('2026-03-15 09:00', 'America/New_York')` — the first treats input as local time then converts, the second treats input as the given timezone. Only the second form is correct.
**How to avoid:** Always use `dayjs.tz(dateTimeString, company.timezone).utc().toDate()` for conversion.
**Warning signs:** Posts publish exactly N hours off where N is the company UTC offset.

### Pitfall 5: LinkedIn Token Is One-Time Use (oneTimeToken: true)
**What goes wrong:** LinkedIn refreshToken attempt fails — LinkedIn V2 issues long-lived access tokens (60 days) but doesn't support refresh token flow in the same way.
**Why it happens:** `oneTimeToken = true` on LinkedinProvider means the token cannot be auto-refreshed — operator must re-authenticate when it expires.
**How to avoid:** LinkedInAdapter must check token expiry before publishing and return a permanent error (non-retryable) when token is expired, to trigger operator alert via the notification pattern from Phase 2.
**Warning signs:** LinkedIn publishes fail after ~60 days with auth errors.

### Pitfall 6: Missing RUN_CRON Guard Causes Cron to Run in Web Process
**What goes wrong:** Both web API server and orchestrator run the same NestJS app code; without the guard, cron jobs fire in both processes simultaneously.
**Why it happens:** NestJS Schedule module runs @Cron decorators in any process that imports ScheduleModule.
**How to avoid:** Established pattern from Phase 2/4: `if (!process.env.RUN_CRON) return;` as first line of every @Cron handler. RUN_CRON=true is set only in the orchestrator Docker service.
**Warning signs:** Cron jobs appear to run multiple times per tick; duplicate jobs in job table.

### Pitfall 7: Facebook Page Token vs User Token
**What goes wrong:** Publishing to a Facebook Page fails with "User not authorized to post to this page."
**Why it happens:** Facebook Graph API requires a Page Access Token (not user token) for posting to a Facebook Page. The OAuth flow stores the user token; the page token must be derived from it.
**How to avoid:** FacebookAdapter must exchange user token for page token using GET /me/accounts before publishing. Study upstream facebook.provider.ts for the fetchPageInformation() pattern.
**Warning signs:** Post requests fail with error 200/190 (OAuth token invalid for page).

### Pitfall 8: X (Twitter) Rate Limits Are Strict and App-Level
**What goes wrong:** X rate limit errors appear even when posting infrequently, blocking all company posts.
**Why it happens:** X API v2 rate limits (300 tweets per 15 min on Basic tier) are per app credentials, not per account. A single app handles all companies.
**How to avoid:** XAdapter.publish() returns retryable=true on 429 errors, backing off via the exponential backoff mechanism. Set `maxConcurrentJob = 1` (matching XProvider.maxConcurrentJob) to serialize X posts. Track rate limit headers (x-rate-limit-remaining, x-rate-limit-reset) for smarter backoff.
**Warning signs:** X posts all fail simultaneously across multiple companies with 429 errors.

---

## Code Examples

Verified patterns from project codebase:

### PlatformAdapter Interface
```typescript
// extensions/scheduling-publishing/src/adapters/platform-adapter.interface.ts
export type PublishStatus = 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED' | 'STALE';

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  platformUrl?: string;
  error?: string;
  retryable?: boolean;
  responseCode?: number;
}

export interface PostVariantPayload {
  variantId: string;
  platform: string;
  caption: string;
  hashtags: string[];
  mediaS3Key?: string;
  accessToken: string;
  accountId: string;
  attemptNumber: number;
}

export interface PlatformAdapter {
  readonly platform: string;
  readonly apiVersion: string;  // NF4.5
  publish(payload: PostVariantPayload): Promise<PublishResult>;
}
```

### Prisma Schema Additions (Phase 6)
```prisma
// Extend PostVariant with scheduling/publishing fields (migration: 20260310000006_phase6_scheduling)
// Note: PostVariant status will use existing String field — add new values: SCHEDULED, PUBLISHING, PUBLISHED, FAILED, STALE

// Extend ContentPostStatus type in content.types.ts:
// 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED'

// Extend PostVariantStatus type:
// 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED' | 'STALE'

// New fields on PostVariant (Prisma migration):
// scheduledAt     DateTime?
// publishedAt     DateTime?
// platformPostId  String?
// platformUrl     String?
// publishAttempts Int      @default(0)
// publishError    String?

// New model: ScheduledPost (links ContentPost → schedule intent)
model ScheduledPost {
  id             String      @id @default(uuid())
  postId         String      @unique
  companyId      String
  scheduledAt    DateTime    // UTC
  platforms      String[]    // which platforms to publish to
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  @@index([companyId, scheduledAt])
  @@index([scheduledAt])
}

// New model: PublishVariantJob (the job queue table)
model PublishVariantJob {
  id          String    @id @default(uuid())
  variantId   String    @unique  // Ensures idempotent enqueue
  platform    String
  status      String    @default("pending")  // pending|processing|completed|failed
  nextRetryAt DateTime  @default(now())
  attempts    Int       @default(0)
  error       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([status, nextRetryAt])
}

// New model: PublishAttemptLog (immutable log — R10.6)
model PublishAttemptLog {
  id             String    @id @default(uuid())
  variantId      String
  attemptNumber  Int
  status         String    // success|failed
  responseCode   Int?
  errorMessage   String?
  errorType      String?   // transient|permanent
  payload        Json?     // full request payload for debugging
  attemptedAt    DateTime  @default(now())

  @@index([variantId])
  @@index([variantId, attemptNumber])
}

// Extend Company with publish window setting
// publishWindowHours  Int  @default(4)
```

### ScheduleService.schedule() — Core Scheduling Flow
```typescript
// extensions/scheduling-publishing/src/scheduling/schedule.service.ts
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);

async schedule(
  companyId: string,
  postId: string,
  scheduledAtLocal: string,    // ISO string in company timezone (e.g., "2026-03-15T09:00:00")
  platforms: string[],
): Promise<void> {
  const company = await this.prisma.company.findUnique({ where: { id: companyId } });

  // CRITICAL: convert company-local time → UTC for DB storage (Pitfall 4)
  const scheduledAtUtc = dayjs.tz(scheduledAtLocal, company.timezone).utc().toDate();

  // Create ScheduledPost record
  await this.prisma.scheduledPost.upsert({
    where: { postId },
    create: { postId, companyId, scheduledAt: scheduledAtUtc, platforms },
    update: { scheduledAt: scheduledAtUtc, platforms },
  });

  // Update all PostVariants for this post+platforms to SCHEDULED
  await this.prisma.postVariant.updateMany({
    where: { postId, platform: { in: platforms } },
    data: { status: 'SCHEDULED', scheduledAt: scheduledAtUtc },
  });

  // Update ContentPost status to SCHEDULED
  await this.prisma.contentPost.update({
    where: { id: postId },
    data: { status: 'SCHEDULED' },
  });
}
```

### PublishingService.processVariant() — Core Publishing Flow
```typescript
// extensions/scheduling-publishing/src/publishing/publishing.service.ts
async processVariant(variantId: string, platform: string): Promise<void> {
  const variant = await this.prisma.postVariant.findUnique({
    where: { id: variantId },
    include: { post: { include: { company: true } } }
  });

  // Idempotency check (R10.3) — second layer after scheduler_tick check
  if (variant.platformPostId) {
    this.logger.log(`Variant ${variantId} already published — skipping`);
    return;
  }

  // Get integration (SocialAccount → Integration → decrypted token)
  const integration = await this.getIntegration(variant.post.company, platform);
  const decryptedToken = this.decryptToken(integration);

  const attemptNumber = (variant.publishAttempts ?? 0) + 1;

  const result = await this.adapter(platform).publish({
    variantId,
    platform,
    caption: variant.caption,
    hashtags: variant.hashtags,
    mediaS3Key: variant.mediaVariantS3Key,
    accessToken: decryptedToken,
    accountId: integration.externalId,
    attemptNumber,
  });

  // Log attempt (R10.6)
  await this.prisma.publishAttemptLog.create({
    data: {
      variantId,
      attemptNumber,
      status: result.success ? 'success' : 'failed',
      responseCode: result.responseCode,
      errorMessage: result.error,
      errorType: result.retryable ? 'transient' : 'permanent',
      attemptedAt: new Date(),
    },
  });

  if (result.success) {
    // Update variant and parent post
    await this.prisma.postVariant.update({
      where: { id: variantId },
      data: {
        status: 'PUBLISHED',
        platformPostId: result.platformPostId,
        platformUrl: result.platformUrl,
        publishedAt: new Date(),
        publishAttempts: attemptNumber,
      },
    });
    await this.updateParentPostStatus(variant.postId);
  } else if (!result.retryable || attemptNumber >= 3) {
    // Permanent failure or exhausted retries → FAILED
    await this.prisma.postVariant.update({
      where: { id: variantId },
      data: { status: 'FAILED', publishError: result.error, publishAttempts: attemptNumber },
    });
  } else {
    // Transient failure — update for retry with backoff
    const nextRetryAt = computeNextRetryAt(attemptNumber);
    await this.prisma.postVariant.update({
      where: { id: variantId },
      data: { status: 'SCHEDULED', publishAttempts: attemptNumber },
    });
    await this.prisma.publishVariantJob.update({
      where: { variantId },
      data: { status: 'pending', attempts: attemptNumber, nextRetryAt, error: result.error },
    });
  }
}
```

### Instagram Adapter Skeleton (Two-Step Publish)
```typescript
// extensions/scheduling-publishing/src/adapters/instagram.adapter.ts
// Based on study of upstream instagram.provider.ts

export class InstagramAdapter implements PlatformAdapter {
  readonly platform = 'instagram';
  readonly apiVersion = 'v21.0';   // NF4.5: pinned version

  async publish(payload: PostVariantPayload): Promise<PublishResult> {
    try {
      // Step 1: Create media container
      const container = await this.createContainer(payload);
      if (!container.id) {
        return { success: false, error: 'Container creation failed', retryable: true };
      }

      // Step 2: Wait for container to be ready (poll with timeout)
      const ready = await this.waitForContainer(container.id, payload.accessToken);
      if (!ready) {
        return { success: false, error: 'Container not ready after timeout', retryable: true };
      }

      // Step 3: Publish
      const publishResult = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${payload.accountId}/media_publish`,
        { method: 'POST', body: new URLSearchParams({ creation_id: container.id, access_token: payload.accessToken }) }
      );
      const data = await publishResult.json();

      if (data.error) {
        const retryable = this.isRetryable(data.error.code);
        return { success: false, error: data.error.message, retryable, responseCode: publishResult.status };
      }

      return {
        success: true,
        platformPostId: data.id,
        platformUrl: `https://www.instagram.com/p/${data.id}`,
        responseCode: publishResult.status,
      };
    } catch (err: any) {
      return { success: false, error: err.message, retryable: true };
    }
  }

  private isRetryable(errorCode: number): boolean {
    // Study upstream instagram.provider.ts handleErrors() for known codes
    const permanentCodes = [24, 10, 200, 190, 2207081, 36003];  // Auth + policy violations
    return !permanentCodes.includes(errorCode);
  }
}
```

### Frontend: Calendar Hook
```typescript
// apps/frontend/src/components/scheduling/hooks/use-calendar.ts
// Source: established pattern from use-review-queue.ts
'use client';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface ScheduledVariant {
  id: string;
  platform: string;
  caption: string;
  scheduledAt: string;    // ISO UTC — displayed in company TZ on frontend
  status: string;
  mediaUrl?: string;
}

export const useSchedulingCalendar = (companySlug: string, from: string, to: string) => {
  const fetch = useFetch();
  const key = companySlug ? `calendar-${companySlug}-${from}-${to}` : null;
  return useSWR<ScheduledVariant[]>(key, async () => {
    const res = await fetch(`/companies/${companySlug}/schedule?from=${from}&to=${to}`);
    return res.json();
  });
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BullMQ for job queues | @Cron poller + DB table | Phase 4 decision | Simpler; no queue dependency in extension zone; same reliability for single-operator scale |
| Direct token use | TokenEncryptionService decrypt before call | Phase 2 | All stored tokens are AES-256-GCM encrypted; must decrypt before passing to platform API |
| Upstream SocialProvider interface | Custom PlatformAdapter interface | Phase 6 design | Extension zone separation — builds on learnings from upstream but doesn't import it |
| facebook.provider.ts / instagram.provider.ts | New adapters in extension zone | Phase 6 | Study patterns, build fresh in @social/scheduling-publishing to avoid coupling to upstream provider infra |

**Deprecated/outdated:**
- `--color-custom*` CSS variables: Deprecated per CLAUDE.md — do NOT use in calendar UI or any Phase 6 frontend components
- Direct fetch() without useFetch: Non-compliant with CLAUDE.md requirements — always use useFetch hook from @gitroom/helpers

**Platform API versions to pin (NF4.5):**
- Meta Graph API (Instagram + Facebook): `v21.0`
- LinkedIn Marketing API: `202502` (quarterly versioning scheme)
- X API v2: `2` (stable)

---

## Open Questions

1. **Company.publishWindowHours field**
   - What we know: Context decision specifies "configurable publish window per company (default: 4 hours)"
   - What's unclear: The Company Prisma model doesn't yet have a `publishWindowHours` field — needs migration
   - Recommendation: Add `publishWindowHours Int @default(4)` to Company model in Phase 6 Prisma migration

2. **CompanySettings for auto-slot posting windows**
   - What we know: Context says "per-company preferred posting windows stored in Company settings"
   - What's unclear: No CompanySettings table exists yet; Company model has notes/settings? fields are not defined
   - Recommendation: Add `postingWindowsJson Json?` to Company model (stores preferred hour ranges per platform as JSON); null = no preference = default windows

3. **mediaVariantS3Key on PostVariant**
   - What we know: PostVariant.mediaVariantId references a MediaVariant record; the adapter needs the actual S3 key to download from MinIO
   - What's unclear: Whether to store S3 key on PostVariant or resolve via MediaVariant.path at publish time
   - Recommendation: Resolve at publish time via join: `MediaVariant.path` contains the S3 key — add include: { mediaVariant: true } in the publishing service query

4. **Integration lookup for platform publishing**
   - What we know: SocialAccount has integrationId FK linking to upstream Integration table (Phase 2)
   - What's unclear: How to efficiently join SocialAccount → Integration for each variant's company + platform combination
   - Recommendation: PublishingService queries `SocialAccount` by `brandId + platform`, then fetches `Integration` by `integrationId` — same pattern as Phase 2 OAuthBrandController batch fetch

5. **Account/page ID for posting (especially Facebook)**
   - What we know: Facebook requires a Page Access Token derived from user token; Instagram requires the Instagram Business Account ID
   - What's unclear: Whether these are stored in Integration.externalId or need to be fetched at publish time
   - Recommendation: Instagram Business ID = Integration.externalId (matches instagram.provider.ts); Facebook requires GET /me/accounts to derive page token — cache in Integration.internalId or publish a derived token during OAuth (study Phase 2 facebook connection flow)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.x with ts-jest |
| Config file | `extensions/scheduling-publishing/jest.config.ts` (copy from content-generation pattern) |
| Quick run command | `pnpm --filter @social/scheduling-publishing test -- --testPathPattern="scheduler-tick\|schedule.service"` |
| Full suite command | `pnpm --filter @social/scheduling-publishing test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R9.1 | ContentPostStatus + PostVariantStatus type unions include all new states | unit | `pnpm --filter @social/scheduling-publishing test -- -t "status types"` | Wave 0 |
| R9.2 | ScheduleService.schedule() converts local time to UTC correctly | unit | `pnpm --filter @social/scheduling-publishing test -- -t "schedule converts timezone"` | Wave 0 |
| R9.4 | scheduler_tick queries SCHEDULED variants with scheduledAt <= now, batch 50 | unit | `pnpm --filter @social/scheduling-publishing test -- -t "scheduler-tick"` | Wave 0 |
| R9.5 | dayjs.tz() conversion: "9:00 America/New_York" → correct UTC | unit | `pnpm --filter @social/scheduling-publishing test -- -t "timezone"` | Wave 0 |
| R10.2 | PlatformAdapter.publish() called with correct payload | unit | `pnpm --filter @social/scheduling-publishing test -- -t "platform adapter"` | Wave 0 |
| R10.3 | Idempotent: publishing skipped if platformPostId already set | unit | `pnpm --filter @social/scheduling-publishing test -- -t "idempotent"` | Wave 0 |
| R10.4 | Retry: nextRetryAt computed correctly for each attempt (1/5/15 min) | unit | `pnpm --filter @social/scheduling-publishing test -- -t "retry backoff"` | Wave 0 |
| R10.5 | Transient error → retryable=true; permanent error → retryable=false | unit | `pnpm --filter @social/scheduling-publishing test -- -t "error classification"` | Wave 0 |
| R10.6 | PublishAttemptLog.create called on every attempt (success and fail) | unit | `pnpm --filter @social/scheduling-publishing test -- -t "attempt log"` | Wave 0 |
| R10.8 | scheduler_tick marks STALE when scheduledAt + windowHours < now | unit | `pnpm --filter @social/scheduling-publishing test -- -t "stale window"` | Wave 0 |
| NF2.1 | Backoff includes jitter (nextRetryAt has non-zero random component) | unit | `pnpm --filter @social/scheduling-publishing test -- -t "jitter"` | Wave 0 |
| NF4.5 | Each adapter has apiVersion string constant | unit | `pnpm --filter @social/scheduling-publishing test -- -t "api version"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @social/scheduling-publishing test -- --testPathPattern="schedule.service\|scheduler-tick"`
- **Per wave merge:** `pnpm --filter @social/scheduling-publishing test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `extensions/scheduling-publishing/src/__tests__/scheduler-tick.job.spec.ts` — covers R9.4, R10.3, R10.8
- [ ] `extensions/scheduling-publishing/src/__tests__/publishing.service.spec.ts` — covers R10.1, R10.3, R10.4, R10.5, R10.6, NF2.1
- [ ] `extensions/scheduling-publishing/src/__tests__/schedule.service.spec.ts` — covers R9.2, R9.5
- [ ] `extensions/scheduling-publishing/src/__tests__/instagram.adapter.spec.ts` — covers R10.2, NF4.5
- [ ] `extensions/scheduling-publishing/jest.config.ts` — copy from content-generation/jest.config.ts
- [ ] `extensions/scheduling-publishing/tsconfig.json` — copy from content-generation/tsconfig.json
- [ ] `extensions/scheduling-publishing/tsconfig.spec.json` — copy from content-generation/tsconfig.spec.json

---

## Sources

### Primary (HIGH confidence)
- Project codebase: `extensions/media-library/src/processing/media-processing.job.ts` — @Cron poller pattern with per-job error isolation
- Project codebase: `extensions/credential-management/src/refresh/token.refresh.job.ts` — consecutiveFailures + @Cron + interface injection pattern
- Project codebase: `extensions/content-generation/src/types/content.types.ts` — ContentPostStatus, PostVariantStatus unions to extend
- Project codebase: `libraries/nestjs-libraries/src/integrations/social/instagram.provider.ts` — Instagram two-step publish flow and error code handling
- Project codebase: `libraries/nestjs-libraries/src/integrations/social/facebook.provider.ts` — Facebook error classification pattern
- Project codebase: `libraries/nestjs-libraries/src/integrations/social/x.provider.ts` — X rate limit handling and twitter-api-v2 usage
- Project codebase: `libraries/nestjs-libraries/src/integrations/social/linkedin.provider.ts` — LinkedIn oneTimeToken behavior
- Project codebase: `libraries/nestjs-libraries/src/integrations/social.abstract.ts` — handleErrors() pattern for error classification
- Project codebase: `apps/frontend/src/components/review-queue/hooks/use-review-queue.ts` — SWR hook pattern for Phase 6 frontend hooks
- Project codebase: `apps/frontend/src/components/launches/calendar.tsx` — dayjs usage for calendar rendering (week/day views)
- Project codebase: `libraries/nestjs-libraries/src/database/prisma/schema.prisma` — existing models (ContentPost, PostVariant, Company) to extend

### Secondary (MEDIUM confidence)
- Phase 6 CONTEXT.md decisions — all implementation decisions sourced directly from user + AI discussion
- Phase 2 CONTEXT.md patterns (from STATE.md decision log) — token decryption before API calls
- CLAUDE.md project rules — SWR per-hook rule, useFetch requirement, no external UI component libraries

### Tertiary (LOW confidence)
- Instagram Graph API v21.0 behavior: two-step container → publish flow based on upstream instagram.provider.ts code study (not live API verification)
- Platform rate limits (Instagram 200/hr, LinkedIn 100/day, X 300/15min): sourced from CONTEXT.md specifics section — should be verified against current platform developer docs before adapter implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already used in project; no new dependencies required
- Architecture patterns: HIGH — directly derived from existing Phase 2/4 code patterns in codebase
- Pitfalls: MEDIUM — Instagram/Facebook/LinkedIn API behaviors inferred from upstream provider code study; verify against current platform docs during adapter implementation
- Platform API version strings: MEDIUM — based on upstream code (v21.0 for Meta); verify at adapter implementation time that these versions are still current

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (platform API versions can change; re-verify NF4.5 version strings before implementation)
