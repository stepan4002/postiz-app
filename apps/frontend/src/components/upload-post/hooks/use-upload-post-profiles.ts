'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface UploadPostProfileData {
  id: string;
  profileUsername: string;
  languageCode: string;
  languageName: string;
  platforms: string[];
  platformSettings: Record<string, any>;
  enabled: boolean;
  createdAt: string;
  company?: { id: string; name: string; slug: string };
  brand?: { id: string; name: string } | null;
  integration?: { id: string; name: string } | null;
}

export const useUploadPostProfiles = () => {
  const fetch = useFetch();
  return useSWR<UploadPostProfileData[]>(
    '/upload-post/profiles',
    (url: string) => fetch(url).then((r: any) => r.json()),
  );
};
