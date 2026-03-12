'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface AyrShareQuotaData {
  used: number;
  max: number;
  remaining: number;
}

export const useAyrShareQuota = () => {
  const fetch = useFetch();
  return useSWR<AyrShareQuotaData>(
    '/ayrshare/profiles/quota',
    (url: string) => fetch(url).then((r: any) => r.json()),
  );
};
