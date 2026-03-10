# Requirements: Social Command Centre

**Version:** 1.0 (Milestone 1)
**Derived from:** PROJECT.md + research (SUMMARY.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, STACK.md)
**Created:** 2026-03-10

---

## Milestone 1 Goal

Deliver a working self-hosted system where one operator can: connect social accounts for multiple companies, generate AI-powered content with brand voice, review and approve posts, schedule and publish to Instagram/Facebook/LinkedIn/X, and track basic engagement metrics — all from a unified dashboard.

---

## Functional Requirements

### R1: Infrastructure & Deployment
- **R1.1:** [x] Fork Postiz and establish Docker Compose deployment (PostgreSQL, Redis, MinIO, app) — completed 01-01
- **R1.2:** [x] Extension zone separation — custom code in `/packages/` or dedicated directories, upstream files minimally modified — completed 01-01
- **R1.3:** [x] DIVERGENCE.md tracking all upstream modifications — completed 01-01
- **R1.4:** [x] Environment-based configuration (`.env`) for all secrets, API keys, and deployment settings — completed 01-01
- **R1.5:** [x] Health checks on all Docker services with restart policies — completed 01-01

### R2: Multi-Company Data Model
- **R2.1:** [x] Company entity with name, slug, settings, timezone, languages — completed 01-02
- **R2.2:** [x] Brand entity (1-N per Company) with brand identity fields — completed 01-02
- **R2.3:** [x] BrandVoice entity per Brand: tone descriptors, target audience, preferred hashtags, blacklisted words, sample posts, language — completed 01-02
- **R2.4:** [x] SocialAccount entity per Brand with platform type and reference to PlatformCredential — completed 01-02
- **R2.5:** [x] `company_id` foreign key on all company-owned tables — Phase 1: Organization.companyId + Brand/BrandVoice/SocialAccount; remaining upstream tables (posts, media, analytics, credentials, schedules) deferred to their respective phases per plan design — completed 01-02 (partial, by design)
- **R2.6:** [x] Row-level scoping — all queries filtered by `company_id`; Prisma $extends factory auto-injects companyId into all Brand/BrandVoice/SocialAccount queries — completed 01-02
- **R2.7:** Company switcher in UI — all views scoped to selected company
- **R2.8:** Automated isolation tests: Company A cannot see Company B's data

### R3: Platform Connections (OAuth)
- **R3.1:** OAuth connect flow for Instagram (Meta Business API), Facebook (Meta Graph API), LinkedIn (Marketing API), X (API v2)
- **R3.2:** PlatformCredential entity with encrypted token storage (AES-256)
- **R3.3:** Proactive token refresh at 75% of token lifetime via background job
- **R3.4:** Token health dashboard: last refreshed, expires at, consecutive failures
- **R3.5:** Alert when token refresh fails (surface in operator dashboard)
- **R3.6:** Meta parent-child token tracking (user token → derived page tokens)

### R4: AI Service Layer
- **R4.1:** Provider-agnostic AIService interface (generateCaption, generateHashtags, adaptForPlatform, analyzeImage, scoreContent)
- **R4.2:** Provider implementations: OpenAI (GPT-4o, GPT-4o-mini), Anthropic (Claude Sonnet, Haiku), Local (Ollama)
- **R4.3:** Provider router: select provider per task type and cost policy
- **R4.4:** Per-company AI configuration: default provider, model preferences, budget limits
- **R4.5:** Cost instrumentation on every AI call: model, input tokens, output tokens, estimated cost, post ID, company ID — stored in DB
- **R4.6:** Per-company weekly token budget with circuit breaker (queue for next cycle when exceeded)
- **R4.7:** Brand voice injection: BrandVoice config injected as system context into every generation call for that company/brand

### R5: Content Generation Pipeline
- **R5.1:** Input workflow: operator uploads image/video + optional text brief → AI generates captions
- **R5.2:** AI vision: analyze uploaded image/video to understand content for caption generation
- **R5.3:** Caption generation with brand voice, tone, and hashtags per BrandVoice config
- **R5.4:** Platform-specific caption adaptation (length, style, hashtag density per platform norms)
- **R5.5:** Generate PostVariants: one per target platform, each with adapted caption
- **R5.6:** Confidence scoring on every generation (0-1 scale)
- **R5.7:** Content types supported: product, brand story, educational, seasonal, offer, testimonial, behind-the-scenes

### R6: Review Queue & Confidence Gating
- **R6.1:** Posts with confidence score below threshold (configurable per company, default 0.7) routed to Review Queue
- **R6.2:** Posts above threshold auto-approved (configurable: can require all posts reviewed)
- **R6.3:** Review Queue UI: list of pending posts with AI-generated content, confidence score, source media
- **R6.4:** Operator actions: approve, edit and approve, reject, regenerate
- **R6.5:** Audit trail: generated_by, model_version, confidence_score, reviewed_by, review_outcome stored per post

### R7: Media Library
- **R7.1:** Per-company media library with folder hierarchy (campaign, season, product)
- **R7.2:** Upload images and videos to MinIO (S3-compatible) storage
- **R7.3:** Thumbnail generation on upload
- **R7.4:** Media reuse across posts within same company
- **R7.5:** Media metadata: dimensions, format, file size, upload date, tags

### R8: Media Processing
- **R8.1:** Image resize per platform specifications (Instagram square/portrait/landscape, Facebook, LinkedIn, X dimensions)
- **R8.2:** Processing runs as async BullMQ job (not in request thread)
- **R8.3:** Processed variants stored alongside originals in MinIO
- **R8.4:** Platform media validation before publish (check dimensions, file size, format against platform requirements)

### R9: Scheduling Engine
- **R9.1:** Post states: DRAFT → APPROVED → SCHEDULED → PUBLISHING → PUBLISHED / FAILED
- **R9.2:** Schedule resolver: assign publish time based on operator selection or auto-slot
- **R9.3:** Scheduling calendar UI showing all scheduled posts across platforms
- **R9.4:** `scheduler_tick` cron job (every minute): enqueue due posts for publishing
- **R9.5:** Per-company timezone support

### R10: Publishing Engine
- **R10.1:** Publishing worker: one job per PostVariant per platform
- **R10.2:** Platform adapter layer: uniform PlatformAdapter interface for all platforms
- **R10.3:** Idempotent publishing: check for existing platform_post_id before re-publishing
- **R10.4:** Retry policy: 3 attempts, exponential backoff (1min, 5min, 15min)
- **R10.5:** Error classification: transient (retry) vs permanent (alert operator)
- **R10.6:** Every publish attempt logged: timestamp, response code, payload, error details
- **R10.7:** Failed posts surface prominently in dashboard (not buried in logs)
- **R10.8:** Publish window concept: if post not published within window, escalate rather than publish stale

### R11: Analytics (Basic)
- **R11.1:** Analytics ingestion worker: pull metrics from platform APIs at T+1h, T+24h, T+7d post-publish
- **R11.2:** Store per-post metrics: impressions, reach, likes, comments, shares, saves, clicks
- **R11.3:** Idempotent ingestion (upsert, not insert)
- **R11.4:** Per-post analytics view in UI
- **R11.5:** Analytics decoupled from publishing (separate background pipeline)

### R12: Personal Dashboard
- **R12.1:** Today's scheduled posts across all companies
- **R12.2:** Posts pending review (review queue count + list)
- **R12.3:** Recent publish failures requiring attention
- **R12.4:** Top performing posts from last 7 days
- **R12.5:** All data from pre-computed DB queries (no live API calls on dashboard load)
- **R12.6:** Company-scoped view with cross-company summary option

---

## Non-Functional Requirements

### NF1: Security
- **NF1.1:** All OAuth tokens encrypted at rest (AES-256-GCM)
- **NF1.2:** Docker Compose production config: internal services bound to 127.0.0.1 or Docker network only; only port 443 exposed
- **NF1.3:** AI prompt injection prevention: user input in `user` message role, never concatenated into system prompt
- **NF1.4:** SSRF protection on URL inputs (HTTPS only, block private IP ranges)
- **NF1.5:** No secrets in code or version control; all via environment variables
- **NF1.6:** Single-user authentication (operator is sole user)

### NF2: Reliability
- **NF2.1:** Publishing worker retry with exponential backoff and jitter
- **NF2.2:** Separate queue workers: media processing, AI generation, publishing, analytics — isolated pools
- **NF2.3:** Docker restart policies on all services
- **NF2.4:** Graceful degradation: if AI provider is down, posts can still be manually created and published

### NF3: Performance
- **NF3.1:** Dashboard loads from pre-aggregated data (< 2s page load)
- **NF3.2:** No live platform API calls in request path
- **NF3.3:** Media processing async (never blocks web requests)
- **NF3.4:** Database indexes on `company_id + created_at`, `company_id + platform + status`

### NF4: Maintainability
- **NF4.1:** Extension zone separation from upstream Postiz code
- **NF4.2:** DIVERGENCE.md maintained for all upstream file modifications
- **NF4.3:** Platform logic in PlatformAdapter implementations, not scattered across features
- **NF4.4:** AI logic behind AIService interface, not inline in handlers
- **NF4.5:** Pinned API version strings on all platform API calls

### NF5: Operability
- **NF5.1:** Docker Compose single-command deployment
- **NF5.2:** Environment variable configuration for all settings
- **NF5.3:** Health check endpoints for all services
- **NF5.4:** Structured logging (JSON) for all background workers

---

## Success Criteria (Milestone 1)

1. Operator can connect Instagram, Facebook, LinkedIn, and X accounts for 3+ companies
2. Operator can upload media, trigger AI caption generation with brand voice, and review output
3. AI-generated content with confidence < 0.7 is automatically flagged for review
4. Operator can schedule posts and they publish automatically at the scheduled time
5. Failed publishes retry automatically and surface in dashboard if unresolved
6. Basic engagement metrics are collected and visible per post
7. All company data is isolated — no cross-company data leakage
8. System runs self-hosted via Docker Compose on a VPS
9. AI costs are tracked per call with per-company visibility
10. Token refresh happens proactively; operator is alerted before tokens expire
