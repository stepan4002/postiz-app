'use client';

import React, { FC, useCallback, useState } from 'react';
import clsx from 'clsx';
import { useSearchParams } from 'next/navigation';
import { useCompanyMedia } from './hooks/use-company-media';
import { MediaGrid } from './media-grid';
import { MediaUploadButton } from './media-upload-button';

/**
 * CompanyMediaLibrary
 *
 * Main media library page component. Composes:
 * - MediaUploadButton: upload images with optional tags
 * - Tag filter pills: filter grid by tag
 * - MediaGrid: responsive grid of media items
 * - Pagination: prev/next page navigation
 *
 * Company is resolved from the ?c={slug} query param (Phase 1 company switcher pattern).
 * Layout: upload button top-right, tag filter top-left, grid below, pagination bottom.
 */
export const CompanyMediaLibrary: FC = () => {
  const searchParams = useSearchParams();
  const companySlug = searchParams.get('c') ?? '';

  const [page, setPage] = useState(1);
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined);

  const { data, isLoading, mutate } = useCompanyMedia(
    companySlug,
    page,
    activeTag
  );

  const handleUploadComplete = useCallback(() => {
    mutate();
  }, [mutate]);

  const handleTagFilter = useCallback(
    (tag: string) => {
      if (activeTag === tag) {
        setActiveTag(undefined);
      } else {
        setActiveTag(tag);
        setPage(1);
      }
    },
    [activeTag]
  );

  const handleClearTag = useCallback(() => {
    setActiveTag(undefined);
    setPage(1);
  }, []);

  const handlePrevPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  // Collect all unique tags from current page items for the tag filter pills
  const availableTags = React.useMemo(() => {
    if (!data?.items) return [];
    const tagSet = new Set<string>();
    data.items.forEach((item) => {
      item.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [data?.items]);

  if (!companySlug) {
    return (
      <div className="flex items-center justify-center py-[60px]">
        <div className="text-[14px] text-textItemBlur">
          Select a company to view its media library.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[20px] p-[24px]">
      {/* Header row: tag filters left, upload button right */}
      <div className="flex items-start justify-between gap-[12px] flex-wrap">
        {/* Tag filter pills */}
        <div className="flex items-center gap-[6px] flex-wrap">
          <span className="text-[12px] text-textItemBlur font-[500]">
            Filter:
          </span>

          {/* "All" pill */}
          <button
            type="button"
            onClick={handleClearTag}
            className={clsx(
              'h-[28px] px-[10px] text-[11px] font-[500] rounded-full transition-colors',
              !activeTag
                ? 'bg-btnPrimary text-white'
                : 'bg-btnSimple text-textItemBlur hover:text-textColor'
            )}
          >
            All
          </button>

          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleTagFilter(tag)}
              className={clsx(
                'h-[28px] px-[10px] text-[11px] font-[500] rounded-full transition-colors',
                activeTag === tag
                  ? 'bg-btnPrimary text-white'
                  : 'bg-btnSimple text-textItemBlur hover:text-textColor'
              )}
            >
              {tag}
            </button>
          ))}

          {/* Active tag label when filtering */}
          {activeTag && (
            <span className="text-[11px] text-textItemBlur ml-[4px]">
              Showing: &ldquo;{activeTag}&rdquo;
            </span>
          )}
        </div>

        {/* Upload button */}
        <MediaUploadButton
          companySlug={companySlug}
          onUploadComplete={handleUploadComplete}
        />
      </div>

      {/* Media grid */}
      <MediaGrid
        items={data?.items ?? []}
        isLoading={isLoading}
      />

      {/* Pagination */}
      {(data?.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-[8px] mt-[8px]">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={page <= 1}
            className={clsx(
              'h-[36px] px-[14px] text-[13px] rounded-[8px] transition-colors border border-newBorder',
              page <= 1
                ? 'opacity-40 cursor-not-allowed text-textItemBlur'
                : 'text-textColor hover:bg-boxHover cursor-pointer'
            )}
          >
            Previous
          </button>

          <span className="text-[13px] text-textItemBlur px-[8px]">
            Page {page} of {data?.totalPages ?? 1}
          </span>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={page >= (data?.totalPages ?? 1)}
            className={clsx(
              'h-[36px] px-[14px] text-[13px] rounded-[8px] transition-colors border border-newBorder',
              page >= (data?.totalPages ?? 1)
                ? 'opacity-40 cursor-not-allowed text-textItemBlur'
                : 'text-textColor hover:bg-boxHover cursor-pointer'
            )}
          >
            Next
          </button>
        </div>
      )}

      {/* Item count */}
      {!isLoading && data && (
        <div className="text-[11px] text-textItemBlur text-center">
          {data.total} {data.total === 1 ? 'item' : 'items'} total
        </div>
      )}
    </div>
  );
};
