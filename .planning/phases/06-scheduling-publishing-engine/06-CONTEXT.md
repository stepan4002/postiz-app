# Phase 6: Scheduling & Publishing Engine - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Posts flow from approved → scheduled → published with retry logic, error classification, and failure alerting. Covers R9.1-R9.5 (scheduling engine) and R10.1-R10.8 (publishing engine). This phase consumes approved PostVariants from Phase 5's content generation pipeline and pushes them to social platforms via official APIs connected in Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Post State Machine
- States: DRAFT → APPROVED → SCHEDULED → PUBLISHING → PUBLISHED / FAILED
- ContentPost already has status field (Phase 5) — extend with SCHEDULED, PUBLISHING, PUBLISHED, FAILED states
- PostVariant gets its own publish status (independent per platform — one can succeed while another fails)
- State transitions enforced in service layer — no skipping states
- FAILED posts can be retried (transition back to SCHEDULED)

### Schedule Resolver
- Operator picks exact date/time OR selects "auto-slot" for AI-suggested optimal time
- Auto-slot: simple rule-based initially (per-company preferred posting windows stored in Company settings)
- Per-company timezone stored on Company model (already has timezone field from Phase 1)
- All scheduling logic works in company timezone, stored as UTC in DB
- Schedule resolver creates a ScheduledPost record linking ContentPost → publish time → target platforms

### Scheduler Tick (Cron)
- `@Cron('*/1 * * * *')` — runs every minute, consistent with Phase 4's @Cron pattern
- Queries PostVariants where status=SCHEDULED AND scheduledAt <= now
- Enqueues each due variant as a publish job
- Batch size limit per tick (e.g., 50) to prevent overwhelming platform APIs
- Idempotent: checks platform_post_id before enqueuing (R10.3)
- Extension zone: new @social/scheduling-publishing extension package

### Platform Adapter Layer
- Uniform `PlatformAdapter` interface: `publish(variant: PostVariant): Promise<PublishResult>`
- Adapters for 4 MVP platforms: Instagram (Meta Business API), Facebook (Graph API), LinkedIn (Marketing API), X (API v2)
- Each adapter uses credentials from Phase 2's CredentialManagement (encrypted tokens, auto-refreshed)
- PublishResult: { success, platformPostId, platformUrl, error?, retryable? }
- Adapters handle platform-specific payload formatting (caption, media upload, hashtags)
- Media uploaded to platform from MinIO (Phase 4) — download from S3 then upload to platform API

### Publishing Worker
- One job per PostVariant — platform-specific publishing
- Uses @Cron poller pattern (consistent with Phase 4 MediaProcessingJob) — not BullMQ
- Per-job error isolation: one variant failure doesn't block others (Phase 4 pattern)
- Updates PostVariant with platformPostId and platformUrl on success
- Updates ContentPost parent status based on all variant outcomes

### Retry & Error Classification
- 3 attempts maximum per PostVariant
- Exponential backoff with jitter: 1min, 5min, 15min
- Error classification in adapter response:
  - Transient (retryable): rate limit, timeout, 5xx → auto-retry
  - Permanent (non-retryable): invalid content, auth failure, policy violation → alert operator
- consecutiveFailures counter on PostVariant (same pattern as Phase 2 token health)
- Publish attempt log: timestamp, attempt number, response code, error details, full payload

### Publish Window & Staleness
- Configurable publish window per company (default: 4 hours after scheduled time)
- If post not published within window → escalate to STALE status, surface in dashboard
- Stale posts require manual operator action (reschedule or cancel)

### Scheduling Calendar UI
- Calendar view showing all scheduled posts across platforms per company
- Day/week view toggle
- Posts shown as cards on calendar with platform icons, media thumbnail, scheduled time
- Click to view post details, edit schedule, or cancel
- Drag-to-reschedule is deferred (future enhancement)
- Color-coded by platform (consistent with Phase 5 review queue: instagram=pink, facebook=blue, linkedin=sky, x=gray)
- Uses existing Postiz calendar infrastructure where possible

### Failed Posts Dashboard
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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ContentPostService` (extensions/content-generation): manages ContentPost lifecycle — extend for scheduling states
- `ContentPostRepository` (extensions/content-generation): DB operations for ContentPost/PostVariant
- `ReviewQueueService` (extensions/content-generation): approve action transitions post to APPROVED — scheduling picks up from here
- `content.types.ts` (extensions/content-generation): ContentPostStatus enum — extend with SCHEDULED/PUBLISHING/PUBLISHED/FAILED
- `TokenEncryptionService` (extensions/credential-management): decrypt stored OAuth tokens for platform API calls
- `TokenRefreshJob` (extensions/credential-management): pattern for @Cron jobs with per-job error isolation
- `MediaProcessingJob` (extensions/media-library): @Cron poller pattern — reuse for scheduler_tick
- `PlatformMediaValidator` (extensions/media-library): validate media before publish
- `MinioStorage` (extensions/media-library): download media from S3 for platform upload
- `uploadBufferToMinio` (extensions/media-library): S3 upload utility
- Existing Postiz integrations: `libraries/nestjs-libraries/src/integrations/social/` — has provider patterns for social platforms

### Established Patterns
- @Cron poller with batch processing and per-job error isolation (Phase 4)
- Extension zone: all custom code in extensions/, @social/* path aliases
- Controller -> Service -> Repository layering
- Company scoping: explicit companyId parameter
- Interface injection for cross-package deps (Phase 2)
- consecutiveFailures + alert threshold pattern (Phase 2 token health)
- SWR hooks: each in separate file, useFetch for API calls

### Integration Points
- Phase 2 credentials: OAuth tokens needed for platform API calls
- Phase 4 media: download processed variants from MinIO for platform upload
- Phase 4 validation: PlatformMediaValidator called before publish
- Phase 5 content: ContentPost/PostVariant models consumed by scheduling
- Phase 5 review: APPROVED status triggers scheduling eligibility
- Existing Postiz social providers: study patterns but build new adapters in extension zone
- Phase 7 analytics: published posts (with platformPostId) are the starting point for metrics ingestion

</code_context>

<specifics>
## Specific Ideas

No specific requirements from user — auto-mode. Key constraints:

- This is the "last mile" — content goes from approved to live on social platforms
- Reliability is paramount: failed publishes must be visible and actionable
- Platform API rate limits vary: Instagram (200/hour), Facebook (200/hour), LinkedIn (100/day), X (300/15min)
- Per-company timezone critical: a post scheduled for "9am" means 9am in the company's timezone
- Solo operator: no approval chain for scheduling, just pick time and go
- Calendar view is the operator's planning workspace — needs to show the full picture at a glance
- Existing Postiz has some scheduling/publishing code — study patterns but build fresh in extension zone

</specifics>

<deferred>
## Deferred Ideas

- Drag-to-reschedule on calendar — future enhancement
- Evergreen post recycling — future phase
- Bulk scheduling (schedule 20 posts at once) — future enhancement
- Cross-posting optimization (stagger same content across platforms) — future enhancement
- Publish preview (show how post will look on each platform) — Milestone 2
- Content calendar with AI-suggested content gaps — Phase 7 or later
- Temporal workflow orchestration (replace @Cron) — production hardening concern

</deferred>

---

*Phase: 06-scheduling-publishing-engine*
*Context gathered: 2026-03-10*
