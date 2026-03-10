---
gsd_state_version: 1.0
milestone: v2.20
milestone_name: milestone
status: in_progress
stopped_at: Completed 04-media-library-processing/04-04-PLAN.md
last_updated: "2026-03-10T20:27:03.353Z"
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 19
  completed_plans: 19
  percent: 100
---

---
gsd_state_version: 1.0
milestone: v2.20
milestone_name: milestone
status: in_progress
stopped_at: Completed 04-media-library-processing/04-02-PLAN.md
last_updated: "2026-03-10T19:29:15.382Z"
progress:
  [██████████] 100%
  completed_phases: 3
  total_plans: 19
  completed_plans: 17
  percent: 89
---

---
gsd_state_version: 1.0
milestone: v2.20
milestone_name: milestone
status: in_progress
stopped_at: Completed 04-media-library-processing/04-01-PLAN.md
last_updated: "2026-03-10T19:28:03.815Z"
progress:
  [█████████░] 89%
  completed_phases: 3
  total_plans: 19
  completed_plans: 16
---

---
gsd_state_version: 1.0
milestone: v2.20
milestone_name: milestone
status: in_progress
stopped_at: Completed 03-ai-service-layer/03-04-PLAN.md
last_updated: "2026-03-10T18:15:57.891Z"
progress:
  total_phases: 8
  completed_phases: 3
  total_plans: 15
  completed_plans: 15
  percent: 100
---

---
gsd_state_version: 1.0
milestone: v2.20
milestone_name: milestone
status: in_progress
stopped_at: Completed 03-ai-service-layer/03-02-PLAN.md
last_updated: "2026-03-10T18:01:50.267Z"
progress:
  [██████████] 100%
  completed_phases: 2
  total_plans: 15
  completed_plans: 14
  percent: 93
---

---
gsd_state_version: 1.0
milestone: v2.20
milestone_name: milestone
status: in_progress
stopped_at: Completed 03-ai-service-layer/03-03-PLAN.md
last_updated: "2026-03-10T17:59:48.854Z"
progress:
  [█████████░] 93%
  completed_phases: 2
  total_plans: 15
  completed_plans: 13
  percent: 87
---

---
gsd_state_version: 1.0
milestone: v2.20
milestone_name: milestone
status: in_progress
stopped_at: Completed 03-ai-service-layer/03-01-PLAN.md
last_updated: "2026-03-10T17:50:18.022Z"
progress:
  [█████████░] 87%
  completed_phases: 2
  total_plans: 15
  completed_plans: 12
---

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

**Phase 4: Media Library & Processing** — Complete (all 4 plans done)

**Stopped at:** Completed 04-media-library-processing/04-04-PLAN.md

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Fork & Foundation | complete |
| 2 | Credential Management & OAuth | complete |
| 3 | AI Service Layer | complete |
| 4 | Media Library & Processing | complete |
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
| BrandVoiceInput local interface | Local interface in brand-voice-prompt.builder.ts avoids importing Prisma types into extension package — self-contained and testable without DB | 2026-03-10 |
| ollama/* prefix matching for cost | calculateCostUsd checks model.startsWith('ollama/') as fallback — covers all Ollama variants without enumerating them, returns 0 | 2026-03-10 |
| English omitted from brand voice prompt | Language directive only emitted for non-English (language !== 'en') — English is the assumed default, reduces token usage | 2026-03-10 |
| AIConfig unique per company | AIConfig has @unique on companyId (one config per company); AICostLog is append-only with no updatedAt field | 2026-03-10 |
| Non-blocking AICostLogger | AICostLogger catches all DB errors and console.warns — cost logging must never block AI call flow | 2026-03-10 |
| Budget UTC weekly window | BudgetCircuitBreaker uses dayjs().utc().startOf('week') for consistent UTC window preventing timezone-dependent resets | 2026-03-10 |
| Null budget = unlimited | weeklyBudgetUsd: null = unlimited — early return avoids unnecessary aggregate query | 2026-03-10 |
| Anthropic zodOutputFormat Zod v3 fix | SDK's zodOutputFormat requires Zod v4 (z.toJSONSchema); built custom helper using zod-to-json-schema package for Zod v3 compatibility | 2026-03-10 |
| Native fetch for Ollama | No maintained npm SDK for Ollama; native fetch keeps provider lightweight and testable via jest.spyOn | 2026-03-10 |
| AIProviderRouter PrismaService injection | AIProviderRouter injects PrismaService directly (as any) for BrandVoice lookup — consistent with (this.prisma as any) pattern from Plan 03 | 2026-03-10 |
| Module test with explicit providers | AIServiceModule test uses explicit provider list instead of Test.createTestingModule({ imports }) — @Global PrismaService not available in isolated test context | 2026-03-10 |
| AiConfigController double registration | Controller in both controllers[] and providers[] via useFactory in AIServiceModule — NestJS requires both for routing + DI injection | 2026-03-10 |
| forcePathStyle: true in MinioStorage | S3Client requires forcePathStyle: true for MinIO — prevents virtual-hosted-style URL generation (bucket.endpoint.com) which MinIO doesn't support without custom DNS | 2026-03-10 |
| MINIO_* env vars distinct from S3_* | MINIO_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET/PUBLIC_URL kept separate from legacy S3_* vars — clear Phase 4 config separation, no ambiguity | 2026-03-10 |
| uploadBufferToMinio standalone export | Exported as utility function (not method) — Plan 02/03 thumbnail and variant pipelines use it directly with S3Client without full IUploadProvider | 2026-03-10 |
| uuid pre-generation for mediaId | Generate mediaId before DB insert so MinIO key includes mediaId prefix without two-step create-then-update flow | 2026-03-10 |
| CompanyMediaRepository isolation contract | findByCompany always filters companyId + deletedAt IS NULL; tag filtering via Prisma { has: tag } on String[]; isolation is explicit and testable | 2026-03-10 |
| S3Client inline in service uploadAndRecord | S3Client created inside service method (not injected) to allow jest.mock(uploadBufferToMinio) to intercept uploads cleanly in unit tests | 2026-03-10 |
| transformToByteArray for S3 download | AWS SDK v3 GetObjectCommand Body uses transformToByteArray() to convert stream to Uint8Array/Buffer for sharp input | 2026-03-10 |
| PlatformMediaValidator no DB dependency | Pure validation logic — injectable without Prisma; consumed by Phase 6 publishing engine without DB overhead | 2026-03-10 |
| instagram format alias in validator | 'jpg' normalized to 'jpeg' in format check — PLATFORM_MEDIA_SPECS lists both, sharp outputs 'jpeg' | 2026-03-10 |
| MediaProcessingJob per-job error isolation | try/catch inside for loop — one job failure never blocks next jobs; matches Phase 2 TokenRefreshJob pattern | 2026-03-10 |
| MediaLibraryModule useFactory wiring | All 6 providers resolved via useFactory in MediaLibraryModule; ScheduleModule included for Cron; onModuleInit for bucket creation | 2026-03-10 |
| Company-scoped Uppy S3 multipart endpoints | Uppy 's3' case routes to /companies/:slug/media/multipart/:endpoint — avoids Cloudflare R2 /media/:endpoint conflict; MinioStorage exposes 5 presigned URL methods | 2026-03-10 |
| useMediaUpload FormData approach | Direct FormData to /companies/:slug/media/upload vs Uppy — server handles sharp pipeline; storageProvider type has no 's3' value; simpler | 2026-03-10 |
| MediaGrid MinIO URL resolution | paths stored as S3 keys in DB; resolveMediaUrl prepends MINIO_PUBLIC_URL when path not http-prefixed | 2026-03-10 |

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
| 03    | 01   | 25min    | 2     | 15    |
| 03    | 02   | 20min    | 2     | 7     |
| 03    | 03   | 15min    | 2     | 7     |
| 03    | 04   | 9min     | 3     | 9     |
| Phase 04 P01 | 7min | 2 tasks | 14 files |
| Phase 04 P02 | 25min | 2 tasks | 8 files |
| 04    | 03   | 20min    | 2     | 6     |
| 04    | 04   | 35min    | 2     | 12    |
| Phase 04 P04 | 35min | 2 tasks | 12 files |

## Key Decisions Made (Plan 06)

| Decision | Outcome | Date |
|----------|---------|------|
| Batch integration fetch for brand-connections | Single findMany with id IN array instead of N+1 per-SocialAccount lookup | 2026-03-10 |
| TokenHealthService DI in OAuthBrandController | Injected as 4th constructor param; module already has it in providers — no module.ts changes | 2026-03-10 |
| MVP_PLATFORMS at controller module scope | Const array defined at top of controller file as single source of truth for backend | 2026-03-10 |

## Session Continuity

Last session: 2026-03-10T20:50:00Z
Stopped at: Completed 04-media-library-processing/04-04-PLAN.md
Resume file: None

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** One person can efficiently operate 100+ social posts per week across dozens of accounts and 4+ languages
**Current focus:** Phase 5 — Content Generation Pipeline

## Next Action

Execute Phase 5 Plan 01: Content generation pipeline foundation.
