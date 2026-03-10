---
phase: 04-media-library-processing
plan: 01
subsystem: storage
tags: [minio, s3, prisma, media, aws-sdk, storage, jest, tdd]

# Dependency graph
requires:
  - phase: 03-ai-service-layer
    provides: Extension package pattern (@social/ai-service) to mirror
  - phase: 01-fork-and-foundation
    provides: tsconfig.base.json path alias pattern, pnpm workspace setup

provides:
  - "@social/media-library extension package with MinioStorage, types, and platform specs"
  - "MinioStorage S3-compatible provider with forcePathStyle: true for MinIO"
  - "UploadFactory case 's3' wired to MinioStorage via MINIO_* env vars"
  - "Prisma schema: Media.companyId, width, height, format, tags extensions"
  - "Prisma schema: MediaVariant model (unique per mediaId+platform+width+height)"
  - "Prisma schema: MediaProcessingJob model (status tracking for async processing)"
  - "Manual migration: 20260310100000_media_library"
  - "PLATFORM_MEDIA_SPECS and PLATFORM_VARIANT_SPECS for Instagram, Facebook, LinkedIn, X"
  - "uploadBufferToMinio utility for Plan 02/03 thumbnail and variant uploads"

affects:
  - 04-02-company-media-service
  - 04-03-variant-generation
  - 04-04-media-api-controller
  - 05-content-generation-pipeline

# Tech tracking
tech-stack:
  added:
    - "@aws-sdk/client-s3 (via existing root dependency, used in extension)"
    - "mime-types (existing root dependency, used for file extension resolution)"
  patterns:
    - "Extension package mirrors ai-service structure: package.json, tsconfig.json, tsconfig.spec.json, jest.config.ts"
    - "S3Client with forcePathStyle: true — mandatory for MinIO, prevents virtual-hosted-style URL generation"
    - "uploadBufferToMinio exported utility for direct buffer uploads by downstream plans"
    - "Static ensureBucket for idempotent startup bucket creation"

key-files:
  created:
    - "extensions/media-library/package.json"
    - "extensions/media-library/tsconfig.json"
    - "extensions/media-library/tsconfig.spec.json"
    - "extensions/media-library/jest.config.ts"
    - "extensions/media-library/src/index.ts"
    - "extensions/media-library/src/types.ts"
    - "extensions/media-library/src/storage/minio.storage.ts"
    - "extensions/media-library/src/processing/platform-specs.ts"
    - "extensions/media-library/src/__tests__/minio.storage.spec.ts"
    - "prisma/migrations/20260310100000_media_library/migration.sql"
  modified:
    - "libraries/nestjs-libraries/src/database/prisma/schema.prisma"
    - "libraries/nestjs-libraries/src/upload/upload.factory.ts"
    - "tsconfig.base.json"
    - ".env.example"
    - "DIVERGENCE.md"

key-decisions:
  - "forcePathStyle: true in S3Client config — critical MinIO requirement; virtual-hosted URLs don't work without custom DNS"
  - "multer types added to both tsconfig.json and tsconfig.spec.json to resolve Express.Multer.File namespace"
  - "uploadBufferToMinio exported as standalone utility — Plan 02/03 thumbnail and variant pipelines use it directly with S3Client"
  - "MinioStorage.ensureBucket static method — idempotent bucket creation avoids startup failures"
  - "Media model extended inline (not new model) — companyId nullable FK preserves existing data"
  - "MediaVariant unique on (mediaId, platform, width, height) — prevents duplicate variant records"
  - "MINIO_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET/PUBLIC_URL env vars — distinct from legacy S3_* vars"

patterns-established:
  - "Extension test pattern: jest.mock('@aws-sdk/client-s3') captures commands via mockSend for assertion"
  - "TDD RED/GREEN cycle: spec file staged first, implementation confirms all tests pass"

requirements-completed:
  - R7.1
  - R7.2
  - R7.5

# Metrics
duration: 35min
completed: 2026-03-10
---

# Phase 4 Plan 01: Media Library Foundation Summary

**MinIO S3-compatible storage provider with forcePathStyle, Prisma MediaVariant + MediaProcessingJob schema, and typed platform specs for Instagram/Facebook/LinkedIn/X**

## Performance

- **Duration:** 35 min
- **Started:** 2026-03-10T18:54:25Z
- **Completed:** 2026-03-10T19:30:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Scaffolded `@social/media-library` extension package mirroring ai-service pattern
- Implemented MinioStorage with S3Client (forcePathStyle: true), all 10 tests GREEN
- Extended Prisma Media model with companyId, width, height, format, tags + MediaVariant + MediaProcessingJob
- Wired UploadFactory `case 's3'` to MinioStorage with MINIO_* env vars
- Defined PLATFORM_MEDIA_SPECS and PLATFORM_VARIANT_SPECS for all 4 MVP platforms

## Task Commits

Each task was committed atomically:

1. **Task 1: Extension scaffold, type contracts, platform specs, and Prisma schema** - `ca60cbe3` (feat)
2. **Task 2: MinioStorage provider and UploadFactory wiring** - `50ed2abf` (feat)

_Note: Task 2 followed TDD RED/GREEN cycle (tests written before implementation)_

## Files Created/Modified

- `extensions/media-library/package.json` - @social/media-library package definition
- `extensions/media-library/tsconfig.json` - TypeScript config (multer types included)
- `extensions/media-library/tsconfig.spec.json` - Jest TypeScript config (multer + jest types)
- `extensions/media-library/jest.config.ts` - ts-jest config mirroring ai-service
- `extensions/media-library/src/index.ts` - Public API: re-exports types, platform-specs, minio.storage
- `extensions/media-library/src/types.ts` - MediaUploadResult, VariantSpec, VariantResult, PlatformValidationResult, MediaProcessingJobStatus
- `extensions/media-library/src/storage/minio.storage.ts` - MinioStorage implementing IUploadProvider; uploadBufferToMinio utility
- `extensions/media-library/src/processing/platform-specs.ts` - PLATFORM_MEDIA_SPECS and PLATFORM_VARIANT_SPECS constants
- `extensions/media-library/src/__tests__/minio.storage.spec.ts` - 10 tests covering constructor, uploadFile, uploadSimple, removeFile, uploadBufferToMinio
- `prisma/migrations/20260310100000_media_library/migration.sql` - Manual migration SQL
- `libraries/nestjs-libraries/src/database/prisma/schema.prisma` - Media extensions + MediaVariant + MediaProcessingJob + Company.media relation
- `libraries/nestjs-libraries/src/upload/upload.factory.ts` - Added s3 case with MinioStorage
- `tsconfig.base.json` - @social/media-library path alias
- `.env.example` - MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, MINIO_PUBLIC_URL vars
- `DIVERGENCE.md` - UploadFactory modification documented

## Decisions Made
- **forcePathStyle: true** is critical for MinIO — without it, AWS SDK generates virtual-hosted-style URLs (bucket.endpoint.com) which MinIO doesn't support by default.
- **multer types** needed in both tsconfig files for Express.Multer.File to resolve — added `"multer"` to both tsconfig.json and tsconfig.spec.json types arrays.
- **uploadBufferToMinio** exported as standalone utility — downstream plans (02/03) use it directly to upload thumbnails and variants without going through the full IUploadProvider abstraction.
- **MINIO_* env vars** chosen over reusing S3_* vars — keeps MinIO Phase 4 config distinct from legacy S3 vars already in .env.example.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added multer types to tsconfig.json and tsconfig.spec.json**
- **Found during:** Task 2 (MinioStorage implementation)
- **Issue:** `Express.Multer.File` namespace unresolvable without `@types/multer` in tsconfig types array; tsc reported TS2503 for both the interface and storage files
- **Fix:** Added `"multer"` to `types` array in both `tsconfig.json` and `tsconfig.spec.json`
- **Files modified:** `extensions/media-library/tsconfig.json`, `extensions/media-library/tsconfig.spec.json`
- **Verification:** `npx tsc --noEmit` passes clean after fix
- **Committed in:** `50ed2abf` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical — type configuration)
**Impact on plan:** Essential for TypeScript compilation correctness. No scope creep.

## Issues Encountered
- Jest `--testPathPattern` flag conflicted with `--passWithNoTests` when passed as positional args — resolved by using `npx jest --config jest.config.ts "pattern"` directly.
- Pre-existing Plan 02 test stub files (`company-media.repository.spec.ts`, `company-media.service.spec.ts`) were present in the repository but not staged — correctly excluded from this plan's commits.

## User Setup Required
None - no external service configuration required beyond setting MINIO_* env vars when using `STORAGE_PROVIDER=s3`.

## Next Phase Readiness
- MinioStorage ready: Plan 02 can use `uploadBufferToMinio` directly with the MinioStorage client
- Prisma schema ready: MediaVariant and MediaProcessingJob tables will be available after migration
- Platform specs ready: Plan 03 variant generation can import PLATFORM_VARIANT_SPECS directly
- All type contracts exported: downstream plans can import from `@social/media-library`

---
*Phase: 04-media-library-processing*
*Completed: 2026-03-10*
