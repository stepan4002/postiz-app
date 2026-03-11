---
phase: 04-media-library-processing
plan: 02
subsystem: api
tags: [nestjs, prisma, sharp, minio, s3, image-processing, media-library, tdd]

# Dependency graph
requires:
  - phase: 04-01
    provides: MinioStorage, types.ts, platform-specs.ts, Prisma schema with MediaVariant + MediaProcessingJob

provides:
  - CompanyMediaRepository — Prisma DB layer with company-scoped queries (companyId isolation contract)
  - CompanyMediaService — upload pipeline: sharp metadata + 300x300 thumbnail + MinIO upload + DB record
  - CompanyMediaController — 5 REST endpoints at /companies/:companySlug/media
  - UploadMediaDto and ListMediaQueryDto for request validation
  - Company isolation contract: findByCompany(companyId) never returns other company records

affects:
  - 04-03-processing (uses repository for cron job queue + service for variant storage)
  - 04-04-module-wiring (imports controller, service, repository into MediaLibraryModule)
  - 05-content-generation (media upload as input to AI caption generation)

# Tech tracking
tech-stack:
  added: [uuid (v4), sharp (metadata extraction + thumbnail), class-validator, class-transformer]
  patterns:
    - TDD with RED (failing tests) -> GREEN (implementation) -> verify cycle
    - Controller resolves slug to ID; service works with IDs only
    - memoryStorage() for multer to populate file.buffer for sharp
    - Separate uploadBufferToMinio utility for direct buffer uploads
    - Repository pattern with explicit companyId parameter (isolation is explicit + testable)

key-files:
  created:
    - extensions/media-library/src/media/company-media.repository.ts
    - extensions/media-library/src/media/company-media.service.ts
    - extensions/media-library/src/media/company-media.controller.ts
    - extensions/media-library/src/media/dtos/upload-media.dto.ts
    - extensions/media-library/src/media/dtos/list-media-query.dto.ts
    - extensions/media-library/src/__tests__/company-media.repository.spec.ts
    - extensions/media-library/src/__tests__/company-media.service.spec.ts
  modified:
    - extensions/media-library/src/index.ts (added MinioStorage export)

key-decisions:
  - "uuid v4 used to pre-generate mediaId before DB insert — allows MinIO path to include mediaId prefix without two-step create"
  - "S3Client created inline in uploadAndRecord (not injected) to allow direct mocking via jest.mock in tests"
  - "Controller accepts any prisma (typed as any) consistent with Phase 2 OAuthBrandController pattern"
  - "Repository receives prisma directly as constructor arg (not via NestJS injection decorator) to simplify unit testing"

patterns-established:
  - "Company isolation: findByCompany always filters WHERE companyId = ? AND deletedAt IS NULL"
  - "Tag filtering via Prisma { has: tag } operator on String[] (PostgreSQL array contains)"
  - "Thumbnail path convention: {companyId}/{mediaId}/thumb_{originalname}.jpg"
  - "Original path convention: {companyId}/{mediaId}/{originalname}"
  - "Soft-delete via deletedAt timestamp — never hard delete media records"

requirements-completed: [R7.3, R7.4, R7.5]

# Metrics
duration: 25min
completed: 2026-03-10
---

# Phase 4 Plan 02: Company Media Upload Pipeline Summary

**Company-scoped media upload pipeline with sharp thumbnail generation (300x300 JPEG), metadata extraction, MinIO buffer upload, and Prisma repository with isolation-tested companyId scoping**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-10T19:20:56Z
- **Completed:** 2026-03-10T19:45:00Z
- **Tasks:** 2 (TDD Task 1 + Controller Task 2)
- **Files modified:** 8

## Accomplishments
- CompanyMediaRepository with companyId isolation contract — 12 unit tests verify Company A never returns Company B data, tag filtering uses Prisma `{ has: tag }`, pagination with skip/take
- CompanyMediaService upload pipeline: sharp extracts width/height/format, thumbnail generated at 300x300 max JPEG with `fit: inside`, originals and thumbnails uploaded to MinIO via uploadBufferToMinio utility
- CompanyMediaController with 5 endpoints: POST upload, GET list, GET single, DELETE, POST process — controller resolves companySlug to companyId, services receive IDs only
- 32 tests passing (11 minio.storage + 12 repository + 9 service)
- TypeScript compiles clean with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: CompanyMediaRepository and CompanyMediaService with thumbnail + metadata** - `a719823b` (feat)
   (Also includes Task 2 controller and DTOs — committed together as one atomic unit)

**Plan metadata:** (committed in final docs commit)

_Note: TDD pattern applied — tests written before implementation, confirmed RED before GREEN_

## Files Created/Modified
- `extensions/media-library/src/media/company-media.repository.ts` - Prisma DB layer; createMedia, findByCompany (company-scoped + tag filter), findById (with variants), deleteMedia (soft), createProcessingJob
- `extensions/media-library/src/media/company-media.service.ts` - Upload pipeline: sharp metadata → thumbnail → uploadBufferToMinio (original + thumb) → createMedia
- `extensions/media-library/src/media/company-media.controller.ts` - REST controller with slug resolution, 5 endpoints
- `extensions/media-library/src/media/dtos/upload-media.dto.ts` - UploadMediaDto: tags (string[], optional), alt (string, optional)
- `extensions/media-library/src/media/dtos/list-media-query.dto.ts` - ListMediaQueryDto: page (default 1), limit (default 20, max 100), tag (optional)
- `extensions/media-library/src/__tests__/company-media.repository.spec.ts` - 12 tests: isolation, pagination, tag filter, soft-delete, processing job
- `extensions/media-library/src/__tests__/company-media.service.spec.ts` - 9 tests: metadata extraction, thumbnail (300x300 inside), upload paths, DB record, delegate methods
- `extensions/media-library/src/index.ts` - Added MinioStorage export

## Decisions Made
- **uuid pre-generation:** Used `uuidv4()` to generate mediaId before DB insert so the MinIO key `{companyId}/{mediaId}/{filename}` can be set atomically without a two-step create-then-update flow
- **S3Client inline in service:** Created S3Client inside uploadAndRecord rather than injecting it — allows jest.mock to intercept `uploadBufferToMinio` cleanly in tests
- **Prisma typed as `any` in repository constructor:** Avoids importing Prisma generated types into extension package; consistent with Phase 2 pattern (OAuthBrandController uses `this.prisma as any`)
- **Repository constructor injection for testing:** Repository takes prisma as constructor argument (not via `@InjectPrisma()` decorator) so tests can pass a mock directly without NestJS Test module overhead

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 01 incomplete — MinioStorage and UploadFactory s3 case were committed but extension scaffold had no minio.storage.ts in storage/ dir**
- **Found during:** Initial setup for Task 1
- **Issue:** `extensions/media-library/src/storage/` directory existed but was empty per git status; the minio.storage.spec.ts was failing with "Cannot find module '../storage/minio.storage'"
- **Fix:** Verified minio.storage.ts existed (from prior commit 50ed2abf) — the ls check was a false alarm; storage dir had the file
- **Files modified:** None — already present
- **Committed in:** 50ed2abf (Plan 01 Task 2 commit, pre-existing)

**2. [Rule 3 - Blocking] service.spec.ts needed MinioConfig interface defined in service module**
- **Found during:** Writing company-media.service.spec.ts
- **Issue:** Service constructor took a MinioConfig object but no interface was defined for tests to instantiate it
- **Fix:** Added `MinioConfig` interface export to company-media.service.ts
- **Files modified:** extensions/media-library/src/media/company-media.service.ts
- **Verification:** TypeScript compilation clean
- **Committed in:** a719823b

---

**Total deviations:** 2 (1 false alarm, 1 missing interface)
**Impact on plan:** Minimal — both resolved immediately, no scope creep.

## Issues Encountered
- Windows path separator issue with `--testPathPattern` on Jest: patterns with `company-media` did not match because Windows uses backslash in paths. Worked around by running `pnpm test` without pattern filter for the verify step.
- Plan 01's committed files included the scaffold but the git staging state showed files as untracked — this was normal Windows git state; the files were there from two prior commits.

## User Setup Required
MinIO environment variables required in `.env`:
```
STORAGE_PROVIDER=s3
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=postiz-media
MINIO_PUBLIC_URL=http://localhost:9000/postiz-media
```
These are already in `.env.example` from Plan 01.

## Next Phase Readiness
- Plan 03 (media processing worker) can import CompanyMediaRepository for cron job queue
- Plan 04 (module wiring) needs to register CompanyMediaController + CompanyMediaService + CompanyMediaRepository in MediaLibraryModule
- Controller endpoints ready for frontend integration (Plan 04)

---
*Phase: 04-media-library-processing*
*Completed: 2026-03-10*
