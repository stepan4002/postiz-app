'use client';

import React from 'react';
import type { ScheduledPostSummary } from '@gitroom/frontend/components/analytics/hooks/use-dashboard';

interface ScheduledTodayWidgetProps {
  count: number;
  posts: ScheduledPostSummary[];
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-500',
  linkedin: 'bg-sky-500',
  x: 'bg-gray-500',
  twitter: 'bg-gray-500',
};

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mm = d.getUTCMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '--:--';
  }
}

/**
 * ScheduledTodayWidget
 *
 * Dashboard card showing today's scheduled posts (R12.1).
 * Posts are sorted by scheduledAt ascending.
 * Empty state shown when no posts are scheduled for today.
 */
export function ScheduledTodayWidget({ count, posts }: ScheduledTodayWidgetProps) {
  const sortedPosts = [...posts].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );

  return (
    <div className="bg-newBgColorInner border border-newTableBorder rounded-lg p-4 h-full flex flex-col">
      {/* Card header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-textColor">Today's Schedule</h3>
        {count > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-forth text-white">
            {count}
          </span>
        )}
      </div>

      {/* Posts list */}
      {sortedPosts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-textItemBlur text-center">
            No posts scheduled for today
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-newTableBorder flex-1 overflow-auto">
          {sortedPosts.map((post) => {
            const colorClass = PLATFORM_COLORS[post.platform.toLowerCase()] ?? 'bg-gray-500';
            return (
              <li key={post.variantId} className="py-2 flex items-start gap-2">
                <span className="text-xs text-textItemBlur font-mono mt-0.5 shrink-0 w-10">
                  {formatTime(post.scheduledAt)}
                </span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white shrink-0 ${colorClass}`}
                >
                  {post.platform}
                </span>
                <p className="text-xs text-textColor truncate">
                  {post.caption || '(no caption)'}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
