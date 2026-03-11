'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

// Local interface — avoids importing from backend to prevent bundler issues
export interface PostMetricsResponse {
  id: string;
  variantId: string;
  postId: string;
  platform: string;
  snapshotType: string;
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  fetchedAt: string;
}

/**
 * SWR hook for per-post analytics data.
 *
 * Fetches all PostMetrics snapshots for all variants of a ContentPost.
 * Returns null key when postId is empty (disables SWR fetch).
 * Data is served from the pre-ingested PostMetrics table — no live platform API calls.
 */
export const usePostAnalytics = (postId: string) => {
  const fetch = useFetch();
  return useSWR<PostMetricsResponse[]>(
    postId ? `post-analytics-${postId}` : null,
    () => fetch(`/analytics/posts/${postId}`).then((r) => r.json()),
  );
};
