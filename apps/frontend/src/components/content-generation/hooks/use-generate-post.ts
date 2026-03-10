'use client';

import { useState, useCallback } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface CreatePostInput {
  brandId: string;
  mediaId?: string;
  brief?: string;
  contentType: string;
  platforms: string[];
}

export interface GenerateResult {
  post: any;
  variants: any[];
}

/**
 * useGeneratePost
 *
 * Mutation hook for triggering AI post generation.
 * Calls POST /companies/:companySlug/posts/generate
 *
 * Returns:
 * - generate: function to trigger generation
 * - isLoading: boolean indicating in-flight request
 * - error: string | null for error state
 *
 * Per CLAUDE.md rules: each data-fetching hook in its own file.
 */
export const useGeneratePost = (companySlug: string) => {
  const fetch = useFetch();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (dto: CreatePostInput): Promise<GenerateResult> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/companies/${companySlug}/posts/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dto),
        });
        return res.json();
      } catch (err: any) {
        const message = err?.message ?? 'Generation failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetch, companySlug]
  );

  return { generate, isLoading, error };
};
