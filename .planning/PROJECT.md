# Social Command Centre

## What This Is

A personal AI-powered social media operations system for a solo operator managing 5-15 companies, each with multiple brands and social accounts across all major platforms. Built on Postiz v2.20.1 (forked), deeply customised via an extension zone architecture into a unified command centre that handles content generation, scheduling, publishing, and analytics — all driven by AI and tailored per company/brand.

## Core Value

One person can efficiently operate 100+ social posts per week across dozens of accounts and 4+ languages, with AI doing the heavy lifting on content creation, adaptation, and monitoring — while the operator retains final review control.

## Current State

**Shipped:** v1.0 MVP (2026-03-11)
**Stack:** NestJS + Vite React + PostgreSQL + Redis + MinIO + Traefik
**Codebase:** ~65,000 LOC (TypeScript/TSX/Prisma/Shell/YAML)
**Extensions:** 7 packages (`@social/credential-management`, `@social/ai-service`, `@social/media-library`, `@social/content-generation`, `@social/scheduling-publishing`, `@social/analytics-dashboard`, `@social/health`, `@social/security`)

The core loop is functional: connect accounts → AI-generate content → review → schedule → publish → collect metrics. All 94 v1.0 requirements satisfied.

## Requirements

### Validated

- ✓ Evaluate and select the best open-source self-hosted social media management base project — v1.0
- ✓ Self-hosted Docker-based deployment on VPS — v1.0 (Docker Compose with PostgreSQL, Redis, MinIO)
- ✓ Multi-company data model (5-15 companies, each with multiple brands/accounts) — v1.0 (Company→Brand→BrandVoice/SocialAccount hierarchy)
- ✓ All integrations via official compliant APIs (no scraping, no TOS violations) — v1.0 (OAuth flows via official APIs)
- ✓ OAuth credential management with encrypted token storage and proactive refresh — v1.0 (AES-256-GCM, 75% lifetime refresh)
- ✓ Media library management: per-company upload, storage, tag filtering, grid UI — v1.0 (MinIO S3 storage, Uppy multipart upload)
- ✓ Media processing: resize per platform, thumbnail generation, variant pipeline — v1.0 (sharp-based processing)
- ✓ AI content generation pipeline (flexible provider: OpenAI, Anthropic, local models) — v1.0 (9-step pipeline via AIProviderRouter)
- ✓ AI vision: understand images/videos to generate captions, hashtags, CTAs — v1.0
- ✓ Content types: product, brand story, educational, seasonal, offer, testimonial, behind-the-scenes — v1.0
- ✓ Platform-specific caption adaptation (length, style, hashtags, CTAs) — v1.0
- ✓ AI confidence gating: low-confidence content flagged for human review before publishing — v1.0
- ✓ Input workflow: upload images/videos + optional text/source info, AI generates everything — v1.0
- ✓ Scheduling engine with post state machine and publish-time resolution — v1.0
- ✓ Publishing engine with retry logic, error classification, and failure alerting — v1.0
- ✓ Analytics: track engagement metrics per post at T+1h/T+24h/T+7d — v1.0
- ✓ Personal dashboard: scheduled today, pending review, failed posts, top performers — v1.0
- ✓ Production hardening: health checks, SSRF protection, structured logging, backup scripts — v1.0

### Active

- [ ] Platform support: TikTok, Pinterest, Google Business, YouTube Shorts (Instagram/Facebook/LinkedIn/X done v1.0)
- [ ] Multi-language content: 4+ languages with localisation and translation
- [ ] Content repurposing: blog to posts, product to posts, review to testimonial, promo to variants
- [ ] Media processing: add logos, create carousels, quote cards (resize/thumbnails done v1.0)
- [ ] Video processing: clip long videos to shorts, add subtitles
- [ ] Evergreen post recycling
- [ ] Automatic UTM tagging and link management
- [ ] Analytics summaries: weekly and monthly per company and platform
- [ ] Growth detection: spot fastest-growing company, best-value platforms
- [ ] Inbox/comment monitoring via compliant APIs
- [ ] Enquiry categorisation: sales, complaint, question, partnership, spam
- [ ] Content gap detection (e.g. "this brand hasn't posted on LinkedIn for 10 days")
- [ ] Personal dashboard enhancements: companies needing attention, pending replies

### Out of Scope

- Agency/client management features — this is for one owner-operator only
- Multi-tenant billing — no paying customers
- Client portals — no external users
- Excessive team collaboration workflows — solo operator
- Building from scratch — reusing Postiz as base
- Scraping-based or TOS-violating automation
- Mobile native app — web-first

## Context

The operator runs multiple companies across different industries. Each company has its own brand identity, tone, languages, and social presence. v1.0 centralises everything into one AI-augmented system deployed on a VPS via Docker Compose.

Key technical context:
- Base project: Postiz v2.20.1 (fork with extension zone)
- Deployment: Docker Compose on VPS (Traefik reverse proxy, Cloudflare TLS)
- Database: PostgreSQL 17 with Prisma ORM
- AI: Provider-agnostic (OpenAI, Anthropic, Ollama) with per-company cost tracking
- Media: MinIO S3-compatible storage with sharp image processing
- Platforms: Instagram, Facebook, LinkedIn, X (via official APIs)
- Scale target: 5-15 companies, 20-75 social accounts, 100+ posts/week

## Constraints

- **Open Source**: Postiz base with Apache-2.0 license
- **Self-Hosted**: Runs entirely on own infrastructure, no mandatory SaaS dependencies
- **API Compliance**: All social platform integrations use official APIs
- **Solo Operator**: System designed for one user managing many companies
- **Docker**: Deployable via Docker Compose (single-command)
- **PostgreSQL**: Primary database via Prisma ORM
- **AI Budget**: Provider-agnostic with per-company weekly budgets and circuit breaker
- **Maintainability**: Extension zone pattern preserves upstream merge compatibility

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Postiz as base project | Best maintained OSS social media manager, NestJS/React stack | ✓ Good — v1.0 |
| Extension zone pattern | All custom code in `extensions/` pnpm workspace | ✓ Good — prevents merge conflicts — v1.0 |
| Company→Brand→BrandVoice hierarchy | Multi-company data model via Prisma schema extensions | ✓ Good — clean isolation — v1.0 |
| AES-256-GCM token encryption | Encrypt OAuth tokens at rest with per-call IV | ✓ Good — v1.0 |
| Redis brand:{state} for OAuth context | Link OAuth callbacks to correct brand during flow | ✓ Good — v1.0 |
| Proactive token refresh (75% lifetime) | Prevent silent credential expiry | ✓ Good — v1.0 |
| Provider-agnostic AI service | IAIProvider interface with router per task type | ✓ Good — supports OpenAI/Anthropic/Ollama — v1.0 |
| MinIO S3 storage | Self-hosted media with Uppy multipart upload | ✓ Good — v1.0 |
| @Cron media processing (not BullMQ) | Simpler polling, 30s interval, 5 jobs/batch | ⚠️ Revisit — may need BullMQ/Temporal at scale |
| ContentType as TypeScript union | Stored as string in DB, avoids enum migration friction | ✓ Good — v1.0 |
| Confidence gating per company | AIConfig.confidenceThreshold + requireAllReview | ✓ Good — v1.0 |
| Pre-computed DashboardCache | Cron every 15min aggregates metrics into JSON | ✓ Good — fast dashboard loads — v1.0 |
| PostVariant companyId denormalization | Compound index for efficient dashboard queries | ✓ Good — v1.0 |
| Tags instead of folder hierarchy | Media library uses tags for filtering (not formal folders) | ⚠️ Revisit — users may want folders |
| Budget circuit breaker throws (not queues) | R4.6: exceeding budget throws error immediately | ✓ Good (by design) — v1.0 |

---
*Last updated: 2026-03-11 after v1.0 milestone*
