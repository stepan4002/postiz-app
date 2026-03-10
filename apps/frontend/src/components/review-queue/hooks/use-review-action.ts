'use client';

import { useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

/**
 * useReviewAction
 *
 * Mutation hook for review queue actions: approve, reject, regenerate, editVariant.
 * Does NOT use SWR — these are write operations (mutations), not reads.
 * Caller should call SWR's mutate() after each action to refresh the list.
 */
export const useReviewAction = (companySlug: string) => {
  const fetch = useFetch();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = async (postId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await fetch(
        `/companies/${companySlug}/review-queue/${postId}/approve`,
        { method: 'POST' }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to approve post';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const reject = async (postId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await fetch(
        `/companies/${companySlug}/review-queue/${postId}/reject`,
        { method: 'POST' }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reject post';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const regenerate = async (postId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await fetch(
        `/companies/${companySlug}/review-queue/${postId}/regenerate`,
        { method: 'POST' }
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to regenerate post';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const editVariant = async (
    postId: string,
    variantId: string,
    editedCaption: string
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await fetch(
        `/companies/${companySlug}/review-queue/${postId}/variants/${variantId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ editedCaption }),
        }
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save variant caption';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return { approve, reject, regenerate, editVariant, isLoading, error };
};
