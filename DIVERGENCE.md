# DIVERGENCE.md — Upstream Modification Log

This file tracks every modification made to upstream Postiz files.
All custom code lives in `extensions/` — upstream files are modified only when absolutely necessary.

**Format:**
- **Phase:** Which project phase introduced the change
- **Date:** When the change was made
- **Change:** What was modified and how
- **Reason:** Why the upstream file had to be touched
- **Upstream risk:** Risk level if upstream changes the same area
- **Watch for:** What to check when merging upstream updates

---

## pnpm-workspace.yaml

- **Phase:** 1
- **Date:** 2026-03-10
- **Change:** Added `extensions/**` to the `packages` array alongside `apps/*` and `libraries/*`
- **Reason:** pnpm workspaces require all package roots to be listed; adding `extensions/` as the custom code directory requires this one-line addition
- **Upstream risk:** LOW — upstream rarely modifies pnpm-workspace.yaml; adding back our line after merge is trivial
- **Watch for:** Upstream adding new package directories that might conflict with glob ordering

---

## tsconfig.base.json

- **Phase:** 1
- **Date:** 2026-03-10
- **Change:** Added `@social/multi-company` and `@social/company-context` path aliases to `compilerOptions.paths`
- **Reason:** TypeScript path aliases enable `import { ... } from '@social/multi-company'` across the monorepo without fragile relative paths
- **Upstream risk:** LOW — upstream adds new `@gitroom/*` path entries; simply re-add `@social/*` entries after merge
- **Watch for:** Upstream restructuring the `paths` object or changing `baseUrl`

---

## .env.example

- **Phase:** 1
- **Date:** 2026-03-10
- **Change:** Added S3/MinIO environment variables (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`) and updated `STORAGE_PROVIDER` comment
- **Reason:** MinIO is not included in upstream Postiz by default; Phase 4 media pipeline requires S3-compatible storage; documenting env vars here ensures developers know what to set
- **Upstream risk:** LOW — upstream may add new env vars but not the same S3 variable names
- **Watch for:** Upstream adding official S3/MinIO support (PR #1125) which may use different variable names

---

## package.json

- **Phase:** 1
- **Date:** 2026-03-10
- **Change:** Modified `dev:docker` script path to `docker/docker-compose.dev.yaml`; added `dev:docker:down`, `prisma:migrate`, `prisma:generate`, `prisma:seed` convenience scripts
- **Reason:** Custom Docker Compose lives in `docker/` subdirectory (not root); additional prisma migrate commands needed for proper migration history; seed script references extension zone
- **Upstream risk:** MEDIUM — upstream regularly modifies package.json scripts; re-apply our script additions after merge
- **Watch for:** Upstream changing existing `dev:docker` script, adding conflicting script names, or changing prisma version used in scripts

---

## apps/backend/src/app.module.ts

- **Phase:** 1 (Plan 02)
- **Date:** 2026-03-10
- **Change:** Added `import { CompanyContextModule } from '@social/company-context'` and added `CompanyContextModule` to the `@Module` imports array before `ApiModule`
- **Reason:** CompanyContextModule must be registered in AppModule to activate the ClsModule global context and the CompanyContextMiddleware that auto-scopes Prisma queries by company
- **Upstream risk:** MEDIUM — upstream regularly adds imports to AppModule; re-add our CompanyContextModule import and ensure it stays before ApiModule after merge
- **Watch for:** Upstream adding conflicting CLS or middleware registrations; upstream reordering imports that might break global ClsModule initialization

---

## libraries/nestjs-libraries/src/database/prisma/schema.prisma

- **Phase:** 1 (Plan 02)
- **Date:** 2026-03-10
- **Change:** Added Company, Brand, BrandVoice, SocialAccount models in a clearly marked block above the Organization model; added nullable `companyId` FK field + index to the Organization model; created initial migration `20260310000000_company_hierarchy`
- **Reason:** Multi-company hierarchy required for data isolation — Company and Brand hierarchy are the foundation of all subsequent features; companyId on Organization links existing Postiz workspaces to the new company layer
- **Upstream risk:** MEDIUM — upstream may add new models or modify existing ones; our models are in a self-contained named block; Organization field addition is the only inline change and is at the bottom of the field list to minimize merge conflicts
- **Watch for:** Upstream adding any field named `companyId` to Organization; upstream adding models with names that conflict with Company/Brand/BrandVoice/SocialAccount; upstream schema format changes

---

## apps/backend/src/app.module.ts (Plan 03 addition)

- **Phase:** 1 (Plan 03)
- **Date:** 2026-03-10
- **Change:** Added `import { MultiCompanyModule } from '@social/multi-company'` and added `MultiCompanyModule` to the `@Module` imports array after `CompanyContextModule`
- **Reason:** MultiCompanyModule registers the Company/Brand/BrandVoice REST endpoints; must be in AppModule to be active
- **Upstream risk:** MEDIUM — upstream regularly adds imports to AppModule; re-add our MultiCompanyModule import after merge
- **Watch for:** Upstream adding route prefixes or global route guards that might conflict with /api/companies routes

---

## libraries/nestjs-libraries/src/database/prisma/schema.prisma (Phase 2 addition)

- **Phase:** 2 (Plan 01)
- **Date:** 2026-03-10
- **Change:** Added 3 fields to the Integration model inside a clearly marked Phase 2 block: `lastRefreshedAt DateTime?`, `consecutiveFailures Int @default(0)`, `tokenEncrypted Boolean @default(false)`; created migration `20260310000002_integration_token_health`
- **Reason:** Token health tracking fields required for credential refresh job (Plan 02) and health API (Plan 04); `tokenEncrypted` flag tracks which Integration tokens have been migrated to AES-256-GCM encryption
- **Upstream risk:** MEDIUM — upstream may add fields to Integration; our block is clearly marked and at end of field list before relations; re-apply after merge
- **Watch for:** Upstream adding fields named `lastRefreshedAt`, `consecutiveFailures`, or `tokenEncrypted`; upstream changing the Integration model structure significantly

---

## apps/backend/src/app.module.ts (Phase 2 Plan 03 addition)

- **Phase:** 2 (Plan 03)
- **Date:** 2026-03-10
- **Change:** Added `import { CredentialManagementModule } from '@social/credential-management'` and added `CredentialManagementModule` to the `@Module` imports array after `MultiCompanyModule`
- **Reason:** CredentialManagementModule registers all credential management services (TokenEncryptionService, CredentialService, CredentialRepository, TokenHealthService, TokenRefreshJob) and controllers (OAuthBrandController, TokenHealthController) for Phase 2 functionality
- **Upstream risk:** MEDIUM — upstream regularly adds imports to AppModule; re-add our CredentialManagementModule import after merge; ensure it stays after MultiCompanyModule (depends on brand/socialAccount schema)
- **Watch for:** Upstream adding conflicting cron scheduling (ScheduleModule) or competing /api/credentials route prefixes; upstream adding OAuth-related modules that might overlap

---

## tsconfig.base.json (Phase 2 Plan 03 addition)

- **Phase:** 2 (Plan 03)
- **Date:** 2026-03-10
- **Change:** Added `"@social/credential-management": ["extensions/credential-management/src/index.ts"]` to `compilerOptions.paths`
- **Reason:** TypeScript path alias enables `import { ... } from '@social/credential-management'` in AppModule and other consumers
- **Upstream risk:** LOW — upstream adds new `@gitroom/*` path entries; re-add our entry after merge
- **Watch for:** Upstream restructuring the `paths` object

---

## libraries/nestjs-libraries/src/upload/upload.factory.ts (Phase 4 addition)

- **Phase:** 4 (Plan 01)
- **Date:** 2026-03-10
- **Change:** Added `import { MinioStorage } from '@social/media-library'` and `case 's3'` to `UploadFactory.createStorage()`, instantiating MinioStorage from MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, MINIO_PUBLIC_URL env vars
- **Reason:** UploadFactory is the upstream mechanism for swapping storage backends; adding the `s3` case here is the only supported integration point without rewriting the factory
- **Upstream risk:** LOW — upstream may add other storage cases but will not conflict with `case 's3'`; re-apply after merge by adding the s3 case and MinioStorage import
- **Watch for:** Upstream adding their own S3/MinIO implementation with different variable names; upstream changing the switch-case to a different pattern

---

## apps/backend/src/app.module.ts (Phase 4 Plan 04 addition)

- **Phase:** 4 (Plan 04)
- **Date:** 2026-03-10
- **Change:** Added `import { MediaLibraryModule } from '@social/media-library'` and added `MediaLibraryModule` to the `@Module` imports array after `AIServiceModule`
- **Reason:** MediaLibraryModule registers all media library services (MinioStorage, CompanyMediaService, CompanyMediaRepository, MediaProcessingService, MediaProcessingJob, PlatformMediaValidator) and controllers (CompanyMediaController) for Phase 4 functionality
- **Upstream risk:** MEDIUM — upstream regularly adds imports to AppModule; re-add our MediaLibraryModule import after merge; ensure it stays after AIServiceModule
- **Watch for:** Upstream adding conflicting media or storage modules; upstream adding routes that conflict with /api/companies/:slug/media

---

## libraries/react-shared-libraries/src/helpers/uppy.upload.ts (Phase 4 Plan 04 addition)

- **Phase:** 4 (Plan 04)
- **Date:** 2026-03-10
- **Change:** Added `case 's3'` to `getUppyUploadPlugin()` switch statement — uses same `AwsS3Multipart` plugin pattern as the `cloudflare` case but points to `/companies/${companySlug}/media/multipart/:endpoint` routes
- **Reason:** Uppy needs an S3-compatible multipart upload path for MinIO; the `s3` case mirrors the cloudflare case's presigned URL flow but uses company-scoped MinIO endpoints
- **Upstream risk:** LOW — upstream may update the switch statement but will not conflict with `case 's3'`; re-apply after merge by adding the s3 case
- **Watch for:** Upstream adding their own S3/MinIO Uppy integration with a different case name

---

## apps/backend/src/app.module.ts (Phase 5 Plan 03 addition)

- **Phase:** 5 (Plan 03)
- **Date:** 2026-03-10
- **Change:** Added `import { ContentGenerationModule } from '@social/content-generation'` and added `ContentGenerationModule` to the `@Module` imports array after `MediaLibraryModule`
- **Reason:** ContentGenerationModule registers all content generation services (ContentPostService, ContentPostRepository, ReviewQueueService) and controllers (ContentPostController, ReviewQueueController) for Phase 5 functionality. Must be registered after MediaLibraryModule because it depends on MediaProcessingService.
- **Upstream risk:** MEDIUM — upstream regularly adds imports to AppModule; re-add our ContentGenerationModule import after merge; ensure it stays after MediaLibraryModule
- **Watch for:** Upstream adding conflicting content generation or AI-related modules; upstream adding routes that conflict with /api/companies/:slug/posts or /api/companies/:slug/review-queue

---

## libraries/nestjs-libraries/src/database/prisma/schema.prisma (Phase 6 addition)

- **Phase:** 6 (Plan 01)
- **Date:** 2026-03-10
- **Change:** Extended ContentPost model with `scheduledAt DateTime?` and `publishAttempts PublishAttempt[]` relation; extended PostVariant model with 8 new scheduling/publishing fields (`scheduledAt`, `platformPostId`, `platformUrl`, `publishAttempts`, `consecutiveFailures`, `lastPublishError`, `publishedAt`, `publishWindowExpiresAt`) and 2 new indexes; created new `PublishAttempt` model for audit logging every publish attempt; created migration `20260310200000_scheduling_publishing`
- **Reason:** Scheduling engine (Plan 02) needs scheduledAt on both ContentPost and PostVariant to track when posts should publish; platformPostId enables idempotency (R10.3); publishAttempts/consecutiveFailures mirror Phase 2 token health pattern; PublishAttempt provides full audit trail (R10.6) for debugging and dashboard display
- **Upstream risk:** MEDIUM — upstream may add fields to ContentPost/PostVariant; our fields are clearly grouped with Phase 6 comments; re-apply after merge
- **Watch for:** Upstream adding fields named `scheduledAt`, `platformPostId`, or `publishAttempts`; upstream adding models named `PublishAttempt`; upstream changing ContentPost/PostVariant model structure significantly

---

## apps/backend/src/app.module.ts (Phase 6 Plan 04 addition)

- **Phase:** 6 (Plan 04)
- **Date:** 2026-03-11
- **Change:** Added `import { SchedulingPublishingModule } from '@social/scheduling-publishing'` and added `SchedulingPublishingModule` to the `@Module` imports array after `ContentGenerationModule`
- **Reason:** SchedulingPublishingModule registers all scheduling and publishing services (SchedulingRepository, PublishingRepository, ScheduleResolverService, AdapterRegistry, PublishAttemptLogger, PublishingService, SchedulerTickJob, PublishingWorkerJob) and controllers (SchedulingController, FailedPostsController) for Phase 6 functionality. Must be registered after ContentGenerationModule (depends on content post schema).
- **Upstream risk:** MEDIUM — upstream regularly adds imports to AppModule; re-add our SchedulingPublishingModule import after merge; ensure it stays after ContentGenerationModule
- **Watch for:** Upstream adding conflicting scheduling or publishing modules; upstream adding routes that conflict with /api/companies/:slug/posts/:id/schedule or /api/companies/:slug/failed-posts

---

## apps/frontend/src/components/new-layout/layout.component.tsx

- **Phase:** 1 (Plan 05)
- **Date:** 2026-03-10
- **Change:** Added import of `CompanySwitcher` and `CompanyProvider` from `@gitroom/frontend/components/company-switcher`; added `<CompanySwitcher />` to the header nav area (before StreakComponent); wrapped `{children}` in `<CompanyProvider>`; added `items-center` to the header flex div
- **Reason:** CompanySwitcher must appear in the header to give operators access to company switching; CompanyProvider must wrap children so all page components can access the current company via `useCompany()` hook
- **Upstream risk:** MEDIUM — upstream may modify the header layout or add new items to the nav bar; our additions are localized to two areas (header nav div and children wrapper); re-add after merge by finding `<StreakComponent />` insertion point and `{children}` wrapping point
- **Watch for:** Upstream restructuring the `LayoutComponent` header area; upstream renaming or moving layout.component.tsx; upstream changing the children rendering pattern

---
