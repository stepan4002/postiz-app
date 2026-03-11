# Roadmap: Social Command Centre — Milestone 1

**Created:** 2026-03-10
**Goal:** Deliver the core loop: connect accounts → AI-generate content → review → schedule → publish → collect metrics

---

## Phase 1: Fork & Foundation

**Goal:** Postiz forked, Docker environment running, extension architecture established, multi-company data model in place.

**Scope:**
- Fork Postiz, set up local Docker Compose dev environment (PostgreSQL, Redis, MinIO, app)
- Establish extension zone: custom packages/directories separated from upstream code
- Create DIVERGENCE.md
- Extend Prisma schema: Company, Brand, BrandVoice, SocialAccount entities
- Add `company_id` FK on all relevant existing tables
- Company CRUD + company switcher in UI
- Automated isolation tests (Company A cannot see Company B data)
- Seed database with 2-3 test companies

**Requirements covered:** R1.1-R1.5, R2.1-R2.8

**Estimated complexity:** HIGH (data model is foundational, fork strategy critical)

**Plans:** 5/5 plans complete

Plans:
- [x] 01-01-PLAN.md — Fork Postiz v2.20.1, Docker dev environment, extension architecture scaffolding
- [x] 01-02-PLAN.md — Prisma schema (Company/Brand/BrandVoice/SocialAccount) and company-context middleware
- [x] 01-03-PLAN.md — Company/Brand/BrandVoice CRUD API and seed data
- [x] 01-04-PLAN.md — Automated company data isolation tests (TDD)
- [x] 01-05-PLAN.md — Company switcher UI component with URL-scoped routing

---

## Phase 2: Credential Management & OAuth

**Goal:** Operator can connect Instagram, Facebook, LinkedIn, and X accounts to any company, with encrypted token storage and proactive refresh.

**Scope:**
- PlatformCredential entity with AES-256 encrypted token storage
- OAuth connect flows: Meta (Instagram + Facebook), LinkedIn, X
- Account <-> Brand <-> Company linking in UI
- Proactive token refresh background job (refresh at 75% lifetime)
- Token health tracking: last refreshed, expires at, failure count
- Meta parent-child token management (user token -> page tokens)
- Token health alerts surfaced in dashboard

**Requirements covered:** R3.1-R3.6, NF1.1

**Estimated complexity:** HIGH (4 OAuth providers, token lifecycle management)

**Plans:** 6/6 plans complete

Plans:
- [x] 02-01-PLAN.md — Extension package scaffold, AES-256-GCM encryption service, Prisma migration
- [x] 02-02-PLAN.md — Token health state calculator and proactive refresh cron job
- [x] 02-03-PLAN.md — OAuth brand-context controller and CredentialManagementModule wiring
- [x] 02-04-PLAN.md — Token health API endpoint and dashboard alert UI components
- [x] 02-05-PLAN.md — Brand connect panel UI and end-to-end verification
- [x] 02-06-PLAN.md — Gap closure: GET /credentials/brand-connections/:brandId endpoint

---

## Phase 3: AI Service Layer

**Goal:** Provider-agnostic AI service with cost tracking, ready to power content generation.

**Scope:**
- AIService interface: generateCaption, generateHashtags, adaptForPlatform, analyzeImage, scoreContent
- OpenAI provider implementation (GPT-4o, GPT-4o-mini)
- Anthropic provider implementation (Claude Sonnet, Haiku)
- Ollama local provider implementation
- Provider router (task type → provider selection)
- Per-company AI config: default provider, model preferences
- Cost instrumentation: log every call (model, tokens, cost, company_id, post_id) to DB
- Per-company weekly budget with circuit breaker
- BrandVoice injection into generation prompts

**Requirements covered:** R4.1-R4.7, NF4.4

**Estimated complexity:** HIGH (3 provider implementations, cost tracking, prompt engineering)

**Plans:** 4/4 plans complete

Plans:
- [x] 03-01-PLAN.md — Extension package scaffold, Prisma models, interface contracts, BrandVoice prompt builder
- [x] 03-02-PLAN.md — Provider implementations (OpenAI, Anthropic, Ollama)
- [x] 03-03-PLAN.md — AIConfig service, cost logger, budget circuit breaker
- [x] 03-04-PLAN.md — Provider router, AIServiceModule wiring, AppModule registration

---

## Phase 4: Media Library & Processing

**Goal:** Per-company media library with upload, storage, and basic image processing.

**Scope:**
- Media library: per-company folders, upload to MinIO, thumbnail generation
- Media reuse across posts within company
- Media metadata storage (dimensions, format, size, tags)
- Image resize worker (BullMQ job): generate platform-specific variants
- Platform media validation (check specs before publish)
- Async processing — never blocks web requests

**Requirements covered:** R7.1-R7.5, R8.1-R8.4, NF2.2 (media worker pool), NF3.3

**Estimated complexity:** MEDIUM

**Plans:** 4/4 plans complete

Plans:
- [x] 04-01-PLAN.md — Extension scaffold, MinIO storage provider, Prisma schema, type contracts
- [x] 04-02-PLAN.md — Company-scoped media upload service with thumbnail + metadata extraction
- [x] 04-03-PLAN.md — Async variant generation worker, cron job poller, platform validation
- [x] 04-04-PLAN.md — MediaLibraryModule wiring, frontend media library UI, end-to-end verification

---

## Phase 5: Content Generation Pipeline

**Goal:** Operator can upload media + brief → AI generates platform-adapted captions with brand voice → confidence-gated review.

**Scope:**
- Input workflow UI: upload media, add optional text brief, select target platforms
- AI vision: analyze uploaded image to understand content
- Caption generation with BrandVoice context injection
- Platform-specific caption adaptation (length, style, hashtags per platform)
- PostVariant generation: one per target platform
- Confidence scoring on every generation
- Content type selection (product, brand story, educational, etc.)
- Review Queue UI: pending posts, confidence score, approve/edit/reject/regenerate
- Confidence gating: below threshold → Review Queue, above → auto-approve
- Audit trail: generated_by, model, confidence, reviewer, outcome

**Requirements covered:** R5.1-R5.7, R6.1-R6.5

**Estimated complexity:** HIGH (AI pipeline + review workflow + UI)

**Plans:** 5/5 plans complete

Plans:
- [x] 05-01-PLAN.md — Extension scaffold, Prisma models (ContentPost/PostVariant), type contracts, prompt templates
- [x] 05-02-PLAN.md — ContentPostService generation pipeline, confidence gating logic, repository
- [x] 05-03-PLAN.md — ReviewQueueService, controllers, ContentGenerationModule wiring, AppModule registration
- [x] 05-04-PLAN.md — Frontend: CreatePostForm input workflow with media picker, platform selector, generation results
- [x] 05-05-PLAN.md — Frontend: Review Queue UI with approve/reject/regenerate/edit actions

---

## Phase 6: Scheduling & Publishing Engine

**Goal:** Posts flow from approved → scheduled → published with retry logic, error classification, and failure alerting.

**Scope:**
- Post state machine: DRAFT → APPROVED → SCHEDULED → PUBLISHING → PUBLISHED / FAILED
- Schedule resolver: operator picks time or auto-slot assignment
- Scheduling calendar UI
- `scheduler_tick` cron job (every minute): enqueue due PostVariants
- Platform adapter layer: uniform PlatformAdapter interface
- Publishing worker: one job per PostVariant
- Idempotent publishing (check platform_post_id before re-publish)
- Retry: 3 attempts, exponential backoff with jitter (1min, 5min, 15min)
- Error classification: transient → retry, permanent → alert
- Every attempt logged (timestamp, response, error)
- Failed posts surface in dashboard
- Per-company timezone in scheduling

**Requirements covered:** R9.1-R9.5, R10.1-R10.8, NF2.1, NF4.3, NF4.5

**Estimated complexity:** HIGH (state machine, 4 platform adapters, retry logic)

**Plans:** 5/5 plans complete

Plans:
- [ ] 06-01-PLAN.md — Extension scaffold, type contracts, state machine, Prisma migration
- [ ] 06-02-PLAN.md — Schedule resolver service, timezone handling, scheduler tick cron
- [ ] 06-03-PLAN.md — Platform adapter layer (Instagram, Facebook, LinkedIn, X) with error classification
- [ ] 06-04-PLAN.md — Publishing worker, retry logic, attempt logger, controllers, module wiring
- [ ] 06-05-PLAN.md — Frontend: scheduling calendar UI, schedule form, failed posts panel

---

## Phase 7: Analytics & Dashboard

**Goal:** Engagement metrics collected per post, personal dashboard shows operator what needs attention.

**Scope:**
- Analytics ingestion worker: pull metrics at T+1h, T+24h, T+7d post-publish
- Store per-post metrics: impressions, reach, likes, comments, shares, saves, clicks
- Idempotent ingestion (upsert)
- Per-post analytics view in UI
- Personal dashboard:
  - Today's scheduled posts
  - Posts pending review (count + list)
  - Recent publish failures
  - Top performing posts (last 7 days)
- Dashboard reads pre-computed data only (no live API calls)
- DB indexes for dashboard queries

**Requirements covered:** R11.1-R11.5, R12.1-R12.6, NF3.1-NF3.2, NF3.4

**Estimated complexity:** MEDIUM-HIGH

**Plans:** 5/5 plans complete

Plans:
- [x] 07-01-PLAN.md — Extension scaffold, type contracts, Prisma models (PostMetrics/DashboardCache), DB indexes
- [x] 07-02-PLAN.md — Platform analytics adapters, AnalyticsRepository, ingestion cron job, analytics controller
- [x] 07-03-PLAN.md — DashboardRepository, DashboardSummaryJob cron, DashboardService, dashboard controller
- [x] 07-04-PLAN.md — AnalyticsDashboardModule wiring, frontend per-post analytics and 4-widget dashboard
- [ ] 07-05-PLAN.md — Gap closure: fix lastPublishError field mismatch (R12.3), add PostVariant companyId compound index (NF3.4)

---

## Phase 8: Production Hardening & Deployment

**Goal:** System is secure, observable, and deployable to production VPS.

**Scope:**
- Docker Compose production config: internal services on internal network, only 443 exposed
- Reverse proxy (Traefik or Nginx) with TLS
- Health check endpoints for all services
- Docker restart policies
- Structured JSON logging for all workers
- SSRF protection on URL inputs
- AI prompt injection safeguards (user input in user role only)
- Environment variable documentation
- Backup strategy for PostgreSQL and MinIO
- Smoke test: full end-to-end flow (connect → generate → schedule → publish → metrics)

**Requirements covered:** NF1.2-NF1.6, NF2.3-NF2.4, NF5.1-NF5.4

**Estimated complexity:** MEDIUM

**Plans:** 3/4 plans executed

Plans:
- [ ] 08-01-PLAN.md — Health check endpoints (@nestjs/terminus) and structured JSON logging (nestjs-pino)
- [ ] 08-02-PLAN.md — SSRF protection utility, prompt injection audit, .env.example completeness
- [ ] 08-03-PLAN.md — Production Docker Compose with Traefik reverse proxy, backup script
- [ ] 08-04-PLAN.md — Automated smoke test script and manual verification checklist

---

## Phase Dependencies

```
Phase 1 (Foundation)
  → Phase 2 (OAuth) — needs Company/Brand/Account entities
  → Phase 4 (Media) — needs company scoping

Phase 2 (OAuth)
  → Phase 6 (Publishing) — needs platform credentials

Phase 3 (AI Service)
  → Phase 5 (Content Gen) — needs AI interface

Phase 4 (Media)
  → Phase 5 (Content Gen) — needs media library for input workflow

Phase 5 (Content Gen)
  → Phase 6 (Publishing) — needs approved posts to publish

Phase 6 (Publishing)
  → Phase 7 (Analytics) — needs published posts to track

Phases 1-7 → Phase 8 (Production Hardening)
```

**Critical path:** 1 → 2 → 3 → 5 → 6 → 7 → 8 (Phase 4 can parallel with Phase 3)
