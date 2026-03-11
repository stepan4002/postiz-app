# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP Social Command Centre

**Shipped:** 2026-03-11
**Phases:** 8 | **Plans:** 38

### What Was Built
- Postiz fork with extension zone architecture (7 custom `@social/*` packages)
- Multi-company data model: Company → Brand → BrandVoice → SocialAccount
- OAuth credential management with AES-256-GCM encryption and proactive refresh
- Provider-agnostic AI service (OpenAI, Anthropic, Ollama) with cost tracking
- Media library with MinIO S3 storage, Uppy upload, sharp variant processing
- Content generation pipeline: image analysis → caption → platform adaptation → confidence gating → review queue
- Scheduling & publishing engine with state machine, 4 platform adapters, retry logic
- Analytics ingestion at T+1h/T+24h/T+7d with pre-computed dashboard
- Production hardening: health checks, SSRF protection, Traefik, backup, smoke tests

### What Worked
- Extension zone pattern kept all custom code in `extensions/` — zero upstream merge conflicts
- Phase-by-phase execution with VERIFICATION.md after each phase caught gaps early (e.g., Phase 7 gap closure plan 07-05)
- Coarse granularity setting kept planning overhead low while maintaining quality
- Provider-agnostic AI abstraction made it easy to support 3 providers with minimal code per provider
- Pre-computed DashboardCache pattern avoided expensive live API calls on dashboard load

### What Was Inefficient
- REQUIREMENTS.md checkboxes fell behind (only 19/94 formally checked off despite all being satisfied) — documentation lag
- ROADMAP.md plan checkboxes for Phases 6-8 not updated despite plans being complete
- Nyquist validation files created but never filled out (all 8 are draft status)
- STATE.md accumulated multiple frontmatter blocks instead of being kept clean

### Patterns Established
- Extension zone: all custom NestJS modules as `@social/*` pnpm workspace packages under `extensions/`
- 3-layer backend: Controller → Service → Repository (no shortcuts)
- Platform adapter pattern: uniform `PlatformAdapter` interface per social platform
- Prisma schema extension: add fields/models in migration files, keep `schema.prisma` as source of truth
- Company-scoped queries: all data access filtered by `companyId`
- @Cron polling for async jobs (simpler than BullMQ for MVP scale)

### Key Lessons
1. Keep REQUIREMENTS.md checkboxes updated during phase execution, not retroactively — prevents documentation drift
2. Extension zone pattern works well for Postiz fork — keeps custom code cleanly separated
3. Pre-computed caches (DashboardCache) are essential for dashboard performance — never do live API calls on page load
4. Phase gap closure plans (e.g., 02-06, 07-05) are a healthy pattern — better to close gaps in dedicated small plans than to leave them

### Cost Observations
- Model mix: balanced profile (sonnet for agents, opus for orchestration)
- GSD config: yolo mode with coarse granularity
- Notable: 38 plans across 8 phases executed efficiently with parallelization enabled

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 8 | 38 | Initial milestone — established extension zone, phase execution, verification pattern |

### Top Lessons (Verified Across Milestones)

1. Extension zone pattern prevents upstream merge conflicts (v1.0 — first milestone, to be verified in future milestones)
2. Phase verification catches gaps early — gap closure plans are healthy (v1.0)
