'use client';

import React, { FC } from 'react';
import { useTokenHealth, TokenHealthItem } from './useTokenHealth';

/**
 * Returns true if the integration has a non-healthy state.
 */
function isUnhealthy(item: TokenHealthItem): boolean {
  return item.health !== 'healthy';
}

/**
 * Determines the banner severity based on the unhealthy integrations.
 * - 'critical': any expired or refresh_needed integration
 * - 'warning': only warning-state integrations
 */
function getBannerSeverity(
  unhealthy: TokenHealthItem[]
): 'critical' | 'warning' {
  const hasCritical = unhealthy.some(
    (i) => i.health === 'expired' || i.health === 'refresh_needed'
  );
  return hasCritical ? 'critical' : 'warning';
}

/**
 * TokenHealthBanner
 *
 * Displays a top-of-page warning banner when one or more connected integrations
 * have a non-healthy token state.
 *
 * - Shows amber background for 'warning' state
 * - Shows red background for 'expired' or 'refresh_needed' state
 * - Renders null when all tokens are healthy or data is loading
 *
 * Designed to be placed on the main dashboard layout so operators are
 * immediately informed when action is needed.
 */
const TokenHealthBanner: FC = () => {
  const { data, isLoading } = useTokenHealth();

  if (isLoading || !data) {
    return null;
  }

  const unhealthy = data.integrations.filter(isUnhealthy);

  if (unhealthy.length === 0) {
    return null;
  }

  const severity = getBannerSeverity(unhealthy);
  const count = unhealthy.length;

  const bannerClasses =
    severity === 'critical'
      ? 'bg-red-500 text-white'
      : 'bg-amber-400 text-amber-900';

  const iconClasses = severity === 'critical' ? 'text-white' : 'text-amber-800';

  return (
    <div
      role="alert"
      className={`w-full px-4 py-3 flex items-center gap-3 ${bannerClasses}`}
    >
      {/* Warning icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-5 w-5 flex-shrink-0 ${iconClasses}`}
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>

      {/* Banner text */}
      <span className="text-sm font-medium flex-1">
        {count === 1
          ? '1 connection needs attention'
          : `${count} connections need attention`}
        {' — '}
        {severity === 'critical'
          ? 'one or more tokens have expired or need re-authentication.'
          : 'one or more tokens are expiring soon or have refresh failures.'}
      </span>

      {/* Link to settings */}
      <a
        href="/settings"
        className="text-sm font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
      >
        Review in Settings
      </a>
    </div>
  );
};

export default TokenHealthBanner;
