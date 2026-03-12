'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface AyrShareProfileData {
  id: string;
  profileKey: string;
  title: string;
  languageCode: string;
  languageName: string;
  platforms: string[];
  enabled: boolean;
  createdAt: string;
  company?: { id: string; name: string; slug: string };
  brand?: { id: string; name: string } | null;
  integration?: { id: string; name: string } | null;
}

export const useAyrShareProfiles = () => {
  const fetch = useFetch();
  return useSWR<AyrShareProfileData[]>(
    '/ayrshare/profiles',
    (url: string) => fetch(url).then((r: any) => r.json()),
  );
};
