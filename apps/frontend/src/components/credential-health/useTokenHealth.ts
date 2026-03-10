'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

/**
 * Health state for an OAuth integration token.
 * Mirrors the backend TokenHealthState type.
 */
export type TokenHealthState = 'healthy' | 'warning' | 'expired' | 'refresh_needed';

export interface TokenHealthItem {
  id: string;
  provider: string;
  name: string;
  picture: string | null;
  brandId: string | null;
  brandName: string | null;
  health: TokenHealthState;
  lastRefreshedAt: string | null;
  expiresAt: string | null;
  consecutiveFailures: number;
  daysUntilExpiry: number | null;
}

export interface TokenHealthResponse {
  integrations: TokenHealthItem[];
}

/**
 * useTokenHealth
 *
 * SWR hook that fetches token health data from GET /api/credentials/health.
 * Returns the list of all connected integrations with their health state.
 *
 * Usage:
 *   const { data, isLoading, error } = useTokenHealth();
 */
export const useTokenHealth = () => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    const res = await fetch('/credentials/health');
    return res.json() as Promise<TokenHealthResponse>;
  }, [fetch]);

  return useSWR<TokenHealthResponse>('credentials/health', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
};
