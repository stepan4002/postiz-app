# Architecture Patterns: AI-Powered Social Media Management

**Domain:** Multi-company social media operations platform (personal, self-hosted)
**Researched:** 2026-03-10
**Confidence:** MEDIUM — based on training knowledge of open-source candidates (Postiz, Mixpost) and established patterns for this domain. Web verification unavailable; flag for validation before committing to base project selection.

---

## System Overview

The system sits between the operator and every social platform. Its job is to accept raw inputs (images, videos, text briefs, source articles), transform them into platform-optimised published content, and report back on what happened.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          OPERATOR BROWSER                                │
│            Dashboard / Content Studio / Inbox / Analytics               │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼──────────────────────────────────────────┐
│                           WEB APPLICATION                                │
│   Next.js / React frontend  +  REST/tRPC/GraphQL API layer              │
│   Auth · Company switcher · Review queue · Settings                     │
└──┬──────────┬────────────┬──────────────┬───────────────────────────────┘
   │          │            │              │
   ▼          ▼            ▼              ▼
┌──────┐ ┌────────┐ ┌──────────┐ ┌───────────────┐
│Media │ │Content │ │Scheduling│ │Analytics &    │
│Store │ │Service │ │Service   │ │Inbox Service  │
│(S3/  │ │        │ │          │ │               │
│Minio)│ └───┬────┘ └────┬─────┘ └───────┬───────┘
└──────┘     │           │               │
             ▼           ▼               │
        ┌─────────────────────────┐      │
        │      MESSAGE QUEUE      │      │
        │  (Redis / BullMQ /      │      │
        │   Inngest / pg-boss)    │      │
        └────────────┬────────────┘      │
                     │ Jobs              │
          ┌──────────┼──────────────┐    │
          ▼          ▼              ▼    │
    ┌──────────┐ ┌────────┐ ┌───────────┐│
    │Publishing│ │Media   │ │Analytics  ││
    │Worker    │ │Process │ │Ingestion  ││
    │          │ │Worker  │ │Worker     ││
    └────┬─────┘ └────────┘ └───────────┘│
         │                               │
         ▼                               ▼
┌─────────────────────────────────────────────────────┐
│                 PLATFORM ADAPTER LAYER               │
│  ┌──────────┐ ┌──────┐ ┌──────────┐ ┌───────────┐  │
│  │Instagram/│ │LinkedIn│ │X/Twitter │ │TikTok/   │  │
│  │Facebook  │ │       │ │          │ │YT Shorts/ │  │
│  │(Meta API)│ │       │ │          │ │Pinterest  │  │
│  └──────────┘ └──────┘ └──────────┘ └───────────┘  │
│  ┌──────────────────────────────────────────────┐   │
│  │           Google Business Profile API        │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│                   AI SERVICE LAYER                   │
│  ┌───────────────────────────────────────────────┐  │
│  │              AI Provider Router               │  │
│  │  (selects provider per task + cost budget)    │  │
│  └──────┬──────────────┬────────────┬────────────┘  │
│         ▼              ▼            ▼               │
│  ┌──────────┐  ┌──────────────┐ ┌────────────────┐  │
│  │ OpenAI   │  │  Anthropic   │ │ Local (Ollama/ │  │
│  │ GPT-4o   │  │  Claude      │ │ llama.cpp)     │  │
│  └──────────┘  └──────────────┘ └────────────────┘  │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│                     DATA LAYER                       │
│  PostgreSQL (primary) + Redis (cache/queues)        │
│  MinIO / local volume (media storage)               │
└─────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### 1. Web Application (Frontend + API)

**Responsibility:** Single entry point for the operator. Renders the dashboard, content studio, scheduling calendar, inbox, analytics, and settings. Exposes a typed API consumed only by the frontend (this is a personal tool — no public API needed in v1).

**Boundaries:**
- Reads/writes to PostgreSQL via ORM (Prisma or Drizzle)
- Enqueues jobs via queue client (never calls platform APIs directly from API handlers)
- Reads pre-aggregated analytics from DB (never pulls live from platform in request path)
- Delegates all AI calls to AI Service Layer via internal service client

**Key sub-sections:**
- Company Switcher context (all queries scoped by `company_id`)
- Content Studio (draft editor, media picker, AI generation trigger, platform preview)
- Review Queue (human-in-the-loop gate before publish)
- Scheduling Calendar (per-company posting windows)
- Inbox (comment/message view per platform)
- Dashboard (today widget: pending reviews, failures, top performers, gaps)

---

### 2. Multi-Company Data Model

**Responsibility:** Enforce strict data isolation between companies. Every entity in the system — accounts, posts, media, analytics, brand configs, scheduling rules — belongs to exactly one `Company`. Every DB query is scoped with `WHERE company_id = ?`.

**Core entity hierarchy:**
```
Operator (1)
  └── Company (5-15)
        ├── Brand (1-N per company)
        │     ├── BrandVoice (tone, language, hashtag rules)
        │     └── SocialAccount (1-N per brand)
        │           └── PlatformCredential (OAuth tokens)
        ├── Post (draft → approved → scheduled → published → failed)
        │     ├── PostVariant (per-platform adaptation of the same content)
        │     └── MediaAttachment
        ├── MediaLibrary (folders: campaign, season, product)
        │     └── MediaAsset
        ├── ScheduleRule (posting windows, frequency caps, blackout dates)
        ├── AnalyticsRecord (ingested metrics per post + account)
        └── InboxMessage (comments, DMs, mentions)
```

**Isolation approach:** Single PostgreSQL database, row-level scoping with `company_id` foreign keys on every table. No separate schemas per company (overkill for 5-15 companies). Row-Level Security (RLS) optional but adds safety.

---

### 3. Platform Adapter Layer

**Responsibility:** Abstract all platform-specific API logic behind a uniform interface. The rest of the system never calls platform SDKs directly — it only calls the adapter.

**Interface contract (TypeScript):**
```typescript
interface PlatformAdapter {
  platform: PlatformName;

  // OAuth
  getAuthorizationUrl(state: string): string;
  exchangeCodeForTokens(code: string): Promise<TokenSet>;
  refreshTokens(refresh_token: string): Promise<TokenSet>;

  // Publishing
  publishPost(payload: PublishPayload): Promise<PublishResult>;
  schedulePost(payload: PublishPayload, publishAt: Date): Promise<PublishResult>;
  deletePost(platformPostId: string): Promise<void>;

  // Analytics
  fetchPostMetrics(platformPostId: string): Promise<PostMetrics>;
  fetchAccountMetrics(accountId: string): Promise<AccountMetrics>;

  // Inbox
  fetchComments(accountId: string, since: Date): Promise<InboxMessage[]>;
  fetchMentions(accountId: string, since: Date): Promise<InboxMessage[]>;
  replyToComment(commentId: string, text: string): Promise<void>;

  // Media
  uploadMedia(file: Buffer, mime: string): Promise<PlatformMediaId>;
  validateMediaConstraints(file: MediaMeta): ValidationResult;
}
```

**Per-platform implementations:**
| Platform | API | Key Constraints |
|---|---|---|
| Instagram | Meta Graph API v19+ | Requires Business Account; images via container upload; video via resumable upload |
| Facebook | Meta Graph API v19+ | Page access tokens; carousel posts; link previews |
| LinkedIn | LinkedIn Marketing API v2 | Organization posts only (no personal); video upload 2-step |
| X (Twitter) | X API v2 | Free tier very limited; Basic/Pro needed for write; thread support |
| TikTok | TikTok for Business API | Content Post API; video only; no scheduling in free tier |
| Pinterest | Pinterest API v5 | Pin creation; board management; no scheduling |
| Google Business | Google My Business API v4 | Local Posts; photo posts; offers |
| YouTube Shorts | YouTube Data API v3 | Video upload; `#Shorts` in title/description for Shorts |

**Token management:** Encrypted storage in DB. Background job checks expiry 48 hours ahead, attempts refresh, flags failed refresh for operator attention.

---

### 4. AI Service Layer

**Responsibility:** Route AI tasks to the right provider based on task type, cost policy, and availability. The rest of the system calls the AI layer by task name, not by provider.

**Provider-agnostic interface:**
```typescript
interface AIService {
  generateCaption(input: CaptionInput): Promise<GeneratedContent>;
  generateHashtags(input: HashtagInput): Promise<string[]>;
  adaptForPlatform(content: string, platform: PlatformName, rules: BrandVoice): Promise<string>;
  translateContent(content: string, targetLang: string): Promise<string>;
  analyzeImage(imageUrl: string): Promise<ImageAnalysis>;
  analyzeVideo(videoUrl: string): Promise<VideoAnalysis>;
  repurposeContent(source: SourceContent, targetType: ContentType): Promise<GeneratedContent>;
  scoreContent(content: string, criteria: ScoringCriteria): Promise<ConfidenceScore>;
}
```

**Provider router logic:**
- Vision tasks (image/video analysis) → GPT-4o or Claude 3.5 Sonnet (both support vision)
- Long-form generation (blog repurposing) → Claude (better at long structured output)
- Fast caption generation → GPT-4o-mini or Claude Haiku (cost optimisation)
- Local/offline → Ollama with Llama 3.1 or Mistral (no API cost, lower quality)
- Routing config stored per-company (company can override default provider)

**Confidence gating:** Every AI generation returns a `ConfidenceScore` (0-1). Posts below threshold (configurable per company, default 0.7) are routed to Review Queue instead of auto-approve. This is non-negotiable architecture — gate must live in the generation pipeline, not be bolted on later.

**Prompt management:** Brand voice, tone, language, and platform rules are injected as system context into every generation call. Stored as structured config per `BrandVoice` entity.

---

### 5. Content Pipeline (Draft → Published)

**Responsibility:** Orchestrate the state machine from raw operator input to published post.

**State machine:**
```
INPUT_RECEIVED
    │
    ▼
MEDIA_PROCESSING     ← media worker (resize, brand, subtitle)
    │
    ▼
AI_GENERATION        ← AI service layer (caption, hashtags, platform variants)
    │
    ▼
CONFIDENCE_CHECK
    ├── pass (≥threshold) → APPROVED (auto)
    └── fail (<threshold) → REVIEW_QUEUE → operator approves → APPROVED
    │
    ▼
SCHEDULED            ← scheduling engine assigns publish time
    │
    ▼
PUBLISHING           ← publishing worker calls platform adapter
    ├── success → PUBLISHED → analytics_ingestion_queued
    ├── retryable error → RETRY (up to 3x, exponential backoff)
    └── fatal error → FAILED → operator alerted
    │
    ▼
ANALYTICS_INGESTING  ← ingestion worker pulls metrics T+1h, T+24h, T+7d
    │
    ▼
COMPLETE
```

**Multi-platform fan-out:** One logical "Post" has N `PostVariant` records (one per target platform). Each variant has its own state. A post is COMPLETE only when all variants reach terminal state (PUBLISHED or FAILED-acknowledged).

---

### 6. Scheduling Engine

**Responsibility:** Determine publish times for posts respecting per-company rules.

**Rule types:**
- Posting windows (e.g. "Tuesday-Thursday, 09:00-11:00, 18:00-20:00")
- Frequency caps (e.g. "max 2 posts/day on Instagram")
- Platform-specific rules (e.g. "LinkedIn: weekdays only")
- Blackout periods (holidays, company events)
- Evergreen recycling rules (recycle pool, minimum gap between recycles)

**Implementation approach:** Scheduling rules stored in DB. A `schedule_resolver` function takes a post + company rules + current calendar state and returns the next available slot. This runs synchronously during post creation (not a background job) so the operator immediately sees the assigned time.

**Cron trigger:** A `scheduler_tick` job runs every minute (or every 5 minutes for scale). It queries `PostVariant WHERE status='SCHEDULED' AND publish_at <= NOW()` and enqueues a `publish_post` job for each. The cron job does not publish directly — it only enqueues. This keeps the scheduler stateless and the publisher isolated.

---

### 7. Publishing Worker

**Responsibility:** Execute a single publish attempt for one PostVariant on one platform.

**Design principles:**
- Idempotent: if the job runs twice (queue redelivery), the second run detects the post already exists on the platform and marks success without double-posting. Achieved by storing `platform_post_id` once received.
- Isolated: one job per variant per platform — no batch publishing that could fail partway through.
- Observable: every attempt logged with timestamp, response, error code.
- Retry policy: 3 attempts with exponential backoff (1min, 5min, 15min). After 3 failures: status=FAILED, operator alert created.

---

### 8. Media Processing Pipeline

**Responsibility:** Transform raw uploaded media into platform-ready assets.

**Processing operations:**
- Image resize to platform specs (per adapter's `validateMediaConstraints`)
- Logo/watermark overlay (configurable per company)
- Quote card generation (text overlay on brand template)
- Carousel pack (multi-image posts for Instagram/LinkedIn)
- Thumbnail extraction and generation for videos
- Video clipping (long video → short clips for Shorts/Reels/TikTok)
- Subtitle burn-in for video (using Whisper for transcription → ffmpeg for burn-in)

**Tool chain:** Sharp (Node.js) for images. FFmpeg for video. Whisper (local or API) for transcription.

**Storage:** MinIO (S3-compatible) for self-hosted. All processed variants stored alongside originals. Paths stored in `MediaAsset` DB record. Originals never deleted (only operators can delete).

**Job architecture:** Media processing runs in a separate worker queue from publishing. Heavy video jobs (clipping, subtitle generation) are long-running and must not block the publishing queue. Separate queue with separate concurrency limit.

---

### 9. Analytics Ingestion

**Responsibility:** Pull post-publish metrics from platform APIs and store for aggregation.

**Pull model (not webhook):** Platform APIs are pull-based for metrics. A `PostVariant` triggers ingestion jobs at fixed intervals post-publish:
- T+1h: early engagement signal
- T+24h: first-day performance
- T+7d: full organic reach window
- T+30d: final snapshot (then stops)

**Aggregation:** Pre-aggregate stats into `AnalyticsRecord` rows on ingest. Dashboard queries hit pre-aggregated records, never raw platform API. Weekly/monthly summaries are materialised views or pre-computed on a cron (Sunday midnight).

**Metrics stored:** impressions, reach, likes, comments, shares, saves, clicks, video_views, video_watch_time, profile_visits (platform-dependent availability).

---

### 10. Inbox / Comment Monitoring

**Responsibility:** Pull new comments, mentions, and DMs from platform APIs at regular intervals.

**Polling approach:** Cron job per connected account, runs every 15-60 minutes (platform rate limit dependent). Stores `InboxMessage` records with `categorised_as` field (AI-powered on ingest: sales/complaint/question/partnership/spam).

**Notification:** Dashboard widget highlights uncategorised or high-priority messages. No real-time push needed (personal tool, not SLA-bound).

---

### 11. Personal Dashboard Aggregator

**Responsibility:** Produce the operator's "today view" without hitting live APIs.

**Sources:**
- Posts scheduled for today (from DB)
- Posts in REVIEW_QUEUE (from DB)
- Recent failures needing attention (from DB)
- Top performers this week (from pre-aggregated analytics)
- Companies with content gaps ("no post in N days" — calculated on demand from last publish timestamps)
- Unread inbox messages above priority threshold

**Implementation:** All queries hit the PostgreSQL DB. No live API calls in the dashboard path. This keeps it fast and offline-capable.

---

## Data Flow

### Content Creation Flow

```
Operator uploads image + optional brief
    │
    ▼
Media stored in MinIO → DB record created
    │
    ▼
media_processing job enqueued
    │
    ▼ (async, 10s-2min)
Processed variants stored in MinIO
    │
    ▼
ai_generation job enqueued (or triggered by operator in studio)
    │
    ▼ (async, 5s-30s)
AI generates: caption, hashtags, platform variants (per BrandVoice config)
Confidence score calculated
    │
    ├── HIGH confidence → auto-approved → scheduling resolves publish time
    └── LOW confidence  → placed in Review Queue → operator reviews → approves
    │
    ▼ (at scheduled time)
scheduler_tick cron picks up due variants → publish_post jobs enqueued
    │
    ▼ (near-real-time)
Publishing worker calls Platform Adapter → POST to platform API
    │
    ├── Success → platform_post_id stored → analytics jobs queued for T+1h, T+24h, T+7d
    └── Failure → retry or FAILED alert
    │
    ▼ (deferred)
Analytics ingestion jobs pull metrics → stored → aggregated
```

### Analytics Aggregation Flow

```
PostVariant published
    │
    ▼
ingest_analytics job (T+1h, T+24h, T+7d)
    │
    ▼
Platform Adapter fetchPostMetrics()
    │
    ▼
Raw metrics stored in analytics_records (per post, per snapshot)
    │
    ▼
Aggregation cron (nightly/weekly)
    │
    ▼
Materialised analytics: per-company, per-platform, per-period
    │
    ▼
Dashboard queries pre-computed rows (fast reads)
```

### Multi-Language Content Flow

```
Source content (e.g. blog post in Greek)
    │
    ▼
AI repurpose: extract key points, write primary language post
    │
    ▼
AI translate: generate variants in EN, GR, DE, FR (etc.)
    │
    ▼
Human review (translation quality check) → approve
    │
    ▼
Platform-specific adaptation per variant per language
    │
    ▼
4x posts (one per language) each scheduled to appropriate markets
```

---

## Integration Points

### Where AI Plugs In

| Trigger Point | AI Task | Provider Preference | Confidence Gate |
|---|---|---|---|
| Image/video upload | Visual analysis (describe content) | GPT-4o / Claude 3.5 Sonnet | No (factual) |
| Content brief | Caption generation | Claude Haiku / GPT-4o-mini | YES |
| Caption ready | Hashtag generation | Any fast model | No |
| Caption generated | Platform adaptation | Any fast model | YES |
| Caption generated | Translation | Claude / GPT-4o | YES |
| Source article | Repurposing | Claude Sonnet / GPT-4o | YES |
| Inbox message | Categorisation | Fast model (Haiku/mini) | No |
| Post metrics | Performance summary | Fast model | No |

### Platform API Rate Limits (Key Constraints)

| Platform | Post Rate | Analytics | Token Expiry |
|---|---|---|---|
| Meta (IG + FB) | 200 posts/day per page | T+30min available | 60 days (refresh needed) |
| LinkedIn | 150 requests/day (org) | T+24h available | 60 days |
| X | Varies by tier (Basic: 1500 tweets/month write) | Limited on free | 90 days |
| TikTok | 150 posts/day | T+30min available | Short-lived |
| Pinterest | Generous | Limited | 60 days |
| Google Business | 1000 calls/day | Limited | Offline access token |
| YouTube | 10,000 units/day | T+1h available | Refresh token (long-lived) |

### Queue Architecture

**Recommended:** BullMQ (Redis-backed) for Node.js ecosystems. pg-boss (PostgreSQL-backed) as alternative if Redis is unwanted dependency.

**Queue topology:**
```
media_processing    (concurrency: 2, long-running OK)
ai_generation       (concurrency: 5, fast)
publishing          (concurrency: 3, rate-limited per platform)
analytics_ingest    (concurrency: 10, low priority)
inbox_poll          (concurrency: 5, scheduled/cron)
scheduler_tick      (concurrency: 1, runs every minute)
notifications       (concurrency: 10, fast)
```

**Separate queues for media vs publishing** is critical. A slow video transcoding job must not starve the publishing queue of a time-sensitive scheduled post.

---

## Open-Source Base: Architectural Fit Assessment

### Postiz (confidence: MEDIUM)

Postiz is a NestJS (backend) + Next.js (frontend) monorepo using PostgreSQL + Redis + BullMQ. It has:
- Multi-workspace support (maps well to multi-company)
- Platform adapters for most major platforms
- Scheduling + publishing workers already built
- Basic AI integration (provider-agnostic design in recent versions)
- Docker Compose deployment

**What needs extension:**
- Multi-company isolation (Postiz uses "workspaces" which may or may not have strict DB-level isolation)
- AI confidence gating (not standard in base)
- Advanced media processing (FFmpeg pipeline, subtitle generation)
- Multi-language content pipeline
- Analytics aggregation and summaries
- Dashboard intelligence (content gaps, growth detection)

**Fork strategy:** Extend data model, add AI service layer as internal module, add workers as new queue consumers. Avoid modifying core adapters — extend via composition.

### Mixpost (confidence: MEDIUM)

Mixpost is Laravel (PHP) + Vue.js. Good scheduling and multi-profile support. Less suitable if the operator prefers Node.js/TypeScript ecosystem and if AI integrations will be TypeScript-heavy.

**Verdict:** Postiz is the stronger architectural fit for this use case. TypeScript throughout means AI integrations, custom workers, and data model extensions share the same language and type system.

---

## Suggested Build Order (Dependency-Driven)

The architecture has clear dependency tiers. Build bottom-up:

**Tier 0 — Foundation (must exist before anything else)**
1. Docker Compose environment (PostgreSQL + Redis + MinIO + app)
2. Multi-company data model + company/brand/account CRUD
3. Platform adapter interface + first adapter (Meta)
4. OAuth connect flow for accounts

**Tier 1 — Core Pipeline (publishing path)**
5. Queue infrastructure (BullMQ workers)
6. Media storage (MinIO integration, upload/serve)
7. Basic post creation + scheduling engine
8. Publishing worker + retry logic
9. AI service layer (provider router + first integration: OpenAI/Claude)
10. Content generation (caption + hashtag + platform adaptation)

**Tier 2 — Production Hardening**
11. Confidence gating + review queue
12. Remaining platform adapters (LinkedIn, X, TikTok, Pinterest, GBP, YouTube)
13. Media processing pipeline (resize, branding)
14. Analytics ingestion + pre-aggregation

**Tier 3 — Intelligence Layer**
15. Multi-language pipeline (translation + localisation)
16. Content repurposing (blog → posts, review → testimonial)
17. Video processing (clipping, subtitles)
18. Evergreen recycling + UTM management

**Tier 4 — Operations Intelligence**
19. Inbox monitoring + AI categorisation
20. Analytics summaries (weekly/monthly reports)
21. Content gap detection
22. Dashboard intelligence (growth detection, best-value platforms)
23. Personal dashboard "today view"

**Rationale for order:**
- Tiers 0-1 deliver the core loop: connect account → create post → publish. Everything else is additive.
- Platform adapters after queue infrastructure because publishing workers consume the queue.
- AI layer after basic pipeline so AI output has a destination (the draft post).
- Analytics after publishing because there is nothing to analyse until posts exist.
- Inbox and intelligence last because they add value but do not block the publishing loop.

---

## Scaling Considerations

This is a personal system (1 operator, 5-15 companies, ~100 posts/week). Scaling is about operational reliability, not horizontal scale.

| Concern | At Current Scale (100 posts/week) | If Scale Grows (500+/week) |
|---|---|---|
| Queue workers | Single worker process per queue | Separate Docker services per worker type |
| AI costs | Cost management via provider routing | Heavier use of local models (Ollama) |
| Platform rate limits | Stagger publishing across accounts | Per-account rate-limit queue with token bucket |
| Media storage | Local MinIO volume | External S3 bucket |
| DB performance | Single PostgreSQL instance | Read replicas for analytics queries |
| Video processing | Sequential jobs on single worker | GPU-enabled worker container |

**No horizontal sharding needed at this scale.** Single PostgreSQL + single Redis is sufficient. Design for operational simplicity over theoretical scale.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Calling Platform APIs from API Request Handlers

**What goes wrong:** A Next.js API route directly calls the Instagram API to publish a post during the HTTP request/response cycle.

**Why bad:** Platform API calls can take 5-30 seconds. They block the HTTP response. They fail silently if the request is interrupted. They cannot be retried automatically.

**Instead:** API handlers enqueue a job and return immediately. Workers execute platform calls with proper retry logic.

---

### Anti-Pattern 2: Shared Platform Credentials Across Companies

**What goes wrong:** OAuth tokens stored without strict `company_id` scoping. A query bug exposes Company A's token to Company B's publishing job.

**Why bad:** Posts published to wrong accounts. API token theft. Potential Terms of Service violation.

**Instead:** Every `PlatformCredential` record has `company_id` as a non-nullable foreign key. Publishing workers verify `variant.company_id === credential.company_id` before use.

---

### Anti-Pattern 3: Monolithic AI Prompt

**What goes wrong:** One enormous prompt template handles caption, hashtags, platform adaptation, translation, and scoring in a single API call to save cost.

**Why bad:** Harder to iterate on individual tasks. One task's failure aborts all. Cannot swap providers per task. Debugging is opaque.

**Instead:** Separate prompt functions per task. Chain them explicitly in the generation pipeline. Accept the slight cost increase in exchange for composability and debuggability.

---

### Anti-Pattern 4: Pulling Analytics Live on Dashboard Load

**What goes wrong:** Dashboard page load triggers live API calls to Instagram, LinkedIn, etc. to fetch current metrics.

**Why bad:** 8 platform API calls per page load = 2-5 second load times. Rate limits consumed by browsing. Dashboard fails when any platform API is down.

**Instead:** Analytics ingestion is entirely background (scheduled jobs). Dashboard reads only pre-aggregated data from PostgreSQL.

---

### Anti-Pattern 5: Media Processing in the Publishing Worker

**What goes wrong:** The publishing worker resizes images, adds watermarks, and generates thumbnails immediately before publishing.

**Why bad:** Slow media processing delays time-sensitive scheduled posts. Video processing (minutes) can miss a scheduled publish window.

**Instead:** Media processing happens at upload time (or on-demand when the post is approved), well before the scheduled publish time. Publishing worker receives already-processed media URLs.

---

### Anti-Pattern 6: Tight Coupling to One AI Provider

**What goes wrong:** AI calls are hardcoded to `openai.chat.completions.create()` throughout the codebase.

**Why bad:** Cannot switch providers without touching every callsite. Cannot A/B test providers. Cannot fall back to local models when API is down.

**Instead:** All AI calls go through the `AIService` interface. Provider is a configuration detail resolved by the router, invisible to calling code.

---

### Anti-Pattern 7: Mixing Multi-Company Data in the Same Query

**What goes wrong:** A dashboard query for "top performing posts" omits the `company_id` filter and returns posts from all companies.

**Why bad:** Data leakage between companies. Misleading analytics. Incorrect content generation using another company's brand voice.

**Instead:** Establish a middleware/decorator pattern that injects the current company context into every DB query. Make it impossible to query cross-company data without explicit opt-in.

---

## Sources

- Architecture patterns derived from training knowledge of Postiz (NestJS + BullMQ + Next.js, github.com/gitroomhq/postiz-app) — MEDIUM confidence (last verified pre-August 2025, web verification unavailable)
- Mixpost architecture (Laravel + Vue.js, github.com/inovector/mixpost) — MEDIUM confidence
- Platform API constraints (Meta Graph API, LinkedIn Marketing API, X API v2, TikTok Business API, Pinterest API v5, Google My Business API, YouTube Data API v3) — MEDIUM confidence (API versioning changes frequently; verify current rate limits and feature availability before implementation)
- BullMQ (docs.bullmq.io) queue patterns — HIGH confidence
- pg-boss PostgreSQL queue (github.com/timgit/pg-boss) — HIGH confidence
- Sharp image processing, FFmpeg video pipeline — HIGH confidence (stable, well-established)
- OpenAI whisper transcription — HIGH confidence
- MinIO S3-compatible storage — HIGH confidence
