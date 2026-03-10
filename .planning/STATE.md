# Project State: Social Command Centre

**Last updated:** 2026-03-10

## Current Milestone

**Milestone 1:** Core Loop — connect → generate → review → schedule → publish → metrics

## Current Phase

**Phase 1: Fork & Foundation** — IN PROGRESS (Plan 02/N complete)

**Stopped at:** Completed 01-fork-and-foundation/01-02-PLAN.md

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Fork & Foundation | in_progress |
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

## Blockers

None currently.

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01    | 01   | 25min    | 2     | 15    |
| 01    | 02   | 20min    | 2     | 10    |

## Next Action

Execute Phase 1 Plan 03: Company CRUD API and company switcher UI (if exists), or next available plan in Phase 1.
