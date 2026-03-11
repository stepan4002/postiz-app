'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import type { PostMetricsResponse } from './use-post-analytics';

// Local response interfaces — avoids importing backend types
export interface TopPerformerEntry {
  variantId: string;
  postId: string;
  platform: string;
  caption: string;
  likes: number;
  comments: number;
  shares: number;
  totalEngagement: number;
}

export interface ScheduledPostSummary {
  variantId: string;
  postId: string;
  platform: string;
  caption: string;
  scheduledAt: string;
}

export interface FailedPostSummary {
  variantId: string;
  postId: string;
  platform: string;
  caption: string;
  status: string;
  lastPublishError: string | null;
}

export interface PendingReviewSummary {
  variantId: string;
  postId: string;
  platform: string;
  caption: string;
  confidenceScore: number | null;
}

export interface DashboardResponse {
  scheduledTodayCount: number;
  pendingReviewCount: number;
  failedPostsCount: number;
  topPosts: TopPerformerEntry[];
  scheduledPosts: ScheduledPostSummary[];
  failedPosts: FailedPostSummary[];
  pendingReview: PendingReviewSummary[];
  computedAt: string;
}

/**
 * SWR hook for dashboard data.
 *
 * Fetches pre-computed dashboard data from the DashboardCache.
 * Refreshes every 60 seconds for near-real-time updates (NF3.1).
 * Uses 'all' when no companySlug is provided (cross-company view R12.6).
 */
export const useDashboard = (companySlug: string | null) => {
  const fetch = useFetch();
  const slug = companySlug || 'all';
  return useSWR<DashboardResponse>(
    `dashboard-${slug}`,
    () => fetch(`/dashboard?companySlug=${slug}`).then((r) => r.json()),
    { refreshInterval: 60000 },
  );
};
