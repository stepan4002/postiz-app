// ============================================================================
// Publishing types for Phase 6: Scheduling & Publishing Engine
// Defines the PlatformAdapter interface and related publishing contracts
// ============================================================================

/**
 * Classification of publish errors for retry logic.
 * - transient: Temporary error (network, 5xx), safe to retry
 * - permanent: Permanent error (invalid content, auth), do not retry
 * - rate_limit: Rate limit hit, retry after delay
 */
export type ErrorClassification = 'transient' | 'permanent' | 'rate_limit';

/**
 * Minimal PostVariant data needed for publishing — avoids importing Prisma types.
 * Provided by the scheduler when invoking a platform adapter.
 */
export interface PostVariantForPublish {
  id: string;
  postId: string;
  platform: string;
  caption: string;
  hashtags: string[];
  mediaVariantId?: string;
}

/**
 * Parameters passed to PlatformAdapter.publish().
 */
export interface PublishParams {
  variant: PostVariantForPublish;
  accessToken: string;
  /** Raw media buffer, if available locally */
  mediaBuffer?: Buffer;
  /** URL of the media to publish, if stored remotely */
  mediaUrl?: string;
  /**
   * Platform-specific account/page/user ID required by some adapters.
   * - Instagram: IG User ID (for /media and /media_publish endpoints)
   * - Facebook: Page ID (for /feed and /photos endpoints)
   * - LinkedIn: Person/Organization URN ID
   * - X: Not required (user context from token)
   */
  platformAccountId?: string;
}

/**
 * Result returned by PlatformAdapter.publish().
 * success=false does not necessarily mean permanent failure — check retryable.
 */
export interface PublishResult {
  success: boolean;
  /** Platform-assigned post ID, present when success=true */
  platformPostId?: string;
  /** URL of the published post on the platform, present when success=true */
  platformUrl?: string;
  /** Human-readable error message, present when success=false */
  error?: string;
  /** Whether this error can be retried (transient/rate_limit) */
  retryable: boolean;
  /** Classification of the error, present when success=false */
  errorType?: ErrorClassification;
}

/**
 * PlatformAdapter interface — uniform publish contract for all platforms.
 * All platform-specific adapters (Instagram, Facebook, LinkedIn, X) implement this.
 *
 * NF4.3: Provides uniform publish contract across all platform integrations.
 * NF4.5: apiVersion field pins the API version to prevent unexpected breakage.
 */
export interface PlatformAdapter {
  /** Platform identifier (e.g., 'instagram', 'facebook', 'linkedin', 'x') */
  platform: string;
  /** Pinned API version for this adapter (NF4.5: version pinning) */
  apiVersion: string;
  /**
   * Publish a post variant to the platform.
   * Must be idempotent — if platformPostId is already set, skip and return success.
   */
  publish(params: PublishParams): Promise<PublishResult>;
}

/**
 * Record of a single publish attempt — logged to PublishAttempt table for
 * audit trail and debugging (R10.6: every attempt must be logged).
 */
export interface PublishAttemptRecord {
  variantId: string;
  attemptNumber: number;
  timestamp: Date;
  success: boolean;
  responseCode?: number;
  responseBody?: string;
  error?: string;
  errorType?: ErrorClassification;
}
