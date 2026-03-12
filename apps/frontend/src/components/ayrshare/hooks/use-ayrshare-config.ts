'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface AyrShareConfigData {
  id: string;
  apiKeyMasked: string;
  planType: string;
  maxProfiles: number;
  enabled: boolean;
  lastVerifiedAt: string | null;
}

export const useAyrShareConfig = () => {
  const fetch = useFetch();
  return useSWR<AyrShareConfigData | null>(
    '/ayrshare/config',
    (url: string) =>
      fetch(url).then((r: any) => {
        if (r.status === 404) return null;
        return r.json();
      }),
  );
};
