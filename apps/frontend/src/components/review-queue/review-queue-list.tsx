'use client';

import React, { FC, useState } from 'react';
import { useCompany } from '../company-switcher/company-context';
import { useReviewQueue } from './hooks/use-review-queue';
import { ReviewQueueItem } from './review-queue-item';

/**
 * Skeleton placeholder for a loading post card.
 */
const SkeletonCard: FC = () => (
  <div className="bg-newBgColorInner border border-newBorder rounded-lg p-4 space-y-3 animate-pulse">
    <div className="flex gap-2">
      <div className="h-5 w-20 bg-newSep rounded-full" />
      <div className="h-5 w-24 bg-newSep rounded-full" />
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-newSep rounded w-full" />
      <div className="h-4 bg-newSep rounded w-4/5" />
      <div className="h-4 bg-newSep rounded w-3/5" />
    </div>
    <div className="flex gap-2 pt-2 border-t border-newBorder">
      <div className="h-8 w-24 bg-newSep rounded-lg" />
      <div className="h-8 w-16 bg-newSep rounded-lg" />
      <div className="h-8 w-24 bg-newSep rounded-lg" />
    </div>
  </div>
);

/**
 * ReviewQueueList
 *
 * Main review queue page component. Shows all pending AI-generated posts
 * for operator review. Fetches via useReviewQueue SWR hook, refreshes
 * after each action via mutate(). Supports pagination.
 */
export const ReviewQueueList: FC = () => {
  const { companySlug } = useCompany();
  const [page, setPage] = useState(1);

  const { data, isLoading, mutate } = useReviewQueue(companySlug ?? '', page);

  const posts = data?.posts ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleActionComplete = () => {
    mutate();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-textColor">Review Queue</h1>
        {!isLoading && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-btnSimple text-textItemBlur border border-newBorder font-medium">
            {total} {total === 1 ? 'post' : 'posts'}
          </span>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-btnSimple flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-textItemBlur"
              />
            </svg>
          </div>
          <div className="text-base font-semibold text-textColor">
            No posts pending review
          </div>
          <div className="text-sm text-textItemBlur max-w-xs">
            All AI-generated posts have been reviewed. New content will appear
            here after generation.
          </div>
        </div>
      )}

      {/* Post list */}
      {!isLoading && posts.length > 0 && (
        <div className="space-y-4">
          {posts.map((post) => (
            <ReviewQueueItem
              key={post.id}
              post={post}
              companySlug={companySlug ?? ''}
              onActionComplete={handleActionComplete}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg px-3 py-1.5 text-sm font-medium border border-newBorder text-textColor hover:bg-boxHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-textItemBlur">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg px-3 py-1.5 text-sm font-medium border border-newBorder text-textColor hover:bg-boxHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
