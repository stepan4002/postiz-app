/**
 * Shared type contracts for the media-library extension.
 * These types are the foundation for Plans 02 and 03 (image processing + variant generation).
 */

/**
 * Result returned after a media upload to storage.
 */
export interface MediaUploadResult {
  id: string;
  path: string;
  thumbnailPath?: string;
  width?: number;
  height?: number;
  format?: string;
  fileSize: number;
}

/**
 * Specification for a single platform media variant.
 */
export interface VariantSpec {
  platform: string;
  width: number;
  height: number;
}

/**
 * Result of generating a single image variant.
 */
export interface VariantResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  fileSize: number;
}

/**
 * Result of validating a media file against platform requirements.
 */
export interface PlatformValidationResult {
  platform: string;
  passed: boolean;
  reasons: string[];
}

/**
 * Status values for asynchronous media processing jobs.
 */
export type MediaProcessingJobStatus = 'pending' | 'processing' | 'completed' | 'failed';
