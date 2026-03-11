# Phase 4: Media Library & Processing - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-company media library with upload to MinIO, thumbnail generation, folder-like organization via tags, media metadata extraction, platform-specific image resize via BullMQ worker, and platform media validation service. Media reuse across brands within the same company. Async processing — never blocks web requests (except lightweight thumbnail generation on upload).

</domain>

<decisions>
## Implementation Decisions

### MinIO Storage Integration
- Add MinIO/S3-compatible provider to existing `UploadFactory` using AWS S3 SDK (`@aws-sdk/client-s3`)
- MinIO is S3-compatible — use standard S3 SDK, not a MinIO-specific library
- Storage path convention: `{companyId}/{mediaId}/{filename}` — flat structure, no nested directories in object storage
- MinIO already in Docker Compose from Phase 1 — no new infrastructure needed
- Keep existing `local` and `cloudflare` providers working — MinIO is a new `s3` case in `UploadFactory`
- Frontend Uppy upload: use S3 multipart upload path (already exists for cloudflare) pointing to MinIO

### Folder Organization
- Virtual folders via tags/labels on Media records, not actual filesystem directories in MinIO
- MinIO stores objects in flat paths with company prefix — no nested "folders" in object storage
- Frontend presents a folder-like view (campaign, season, product, uncategorized) using tag filters
- Tags are free-form strings on Media model — operator can create any tag
- Default tags seeded: "campaign", "season", "product", "brand-asset", "uncategorized"

### Thumbnail Generation
- Use `sharp` (Node.js native image processing) for thumbnail generation
- Thumbnail generated synchronously on upload (sharp is fast, ~50-100ms for a thumbnail)
- Thumbnail dimensions: 300x300 max, preserve aspect ratio, JPEG format
- Thumbnail stored in MinIO at `{companyId}/{mediaId}/thumb_{filename}.jpg`
- Thumbnail path saved in existing `thumbnail` field on Media model

### Media Metadata Extraction
- Extract metadata via `sharp` on upload: width, height, format, file size (already in model)
- Extend Media Prisma model with: `width` (Int?), `height` (Int?), `format` (String?), `tags` (String[])
- Add `companyId` (String) to Media model — company-scoped media library
- Video metadata extraction deferred — Phase 4 focuses on images; video processing is a future concern

### Platform-Specific Resize Worker
- New `media-processing` BullMQ queue in extension zone
- Worker receives: mediaId, target platforms array
- Generates platform-specific variants using `sharp`:
  - Instagram: 1080x1080 (square), 1080x1350 (portrait), 1080x566 (landscape)
  - Facebook: 1200x630
  - LinkedIn: 1200x627
  - X: 1200x675
- Variants stored in MinIO at `{companyId}/{mediaId}/variants/{platform}_{width}x{height}.{ext}`
- New `MediaVariant` Prisma model: mediaId, platform, width, height, path, fileSize
- Processing triggered when operator selects target platforms for a post (Phase 5 will call this)
- Also available as manual "generate variants" action from media library UI

### Media Reuse Policy
- Media is company-scoped, not brand-scoped — any brand within a company can use any media
- This aligns with real-world usage: a company's product photos shared across brand accounts
- Media picker component reusable across post creation flows

### Platform Media Validation
- Validation service checks processed variants against platform requirements before publish
- Checks: dimensions match platform specs, file size within limits, format supported
- Returns structured result: pass/fail per platform + specific failure reasons
- Called by Phase 6 publishing engine — this phase just builds the validation logic
- Platform specs stored as a configuration object (not DB) — easy to update when platforms change requirements

### Claude's Discretion
- Exact sharp configuration options (quality, compression settings)
- BullMQ job retry/timeout configuration for media processing
- Media list pagination strategy (offset vs cursor)
- Frontend media library UI layout and component structure
- Error handling for corrupt/unsupported file uploads
- Whether to add a media preview/lightbox component

</decisions>

<specifics>
## Specific Ideas

No specific requirements — auto-mode. Key constraints from prior phases and project context:

- Extension zone architecture: custom code in `extensions/`, upstream files modified minimally (DIVERGENCE.md tracking)
- Existing Media model has: name, path, organizationId, fileSize, type, thumbnail, alt — needs extending
- Existing MediaController/MediaService/MediaRepository follows Controller->Service->Repository pattern
- UploadFactory pattern: factory creates storage provider based on env var — add S3/MinIO case
- Uppy frontend upload already supports S3 multipart — can be reused for MinIO
- BullMQ already in use for background jobs — add new queue for media processing
- Company scoping: explicit companyId parameter pattern (Phase 1 decision)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Media` Prisma model (schema.prisma:317): name, path, organizationId, fileSize, type, thumbnail, alt — extend with width, height, format, tags, companyId
- `MediaController` (apps/backend/src/api/routes/media.controller.ts): upload, delete, get endpoints — wrap or extend for company-scoped operations
- `MediaService` (libraries/nestjs-libraries/src/database/prisma/media/media.service.ts): saveFile, getMedia, deleteMedia — reuse patterns
- `MediaRepository` (libraries/nestjs-libraries/src/database/prisma/media/media.repository.ts): DB layer for media operations
- `UploadFactory` (libraries/nestjs-libraries/src/upload/upload.factory.ts): supports local/cloudflare — add MinIO/S3
- `IUploadProvider` interface (libraries/nestjs-libraries/src/upload/upload.interface.ts): uploadSimple, uploadFile, removeFile
- Uppy upload helper (libraries/react-shared-libraries/src/helpers/uppy.upload.ts): S3 multipart already implemented for cloudflare
- `SaveMediaInformationDto` (libraries/nestjs-libraries/src/dtos/media/save.media.information.dto.ts): existing DTO for media info
- Extension packages: `extensions/company-context`, `extensions/multi-company`, `extensions/credential-management`, `extensions/ai-service`

### Established Patterns
- NestJS module registration in AppModule
- Controller -> Service -> Repository layering (no shortcuts)
- Prisma as ORM with PrismaRepository pattern
- Extension packages use `@social/*` path aliases via tsconfig.base.json
- Interface injection for cross-package deps (Phase 2 pattern)
- Environment variable guards (ENCRYPTION_KEY, RUN_CRON patterns)
- BullMQ for background job processing (used in existing Postiz code)
- `GetOrgFromRequest()` decorator for org-scoped requests

### Integration Points
- Media model: needs `companyId` FK added (company-scoped media)
- UploadFactory: add MinIO/S3 case for `STORAGE_PROVIDER=s3`
- Docker Compose: MinIO service already present from Phase 1
- Phase 5 (Content Generation): will use media library for input workflow (upload media -> AI generates captions)
- Phase 6 (Publishing): will call platform validation service before publishing
- Frontend: media library page exists at org level — needs company-scoped version

</code_context>

<deferred>
## Deferred Ideas

- Video processing (clip long videos to shorts, add subtitles) — separate phase or Milestone 2
- Logo overlay on images — future enhancement
- Carousel/quote card generation — future enhancement
- AI-powered auto-tagging of uploaded media — could leverage Phase 3 AI service, but not in Phase 4 scope
- Media CDN/caching layer — production optimization, Phase 8 concern

</deferred>

---

*Phase: 04-media-library-processing*
*Context gathered: 2026-03-10*
