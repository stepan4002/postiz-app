# Project State: Social Command Centre

**Last updated:** 2026-03-10

## Current Milestone

**Milestone 1:** Core Loop — connect → generate → review → schedule → publish → metrics

## Current Phase

**Phase 1: Fork & Foundation** — NOT STARTED

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Fork & Foundation | not_started |
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

## Blockers

None currently.

## Next Action

Plan and execute Phase 1: Fork Postiz, set up Docker dev environment, extend data model with multi-company hierarchy, establish extension architecture.
