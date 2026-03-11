'use client';

import React from 'react';
import { usePostAnalytics, PostMetricsResponse } from './hooks/use-post-analytics';
import { MetricsSnapshotRow } from './metrics-snapshot-row';

interface PostAnalyticsPanelProps {
  postId: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-500',
  linkedin: 'bg-sky-500',
  x: 'bg-gray-500',
  twitter: 'bg-gray-500',
};

const SNAPSHOT_ORDER = ['1h', '24h', '7d'];

/**
 * Groups PostMetrics snapshots by variantId for display.
 * Returns a map of variantId -> { platform, snapshotsMap }
 */
function groupByVariant(
  metrics: PostMetricsResponse[],
): Map<string, { platform: string; snapshots: Map<string, PostMetricsResponse> }> {
  const groups = new Map<
    string,
    { platform: string; snapshots: Map<string, PostMetricsResponse> }
  >();

  for (const metric of metrics) {
    if (!groups.has(metric.variantId)) {
      groups.set(metric.variantId, {
        platform: metric.platform,
        snapshots: new Map(),
      });
    }
    groups.get(metric.variantId)!.snapshots.set(metric.snapshotType, metric);
  }

  return groups;
}

function PlatformBadge({ platform }: { platform: string }) {
  const colorClass = PLATFORM_COLORS[platform.toLowerCase()] ?? 'bg-gray-500';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${colorClass}`}
    >
      {platform}
    </span>
  );
}

/**
 * PostAnalyticsPanel
 *
 * Displays per-post analytics for all variants with cross-platform comparison.
 * Shows 1h, 24h, 7d snapshots as time-progression rows per variant.
 *
 * Loading state: skeleton shimmer
 * Error state: error message
 * Empty state: "No analytics data yet" per variant
 */
export function PostAnalyticsPanel({ postId }: PostAnalyticsPanelProps) {
  const { data, isLoading, error } = usePostAnalytics(postId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse bg-newBgColorInner rounded-lg h-32"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-newBgColorInner border border-newTableBorder rounded-lg p-4">
        <p className="text-sm text-red-400">Failed to load analytics</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-newBgColorInner border border-newTableBorder rounded-lg p-4">
        <p className="text-sm text-textItemBlur">
          No analytics data yet. Analytics are collected at 1h, 24h, and 7d after publishing.
        </p>
      </div>
    );
  }

  const variantGroups = groupByVariant(data);

  return (
    <div className="space-y-6">
      {Array.from(variantGroups.entries()).map(([variantId, { platform, snapshots }]) => (
        <div
          key={variantId}
          className="bg-newBgColorInner border border-newTableBorder rounded-lg p-4 space-y-4"
        >
          {/* Variant header */}
          <div className="flex items-center gap-3">
            <PlatformBadge platform={platform} />
            <span className="text-xs text-textItemBlur font-mono truncate max-w-xs">
              {variantId}
            </span>
          </div>

          {/* Snapshots */}
          {snapshots.size === 0 ? (
            <p className="text-xs text-textItemBlur">No analytics data yet for this variant.</p>
          ) : (
            <div className="space-y-4">
              {SNAPSHOT_ORDER.filter((type) => snapshots.has(type)).map((type) => (
                <MetricsSnapshotRow
                  key={type}
                  snapshotType={type}
                  metrics={snapshots.get(type)!}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
