'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface FailedVariant {
  id: string;
  postId: string;
  platform: string;
  caption: string;
  status: string;
  errorMessage?: string;
  consecutiveFailures: number;
  publishAttempts?: number;
  scheduledAt?: string;
  mediaUrl?: string;
}

export interface FailedPostsResponse {
  variants: FailedVariant[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * useFailedPosts
 *
 * SWR hook to fetch failed/stale post variants for a company.
 * Calls GET /companies/:companySlug/failed-posts?platform=&page=
 *
 * Per CLAUDE.md rules: each SWR call lives in its own hook.
 */
export const useFailedPosts = (
  companySlug: string,
  platform?: string,
  page = 1
) => {
  const fetch = useFetch();

  const key = companySlug
    ? `failed-posts-${companySlug}-${platform ?? 'all'}-${page}`
    : null;

  return useSWR<FailedPostsResponse>(key, async () => {
    const params = new URLSearchParams();
    if (platform) params.set('platform', platform);
    params.set('page', String(page));
    const res = await fetch(
      `/companies/${companySlug}/failed-posts?${params.toString()}`
    );
    return res.json();
  });
};
