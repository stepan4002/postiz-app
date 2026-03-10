---
gsd_state_version: 1.0
milestone: v2.20
milestone_name: milestone
status: complete
stopped_at: Completed 01-fork-and-foundation/01-05-PLAN.md
last_updated: "2026-03-10T14:55:00.000Z"
progress:
  total_phases: 8
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 100
---

# Project State: Social Command Centre

**Last updated:** 2026-03-10

## Current Milestone

**Milestone 1:** Core Loop — connect → generate → review → schedule → publish → metrics

## Current Phase

**Phase 1: Fork & Foundation** — COMPLETE (Plan 05/5 complete)

**Stopped at:** Completed 01-fork-and-foundation/01-05-PLAN.md

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Fork & Foundation | complete |
| 2 | Credential Management & OAuth | not_started |
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

## Next Action

Phase 1 complete. Begin Phase 2: Credential Management & OAuth.
