'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface ScheduledVariant {
  id: string;
  postId: string;
  platform: string;
  caption: string;
  hashtags: string[];
  status: string;
  scheduledAt: string;
  mediaUrl?: string;
  errorMessage?: string;
  publishAttempts?: number;
}

export interface ScheduledPost {
  id: string;
  companyId: string;
  brandId: string;
  mediaId?: string;
  brief?: string;
  contentType: string;
  status: string;
  scheduledAt?: string;
  variants: ScheduledVariant[];
}

export interface CalendarResponse {
  posts: ScheduledPost[];
  total: number;
}

/**
 * useScheduledPosts
 *
 * SWR hook to fetch scheduled posts for a calendar date range.
 * Calls GET /companies/:companySlug/calendar?from=ISO&to=ISO
 *
 * Per CLAUDE.md rules: each SWR call lives in its own hook.
 */
export const useScheduledPosts = (
  companySlug: string,
  from: string,
  to: string
) => {
  const fetch = useFetch();

  const key =
    companySlug && from && to
      ? `calendar-${companySlug}-${from}-${to}`
      : null;

  return useSWR<CalendarResponse>(key, async () => {
    const res = await fetch(
      `/companies/${companySlug}/calendar?from=${from}&to=${to}`
    );
    return res.json();
  });
};
