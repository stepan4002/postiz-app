// SOCIAL COMMAND CENTRE — Phase 7: Analytics & Dashboard
// Type contracts for metrics ingestion, adapters, and dashboard data

/**
 * SnapshotType defines the time window for a metrics snapshot.
 * - '1h'  → metrics fetched 1 hour after publish (early engagement signal)
 * - '24h' → metrics fetched 24 hours after publish (first-day performance)
 * - '7d'  → metrics fetched 7 days after publish (full campaign result)
 */
export type SnapshotType = '1h' | '24h' | '7d';

/**
 * MetricsSnapshot holds platform engagement metrics for a single post variant.
 * All fields are nullable — platforms may not expose every metric.
 */
export interface MetricsSnapshot {
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
}

/**
 * AnalyticsAdapter defines the interface each platform adapter must implement.
 * Used by the ingestion worker to fetch post metrics from platform APIs.
 */
export interface AnalyticsAdapter {
  /** Platform identifier matching PostVariant.platform (e.g. 'instagram', 'linkedin') */
  platform: string;
  /** Platform API version this adapter targets (NF4.5 pinning) */
  apiVersion: string;
  /**
   * Fetch engagement metrics for a published post.
   * @param platformPostId - ID returned by platform at publish time (PostVariant.platformPostId)
   * @param accessToken - Decrypted access token for the platform account
   * @returns Partial or full MetricsSnapshot (null fields for unsupported metrics)
   */
  fetchPostMetrics(
    platformPostId: string,
    accessToken: string,
  ): Promise<MetricsSnapshot>;
}

/**
 * DueIngestionItem represents a single ingestion work item popped from the queue.
 * Built by the ingestion scheduler from published PostVariant records.
 */
export interface DueIngestionItem {
  variantId: string;
  postId: string;
  companyId: string;
  platform: string;
  /** platformPostId from PostVariant — the ID used to query platform APIs */
  platformPostId: string;
  /** Which snapshot window to fetch (determines upsert key) */
  snapshotType: SnapshotType;
  /** Encrypted access token — must be decrypted before passing to adapter */
  accessToken: string;
  /** Platform account/page ID — required for page-scoped APIs (Facebook, LinkedIn) */
  platformAccountId?: string;
}

/**
 * TopPerformerEntry represents a single post in the top performers ranking.
 * Returned by the DashboardCache after pre-computation.
 */
export interface TopPerformerEntry {
  variantId: string;
  postId: string;
  platform: string;
  /** Post caption (truncated for display) */
  caption: string;
  likes: number;
  comments: number;
  shares: number;
  /** Sum of likes + comments + shares for ranking */
  totalEngagement: number;
  publishedAt: Date;
}

/**
 * ScheduledPostSummary is a card shown in the "Scheduled Today" section.
 */
export interface ScheduledPostSummary {
  variantId: string;
  postId: string;
  platform: string;
  /** Truncated caption for display */
  caption: string;
  scheduledAt: Date;
  brandName: string;
}

/**
 * FailedPostSummary is a card shown in the "Failed Posts" section.
 * Includes consecutive failures to indicate severity.
 */
export interface FailedPostSummary {
  variantId: string;
  postId: string;
  platform: string;
  /** Truncated caption for display */
  caption: string;
  /** Current PostVariant status (FAILED or STALE) */
  status: string;
  /** Last error message from publish attempt log */
  lastPublishError: string | null;
  consecutiveFailures: number;
}

/**
 * PendingReviewSummary is a card shown in the "Pending Review" section.
 * Includes confidence score to help prioritize review order.
 */
export interface PendingReviewSummary {
  variantId: string;
  postId: string;
  platform: string;
  /** Truncated caption for display */
  caption: string;
  /** AI confidence score (0–1) */
  confidenceScore: number;
  createdAt: Date;
}

/**
 * DashboardData is the full payload returned to the frontend.
 * Loaded from DashboardCache (pre-computed) to keep the dashboard fast.
 */
export interface DashboardData {
  /** Count of PostVariants scheduled to publish today (UTC) */
  scheduledTodayCount: number;
  /** Count of PostVariants awaiting human review */
  pendingReviewCount: number;
  /** Count of PostVariants in FAILED or STALE status */
  failedPostsCount: number;
  /** Top 5 posts by total engagement over the last 7 days */
  topPosts: TopPerformerEntry[];
  /** When this cache entry was computed (for staleness indicator) */
  computedAt: Date;
}
