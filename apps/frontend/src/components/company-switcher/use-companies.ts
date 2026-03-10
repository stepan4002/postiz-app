'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface Brand {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  defaultLanguage: string;
  industry: string | null;
  website: string | null;
  logo: string | null;
  notes: string | null;
  brands: Brand[];
}

export const useCompanies = () => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    return await (await fetch('/companies')).json();
  }, []);

  const { data, isLoading, error } = useSWR<Company[]>('companies', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });

  return {
    companies: data ?? [],
    isLoading,
    error,
  };
};
