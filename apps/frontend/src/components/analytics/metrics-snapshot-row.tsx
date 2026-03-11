'use client';

import React from 'react';
import type { PostMetricsResponse } from './hooks/use-post-analytics';

interface MetricsSnapshotRowProps {
  snapshotType: string;
  metrics: PostMetricsResponse;
}

const METRIC_KEYS: Array<{ key: keyof PostMetricsResponse; label: string }> = [
  { key: 'impressions', label: 'Impressions' },
  { key: 'reach', label: 'Reach' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'saves', label: 'Saves' },
  { key: 'clicks', label: 'Clicks' },
];

function formatMetricValue(value: number | null | undefined | string): string {
  if (value === null || value === undefined) return '--';
  if (typeof value === 'string') return value;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

const SNAPSHOT_LABELS: Record<string, string> = {
  '1h': '1 Hour',
  '24h': '24 Hours',
  '7d': '7 Days',
};

/**
 * MetricsSnapshotRow
 *
 * Displays a single time-window snapshot (1h, 24h, 7d) as a row of metric cards.
 * Null values render as '--' (not 0) — important distinction per CONTEXT.md.
 */
export function MetricsSnapshotRow({ snapshotType, metrics }: MetricsSnapshotRowProps) {
  const label = SNAPSHOT_LABELS[snapshotType] ?? snapshotType;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-textItemBlur uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {METRIC_KEYS.map(({ key, label: metricLabel }) => {
          const raw = metrics[key];
          const value =
            typeof raw === 'number' || raw === null
              ? formatMetricValue(raw as number | null)
              : '--';

          return (
            <div
              key={key}
              className="bg-newBgColorInner border border-newTableBorder rounded-md p-2 text-center min-w-[80px]"
            >
              <p className="text-xs text-textItemBlur mb-1">{metricLabel}</p>
              <p className="text-sm font-semibold text-textColor">{value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
