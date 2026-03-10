/**
 * @social/media-library — Public API
 *
 * Storage providers, type contracts, and platform specifications
 * for the Social Command Centre media processing pipeline.
 */

// Type contracts (used across all media plans)
export * from './types';

// Platform dimension specifications and variant maps
export * from './processing/platform-specs';

// MinIO storage provider (wired in UploadFactory as STORAGE_PROVIDER=s3)
// Storage exports added in Task 2 (after minio.storage.ts is created)
