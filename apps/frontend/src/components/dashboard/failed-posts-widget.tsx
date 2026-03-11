'use client';

import React from 'react';
import type { FailedPostSummary } from '@gitroom/frontend/components/analytics/hooks/use-dashboard';

interface FailedPostsWidgetProps {
  count: number;
  posts: FailedPostSummary[];
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-500',
  linkedin: 'bg-sky-500',
  x: 'bg-gray-500',
  twitter: 'bg-gray-500',
};

function getStatusBadge(status: string): { label: string; className: string } {
  switch (status.toUpperCase()) {
    case 'FAILED':
      return { label: 'FAILED', className: 'bg-red-500 text-white' };
    case 'STALE':
      return { label: 'STALE', className: 'bg-amber-500 text-white' };
    default:
      return { label: status, className: 'bg-gray-500 text-white' };
  }
}

/**
 * FailedPostsWidget
 *
 * Dashboard card showing publish failures (R12.3).
 * Covers both FAILED (platform API error) and STALE (window expired) posts.
 * Count badge turns red when there are failures.
 */
export function FailedPostsWidget({ count, posts }: FailedPostsWidgetProps) {
  return (
    <div className="bg-newBgColorInner border border-newTableBorder rounded-lg p-4 h-full flex flex-col">
      {/* Card header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-textColor">Publish Failures</h3>
        {count > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white">
            {count}
          </span>
        )}
      </div>

      {/* Posts list */}
      {posts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-textItemBlur text-center">
            No publish failures. All clear!
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-newTableBorder flex-1 overflow-auto">
          {posts.map((post) => {
            const platformColor = PLATFORM_COLORS[post.platform.toLowerCase()] ?? 'bg-gray-500';
            const { label: statusLabel, className: statusColor } = getStatusBadge(post.status);
            return (
              <li key={post.variantId} className="py-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white shrink-0 ${platformColor}`}
                  >
                    {post.platform}
                  </span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${statusColor}`}
                  >
                    {statusLabel}
                  </span>
                  <p className="text-xs text-textColor flex-1 truncate">
                    {post.caption || '(no caption)'}
                  </p>
                </div>
                {post.lastError && (
                  <p className="text-xs text-red-400 truncate pl-0.5">
                    {post.lastError}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
