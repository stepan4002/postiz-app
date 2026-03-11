'use client';

import React from 'react';
import type { PendingReviewSummary } from '@gitroom/frontend/components/analytics/hooks/use-dashboard';

interface PendingReviewWidgetProps {
  count: number;
  posts: PendingReviewSummary[];
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-500',
  linkedin: 'bg-sky-500',
  x: 'bg-gray-500',
  twitter: 'bg-gray-500',
};

/**
 * Get confidence badge color class.
 *
 * < 0.5 -> red (low confidence, needs careful review)
 * 0.5-0.7 -> amber (medium confidence)
 * > 0.7 -> green (high confidence, likely safe)
 */
function getConfidenceColor(score: number | null): string {
  if (score === null) return 'bg-gray-500 text-white';
  if (score < 0.5) return 'bg-red-500 text-white';
  if (score <= 0.7) return 'bg-amber-500 text-white';
  return 'bg-green-500 text-white';
}

function formatConfidence(score: number | null): string {
  if (score === null) return 'N/A';
  return `${Math.round(score * 100)}%`;
}

/**
 * PendingReviewWidget
 *
 * Dashboard card showing posts pending human review (R12.2).
 * Count badge turns amber when there are pending posts.
 * Confidence score color-coded: red < 0.5, amber 0.5-0.7, green > 0.7.
 */
export function PendingReviewWidget({ count, posts }: PendingReviewWidgetProps) {
  return (
    <div className="bg-newBgColorInner border border-newTableBorder rounded-lg p-4 h-full flex flex-col">
      {/* Card header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-textColor">Pending Review</h3>
        {count > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500 text-white">
            {count}
          </span>
        )}
      </div>

      {/* Posts list */}
      {posts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-textItemBlur text-center">
            All caught up! No posts pending review.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-newTableBorder flex-1 overflow-auto">
          {posts.map((post) => {
            const platformColor = PLATFORM_COLORS[post.platform.toLowerCase()] ?? 'bg-gray-500';
            const confidenceColor = getConfidenceColor(post.confidenceScore);
            return (
              <li key={post.variantId} className="py-2 flex items-start gap-2">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white shrink-0 ${platformColor}`}
                >
                  {post.platform}
                </span>
                <p className="text-xs text-textColor flex-1 truncate">
                  {post.caption || '(no caption)'}
                </p>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${confidenceColor}`}
                >
                  {formatConfidence(post.confidenceScore)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
