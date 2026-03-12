'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface UploadPostConfigData {
  id: string;
  apiKeyMasked: string;
  planType: string;
  maxProfiles: number;
  enabled: boolean;
  lastVerifiedAt: string | null;
}

export const useUploadPostConfig = () => {
  const fetch = useFetch();
  return useSWR<UploadPostConfigData | null>(
    '/upload-post/config',
    (url: string) =>
      fetch(url).then((r: any) => {
        if (r.status === 404) return null;
        return r.json();
      }),
  );
};
