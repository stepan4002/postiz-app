'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface MediaItem {
  id: string;
  name: string;
  path: string;
  thumbnail: string;
  width: number | null;
  height: number | null;
  format: string | null;
  tags: string[];
  fileSize: number;
  companyId: string;
  createdAt: string;
}

export interface CompanyMediaResponse {
  items: MediaItem[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * useCompanyMedia
 *
 * SWR hook to fetch company-scoped media list.
 * Calls GET /companies/:companySlug/media?page=N[&tag=T]
 *
 * Per CLAUDE.md rules: each SWR call lives in its own hook.
 */
export const useCompanyMedia = (
  companySlug: string,
  page: number = 1,
  tag?: string
) => {
  const fetch = useFetch();

  const key =
    companySlug
      ? `company-media-${companySlug}-p${page}${tag ? `-t${tag}` : ''}`
      : null;

  return useSWR<CompanyMediaResponse>(key, async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (tag) params.set('tag', tag);
    const res = await fetch(
      `/companies/${companySlug}/media?${params.toString()}`
    );
    return res.json();
  });
};
