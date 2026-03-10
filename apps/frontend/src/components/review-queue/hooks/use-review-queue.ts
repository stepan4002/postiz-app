'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface ReviewVariant {
  id: string;
  postId: string;
  platform: string;
  caption: string;
  hashtags: string[];
  confidenceScore: number;
  status: string;
  generatedBy: string;
  generatedAt: string;
  reviewedBy?: string;
  reviewAction?: string;
  reviewedAt?: string;
  originalCaption?: string;
}

export interface ReviewPost {
  id: string;
  companyId: string;
  brandId: string;
  mediaId?: string;
  brief?: string;
  contentType: string;
  status: string;
  createdAt: string;
  variants: ReviewVariant[];
}

export interface ReviewQueueResponse {
  posts: ReviewPost[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * useReviewQueue
 *
 * SWR hook to fetch the paginated review queue for a company.
 * Calls GET /companies/:companySlug/review-queue?page=N
 *
 * Per CLAUDE.md rules: each SWR call lives in its own hook.
 * Caller accesses .mutate from the returned SWR result to refresh after actions.
 */
export const useReviewQueue = (companySlug: string, page = 1) => {
  const fetch = useFetch();

  const key = companySlug
    ? `review-queue-${companySlug}-p${page}`
    : null;

  return useSWR<ReviewQueueResponse>(key, async () => {
    const res = await fetch(
      `/companies/${companySlug}/review-queue?page=${page}`
    );
    return res.json();
  });
};
