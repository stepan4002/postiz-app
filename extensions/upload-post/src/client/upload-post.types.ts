/**
 * Upload-Post API Type Definitions
 *
 * TypeScript types for the Upload-Post.com REST API.
 * API Docs: https://upload-post.com/docs
 *
 * Base URL:  https://api.upload-post.com/api/
 * Auth:      Authorization: Apikey {api-key}
 *
 * Endpoints:
 *   POST /api/upload_text   — publish text-only posts
 *   POST /api/upload_photo  — publish posts with photos
 *   POST /api/upload_video  — publish posts with videos
 *   GET  /api/status/{id}   — check async post status
 */

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

/** Common fields shared across all upload endpoints */
export interface UploadPostBaseRequest {
  /** Upload-Post profile username (e.g. "cadema__main__cs") */
  profile: string;

  /** Post content / caption text */
  post_text: string;

  /** Array of platform identifiers (e.g. ["instagram", "x", "linkedin"]) */
  platforms: string[];

  /** ISO 8601 datetime for scheduled publishing (optional) */
  schedule_time?: string;

  // -- Platform-specific optional params --

  /** Instagram: post type */
  ig_post_type?: 'feed' | 'reel' | 'story';

  /** YouTube: video title */
  yt_title?: string;

  /** YouTube: privacy setting */
  yt_privacy?: 'public' | 'unlisted' | 'private';

  /** Pinterest: target board ID */
  pin_board_id?: string;

  /** Reddit: subreddit name */
  reddit_subreddit?: string;

  /** Reddit: post title */
  reddit_title?: string;

  /** TikTok: disable comments */
  tiktok_disable_comment?: boolean;

  /** TikTok: disable duet */
  tiktok_disable_duet?: boolean;

  /** Facebook: target page ID (for multi-page accounts) */
  fb_page_id?: string;

  /** LinkedIn: visibility */
  linkedin_visibility?: 'PUBLIC' | 'CONNECTIONS';
}

/** Request body for /api/upload_text */
export interface UploadTextRequest extends UploadPostBaseRequest {}

/** Request body for /api/upload_photo */
export interface UploadPhotoRequest extends UploadPostBaseRequest {
  /** Publicly accessible image URL */
  media_url?: string;

  /** Base64 encoded image (alternative to media_url) */
  media_base64?: string;
}

/** Request body for /api/upload_video */
export interface UploadVideoRequest extends UploadPostBaseRequest {
  /** Publicly accessible video URL */
  video_url: string;
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/** Result for an individual platform within a publish response */
export interface PlatformResult {
  /** Platform identifier (e.g. "instagram", "x") */
  platform: string;

  /** Whether posting succeeded on this platform */
  success: boolean;

  /** Platform-assigned post ID */
  post_id?: string;

  /** URL to the published post */
  post_url?: string;

  /** Error message if posting failed */
  error?: string;
}

/** Response from any upload endpoint */
export interface UploadPostResponse {
  /** Overall success flag */
  success: boolean;

  /** Async request ID for polling (present when response is async) */
  request_id?: string;

  /** Scheduled job ID (present when post is scheduled, HTTP 202) */
  job_id?: string;

  /** Per-platform results (present on sync success) */
  results?: PlatformResult[];

  /** Error message (present on failure) */
  error?: string;
}

/** Response from /api/status/{request_id} */
export interface StatusResponse {
  /** Whether the async job has completed */
  completed: boolean;

  /** Current status string */
  status: 'processing' | 'completed' | 'failed';

  /** Per-platform results (available when completed) */
  results?: PlatformResult[];

  /** Error message (present on failure) */
  error?: string;
}

// ---------------------------------------------------------------------------
// Internal DTOs (used within the extension module)
// ---------------------------------------------------------------------------

/** DTO for creating a new UploadPostConfig */
export interface CreateConfigDto {
  apiKey: string;
  planType?: string;
  maxProfiles?: number;
}

/** DTO for updating an existing UploadPostConfig */
export interface UpdateConfigDto {
  apiKey?: string;
  planType?: string;
  maxProfiles?: number;
  enabled?: boolean;
}

/** DTO for creating a new UploadPostProfile */
export interface CreateProfileDto {
  companyId: string;
  companySlug: string;
  languageCode: string;
  languageName: string;
  brandId?: string;
  brandSlug?: string;
  platforms: string[];
  platformSettings?: Record<string, any>;
}

/** DTO for updating an existing UploadPostProfile */
export interface UpdateProfileDto {
  platforms?: string[];
  platformSettings?: Record<string, any>;
  brandId?: string;
  enabled?: boolean;
}

/** Masked config for API responses (never exposes full API key) */
export interface ConfigResponse {
  id: string;
  apiKeyMasked: string;
  planType: string;
  maxProfiles: number;
  enabled: boolean;
  lastVerifiedAt: string | null;
}

/** Quota information */
export interface QuotaResponse {
  used: number;
  max: number;
  remaining: number;
  planType: string;
}

/** Supported Upload-Post platform identifiers */
export type UploadPostPlatform =
  | 'instagram'
  | 'x'
  | 'linkedin'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'pinterest'
  | 'reddit'
  | 'threads'
  | 'bluesky'
  | 'google_business';

/** Map from Postiz providerIdentifier to Upload-Post platform identifier */
export const POSTIZ_TO_UPLOADPOST_PLATFORM: Record<string, UploadPostPlatform> = {
  instagram: 'instagram',
  x: 'x',
  linkedin: 'linkedin',
  'linkedin-page': 'linkedin',
  facebook: 'facebook',
  'facebook-page': 'facebook',
  tiktok: 'tiktok',
  youtube: 'youtube',
  pinterest: 'pinterest',
  reddit: 'reddit',
  threads: 'threads',
  bluesky: 'bluesky',
  'google-business': 'google_business',
};
