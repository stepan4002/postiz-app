/**
 * @social/media-library — Public API
 *
 * Storage providers, type contracts, platform specifications,
 * and NestJS module for the Social Command Centre media processing pipeline.
 */

// NestJS module (Phase 4 Plan 04)
export { MediaLibraryModule } from './media-library.module';

// Type contracts (used across all media plans)
export * from './types';

// Platform dimension specifications and variant maps
export * from './processing/platform-specs';

// MinIO storage provider (wired in UploadFactory as STORAGE_PROVIDER=s3)
export * from './storage/minio.storage';

// Services (for external consumers: Phase 5/6)
export { CompanyMediaService } from './media/company-media.service';
export { CompanyMediaController } from './media/company-media.controller';
export { CompanyMediaRepository } from './media/company-media.repository';
export { MediaProcessingService } from './processing/media-processing.service';
export { MediaProcessingJob } from './processing/media-processing.job';
export { PlatformMediaValidator } from './processing/platform-media-validator';
