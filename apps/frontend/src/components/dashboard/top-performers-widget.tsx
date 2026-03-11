'use client';

import React from 'react';
import type { TopPerformerEntry } from '@gitroom/frontend/components/analytics/hooks/use-dashboard';

interface TopPerformersWidgetProps {
  posts: TopPerformerEntry[];
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-500',
  linkedin: 'bg-sky-500',
  x: 'bg-gray-500',
  twitter: 'bg-gray-500',
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * TopPerformersWidget
 *
 * Dashboard card showing top-performing posts by total engagement over the last 7 days (R12.4).
 * Ranked 1-5 with engagement breakdown: likes, comments, shares.
 * Total engagement prominently displayed.
 */
export function TopPerformersWidget({ posts }: TopPerformersWidgetProps) {
  return (
    <div className="bg-newBgColorInner border border-newTableBorder rounded-lg p-4 h-full flex flex-col">
      {/* Card header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-textColor">Top Performers (7 days)</h3>
      </div>

      {/* Posts list */}
      {posts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-textItemBlur text-center">
            No published posts with analytics yet
          </p>
        </div>
      ) : (
        <ol className="divide-y divide-newTableBorder flex-1 overflow-auto">
          {posts.slice(0, 5).map((post, index) => {
            const platformColor = PLATFORM_COLORS[post.platform.toLowerCase()] ?? 'bg-gray-500';
            return (
              <li key={post.variantId} className="py-2 flex items-start gap-2">
                {/* Rank */}
                <span className="text-xs font-bold text-textItemBlur shrink-0 w-4 mt-0.5">
                  #{index + 1}
                </span>

                {/* Platform badge */}
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white shrink-0 ${platformColor}`}
                >
                  {post.platform}
                </span>

                {/* Caption */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-textColor truncate">
                    {post.caption || '(no caption)'}
                  </p>

                  {/* Engagement breakdown */}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-textItemBlur">
                      {formatCount(post.likes ?? 0)} likes
                    </span>
                    <span className="text-xs text-textItemBlur">
                      {formatCount(post.comments ?? 0)} comments
                    </span>
                    <span className="text-xs text-textItemBlur">
                      {formatCount(post.shares ?? 0)} shares
                    </span>
                  </div>
                </div>

                {/* Total engagement */}
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-textColor">
                    {formatCount(post.totalEngagement)}
                  </p>
                  <p className="text-xs text-textItemBlur">total</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
