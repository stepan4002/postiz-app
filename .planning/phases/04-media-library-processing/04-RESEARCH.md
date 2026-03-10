# Phase 4: Media Library & Processing - Research

**Researched:** 2026-03-10
**Domain:** MinIO S3 storage, sharp image processing, async background jobs (Temporal/Cron), Prisma schema extension, NestJS extension zone
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**MinIO Storage Integration:**
- Add MinIO/S3-compatible provider to existing `UploadFactory` using `@aws-sdk/client-s3` (already in root `package.json`)
- MinIO is S3-compatible — use standard S3 SDK, not a MinIO-specific library
- Storage path convention: `{companyId}/{mediaId}/{filename}` — flat structure in object storage
- MinIO already in Docker Compose from Phase 1 — no new infrastructure needed
- Keep existing `local` and `cloudflare` providers working — add new `s3` case in `UploadFactory`
- Frontend Uppy upload: use S3 multipart upload path (already exists for cloudflare) pointing to MinIO

**Folder Organization:**
- Virtual folders via tags/labels on Media records, not actual filesystem directories in MinIO
- Tags are free-form strings on Media model
- Default tags seeded: "campaign", "season", "product", "brand-asset", "uncategorized"

**Thumbnail Generation:**
- Use `sharp` (^0.33.4, already in `package.json`) for thumbnail generation
- Thumbnail generated synchronously on upload (sharp is fast, ~50-100ms)
- Thumbnail dimensions: 300x300 max, preserve aspect ratio, JPEG format
- Stored at `{companyId}/{mediaId}/thumb_{filename}.jpg`
- Thumbnail path saved in existing `thumbnail` field on Media model

**Media Metadata Extraction:**
- Extract via `sharp` on upload: width, height, format, file size
- Extend Media Prisma model with: `width` (Int?), `height` (Int?), `format` (String?), `tags` (String[])
- Add `companyId` (String) to Media model — company-scoped media library
- Video metadata extraction deferred — Phase 4 images only

**Platform-Specific Resize Worker:**
- New `media-processing` background job queue
- Worker receives: mediaId, target platforms array
- Platform variants via `sharp`:
  - Instagram: 1080x1080 (square), 1080x1350 (portrait), 1080x566 (landscape)
  - Facebook: 1200x630
  - LinkedIn: 1200x627
  - X: 1200x675
- Variants stored at `{companyId}/{mediaId}/variants/{platform}_{width}x{height}.{ext}`
- New `MediaVariant` Prisma model: mediaId, platform, width, height, path, fileSize
- Triggered when operator selects target platforms or via "generate variants" action

**Media Reuse Policy:**
- Company-scoped, not brand-scoped — any brand within a company can use any media

**Platform Media Validation:**
- Validation service checks variants against platform requirements
- Returns structured result: pass/fail per platform + specific failure reasons
- Platform specs stored as a configuration object (not DB)
- Called by Phase 6 publishing engine

### Claude's Discretion
- Exact sharp configuration options (quality, compression settings)
- Background job mechanism for media processing (see critical finding below)
- Media list pagination strategy (offset vs cursor)
- Frontend media library UI layout and component structure
- Error handling for corrupt/unsupported file uploads
- Whether to add a media preview/lightbox component
- BullMQ job retry/timeout configuration (NOTE: BullMQ is not in this codebase — see critical finding)

### Deferred Ideas (OUT OF SCOPE)
- Video processing (clip long videos to shorts, add subtitles) — Milestone 2
- Logo overlay on images
- Carousel/quote card generation
- AI-powered auto-tagging
- Media CDN/caching layer — Phase 8
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| R7.1 | Per-company media library with folder hierarchy (campaign, season, product) | Virtual folders via `tags` String[] on Media model; company-scoped via `companyId` FK |
| R7.2 | Upload images and videos to MinIO (S3-compatible) storage | `@aws-sdk/client-s3` already in root package.json; add `s3` case to `UploadFactory` |
| R7.3 | Thumbnail generation on upload | `sharp` ^0.33.4 already in package.json; synchronous on upload path |
| R7.4 | Media reuse across posts within same company | company-scoped Media model; MediaPicker component shared across post creation flows |
| R7.5 | Media metadata: dimensions, format, file size, upload date, tags | Extend Media model with width, height, format, tags; extracted by sharp on upload |
| R8.1 | Image resize per platform specifications | sharp.resize() with platform-specific dimensions; MediaVariant model stores each variant |
| R8.2 | Processing runs as async background job (not in request thread) | Use `@nestjs/schedule` Cron or Temporal workflow in orchestrator (see critical finding) |
| R8.3 | Processed variants stored alongside originals in MinIO | MinIO path: `{companyId}/{mediaId}/variants/{platform}_{w}x{h}.{ext}` |
| R8.4 | Platform media validation before publish | PlatformMediaValidator service with spec config object; called by Phase 6 |
| NF2.2 | Separate queue workers: media processing isolated from other workers | Separate worker/activity for media processing vs publishing/AI |
| NF3.3 | Media processing async (never blocks web requests) | Processing triggered after upload returns; no blocking in controller |
</phase_requirements>

---

## Summary

Phase 4 builds a company-scoped media library on top of MinIO object storage, extending the existing `Media` Prisma model and `UploadFactory` pattern with a new `s3` provider. All core libraries are already in the root `package.json`: `@aws-sdk/client-s3` (^3.787.0, used for Cloudflare R2), `sharp` (^0.33.4, used in posts.service.ts), and `@uppy/aws-s3` (^4.1.0, used for multipart uploads). The new MinIO provider is simply a new switch case in `UploadFactory` using the same `S3Client` pattern as `CloudflareStorage`.

**Critical Finding — Background Job Mechanism:** The CONTEXT.md mentions "BullMQ queue" but BullMQ is **not in this codebase**. The project uses Temporal (via `nestjs-temporal-core`) for all background workflows, with `@nestjs/schedule` Cron decorators for periodic jobs in extension packages. The dev Docker Compose deliberately excludes Temporal (Phase 6 introduces it). For media processing, the pattern is: (1) for the dev/extension zone use `@nestjs/schedule` Cron polling OR (2) add a Temporal workflow + activity in the orchestrator. Given Phase 4 operates pre-Temporal (dev compose has no Temporal), use an in-process `@nestjs/schedule` CronJob or setInterval approach that polls a DB queue table, or directly add a Temporal workflow in the orchestrator app (which is already a separate service but excluded from dev-only compose). Recommendation: use a lightweight DB-backed job queue via Prisma + `@nestjs/schedule` polling — consistent with how Phase 2 handled cron jobs.

**Primary recommendation:** Add `MinioStorage` provider to `UploadFactory`, extend Media model with 5 fields, add `MediaVariant` model, and implement image processing as `@nestjs/schedule` Cron jobs polling a `MediaProcessingJob` DB table — matching the extension zone pattern from Phase 2.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@aws-sdk/client-s3` | ^3.787.0 | MinIO/S3 PUT/DELETE/presigned operations | Already in root package.json; used by Cloudflare R2 storage; S3-compatible with MinIO |
| `@aws-sdk/s3-request-presigner` | ^3.787.0 | Presigned upload URLs for Uppy multipart | Already in root package.json; required for client-side multipart upload |
| `sharp` | ^0.33.4 | Thumbnail generation, resize, metadata extraction | Already in root package.json and used in posts.service.ts |
| `@uppy/aws-s3` | ^4.1.0 | Frontend multipart upload to MinIO via S3 API | Already used for Cloudflare R2 multipart uploads in uppy.upload.ts |
| `@nestjs/schedule` | ^4.0.0 | Cron jobs for async media processing worker | Already used in CredentialManagementModule; matches extension zone pattern |
| `class-validator` | ^0.14.1 | DTO validation | Standard throughout project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `mime-types` | ^2.1.35 | Content-Type detection for S3 upload | Already in package.json |
| `mime` | ^3.0.0 | Extension-from-MIME lookup | Already used in cloudflare.storage.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@nestjs/schedule` cron poll | Temporal workflow | Temporal is excluded from dev compose until Phase 6; Cron is simpler and consistent with Phase 2 |
| DB-backed job queue | BullMQ | BullMQ not in codebase at all; Redis is available but adding BullMQ is an unnecessary new dependency |
| `@nestjs/schedule` | Temporal `media-processing` activity | Correct long-term pattern but requires dev compose change; add as Temporal activity in Phase 6 refactor |

**Installation:** No new installations needed — all dependencies are in root `package.json`. Extension package `package.json` only needs NestJS common/core.

---

## Architecture Patterns

### Extension Package Structure
```
extensions/media-library/
├── package.json               # @social/media-library
├── tsconfig.json              # extends ../../tsconfig.base.json
├── jest.config.ts             # ts-jest pattern from ai-service
└── src/
    ├── index.ts               # exports MediaLibraryModule
    ├── media-library.module.ts
    ├── storage/
    │   └── minio.storage.ts   # MinioStorage implements IUploadProvider
    ├── media/
    │   ├── company-media.controller.ts   # company-scoped media endpoints
    │   ├── company-media.service.ts      # upload + thumbnail + metadata
    │   └── company-media.repository.ts   # DB layer, company-scoped queries
    ├── processing/
    │   ├── media-processing.job.ts       # @Cron job that polls for pending jobs
    │   ├── media-processing.service.ts   # sharp resize logic + variant storage
    │   └── platform-media-validator.ts   # static validation against platform specs
    └── __tests__/
        ├── minio.storage.spec.ts
        ├── media-processing.service.spec.ts
        └── platform-media-validator.spec.ts
```

### Pattern 1: MinIO Storage Provider (extends UploadFactory)

**What:** New `MinioStorage` class implementing `IUploadProvider` interface, wired into `UploadFactory.createStorage()` as `case 's3'`.

**When to use:** `STORAGE_PROVIDER=s3` environment variable.

**Key difference from CloudflareStorage:** MinIO endpoint is `http://localhost:9000` (configurable), not `https://accountId.r2.cloudflarestorage.com`. Also no ACL header in MinIO default config.

```typescript
// Source: CloudflareStorage pattern in libraries/nestjs-libraries/src/upload/cloudflare.storage.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { IUploadProvider } from './upload.interface';
import mime from 'mime-types';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';

export class MinioStorage implements IUploadProvider {
  private _client: S3Client;

  constructor(
    private endpoint: string,        // http://localhost:9000
    private accessKeyId: string,
    private secretAccessKey: string,
    private bucketName: string,
    private publicUrl: string        // http://localhost:9000/postiz-media
  ) {
    this._client = new S3Client({
      endpoint,
      region: 'us-east-1',           // MinIO ignores region, but SDK requires it
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,           // CRITICAL: MinIO requires path-style, not virtual-hosted
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<any> {
    const id = makeId(10);
    const extension = mime.extension(file.mimetype) || 'bin';
    const key = `${id}.${extension}`;

    await this._client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    return {
      filename: key,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer,
      originalname: key,
      fieldname: 'file',
      path: `${this.publicUrl}/${key}`,
      destination: `${this.publicUrl}/${key}`,
    };
  }

  async uploadSimple(path: string): Promise<string> { /* same pattern as CloudflareStorage */ }
  async removeFile(filePath: string): Promise<void> { /* DeleteObjectCommand */ }
}
```

**CRITICAL:** `forcePathStyle: true` is mandatory for MinIO. Without it, the SDK will construct virtual-hosted URLs (`bucketname.localhost:9000`) which MinIO does not support.

### Pattern 2: Sharp Thumbnail + Metadata Extraction

**What:** Run sharp on the uploaded file buffer synchronously during the upload request handler. Generate thumbnail and extract image metadata in one pipeline pass.

**When to use:** Every image upload (JPEG, PNG, WebP, GIF).

```typescript
// Source: sharp usage pattern from posts.service.ts + sharp 0.33 docs
import sharp from 'sharp';

export async function extractMetadataAndGenerateThumbnail(
  buffer: Buffer,
  mimeType: string
): Promise<{ width: number; height: number; format: string; thumbBuffer: Buffer }> {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  const thumbBuffer = await sharp(buffer)
    .resize(300, 300, {
      fit: 'inside',       // preserve aspect ratio, never upscale beyond 300x300
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();

  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: metadata.format ?? mimeType,
    thumbBuffer,
  };
}
```

### Pattern 3: Company-Scoped Media Upload Endpoint

**What:** New controller at `/api/companies/:companySlug/media` following the Controller -> Service -> Repository layering. Wraps the existing upload mechanics with company context.

**Key difference from existing MediaController:** scoped to `companyId` (not `organizationId`). Both fields exist in separate records — the extension uses `companyId` FK which was added in Phase 1.

```typescript
// Extension zone controller pattern (from OAuthBrandController in Phase 2)
@Controller('/companies/:companySlug/media')
export class CompanyMediaController {
  constructor(
    private _companyMediaService: CompanyMediaService
  ) {}

  @Post('/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(
    @Param('companySlug') companySlug: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this._companyMediaService.uploadAndRecord(companySlug, file);
  }

  @Get('/')
  listMedia(
    @Param('companySlug') companySlug: string,
    @Query('page') page: number,
    @Query('tag') tag?: string
  ) {
    return this._companyMediaService.listMedia(companySlug, page, tag);
  }

  @Post('/:mediaId/process')
  triggerVariants(
    @Param('companySlug') companySlug: string,
    @Param('mediaId') mediaId: string,
    @Body('platforms') platforms: string[]
  ) {
    return this._companyMediaService.queueVariantGeneration(mediaId, platforms);
  }
}
```

### Pattern 4: Async Processing via DB Queue + @Cron

**What:** Rather than BullMQ (not in codebase), use a `MediaProcessingJob` Prisma model as a lightweight job queue. A `@Cron` job polls for pending jobs every 30 seconds and processes them.

**Why:** Consistent with Phase 2 credential refresh pattern. No new infrastructure. Redis is available but adding BullMQ introduces a new dependency not currently in the project.

```typescript
// Pattern: @Cron job polling DB queue (similar to TokenRefreshJob in credential-management)
// Source: Phase 2 token.refresh.job.ts pattern
@Injectable()
export class MediaProcessingJob {
  private readonly logger = new Logger(MediaProcessingJob.name);

  constructor(
    private readonly _processingService: MediaProcessingService,
    private readonly _repository: CompanyMediaRepository
  ) {}

  @Cron('*/30 * * * * *')  // every 30 seconds
  async processPendingJobs() {
    if (!process.env.RUN_CRON) return;   // guard: only runs in worker context

    const pending = await this._repository.findPendingProcessingJobs(5);
    for (const job of pending) {
      await this._repository.markJobProcessing(job.id);
      try {
        await this._processingService.generateVariants(job.mediaId, job.platforms);
        await this._repository.markJobCompleted(job.id);
      } catch (err) {
        this.logger.error(`Media processing failed for job ${job.id}`, err);
        await this._repository.markJobFailed(job.id, err.message);
      }
    }
  }
}
```

### Pattern 5: Platform Media Validation Service

**What:** Pure service (no DB) that validates variant dimensions, file size, and format against a static platform spec object.

```typescript
// Platform specs as a constant config object (not DB) — easy to update
export const PLATFORM_MEDIA_SPECS = {
  instagram: {
    square:    { width: 1080, height: 1080, maxFileSizeBytes: 8_388_608, formats: ['jpeg', 'jpg', 'png'] },
    portrait:  { width: 1080, height: 1350, maxFileSizeBytes: 8_388_608, formats: ['jpeg', 'jpg', 'png'] },
    landscape: { width: 1080, height: 566,  maxFileSizeBytes: 8_388_608, formats: ['jpeg', 'jpg', 'png'] },
  },
  facebook:  { width: 1200, height: 630,  maxFileSizeBytes: 4_194_304, formats: ['jpeg', 'jpg', 'png'] },
  linkedin:  { width: 1200, height: 627,  maxFileSizeBytes: 5_242_880, formats: ['jpeg', 'jpg', 'png'] },
  x:         { width: 1200, height: 675,  maxFileSizeBytes: 5_242_880, formats: ['jpeg', 'jpg', 'png'] },
} as const;

export interface PlatformValidationResult {
  platform: string;
  passed: boolean;
  reasons: string[];
}

export class PlatformMediaValidator {
  validate(
    variant: { width: number; height: number; fileSize: number; format: string },
    platform: string
  ): PlatformValidationResult {
    const spec = PLATFORM_MEDIA_SPECS[platform];
    if (!spec) return { platform, passed: false, reasons: [`Unknown platform: ${platform}`] };

    const reasons: string[] = [];
    if (variant.width !== spec.width || variant.height !== spec.height) {
      reasons.push(`Expected ${spec.width}x${spec.height}, got ${variant.width}x${variant.height}`);
    }
    if (variant.fileSize > spec.maxFileSizeBytes) {
      reasons.push(`File too large: ${variant.fileSize} > ${spec.maxFileSizeBytes} bytes`);
    }
    if (!spec.formats.includes(variant.format.toLowerCase())) {
      reasons.push(`Format ${variant.format} not supported for ${platform}`);
    }
    return { platform, passed: reasons.length === 0, reasons };
  }
}
```

### Pattern 6: Prisma Model Extensions

**What:** Extend `Media` model and add `MediaVariant` + `MediaProcessingJob` models in `schema.prisma`.

```prisma
// Extend existing Media model (schema.prisma:317)
// DIVERGENCE.md must record this change
model Media {
  id                 String              @id @default(uuid())
  name               String
  originalName       String?
  path               String
  organizationId     String
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  deletedAt          DateTime?
  fileSize           Int                 @default(0)
  type               String              @default("image")
  thumbnail          String?
  alt                String?
  thumbnailTimestamp Int?
  // Phase 4 additions:
  companyId          String?             // nullable for backward compat with existing records
  width              Int?
  height             Int?
  format             String?
  tags               String[]            @default([])
  organization       Organization        @relation(fields: [organizationId], references: [id])
  company            Company?            @relation(fields: [companyId], references: [id])
  agencies           SocialMediaAgency[]
  userPicture        User[]
  oauthApps          OAuthApp[]
  variants           MediaVariant[]

  @@index([name])
  @@index([organizationId])
  @@index([type])
  @@index([companyId])
  @@index([companyId, createdAt])   // NF3.4 compound index
}

model MediaVariant {
  id           String   @id @default(uuid())
  mediaId      String
  platform     String
  width        Int
  height       Int
  path         String
  fileSize     Int      @default(0)
  createdAt    DateTime @default(now())
  media        Media    @relation(fields: [mediaId], references: [id], onDelete: Cascade)

  @@unique([mediaId, platform, width, height])
  @@index([mediaId])
}

model MediaProcessingJob {
  id        String   @id @default(uuid())
  mediaId   String
  platforms String[]
  status    String   @default("pending")  // pending | processing | completed | failed
  error     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status, createdAt])
}
```

### Pattern 7: Uppy Frontend for MinIO S3 Multipart

**What:** Add `'s3'` case to `getUppyUploadPlugin` using the existing `AwsS3Multipart` plugin. MinIO uses the same S3 multipart protocol as Cloudflare R2.

```typescript
// Source: uppy.upload.ts — the cloudflare case already implements this
// Add 's3' as an alias for 'cloudflare' in uppy.upload.ts OR
// add 's3' case in the switch with identical configuration

case 's3':  // MinIO via S3 multipart
  return {
    plugin: AwsS3Multipart,
    options: {
      shouldUseMultipart: () => true,
      createMultipartUpload: (file) =>
        fetchUploadApiEndpoint(fetch, 'create-multipart-upload', { file }),
      listParts: (file, props) =>
        fetchUploadApiEndpoint(fetch, 'list-parts', { file, ...props }),
      signPart: (file, props) =>
        fetchUploadApiEndpoint(fetch, 'sign-part', { file, ...props }),
      abortMultipartUpload: (file, props) =>
        fetchUploadApiEndpoint(fetch, 'abort-multipart-upload', { file, ...props }),
      completeMultipartUpload: (file, props) =>
        fetchUploadApiEndpoint(fetch, 'complete-multipart-upload', { file, ...props }),
    },
  };
```

### Anti-Patterns to Avoid

- **Using MinIO without `forcePathStyle: true`:** The S3 SDK defaults to virtual-hosted URLs (`bucket.host/key`) which MinIO does not support. Always set `forcePathStyle: true`.
- **Calling sharp for every variant synchronously in the request handler:** Only thumbnail is synchronous. Full variant generation must be async (queued job).
- **Storing tags as a JSON string:** Use Prisma's `String[]` array type (PostgreSQL array). Already used in `BrandVoice.preferredHashtags`.
- **Creating actual MinIO "folders":** MinIO is flat object storage. Use prefix conventions like `{companyId}/{mediaId}/filename` — the `/` in the key name is just naming convention.
- **Skipping `RUN_CRON` guard on Cron jobs:** Without this guard, both backend AND orchestrator would run the same cron job. Follow Phase 2 pattern.
- **Direct BullMQ import:** BullMQ is NOT in this project's dependencies. Do not add it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| S3 object upload | Custom HTTP PUT logic | `@aws-sdk/client-s3` `PutObjectCommand` | SDK handles signing (SigV4), retries, multipart assembly |
| Presigned upload URLs | Custom HMAC signing | `@aws-sdk/s3-request-presigner` `getSignedUrl` | Already in root package.json, used in r2.uploader.ts |
| Image resize | Custom canvas/jimp manipulation | `sharp` | native libvips bindings, 5-10x faster than canvas |
| Metadata extraction | ffprobe or custom parsing | `sharp.metadata()` | Returns width/height/format/density/channels synchronously |
| File type detection | Magic byte parsing | `mime-types`/`mime` | Already in package.json, used throughout codebase |
| MinIO bucket management | Custom REST calls | Run `mc mb` in Docker init or MinIO console | Bucket creation is infrastructure concern, not code |

**Key insight:** Every library needed for this phase is already in `package.json`. Zero new root-level dependencies required.

---

## Common Pitfalls

### Pitfall 1: MinIO `forcePathStyle` Missing
**What goes wrong:** S3Client constructs `http://bucket.localhost:9000/key` — connection refused (MinIO not on that host).
**Why it happens:** AWS SDK defaults to virtual-hosted style for modern S3 compatibility. MinIO only supports path-style by default.
**How to avoid:** Always include `forcePathStyle: true` in `S3Client` constructor config.
**Warning signs:** `ECONNREFUSED` or DNS resolution failures when using MinIO with SDK.

### Pitfall 2: Sharp Binary on Linux vs Windows Dev
**What goes wrong:** `sharp` includes pre-built native binaries. If `pnpm install` was run on Windows but the Docker container is Linux, the binary won't work.
**Why it happens:** Sharp uses platform-specific libvips binaries, not pure JS.
**How to avoid:** In Docker, always run `pnpm install` inside the container. For dev on Windows, this is why Docker-based execution matters. The existing codebase already uses sharp (posts.service.ts) so this is already solved for the running environment.
**Warning signs:** `Error: sharp: Installation error` or `Error: EMFILE: too many open files`.

### Pitfall 3: Media Model `companyId` Nullability
**What goes wrong:** Adding `companyId String` (non-nullable) to existing Media records fails Prisma migration — existing rows have no companyId.
**Why it happens:** PostgreSQL cannot set a NOT NULL column without a default value on existing rows.
**How to avoid:** Add `companyId String?` (nullable). Company-scoped queries use `WHERE companyId = ?`. Existing organizationId-scoped records remain unaffected.
**Warning signs:** Migration fails with `NOT NULL constraint violation` error.

### Pitfall 4: Thumbnail Stored in MinIO but URL Pattern Wrong
**What goes wrong:** Thumbnail URL stored as `http://localhost:9000/bucket/thumb_file.jpg` — this works locally but breaks in production where MinIO is behind a proxy.
**Why it happens:** URL is baked into the DB at upload time.
**How to avoid:** Store the MinIO **key** in thumbnail field (e.g., `{companyId}/{mediaId}/thumb_file.jpg`), not the full URL. Generate the public URL by prepending `MINIO_PUBLIC_URL` at read time.

### Pitfall 5: Processing Job Race Condition
**What goes wrong:** Two `@Cron` instances (if running multiple backend processes) both pick up the same pending job.
**Why it happens:** `findPendingProcessingJobs` + `markJobProcessing` are separate DB operations.
**How to avoid:** Use a Prisma transaction or atomic update: `UPDATE MediaProcessingJob SET status='processing' WHERE status='pending' LIMIT 5 RETURNING *`. Or use optimistic locking with `updatedAt` check. The `RUN_CRON` env guard prevents multiple instances from running cron jobs.

### Pitfall 6: `@UploadedFile()` Buffer is Empty for Large Files
**What goes wrong:** `file.buffer` is undefined when multer uses disk storage instead of memory storage.
**Why it happens:** Multer defaults can be disk-based depending on configuration.
**How to avoid:** Use `FileInterceptor('file', { storage: memoryStorage() })` to ensure buffer is populated. The existing `CustomFileValidationPipe` already handles this — check it before adding new interceptors.

---

## Code Examples

### MinioStorage — Full Implementation Pattern
```typescript
// Source: CloudflareStorage pattern (cloudflare.storage.ts) + AWS SDK docs
// extensions/media-library/src/storage/minio.storage.ts
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IUploadProvider } from '@gitroom/nestjs-libraries/upload/upload.interface';
import mime from 'mime-types';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';

export class MinioStorage implements IUploadProvider {
  private _client: S3Client;

  constructor(
    endpoint: string,           // MINIO_ENDPOINT=http://localhost:9000
    accessKeyId: string,        // MINIO_ACCESS_KEY
    secretAccessKey: string,    // MINIO_SECRET_KEY
    private bucketName: string, // MINIO_BUCKET
    private publicUrl: string   // MINIO_PUBLIC_URL=http://localhost:9000/postiz-media
  ) {
    this._client = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,   // REQUIRED for MinIO
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<any> {
    const id = makeId(10);
    const ext = mime.extension(file.mimetype) || 'bin';
    const key = `${id}.${ext}`;

    await this._client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    return {
      filename: key, mimetype: file.mimetype, size: file.size,
      buffer: file.buffer, originalname: key, fieldname: 'file',
      path: `${this.publicUrl}/${key}`,
      destination: `${this.publicUrl}/${key}`,
    };
  }

  async uploadSimple(path: string): Promise<string> {
    const response = await fetch(path);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const ext = mime.extension(contentType) || 'bin';
    const key = `${makeId(10)}.${ext}`;
    await this._client.send(new PutObjectCommand({
      Bucket: this.bucketName, Key: key,
      Body: Buffer.from(await response.arrayBuffer()),
      ContentType: contentType,
    }));
    return `${this.publicUrl}/${key}`;
  }

  async removeFile(filePath: string): Promise<void> {
    const key = filePath.replace(`${this.publicUrl}/`, '');
    await this._client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }));
  }

  // For Uppy multipart — same interface as r2.uploader.ts
  async createMultipartUpload(key: string, contentType: string) {
    const cmd = new CreateMultipartUploadCommand({
      Bucket: this.bucketName, Key: key, ContentType: contentType,
    });
    return this._client.send(cmd);
  }

  async signPart(key: string, uploadId: string, partNumber: number): Promise<string> {
    const cmd = new UploadPartCommand({
      Bucket: this.bucketName, Key: key,
      UploadId: uploadId, PartNumber: partNumber,
    });
    return getSignedUrl(this._client, cmd, { expiresIn: 3600 });
  }
}
```

### Sharp Variant Generation
```typescript
// Source: sharp 0.33 docs + existing usage in posts.service.ts
import sharp from 'sharp';

export interface VariantSpec {
  platform: string;
  width: number;
  height: number;
}

export async function generateVariant(
  sourceBuffer: Buffer,
  spec: VariantSpec
): Promise<{ buffer: Buffer; width: number; height: number; format: string; fileSize: number }> {
  const outputBuffer = await sharp(sourceBuffer)
    .resize(spec.width, spec.height, {
      fit: 'cover',        // crop to exact dimensions
      position: 'centre',  // center the crop
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  return {
    buffer: outputBuffer,
    width: spec.width,
    height: spec.height,
    format: 'jpeg',
    fileSize: outputBuffer.length,
  };
}
```

### UploadFactory S3 case (upstream file modification)
```typescript
// Modify: libraries/nestjs-libraries/src/upload/upload.factory.ts
// DIVERGENCE.md: add entry for this change
import { MinioStorage } from '@social/media-library';

case 's3':
  return new MinioStorage(
    process.env.MINIO_ENDPOINT!,
    process.env.MINIO_ACCESS_KEY!,
    process.env.MINIO_SECRET_KEY!,
    process.env.MINIO_BUCKET!,
    process.env.MINIO_PUBLIC_URL!
  );
```

### SWR hook for media list (frontend)
```typescript
// Source: CLAUDE.md — use useFetch hook; each SWR in a separate hook
// libraries/helpers pattern: SWR hooks must comply with react-hooks/rules-of-hooks
const useCompanyMedia = (companySlug: string, page: number, tag?: string) => {
  const fetch = useFetch();
  return useSWR(
    `/companies/${companySlug}/media?page=${page}${tag ? `&tag=${tag}` : ''}`,
    fetch
  );
};

// Variant trigger (mutation, not SWR)
const useTriggerVariants = () => {
  const fetch = useFetch();
  return useCallback(async (companySlug: string, mediaId: string, platforms: string[]) => {
    return fetch(`/companies/${companySlug}/media/${mediaId}/process`, {
      method: 'POST',
      body: JSON.stringify({ platforms }),
    });
  }, [fetch]);
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@aws-sdk/client-s3` v2 (aws-sdk) | v3 modular SDK (`@aws-sdk/client-s3`) | AWS SDK v3 released 2020 | Modular imports, smaller bundle size; v3 is already in this codebase |
| MinIO SDK (`minio` npm package) | AWS S3 SDK with `forcePathStyle` | MinIO went S3-compatible in ~2019 | No MinIO-specific SDK needed; standard S3 SDK works |
| sharp v0.32 | sharp v0.33 | Jan 2024 | v0.33 dropped Node.js 14 support; current codebase at ^0.33.4 |
| BullMQ for job queues | Temporal for workflows | Postiz architecture decision | All background jobs in this codebase use Temporal workflows/activities or @nestjs/schedule Cron |

**Deprecated/outdated:**
- `aws-sdk` (v2): Not used in this project; v3 modular packages are used
- `multer`'s `diskStorage`: All uploads use `memoryStorage()` + buffer-based upload; avoids temp file cleanup

---

## Open Questions

1. **MinIO bucket creation at startup**
   - What we know: MinIO bucket must exist before uploads; Docker Compose does not auto-create buckets
   - What's unclear: Should bucket creation be in Docker init scripts, the extension module `onModuleInit`, or documented as a manual step?
   - Recommendation: Add `onModuleInit` in `MediaLibraryModule` that calls `HeadBucketCommand` and then `CreateBucketCommand` if bucket doesn't exist. Safe to run on every start (idempotent).

2. **Company-scoped path vs media ID path in MinIO**
   - What we know: CONTEXT.md says `{companyId}/{mediaId}/{filename}` — but `mediaId` is only known after DB insert
   - What's unclear: Do we generate a UUID client-side before upload, or do a two-step (create DB record first, then upload)?
   - Recommendation: Two-step: (1) create Media DB record with `status='pending'`, get `mediaId`, (2) upload to `{companyId}/{mediaId}/{filename}`, (3) update DB record with path + metadata. Wraps as a service transaction.

3. **Uppy multipart for MinIO: presigned URLs or direct upload?**
   - What we know: Cloudflare R2 uses server-side presigned URL endpoints (`/media/sign-part` etc.) in `r2.uploader.ts`; MinIO supports both
   - What's unclear: Whether to add new multipart endpoints to `CompanyMediaController` or reuse the existing `/media/:endpoint` pattern
   - Recommendation: Add new `/companies/:companySlug/media/multipart/:endpoint` endpoints in the extension controller. Avoids modifying the upstream MediaController.

4. **Background job mechanism — Temporal vs Cron**
   - What we know: Temporal is excluded from dev compose; BullMQ is not in the codebase; Phase 2 used @nestjs/schedule Cron successfully
   - What's unclear: Whether the planner wants to pre-wire Temporal for this phase (adds orchestrator complexity) or use Cron for now
   - Recommendation: Use `@nestjs/schedule` Cron polling DB queue for Phase 4. Note in code comments that this should migrate to a Temporal activity in Phase 6.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 with ts-jest |
| Config file | `extensions/media-library/jest.config.ts` (new — Wave 0) |
| Quick run command | `cd extensions/media-library && pnpm test -- --testPathPattern="spec.ts" --passWithNoTests` |
| Full suite command | `pnpm test --filter @social/media-library` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R7.1 | Company-scoped media list filters by companyId and tag | unit | `pnpm test --testPathPattern="company-media.repository.spec"` | Wave 0 |
| R7.2 | MinioStorage.uploadFile sends PutObjectCommand with correct key | unit | `pnpm test --testPathPattern="minio.storage.spec"` | Wave 0 |
| R7.3 | Thumbnail generated at 300x300 max preserving aspect ratio | unit | `pnpm test --testPathPattern="media-processing.service.spec"` | Wave 0 |
| R7.4 | Media list returns companyId-scoped records only | unit | `pnpm test --testPathPattern="company-media.repository.spec"` | Wave 0 |
| R7.5 | Metadata extracted (width/height/format) saved on Media record | unit | `pnpm test --testPathPattern="company-media.service.spec"` | Wave 0 |
| R8.1 | generateVariant produces correct dimensions per platform spec | unit | `pnpm test --testPathPattern="media-processing.service.spec"` | Wave 0 |
| R8.2 | Upload endpoint returns before variant generation completes | manual | Manual: verify response time < 2s on upload | N/A |
| R8.3 | MediaVariant records created with correct MinIO path | unit | `pnpm test --testPathPattern="media-processing.service.spec"` | Wave 0 |
| R8.4 | PlatformMediaValidator returns pass for correct spec, fail with reasons for wrong dimensions | unit | `pnpm test --testPathPattern="platform-media-validator.spec"` | Wave 0 |
| NF2.2 | MediaProcessingJob cron picks up only pending jobs, marks completed | unit | `pnpm test --testPathPattern="media-processing.job.spec"` | Wave 0 |
| NF3.3 | Verified by R8.2 manual test | manual | See R8.2 | N/A |

### Sampling Rate
- **Per task commit:** `cd extensions/media-library && pnpm test -- --passWithNoTests`
- **Per wave merge:** `pnpm test --filter @social/media-library`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `extensions/media-library/package.json` — new extension package
- [ ] `extensions/media-library/tsconfig.json` — extends ../../tsconfig.base.json
- [ ] `extensions/media-library/tsconfig.spec.json` — for ts-jest
- [ ] `extensions/media-library/jest.config.ts` — mirrors ai-service/jest.config.ts
- [ ] `extensions/media-library/src/__tests__/minio.storage.spec.ts` — covers R7.2
- [ ] `extensions/media-library/src/__tests__/company-media.repository.spec.ts` — covers R7.1, R7.4
- [ ] `extensions/media-library/src/__tests__/company-media.service.spec.ts` — covers R7.5
- [ ] `extensions/media-library/src/__tests__/media-processing.service.spec.ts` — covers R7.3, R8.1, R8.3
- [ ] `extensions/media-library/src/__tests__/platform-media-validator.spec.ts` — covers R8.4
- [ ] `extensions/media-library/src/__tests__/media-processing.job.spec.ts` — covers NF2.2
- [ ] Add `@social/media-library` to `tsconfig.base.json` paths
- [ ] Framework install: already in root `package.json` (jest, ts-jest)

---

## Sources

### Primary (HIGH confidence)
- Verified directly from codebase:
  - `libraries/nestjs-libraries/src/upload/cloudflare.storage.ts` — S3Client pattern with endpoint config
  - `libraries/nestjs-libraries/src/upload/upload.factory.ts` — factory switch pattern
  - `libraries/nestjs-libraries/src/upload/upload.interface.ts` — IUploadProvider interface
  - `libraries/react-shared-libraries/src/helpers/uppy.upload.ts` — Uppy S3 multipart pattern
  - `libraries/nestjs-libraries/src/upload/r2.uploader.ts` — presigned URL endpoints pattern
  - `libraries/nestjs-libraries/src/database/prisma/schema.prisma` — Media model at line 317
  - `libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts` — existing sharp usage
  - `apps/orchestrator/src/app.module.ts` — Temporal (not BullMQ) for background jobs
  - `extensions/credential-management/src/refresh/token.refresh.job.ts` — @Cron pattern in extension zone
  - `package.json` — confirms @aws-sdk/client-s3 ^3.787.0, sharp ^0.33.4, no BullMQ
  - `docker/docker-compose.dev.yaml` — MinIO at port 9000/9001, no Temporal

### Secondary (MEDIUM confidence)
- MinIO S3 compatibility and `forcePathStyle` requirement: well-documented MinIO pattern, cross-referenced with the cloudflare.storage.ts S3Client config in codebase

### Tertiary (LOW confidence)
- Platform media specs (Instagram 1080x1080, Facebook 1200x630, etc.): from CONTEXT.md which cites platform requirements. Platform specs change; these should be validated against current platform documentation before Phase 6 (publishing) integration.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in root package.json; cloudflare.storage.ts provides exact pattern to follow
- Architecture: HIGH — MinioStorage pattern is a direct analog of CloudflareStorage; extension zone structure matches established phases
- Pitfalls: HIGH — forcePathStyle is a documented MinIO requirement; nullability and race conditions are well-understood Prisma/PostgreSQL concerns
- Background job mechanism: MEDIUM — Cron pattern confirmed from Phase 2; BullMQ absence confirmed; Temporal architecture confirmed; recommendation is a judgment call on implementation approach

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (30 days; stable libraries)

**Key divergence finding:** BullMQ is NOT in this codebase. CONTEXT.md's reference to "BullMQ queue" should be interpreted as "async background job queue" — implement as `@nestjs/schedule` Cron + DB queue table, consistent with Phase 2 pattern and dev compose constraints.
