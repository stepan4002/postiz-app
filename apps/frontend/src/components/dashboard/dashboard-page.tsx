'use client';

import React from 'react';
import { useCompany } from '@gitroom/frontend/components/company-switcher/company-context';
import { useDashboard } from '@gitroom/frontend/components/analytics/hooks/use-dashboard';
import { ScheduledTodayWidget } from './scheduled-today-widget';
import { PendingReviewWidget } from './pending-review-widget';
import { FailedPostsWidget } from './failed-posts-widget';
import { TopPerformersWidget } from './top-performers-widget';

function formatRelativeTime(isoString: string | undefined): string {
  if (!isoString) return '';
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin === 1) return '1 minute ago';
    if (diffMin < 60) return `${diffMin} minutes ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
  } catch {
    return '';
  }
}

function SkeletonCard() {
  return (
    <div className="bg-newBgColorInner border border-newTableBorder rounded-lg p-4 animate-pulse">
      <div className="h-4 bg-newBgColor rounded w-1/3 mb-3" />
      <div className="space-y-2">
        <div className="h-3 bg-newBgColor rounded w-full" />
        <div className="h-3 bg-newBgColor rounded w-4/5" />
        <div className="h-3 bg-newBgColor rounded w-3/4" />
      </div>
    </div>
  );
}

/**
 * DashboardPage
 *
 * Command Centre landing page showing 4 widgets in a 2x2 grid:
 * - Today's Schedule (R12.1)
 * - Pending Review (R12.2)
 * - Publish Failures (R12.3)
 * - Top Performers (R12.4)
 *
 * All data from pre-computed DashboardCache via useDashboard SWR hook (R12.5, NF3.1).
 * Company-scoped via useCompany() context (R12.6: 'all' when no company selected).
 */
export function DashboardPage() {
  const { company, companySlug } = useCompany();
  const { data, isLoading, error } = useDashboard(companySlug ?? null);

  const companyLabel = company?.name ?? (companySlug ? companySlug : 'All Companies');

  return (
    <div className="flex flex-col h-full gap-4 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-textColor">Command Centre</h1>
          <p className="text-sm text-textItemBlur">{companyLabel}</p>
        </div>
        {data?.computedAt && (
          <p className="text-xs text-textItemBlur">
            Updated {formatRelativeTime(data.computedAt)}
          </p>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-newBgColorInner border border-newTableBorder rounded-lg p-4">
          <p className="text-sm text-red-400">Failed to load dashboard</p>
        </div>
      )}

      {/* Loading state — 4 skeleton cards */}
      {isLoading && (
        <div className="grid grid-cols-1 mobile:grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Dashboard widgets — 2x2 grid */}
      {!isLoading && !error && data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          <ScheduledTodayWidget
            count={data.scheduledTodayCount}
            posts={data.scheduledPosts ?? []}
          />
          <PendingReviewWidget
            count={data.pendingReviewCount}
            posts={data.pendingReview ?? []}
          />
          <FailedPostsWidget
            count={data.failedPostsCount}
            posts={data.failedPosts ?? []}
          />
          <TopPerformersWidget posts={data.topPosts ?? []} />
        </div>
      )}

      {/* Empty state when not loading, no error, but no data */}
      {!isLoading && !error && !data && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-textItemBlur">No dashboard data available yet.</p>
        </div>
      )}
    </div>
  );
}
