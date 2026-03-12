'use client';

import { useCallback, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface UploadProgress {
  percent: number;
  status: 'idle' | 'uploading' | 'done' | 'error';
  error?: string;
}

/**
 * useMediaUpload
 *
 * Hook for uploading media files to the company-scoped media endpoint.
 * Calls POST /companies/:companySlug/media/upload with multipart/form-data.
 *
 * Returns:
 * - uploadMedia: function to trigger upload
 * - progress: current upload progress state
 *
 * Per CLAUDE.md rules: each SWR/fetch-related hook in its own file.
 */
export const useMediaUpload = () => {
  const fetch = useFetch();
  const [progress, setProgress] = useState<UploadProgress>({
    percent: 0,
    status: 'idle',
  });

  const uploadMedia = useCallback(
    async (
      companySlug: string,
      file: File,
      tags: string[] = []
    ): Promise<any | null> => {
      setProgress({ percent: 0, status: 'uploading' });

      try {
        const formData = new FormData();
        formData.append('file', file);
        if (tags.length > 0) {
          tags.forEach((tag) => formData.append('tags', tag));
        }

        const res = await fetch(`/companies/${companySlug}/media/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Upload failed with status ${res.status}`);
        }

        const data = await res.json();
        setProgress({ percent: 100, status: 'done' });
        return data;
      } catch (err: any) {
        const errorMessage = err?.message ?? 'Upload failed';
        setProgress({ percent: 0, status: 'error', error: errorMessage });
        return null;
      }
    },
    [fetch]
  );

  const resetProgress = useCallback(() => {
    setProgress({ percent: 0, status: 'idle' });
  }, []);

  return { uploadMedia, progress, resetProgress };
};
