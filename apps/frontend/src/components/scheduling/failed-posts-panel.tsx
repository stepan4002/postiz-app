'use client';

import React, { FC, useState, useCallback } from 'react';
import clsx from 'clsx';
import { useFailedPosts } from './use-failed-posts';
import { useScheduleActions } from './use-schedule-actions';

interface FailedPostsPanelProps {
  companySlug: string;
}

const PLATFORM_BADGE_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500/10 text-pink-500 border-pink-500',
  facebook: 'bg-blue-500/10 text-blue-500 border-blue-500',
  linkedin: 'bg-sky-500/10 text-sky-500 border-sky-500',
  x: 'bg-gray-500/10 text-gray-400 border-gray-500',
};

const PLATFORM_OPTIONS = [
  { value: '', label: 'All platforms' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'x', label: 'X (Twitter)' },
];

/**
 * FailedPostsPanel
 *
 * Panel surfacing failed and stale post variants with error details and retry action.
 * Includes platform filter and pagination.
 */
export const FailedPostsPanel: FC<FailedPostsPanelProps> = ({
  companySlug,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [page, setPage] = useState(1);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  const actions = useScheduleActions(companySlug);

  const { data, isLoading, mutate } = useFailedPosts(
    companySlug,
    selectedPlatform || undefined,
    page
  );

  const variants = data?.variants ?? [];
  const totalPages = data?.totalPages ?? 1;

  const handleRetry = useCallback(
    async (postId: string, variantId: string) => {
      setRetryingIds((prev) => new Set(prev).add(variantId));
      try {
        await actions.retry(postId);
        await mutate();
      } catch {
        // Error silently — UI will show updated state after mutate
      } finally {
        setRetryingIds((prev) => {
          const next = new Set(prev);
          next.delete(variantId);
          return next;
        });
      }
    },
    [actions, mutate]
  );

  const handlePlatformChange = (platform: string) => {
    setSelectedPlatform(platform);
    setPage(1);
  };

  return (
    <div className="bg-newBgColorInner border border-newBorder rounded-lg overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-newBorder gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          <h2 className="text-sm font-semibold text-textColor">Failed Posts</h2>
          {!isLoading && data && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 font-medium">
              {data.total}
            </span>
          )}
        </div>

        {/* Platform filter */}
        <select
          value={selectedPlatform}
          onChange={(e) => handlePlatformChange(e.target.value)}
          className="bg-input text-textColor text-xs rounded-lg border border-newBorder px-2 py-1.5 focus:border-btnPrimary outline-none transition-colors"
        >
          {PLATFORM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-btnSimple rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : variants.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7.5 10L9.5 12L13 8.5M17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 5.85786 5.85786 2.5 10 2.5C14.1421 2.5 17.5 5.85786 17.5 10Z"
                stroke="#22c55e"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="text-sm font-medium text-textColor">No failed posts</div>
          <div className="text-xs text-textItemBlur max-w-[240px]">
            All posts are publishing successfully. Failed items will appear here.
          </div>
        </div>
      ) : (
        /* Failed variants list */
        <div className="divide-y divide-newBorder">
          {variants.map((variant) => {
            const key = variant.platform.toLowerCase();
            const platformColor =
              PLATFORM_BADGE_COLORS[key] ??
              'bg-newColColor text-textItemBlur border-newBorder';
            const isRetrying = retryingIds.has(variant.id);

            return (
              <div
                key={variant.id}
                className="px-4 py-3 flex items-start gap-3 hover:bg-boxHover transition-colors"
              >
                {/* Left: info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={clsx(
                        'text-xs px-2 py-0.5 rounded-full border font-medium capitalize',
                        platformColor
                      )}
                    >
                      {variant.platform}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 font-medium">
                      {variant.status}
                    </span>
                    {variant.consecutiveFailures > 0 && (
                      <span className="text-xs text-textItemBlur">
                        {variant.consecutiveFailures} attempt
                        {variant.consecutiveFailures !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Caption preview */}
                  <p className="text-xs text-textColor line-clamp-2">
                    {variant.caption}
                  </p>

                  {/* Error message */}
                  {variant.errorMessage && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1 line-clamp-2">
                      {variant.errorMessage}
                    </p>
                  )}
                </div>

                {/* Right: retry button */}
                <button
                  type="button"
                  onClick={() => handleRetry(variant.postId, variant.id)}
                  disabled={isRetrying}
                  className={clsx(
                    'flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
                    isRetrying
                      ? 'bg-btnSimple text-textItemBlur cursor-not-allowed opacity-60'
                      : 'bg-btnPrimary text-white hover:opacity-90'
                  )}
                >
                  {isRetrying ? 'Retrying…' : 'Retry'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-newBorder">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-xs px-2.5 py-1 rounded-lg border border-newBorder text-textItemBlur hover:text-textColor hover:bg-boxHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-xs text-textItemBlur">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="text-xs px-2.5 py-1 rounded-lg border border-newBorder text-textItemBlur hover:text-textColor hover:bg-boxHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
