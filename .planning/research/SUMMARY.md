# Research Summary: Social Command Centre

**Synthesized:** 2026-03-10
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Base Project Decision: Postiz

**Postiz** (github.com/gitroomhq/postiz-app) is the clear winner over Mixpost, Socioboard, and Shoutify.

- 27.2k stars, 70 contributors, actively maintained (Mar 2026 release)
- TypeScript throughout: NestJS backend + Next.js 14 frontend
- PostgreSQL (Prisma ORM) + Redis + BullMQ for job queues
- 19+ platform integrations in the open-source version (AGPL-3.0)
- Built-in AI content assistant, media library, scheduling, analytics
- Clean extension model: SocialAbstract provider pattern, NestJS DI, decorator system
- Docker Compose deployment ready

**What Postiz lacks** (must be built):
- Multi-company hierarchy (Company → Brand → Account) — currently workspace-based
- AI confidence gating / review queue
- Multi-language content pipeline
- Advanced media processing (video clipping, subtitle generation)
- Content repurposing from long-form sources
- Analytics aggregation and intelligence layer
- Content gap detection, growth intelligence
- Per-company brand voice configuration (structured)
- UTM tagging automation

---

## Architecture Summary

**Data model:** Single PostgreSQL DB, row-level `company_id` scoping on all entities. Hierarchy: Operator → Company → Brand → BrandVoice + SocialAccount → PlatformCredential.

**Content pipeline state machine:** INPUT_RECEIVED → MEDIA_PROCESSING → AI_GENERATION → CONFIDENCE_CHECK → APPROVED/REVIEW_QUEUE → SCHEDULED → PUBLISHING → PUBLISHED/FAILED → ANALYTICS_INGESTING → COMPLETE

**Queue topology (BullMQ):**
- `media_processing` (concurrency: 2, long-running)
- `ai_generation` (concurrency: 5, fast)
- `publishing` (concurrency: 3, rate-limited)
- `analytics_ingest` (concurrency: 10, low priority)
- `inbox_poll` (concurrency: 5, scheduled)
- `scheduler_tick` (concurrency: 1, every minute)

**AI service layer:** Provider-agnostic interface. Routes by task type — vision → GPT-4o/Claude Sonnet, fast captions → Haiku/GPT-4o-mini, local fallback → Ollama. Per-company provider config. Cost instrumentation on every call.

**Platform adapter layer:** Uniform `PlatformAdapter` interface per platform. OAuth, publishing, analytics, inbox. Token management with proactive refresh and encrypted storage.

---

## Key Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Fork divergence from upstream Postiz | Critical | Extension zone separation, DIVERGENCE.md, monthly upstream sync |
| OAuth token cascade expiry (Meta 60-day) | Critical | Proactive refresh at 75% lifetime, parent-child token tracking |
| Multi-company data bleed | Critical | RLS, `company_id` on all tables, automated isolation tests |
| AI cost spiral | High | Per-call instrumentation, tiered models, per-company budgets |
| Platform API instability | High | Adapter pattern, pinned API versions, structured error logging |
| Publishing failures at volume | High | Explicit state machine, transient vs permanent error classification, retry with backoff |
| Video processing blocking publishers | Medium | Separate worker pools per job type |

---

## MVP Scope (Phase 1)

Core loop: **connect accounts → upload media → AI generates captions with brand voice → operator reviews → schedules → publishes → metrics collected**

MVP platforms: Instagram, Facebook, LinkedIn, X (covers ~80% posting volume)

MVP defers: TikTok, Pinterest, Google Business, YouTube Shorts, multi-language, content repurposing, evergreen recycling, carousel/video generation, inbox monitoring, advanced analytics

---

## Build Order (5 Tiers)

1. **Foundation:** Docker env, multi-company data model, first platform adapter (Meta), OAuth
2. **Core Pipeline:** Queue infrastructure, media storage, scheduling, publishing, AI service layer, content generation
3. **Production Hardening:** Confidence gating, remaining platform adapters, media processing, analytics ingestion
4. **Intelligence:** Multi-language, content repurposing, video processing, evergreen recycling, UTM
5. **Operations Intelligence:** Inbox monitoring, analytics summaries, content gap detection, dashboard intelligence
