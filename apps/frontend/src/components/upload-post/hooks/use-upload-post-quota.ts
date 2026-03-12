'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface UploadPostQuotaData {
  used: number;
  max: number;
  remaining: number;
  planType: string;
}

export const useUploadPostQuota = () => {
  const fetch = useFetch();
  return useSWR<UploadPostQuotaData>(
    '/upload-post/profiles/quota',
    (url: string) => fetch(url).then((r: any) => r.json()),
  );
};
