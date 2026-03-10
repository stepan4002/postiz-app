// ============================================================================
// Scheduling types for Phase 6: Scheduling & Publishing Engine
// Extends content-generation types with scheduling/publishing/stale states
// ============================================================================

/**
 * Extended ContentPost status including scheduling/publishing lifecycle states.
 * - DRAFT: Initial state, content being created
 * - PENDING_REVIEW: Submitted for review
 * - APPROVED: Review passed, ready to schedule
 * - SCHEDULED: Assigned a publish time, waiting for scheduler_tick
 * - PUBLISHING: Currently being sent to platform API
 * - PUBLISHED: Successfully published on the platform
 * - FAILED: Platform API returned an error during publishing
 * - STALE: Publish window expired without publishing (requires operator action)
 */
export type ContentPostStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'STALE';

/**
 * Extended PostVariant status including scheduling/publishing lifecycle states.
 * Mirrors ContentPostStatus for per-platform variant tracking.
 */
export type PostVariantStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'STALE';

// ============================================================================
// DTOs for scheduling operations
// ============================================================================

/**
 * DTO for explicitly scheduling a post at a specific time.
 */
export interface SchedulePostDto {
  postId: string;
  scheduledAt: Date;
  timezone?: string;
}

/**
 * DTO for auto-slotting a post into the next available time slot.
 */
export interface AutoSlotDto {
  postId: string;
  timezone?: string;
}

/**
 * Configuration for the publish window — how long after scheduledAt the
 * scheduler will attempt to publish before marking as STALE.
 * Default: 4 hours (R10.8 publish window requirement).
 */
export interface PublishWindowConfig {
  /** Number of hours after scheduledAt before marking as STALE */
  windowHours: number;
}

/** Default publish window: 4 hours */
export const DEFAULT_PUBLISH_WINDOW_HOURS = 4;
