'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { TokenHealthState } from './useTokenHealth';

/**
 * A single platform connection entry for a brand.
 */
export interface BrandConnection {
  platform: string;
  connected: boolean;
  integrationId?: string;
  health?: TokenHealthState;
  displayName?: string;
}

/**
 * Response shape from the brand connections endpoint.
 */
export interface BrandConnectionsResponse {
  connections: BrandConnection[];
}

/**
 * useBrandConnections
 *
 * SWR hook that fetches the social account connections for a specific brand.
 * Returns one entry per MVP platform (instagram, facebook, linkedin, x),
 * each indicating whether the brand has connected that platform and its health state.
 *
 * Usage:
 *   const { connections, isLoading, error, mutate } = useBrandConnections(brandId);
 */
export const useBrandConnections = (brandId: string) => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    const res = await fetch(`/credentials/brand-connections/${brandId}`);
    return res.json() as Promise<BrandConnectionsResponse>;
  }, [fetch, brandId]);

  const { data, error, isLoading, mutate } = useSWR<BrandConnectionsResponse>(
    brandId ? `credentials/brand-connections/${brandId}` : null,
    load,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    connections: data?.connections ?? [],
    isLoading,
    error,
    mutate,
  };
};
