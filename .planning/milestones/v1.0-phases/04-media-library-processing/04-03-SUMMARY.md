---
phase: 04-media-library-processing
plan: 03
subsystem: processing
tags: [nestjs, sharp, minio, s3, prisma, image-processing, cron, variant-generation, tdd, jest]

# Dependency graph
requires:
  - phase: 04-01
    provides: MinioStorage, PLATFORM_VARIANT_SPECS, PLATFORM_MEDIA_SPECS, VariantSpec, VariantResult, PlatformValidationResult types
  - phase: 04-02
    provides: CompanyMediaRepository, uploadBufferToMinio utility

provides:
  - MediaProcessingService — sharp-based variant generation (cover fit, JPEG 85) + full generateVariants pipeline
  - PlatformMediaValidator — pure validation service for dimensions/fileSize/format per platform
  - MediaProcessingJob — @Cron every 30s, polls pending jobs, processes async, handles errors per-job
  - Variant path convention: {companyId}/{mediaId}/variants/{platform}_{w}x{h}.jpg
  - Job status transitions: pending -> processing -> completed/failed

affects:
  - 04-04-media-api-controller (module wiring — MediaProcessingJob + MediaProcessingService registered in MediaLibraryModule)
  - 05-content-generation-pipeline (variants available for AI caption context)
  - 06-scheduling-publishing (PlatformMediaValidator consumed before publishing)

# Tech tracking
tech-stack:
  added:
    - "sharp (existing root dependency) — cover resize to exact platform dimensions, JPEG quality 85"
    - "@nestjs/schedule Cron decorator — every-30-second job polling"
  patterns:
    - "TDD RED/GREEN: spec files written before implementation, confirmed failing before implementing"
    - "Cover fit resize: exact pixel dimensions guaranteed for all platform variant specs"
    - "GetObjectCommand with transformToByteArray() — stream-to-Buffer conversion for S3 download"
    - "RUN_CRON guard: matches Phase 2 TokenRefreshJob pattern — prevents dual-context processing"
    - "Per-job error isolation: try/catch inside for loop, never throws from processPendingJobs"

key-files:
  created:
    - extensions/media-library/src/processing/media-processing.service.ts
    - extensions/media-library/src/processing/platform-media-validator.ts
    - extensions/media-library/src/processing/media-processing.job.ts
    - extensions/media-library/src/__tests__/media-processing.service.spec.ts
    - extensions/media-library/src/__tests__/platform-media-validator.spec.ts
    - extensions/media-library/src/__tests__/media-processing.job.spec.ts

key-decisions:
  - "transformToByteArray() for S3 GetObjectCommand body — converts AWS SDK stream response to Buffer for sharp input"
  - "S3Client created inline in generateVariants (not injected) — consistent with CompanyMediaService pattern; enables jest.mock interception"
  - "PlatformMediaValidator has no DB dependency — pure validation logic; injectable for Phase 6 publishing checks"
  - "MediaProcessingJob injects MediaProcessingService directly — simple two-param constructor, no factory pattern needed"
  - "instagram format normalization: 'jpg' aliased to 'jpeg' in format check — spec stores 'jpeg', sharp outputs 'jpeg'"
  - "validateAll finds variant by platform field match — correct for multi-platform batch validation"

patterns-established:
  - "Cron job pattern: RUN_CRON guard -> findMany pending -> for loop with per-job try/catch -> status updates"
  - "Variant path: {companyId}/{mediaId}/variants/{platform}_{width}x{height}.jpg"
  - "Validation result: {platform, passed: boolean, reasons: string[]}"

requirements-completed:
  - R8.1
  - R8.2
  - R8.3
  - R8.4
  - NF2.2
  - NF3.3

# Metrics
duration: 20min
completed: 2026-03-10
---

# Phase 4 Plan 03: Async Media Processing Pipeline Summary

**Sharp-based variant generation for 4 MVP platforms (7 total specs), @Cron-30s DB queue poller with per-job error isolation, and pure PlatformMediaValidator service for dimensions/fileSize/format checks**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-10T19:47:00Z
- **Completed:** 2026-03-10T20:13:50Z
- **Tasks:** 2
- **Files created:** 6

## Accomplishments
- MediaProcessingService: `generateVariant` uses sharp cover resize to exact platform dimensions at JPEG quality 85; `generateVariants` downloads original from MinIO, loops over all specs per platform, uploads each variant to `{companyId}/{mediaId}/variants/{platform}_{w}x{h}.jpg`, creates MediaVariant DB record
- PlatformMediaValidator: pure injectable service (no DB), validates dimensions, file size, format against PLATFORM_MEDIA_SPECS; `validateAll` handles batch validation across multiple platforms
- MediaProcessingJob: `@Cron('*/30 * * * * *')` with RUN_CRON guard, polls 5 pending jobs ascending by createdAt, marks processing before calling service, marks completed/failed after, never throws (per-job try/catch)
- 64 total tests passing across all 6 test files (10 minio.storage + 12 repository + 9 company-media service + 12 processing service + 13 validator + 9 job)

## Task Commits

Each task was committed atomically:

1. **Task 1: MediaProcessingService variant generation and PlatformMediaValidator** - `5797abc0` (feat)
2. **Task 2: MediaProcessingJob cron poller** - `f88cdcd0` (feat)

_Note: Both tasks followed TDD RED/GREEN cycle — tests written before implementation_

## Files Created

- `extensions/media-library/src/processing/media-processing.service.ts` - Sharp-based variant generation; generateVariant (single spec) + generateVariants (full pipeline: download → resize → upload → DB record)
- `extensions/media-library/src/processing/platform-media-validator.ts` - Pure validation: validate(variant, platform, aspectRatio?) + validateAll(variants[], platforms[]); checks dimensions, fileSize, format
- `extensions/media-library/src/processing/media-processing.job.ts` - @Cron every 30s; RUN_CRON guard; polls 5 pending jobs; pending->processing->completed/failed transitions; per-job error isolation
- `extensions/media-library/src/__tests__/media-processing.service.spec.ts` - 12 tests: generateVariant dimensions/format/error, generateVariants DB load/download/upload paths/DB records/instagram 3 specs/multi-platform
- `extensions/media-library/src/__tests__/platform-media-validator.spec.ts` - 13 tests: pass/fail for each validation rule, all 4 platforms, unknown platform, validateAll batch
- `extensions/media-library/src/__tests__/media-processing.job.spec.ts` - 9 tests: RUN_CRON guard, polling query params, batch processing, processing-before-service ordering, completed/failed status, error isolation, continues after failure

## Decisions Made
- **transformToByteArray()** for S3 body conversion — AWS SDK v3 streams require this method to convert to Uint8Array/Buffer; consistent approach across the codebase
- **S3Client created inline** in generateVariants — mirrors CompanyMediaService pattern; allows jest.mock to intercept uploadBufferToMinio without DI complexity
- **PlatformMediaValidator no DB** — pure validation logic is self-contained and testable without Prisma mock; Phase 6 can inject it without DB overhead
- **instagram format alias** — normalized 'jpg' to 'jpeg' in format check because PLATFORM_MEDIA_SPECS stores both 'jpeg' and 'jpg' and sharp outputs 'jpeg'
- **validateAll by platform field match** — variant array has `platform` property; finding by platform ensures correct variant-to-spec pairing in batch validation

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

**Created files exist:**
- `extensions/media-library/src/processing/media-processing.service.ts` — FOUND
- `extensions/media-library/src/processing/platform-media-validator.ts` — FOUND
- `extensions/media-library/src/processing/media-processing.job.ts` — FOUND
- `extensions/media-library/src/__tests__/media-processing.service.spec.ts` — FOUND
- `extensions/media-library/src/__tests__/platform-media-validator.spec.ts` — FOUND
- `extensions/media-library/src/__tests__/media-processing.job.spec.ts` — FOUND

**Commits exist:**
- `5797abc0` feat(04-03): implement MediaProcessingService and PlatformMediaValidator — FOUND
- `f88cdcd0` feat(04-03): implement MediaProcessingJob cron poller with TDD — FOUND

**Tests:** 64/64 passing — VERIFIED

## Self-Check: PASSED

## Next Phase Readiness
- Plan 04 (MediaLibraryModule) needs to register: MediaProcessingService, PlatformMediaValidator, MediaProcessingJob
- Phase 6 (Scheduling & Publishing) can import PlatformMediaValidator directly for pre-publish validation
- Variant paths follow convention: `{companyId}/{mediaId}/variants/{platform}_{w}x{h}.jpg` — documented for Phase 6

---
*Phase: 04-media-library-processing*
*Completed: 2026-03-10*
