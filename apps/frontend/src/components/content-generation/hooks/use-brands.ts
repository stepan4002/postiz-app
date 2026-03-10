'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string;
}

/**
 * useBrands
 *
 * SWR hook to fetch the list of brands for a given company.
 * Calls GET /companies/:companySlug/brands
 *
 * Per CLAUDE.md rules: each SWR call lives in its own hook.
 */
export const useBrands = (companySlug: string) => {
  const fetch = useFetch();

  const key = companySlug ? `brands-${companySlug}` : null;

  return useSWR<Brand[]>(key, async () => {
    const res = await fetch(`/companies/${companySlug}/brands`);
    return res.json();
  });
};
