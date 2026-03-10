'use client';

import React, { FC } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTokenHealth, TokenHealthItem, TokenHealthState } from './useTokenHealth';

dayjs.extend(relativeTime);

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
 * Returns human-readable label for the health state.
 */
function healthLabel(health: TokenHealthState): string {
  switch (health) {
    case 'healthy':
      return 'Healthy';
    case 'warning':
      return 'Warning';
    case 'expired':
      return 'Expired';
    case 'refresh_needed':
      return 'Refresh needed';
    default:
      return 'Unknown';
  }
}

/**
 * Formats a nullable ISO date string for display.
 */
function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return dayjs(iso).format('MMM D, YYYY');
}

/**
 * Single row in the token health list.
 */
const TokenHealthRow: FC<{ item: TokenHealthItem }> = ({ item }) => {
  const dotClass = healthDotClass(item.health);
  const label = healthLabel(item.health);

  return (
    <div className="flex items-center gap-4 py-3 border-b border-newTableBorder last:border-b-0">
      {/* Health indicator dot */}
      <div className="flex-shrink-0 flex items-center justify-center w-8">
        <span
          className={`inline-block w-3 h-3 rounded-full ${dotClass}`}
          title={label}
          aria-label={`Health: ${label}`}
        />
      </div>

      {/* Provider / account name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {item.picture && (
            <img
              src={item.picture}
              alt={item.name}
              className="w-6 h-6 rounded-full object-cover flex-shrink-0"
            />
          )}
          <span className="text-sm font-medium text-newTextColor truncate">
            {item.name}
          </span>
        </div>
        <div className="text-xs text-newTableText mt-0.5 capitalize">
          {item.provider}
          {item.brandName && (
            <span className="ml-2 text-newTableText">
              &middot; {item.brandName}
            </span>
          )}
        </div>
      </div>

      {/* Health status */}
      <div className="w-32 flex-shrink-0 text-sm">
        <span
          className={`inline-flex items-center gap-1.5 ${
            item.health === 'healthy'
              ? 'text-green-500'
              : item.health === 'warning'
              ? 'text-amber-500'
              : 'text-red-500'
          }`}
        >
          {label}
        </span>
        {item.consecutiveFailures > 0 && (
          <div className="text-xs text-newTableText mt-0.5">
            {item.consecutiveFailures} failure
            {item.consecutiveFailures !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Last refreshed */}
      <div className="w-32 flex-shrink-0 text-xs text-newTableText">
        <div className="text-newTableText font-medium text-sm">
          {item.lastRefreshedAt ? dayjs(item.lastRefreshedAt).fromNow() : '—'}
        </div>
        {item.lastRefreshedAt && (
          <div className="text-xs text-newTableText mt-0.5">
            {formatDate(item.lastRefreshedAt)}
          </div>
        )}
      </div>

      {/* Expiry */}
      <div className="w-32 flex-shrink-0 text-xs text-newTableText">
        {item.expiresAt ? (
          <>
            <div
              className={`text-sm font-medium ${
                item.health === 'expired'
                  ? 'text-red-500'
                  : item.daysUntilExpiry !== null && item.daysUntilExpiry <= 7
                  ? 'text-amber-500'
                  : 'text-newTextColor'
              }`}
            >
              {item.daysUntilExpiry !== null && item.daysUntilExpiry < 0
                ? 'Expired'
                : item.daysUntilExpiry !== null
                ? `${item.daysUntilExpiry}d`
                : '—'}
            </div>
            <div className="text-xs text-newTableText mt-0.5">
              {formatDate(item.expiresAt)}
            </div>
          </>
        ) : (
          <span className="text-sm text-newTableText">No expiry</span>
        )}
      </div>
    </div>
  );
};

/**
 * TokenHealthList
 *
 * Displays a full inventory of all connected social media accounts with
 * color-coded health state indicators, last refresh time, expiry date,
 * and failure counts.
 *
 * - Healthy tokens: green indicator dot
 * - Warning tokens: amber indicator dot
 * - Expired / refresh_needed tokens: red indicator dot
 *
 * Empty state shows a helpful message when no accounts are connected.
 * Loading state shows a skeleton placeholder.
 */
const TokenHealthList: FC = () => {
  const { data, isLoading } = useTokenHealth();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-14 rounded-md bg-newTableHeader"
          />
        ))}
      </div>
    );
  }

  const integrations: TokenHealthItem[] = data?.integrations ?? [];

  if (integrations.length === 0) {
    return (
      <div className="text-center py-12 text-newTableText">
        <div className="text-4xl mb-3">&#128279;</div>
        <p className="text-sm">No connected accounts</p>
        <p className="text-xs mt-1 text-newTableText">
          Connect your social media accounts to see their health status here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-newBgColorInner border border-newTableBorder rounded-md overflow-hidden">
      {/* Table header */}
      <div className="flex items-center gap-4 px-4 py-2 bg-newTableHeader border-b border-newTableBorder">
        <div className="w-8 flex-shrink-0" />
        <div className="flex-1 text-xs font-semibold text-newTableText uppercase tracking-wide">
          Account
        </div>
        <div className="w-32 flex-shrink-0 text-xs font-semibold text-newTableText uppercase tracking-wide">
          Status
        </div>
        <div className="w-32 flex-shrink-0 text-xs font-semibold text-newTableText uppercase tracking-wide">
          Last Refresh
        </div>
        <div className="w-32 flex-shrink-0 text-xs font-semibold text-newTableText uppercase tracking-wide">
          Expires
        </div>
      </div>

      {/* Table rows */}
      <div className="px-4">
        {integrations.map((item) => (
          <TokenHealthRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
};

export default TokenHealthList;
