---
gsd_state_version: 1.0
milestone: v2.20
milestone_name: milestone
status: in_progress
stopped_at: Completed 02-credential-management-oauth/02-06-PLAN.md
last_updated: "2026-03-10T17:04:05.597Z"
progress:
  total_phases: 8
  completed_phases: 2
  total_plans: 11
  completed_plans: 11
---

---
gsd_state_version: 1.0
milestone: v2.20
milestone_name: milestone
status: in_progress
stopped_at: Completed 02-credential-management-oauth/02-06-PLAN.md
last_updated: "2026-03-10T17:30:00.000Z"
progress:
  total_phases: 8
  completed_phases: 2
  total_plans: 11
  completed_plans: 11
  percent: 100
---

# Project State: Social Command Centre

**Last updated:** 2026-03-10

## Current Milestone

**Milestone 1:** Core Loop — connect → generate → review → schedule → publish → metrics

## Current Phase

**Phase 3: AI Service Layer** — Ready to plan

**Stopped at:** Phase 2 complete, ready to plan Phase 3

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Fork & Foundation | complete |
| 2 | Credential Management & OAuth | complete |
| 3 | AI Service Layer | not_started |
| 4 | Media Library & Processing | not_started |
| 5 | Content Generation Pipeline | not_started |
| 6 | Scheduling & Publishing Engine | not_started |
| 7 | Analytics & Dashboard | not_started |
| 8 | Production Hardening & Deployment | not_started |

## Key Decisions Made

| Decision | Outcome | Date |
|----------|---------|------|
| Base project | Postiz (github.com/gitroomhq/postiz-app) | 2026-03-10 |
| Stack | TypeScript, NestJS + Next.js, PostgreSQL, Redis, BullMQ | 2026-03-10 |
| Data isolation | Row-level `company_id` scoping, single DB | 2026-03-10 |
| AI approach | Provider-agnostic (OpenAI, Anthropic, Ollama) | 2026-03-10 |
| Media storage | MinIO (S3-compatible, self-hosted) | 2026-03-10 |
| MVP platforms | Instagram, Facebook, LinkedIn, X | 2026-03-10 |
| Fork strategy | Merged v2.20.1 via --allow-unrelated-histories; upstream branch pinned to tag | 2026-03-10 |
| Dev compose | Lightweight stack: PostgreSQL + Redis + MinIO only, no Temporal until Phase 6 | 2026-03-10 |
| Extension zone | All custom code in extensions/ pnpm workspace, never in apps/ or libraries/ | 2026-03-10 |
| Company hierarchy | Company->Brand->BrandVoice/SocialAccount hierarchy in Prisma; Organization.companyId nullable FK | 2026-03-10 |
| CLS company scoping | nestjs-cls AsyncLocalStorage stores companyId per request; Prisma $extends auto-filters company-owned models | 2026-03-10 |
| Prisma migration | Migration 20260310000000_company_hierarchy created manually (Docker not running); apply with pnpm run dev:docker && pnpm run prisma:migrate | 2026-03-10 |
| Company API scoping | BrandService uses explicit companyId parameter (not CLS) — isolation is explicit and testable without mocking middleware | 2026-03-10 |
| Controller slug resolution | Controllers resolve companySlug/brandSlug to IDs before calling services; services work with IDs only | 2026-03-10 |
| Seed idempotency | Seed script uses Prisma upsert on unique constraints (slug for Company, companyId+slug for Brand, brandId for BrandVoice, brandId+platform for SocialAccount) | 2026-03-10 |
| Test isolation boundary | BrandService.findAllByCompany(companyId) is the formal isolation contract — integration tests prove Company A data never appears in Company B queries | 2026-03-10 |
| Integration test state | company-isolation.spec.ts is TDD RED (requires Docker DB); company.service.spec.ts is TDD GREEN (15 tests, no DB needed) | 2026-03-10 |
| Company switcher URL | ?c={slug} query param used for company scoping — avoids restructuring Postiz route tree; provides bookmarkable URLs without upstream disruption | 2026-03-10 |
| CompanySwitcher dropdown | CSS-only group-hover dropdown matches OrganizationSelector pattern — consistent UI without extra React state | 2026-03-10 |
| Token encryption algorithm | AES-256-GCM with 12-byte random IV per call; SHA-256 key derivation from ENCRYPTION_KEY env var; throws at startup if missing | 2026-03-10 |
| Token health schema | Integration model extended with lastRefreshedAt, consecutiveFailures, tokenEncrypted via manual migration 20260310000002 | 2026-03-10 |
| Interface injection for cross-package deps | IRefreshIntegrationService/INotificationService minimal interfaces in token.refresh.job.ts; avoids circular imports and enables unit testing without upstream package imports | 2026-03-10 |
| JS-side 75% lifetime filtering | Prisma cannot compute tokenExpiration - 0.25*(tokenExpiration - createdAt) in WHERE; fetch non-expired candidates, filter in JS | 2026-03-10 |
| Cron alert threshold logic | Alert on consecutiveFailures >= ALERT_THRESHOLD - 1 (before increment) to avoid DB re-read; fires on 3rd consecutive failure | 2026-03-10 |
| Frontend type isolation | TokenHealthState defined locally in frontend — avoids importing @social/credential-management (NestJS deps break frontend bundler) | 2026-03-10 |
| SocialAccount join by integrationId | Health endpoint joins SocialAccount by integrationId FK — more reliable than platform string match for brand context | 2026-03-10 |
| TokenHealthController module wiring | Controller file created in Plan 04; Plan 03 handles module registration — prevents write conflicts between parallel plans | 2026-03-10 |
| Factory providers for interface constructors | useFactory pattern in CredentialManagementModule to wire interface-typed services without re-writing; clean testability preserved | 2026-03-10 |
| OAuth brand context Redis key | brand:{state} TTL 600s alongside standard login:{state} and organization:{state} keys; 600s match social provider auth session lifetime | 2026-03-10 |
| Native fetch for OAuth start POST | useFetch uses relative URLs; OAuth start redirect needs external social provider URL, so native fetch('/api/credentials/oauth/start') is correct | 2026-03-10 |
| ENCRYPTION_KEY in Required Settings | TokenEncryptionService throws at NestJS startup if missing — truly required not optional; placed above optional settings in .env.example | 2026-03-10 |
| META_APP_ID separate from FACEBOOK_APP_ID | Meta Business API (Instagram + Facebook) uses its own app credentials; FACEBOOK_APP_ID kept for upstream Postiz legacy OAuth flow backward compatibility | 2026-03-10 |

## Blockers

None currently.

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01    | 01   | 25min    | 2     | 15    |
| 01    | 02   | 20min    | 2     | 10    |
| 01    | 03   | 10min    | 2     | 19    |
| 01    | 04   | 30min    | 1     | 4     |
| 01    | 05   | 5min     | 2     | 6     |
| 02    | 01   | 15min    | 2     | 9     |
| 02    | 02   | 15min    | 2     | 7     |
| 02    | 03   | 25min    | 2     | 9     |
| 02    | 04   | 15min    | 2     | 4     |
| 02    | 05   | 15min    | 1     | 4     |
| 02    | 06   | 10min    | 1     | 1     |

## Key Decisions Made (Plan 06)

| Decision | Outcome | Date |
|----------|---------|------|
| Batch integration fetch for brand-connections | Single findMany with id IN array instead of N+1 per-SocialAccount lookup | 2026-03-10 |
| TokenHealthService DI in OAuthBrandController | Injected as 4th constructor param; module already has it in providers — no module.ts changes | 2026-03-10 |
| MVP_PLATFORMS at controller module scope | Const array defined at top of controller file as single source of truth for backend | 2026-03-10 |

## Session Continuity

Last session: 2026-03-10
Stopped at: Phase 2 complete, ready to plan Phase 3: AI Service Layer
Resume file: None

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** One person can efficiently operate 100+ social posts per week across dozens of accounts and 4+ languages
**Current focus:** Phase 3 — AI Service Layer

## Next Action

Plan Phase 3: AI Service Layer.
