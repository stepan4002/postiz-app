# Social Command Centre

## What This Is

A personal AI-powered social media operations system for a solo operator managing 5-15 companies, each with multiple brands and social accounts across all major platforms. Built on top of the best available open-source self-hosted social media management project, deeply customised into a unified command centre that handles content generation, scheduling, publishing, monitoring, and analytics — all driven by AI and tailored per company/brand.

## Core Value

One person can efficiently operate 100+ social posts per week across dozens of accounts and 4+ languages, with AI doing the heavy lifting on content creation, adaptation, and monitoring — while the operator retains final review control.

## Requirements

### Validated

- ✓ Evaluate and select the best open-source self-hosted social media management base project — Phase 1
- ✓ Self-hosted Docker-based deployment on VPS — Phase 1 (Docker Compose with PostgreSQL, Redis, MinIO)
- ✓ Multi-company data model (5-15 companies, each with multiple brands/accounts) — Phase 1 (Company→Brand→BrandVoice/SocialAccount hierarchy)
- ✓ All integrations via official compliant APIs (no scraping, no TOS violations) — Phase 2 (OAuth flows via official APIs)
- ✓ Media library management: per-company upload, storage, tag filtering, grid UI — Phase 4 (MinIO S3 storage, Uppy multipart upload, company-scoped endpoints)
- ✓ Media processing: resize per platform, thumbnail generation, variant pipeline — Phase 4 (sharp-based processing, platform-specific specs for Instagram/Facebook/LinkedIn/X)
- ✓ AI content generation pipeline (flexible provider: OpenAI, Anthropic, local models) — Phase 5 (ContentPostService 9-step pipeline via AIProviderRouter)
- ✓ AI vision: understand images/videos to generate captions, hashtags, CTAs — Phase 5 (executeImageAnalysis → caption → platform adaptation)
- ✓ Content types: product, brand story, educational, seasonal, offer, testimonial, behind-the-scenes — Phase 5 (7 content type prompt modifiers)
- ✓ Platform-specific caption adaptation (length, style, hashtags, CTAs) — Phase 5 (PLATFORM_CAPTION_NORMS for Instagram/Facebook/LinkedIn/X)
- ✓ AI confidence gating: low-confidence content flagged for human review before publishing — Phase 5 (confidence scoring + threshold gating per company)
- ✓ Input workflow: upload images/videos + optional text/source info, AI generates everything — Phase 5 (CreatePostForm with media picker, brief, and generation results)

### Active

- [ ] Platform support: Instagram, Facebook, LinkedIn, X, TikTok, Pinterest, Google Business, YouTube Shorts
- [ ] Per-company brand voice, tone, and language configuration
- [ ] Multi-language content: 4+ languages with localisation and translation
- [ ] Content repurposing: blog to posts, product to posts, review to testimonial, promo to variants
- [ ] Media library management: per-campaign, per-season folders (per-company done Phase 4)
- [ ] Media processing: add logos, create carousels, quote cards (resize/thumbnails done Phase 4)
- [ ] Video processing: clip long videos to shorts, add subtitles
- [ ] Scheduling engine with per-company posting rules, windows, and frequency
- [ ] Publishing engine: auto-publish, retry failures, log everything
- [ ] Evergreen post recycling
- [ ] Automatic UTM tagging and link management
- [ ] Analytics: track engagement metrics per post, detect best/worst content
- [ ] Analytics summaries: weekly and monthly per company and platform
- [ ] Growth detection: spot fastest-growing company, best-value platforms
- [ ] Inbox/comment monitoring via compliant APIs
- [ ] Enquiry categorisation: sales, complaint, question, partnership, spam
- [ ] Content gap detection (e.g. "this brand hasn't posted on LinkedIn for 10 days")
- [ ] Personal dashboard: today's tasks, failures, top performers, companies needing attention, content ready for review, pending replies

### Out of Scope

- Agency/client management features — this is for one owner-operator only
- Multi-tenant billing — no paying customers
- Client portals — no external users
- Excessive team collaboration workflows — solo operator
- Building from scratch — must reuse existing open-source base
- Scraping-based or TOS-violating automation
- Mobile native app — web-first

## Context

The operator runs multiple companies across different industries. Each company has its own brand identity, tone, languages, and social presence. Currently, managing social media across all companies is fragmented and time-consuming. The goal is to centralise everything into one AI-augmented system that makes it possible for one person to maintain a professional, consistent social presence across all brands.

Key technical context:
- Deployment target: VPS (Docker Compose)
- Database preference: PostgreSQL
- AI layer must be provider-agnostic (OpenAI, Anthropic, local LLMs)
- Must preserve upstream compatibility with chosen base project where reasonable
- All platform integrations must use official APIs
- Scale: 5-15 companies, 20-75 social accounts, 100+ posts/week, 4+ languages

Primary open-source candidates to evaluate:
- Postiz (https://github.com/gitroomhq/postiz-app)
- Mixpost (https://github.com/inovector/mixpost)
- Socioboard (https://github.com/nicholasgasior/socioboard-core or related)
- Others from awesome-selfhosted list

## Constraints

- **Open Source**: Base project must be open source with a permissive or copyleft license that allows self-hosted modification
- **Self-Hosted**: Must run entirely on own infrastructure, no mandatory SaaS dependencies
- **API Compliance**: All social platform integrations must use official APIs — no scraping or TOS violations
- **Solo Operator**: System designed for one user managing many companies, not multi-user agency
- **Docker**: Must be deployable via Docker/Docker Compose
- **PostgreSQL**: Preferred database (or compatible alternative if base project requires)
- **AI Budget**: AI provider costs should be manageable (provider-agnostic to optimise)
- **Maintainability**: Custom modifications should be structured to allow merging upstream updates

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Reuse open-source base vs build from scratch | Faster path to working system, community maintenance | Postiz selected — Phase 1 |
| AI provider abstraction | Future-proof, cost optimisation, avoid vendor lock-in | — Pending (Phase 3) |
| Multi-company model approach | Extend base project's data model vs separate layer | Company→Brand→BrandVoice hierarchy in Prisma — Phase 1 |
| Extension zone pattern | All custom code isolated in extensions/ pnpm workspace | Prevents upstream merge conflicts — Phase 1 |
| Token encryption | AES-256-GCM with per-call IV, ENCRYPTION_KEY env var | Tokens encrypted at rest — Phase 2 |
| OAuth brand context | Redis brand:{state} key with 600s TTL for OAuth flow | Links OAuth callbacks to correct brand — Phase 2 |
| Proactive token refresh | Cron job refreshes tokens at 75% lifetime, alerts on 3rd failure | Prevents silent credential expiry — Phase 2 |
| Media storage via MinIO S3 | MinioStorage with forcePathStyle, UploadFactory case 's3', Uppy multipart presigned URLs | Self-hosted media pipeline — Phase 4 |
| @Cron media processing | 30s cron poller, 5 jobs/batch, per-job error isolation; migrate to Temporal in Phase 6 | Simpler than BullMQ — Phase 4 |
| Company-scoped media isolation | All queries filter companyId, slug→id in controller, company-scoped S3 paths | Data isolation contract — Phase 4 |
| Content generation as extension | @social/content-generation extension package in extensions/ workspace — consistent with Phase 1 extension zone pattern | Phase 5 |
| ContentType as union type | TypeScript union (not Prisma enum) — stored as string in DB, avoids enum migration friction | Phase 5 |
| Confidence gating per company | AIConfig.confidenceThreshold + requireAllReview — company-level control over auto-approval | Phase 5 |
| Review queue audit trail | reviewedBy, reviewAction, reviewedAt, originalCaption stored directly on PostVariant — full traceability | Phase 5 |

---
*Last updated: 2026-03-10 after Phase 5*
