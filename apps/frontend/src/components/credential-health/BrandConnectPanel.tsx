'use client';

import React, { FC, useCallback, useState } from 'react';
import { useBrandConnections, BrandConnection } from './useBrandConnections';
import { TokenHealthState } from './useTokenHealth';

/** MVP platforms supported for brand connections. */
const MVP_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x'] as const;
type MvpPlatform = (typeof MVP_PLATFORMS)[number];

/** Display metadata for each platform. */
const PLATFORM_META: Record<
  MvpPlatform,
  { label: string; color: string; icon: React.ReactNode }
> = {
  instagram: {
    label: 'Instagram',
    color: 'text-pink-500',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-6 h-6"
        aria-hidden="true"
      >
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  facebook: {
    label: 'Facebook',
    color: 'text-blue-500',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-6 h-6"
        aria-hidden="true"
      >
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  linkedin: {
    label: 'LinkedIn',
    color: 'text-blue-600',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-6 h-6"
        aria-hidden="true"
      >
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  x: {
    label: 'X (Twitter)',
    color: 'text-newTextColor',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-6 h-6"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.74-8.842L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
};

/**
 * Returns Tailwind classes for the health indicator dot.
 */
function healthDotClass(health: TokenHealthState): string {
  switch (health) {
    case 'healthy':
      return 'bg-green-500';
    case 'warning':
      return 'bg-amber-500';
    case 'expired':
    case 'refresh_needed':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
}

/**
 * Returns a human-readable label for a health state.
 */
function healthLabel(health: TokenHealthState): string {
  switch (health) {
    case 'healthy':
      return 'Healthy';
    case 'warning':
      return 'Warning — expiring soon';
    case 'expired':
      return 'Expired';
    case 'refresh_needed':
      return 'Refresh needed';
    default:
      return 'Unknown';
  }
}

/**
 * Props for the BrandConnectPanel component.
 */
interface BrandConnectPanelProps {
  brandId: string;
  brandSlug: string;
  companyId: string;
  companySlug: string;
}

/**
 * Single platform card inside the connect panel.
 */
interface PlatformCardProps {
  platform: MvpPlatform;
  connection?: BrandConnection;
  brandId: string;
  companyId: string;
  onConnect: (platform: string) => Promise<void>;
  connecting: boolean;
}

const PlatformCard: FC<PlatformCardProps> = ({
  platform,
  connection,
  brandId,
  companyId,
  onConnect,
  connecting,
}) => {
  const meta = PLATFORM_META[platform];
  const isConnected = connection?.connected ?? false;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg border border-newTableBorder bg-newBgColorInner hover:bg-boxHover transition-colors">
      {/* Platform header */}
      <div className="flex items-center gap-2">
        <span className={meta.color}>{meta.icon}</span>
        <span className="text-sm font-semibold text-newTextColor">
          {meta.label}
        </span>
      </div>

      {/* Status / action */}
      {isConnected && connection ? (
        <div className="flex flex-col gap-1.5">
          {/* Account display name */}
          {connection.displayName && (
            <p className="text-xs text-newTableText truncate">
              {connection.displayName}
            </p>
          )}

          {/* Health indicator */}
          {connection.health && (
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${healthDotClass(
                  connection.health
                )}`}
                aria-label={`Health: ${healthLabel(connection.health)}`}
              />
              <span
                className={`text-xs ${
                  connection.health === 'healthy'
                    ? 'text-green-500'
                    : connection.health === 'warning'
                    ? 'text-amber-500'
                    : 'text-red-500'
                }`}
              >
                {healthLabel(connection.health)}
              </span>
            </div>
          )}

          {/* Disconnect link */}
          <a
            href="/settings"
            className="text-xs text-newTableText underline underline-offset-2 hover:text-newTextColor transition-colors mt-1"
          >
            Manage connection
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-newTableText">Not connected</p>
          <button
            type="button"
            disabled={connecting}
            onClick={() => onConnect(platform)}
            className="self-start mt-1 px-3 py-1.5 rounded-md text-xs font-medium bg-btnPrimary text-btnText hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * BrandConnectPanel
 *
 * Displays a 2-column grid of platform cards for the 4 MVP platforms
 * (Instagram, Facebook, LinkedIn, X). Each card shows the current connection
 * state, health indicator, and a "Connect" button to initiate the OAuth flow.
 *
 * Clicking "Connect" posts to /api/credentials/oauth/start and redirects the
 * browser to the returned OAuth URL to complete the flow.
 *
 * Props:
 *   - brandId: UUID of the brand
 *   - brandSlug: URL slug of the brand
 *   - companyId: UUID of the owning company
 *   - companySlug: URL slug of the company
 */
const BrandConnectPanel: FC<BrandConnectPanelProps> = ({
  brandId,
  brandSlug,
  companyId,
  companySlug,
}) => {
  const { connections, isLoading, mutate } = useBrandConnections(brandId);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(
    null
  );
  const [connectError, setConnectError] = useState<string | null>(null);

  const handleConnect = useCallback(
    async (platform: string) => {
      setConnectingPlatform(platform);
      setConnectError(null);
      try {
        const res = await fetch('/api/credentials/oauth/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: platform, brandId, companyId }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { message?: string }).message ?? 'Failed to start OAuth'
          );
        }

        const data = (await res.json()) as { url: string; state: string };
        // Redirect to the OAuth provider
        window.location.href = data.url;
      } catch (err) {
        setConnectError(
          err instanceof Error ? err.message : 'Something went wrong'
        );
        setConnectingPlatform(null);
      }
    },
    [brandId, companyId]
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse">
        {MVP_PLATFORMS.map((platform) => (
          <div
            key={platform}
            className="h-24 rounded-lg bg-newTableHeader"
          />
        ))}
      </div>
    );
  }

  const connectionMap = new Map<string, BrandConnection>(
    connections.map((c) => [c.platform, c])
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-newTextColor">
          Connected Platforms
        </h3>
        <button
          type="button"
          onClick={() => mutate()}
          className="text-xs text-newTableText hover:text-newTextColor transition-colors"
          aria-label="Refresh connection status"
        >
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {connectError && (
        <div
          role="alert"
          className="px-3 py-2 rounded-md bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 text-xs text-red-500"
        >
          {connectError}
        </div>
      )}

      {/* Platform cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {MVP_PLATFORMS.map((platform) => (
          <PlatformCard
            key={platform}
            platform={platform}
            connection={connectionMap.get(platform)}
            brandId={brandId}
            companyId={companyId}
            onConnect={handleConnect}
            connecting={connectingPlatform === platform}
          />
        ))}
      </div>
    </div>
  );
};

export default BrandConnectPanel;
