'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

/**
 * useScheduleActions
 *
 * Mutation hook for scheduling actions: schedule, autoSlot, cancel, retry.
 * Does NOT use SWR — these are write operations (mutations).
 * Caller should call SWR's mutate() after each action to refresh data.
 */
export const useScheduleActions = (companySlug: string) => {
  const fetch = useFetch();

  const schedule = async (
    postId: string,
    scheduledAt: string,
    timezone?: string
  ): Promise<void> => {
    await fetch(`/companies/${companySlug}/posts/${postId}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledAt, timezone }),
    });
  };

  const autoSlot = async (
    postId: string,
    timezone?: string
  ): Promise<{ scheduledAt: string }> => {
    const res = await fetch(
      `/companies/${companySlug}/posts/${postId}/auto-slot`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone }),
      }
    );
    return res.json();
  };

  const cancel = async (postId: string): Promise<void> => {
    await fetch(`/companies/${companySlug}/posts/${postId}/schedule`, {
      method: 'DELETE',
    });
  };

  const retry = async (postId: string): Promise<void> => {
    await fetch(`/companies/${companySlug}/posts/${postId}/retry`, {
      method: 'POST',
    });
  };

  return { schedule, autoSlot, cancel, retry };
};
