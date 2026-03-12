'use client';

import React, { FC } from 'react';
import clsx from 'clsx';
import { MediaItem } from './hooks/use-company-media';

interface MediaGridProps {
  items: MediaItem[];
  isLoading: boolean;
  minioPublicUrl?: string;
}

/**
 * Resolve a media path to a displayable URL.
 * MinIO paths are stored as keys (e.g. companyId/mediaId/filename).
 * If the path already starts with http, use it as-is.
 * Otherwise, prepend the MinIO public URL from the path (the path is already the full key).
 */
function resolveMediaUrl(path: string, minioPublicUrl?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (minioPublicUrl) {
    const base = minioPublicUrl.endsWith('/')
      ? minioPublicUrl.slice(0, -1)
      : minioPublicUrl;
    return `${base}/${path}`;
  }
  return path;
}

const FORMAT_COLORS: Record<string, string> = {
  jpeg: 'bg-blue-500/20 text-blue-400',
  jpg: 'bg-blue-500/20 text-blue-400',
  png: 'bg-green-500/20 text-green-400',
  gif: 'bg-purple-500/20 text-purple-400',
  webp: 'bg-yellow-500/20 text-yellow-400',
};

const MediaCard: FC<{ item: MediaItem; minioPublicUrl?: string }> = ({
  item,
  minioPublicUrl,
}) => {
  const thumbUrl = resolveMediaUrl(item.thumbnail || item.path, minioPublicUrl);
  const format = item.format?.toLowerCase() ?? '';
  const formatColorClass =
    FORMAT_COLORS[format] ?? 'bg-newColColor text-textItemBlur';
  const dimensions =
    item.width && item.height ? `${item.width}x${item.height}` : null;
  const displayName =
    item.name.length > 20 ? item.name.slice(0, 18) + '...' : item.name;

  return (
    <div className="group relative bg-newBgColorInner border border-newBorder rounded-[8px] overflow-hidden hover:border-btnPrimary transition-colors duration-150">
      {/* Thumbnail */}
      <div className="aspect-square relative overflow-hidden bg-newBgColor">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-textItemBlur text-[12px]">
            No preview
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="p-[8px] flex flex-col gap-[4px]">
        {/* File name */}
        <div
          className="text-[12px] font-[500] text-textColor truncate"
          title={item.name}
        >
          {displayName}
        </div>

        {/* Dimensions + format */}
        <div className="flex items-center gap-[4px] flex-wrap">
          {dimensions && (
            <span className="text-[10px] text-textItemBlur">{dimensions}</span>
          )}
          {format && (
            <span
              className={clsx(
                'text-[10px] px-[4px] py-[1px] rounded font-[500] uppercase',
                formatColorClass
              )}
            >
              {format}
            </span>
          )}
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-[3px] mt-[2px]">
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] bg-btnSimple text-textItemBlur px-[5px] py-[1px] rounded-full"
              >
                {tag}
              </span>
            ))}
            {item.tags.length > 3 && (
              <span className="text-[10px] text-textItemBlur">
                +{item.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const SkeletonCard: FC = () => (
  <div className="bg-newBgColorInner border border-newBorder rounded-[8px] overflow-hidden animate-pulse">
    <div className="aspect-square bg-newBgColor" />
    <div className="p-[8px] flex flex-col gap-[6px]">
      <div className="h-[12px] bg-newSep rounded w-[80%]" />
      <div className="h-[10px] bg-newSep rounded w-[50%]" />
    </div>
  </div>
);

/**
 * MediaGrid
 *
 * Responsive grid displaying company media items with thumbnails,
 * dimensions, format badges, and tag chips.
 *
 * - 4 cols on lg, 3 on md, 2 on sm
 * - Empty state: "No media uploaded yet" centered message
 * - Loading state: skeleton cards
 */
export const MediaGrid: FC<MediaGridProps> = ({
  items,
  isLoading,
  minioPublicUrl,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[12px]">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-[60px] text-center gap-[12px]">
        <div className="w-[48px] h-[48px] rounded-full bg-btnSimple flex items-center justify-center">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 16L8.586 11.414C9.367 10.633 10.633 10.633 11.414 11.414L16 16M14 14L15.586 12.414C16.367 11.633 17.633 11.633 18.414 12.414L20 14M14 8H14.01M6 20H18C19.105 20 20 19.105 20 18V6C20 4.895 19.105 4 18 4H6C4.895 4 4 4.895 4 6V18C4 19.105 4.895 20 6 20Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-textItemBlur"
            />
          </svg>
        </div>
        <div className="text-[16px] font-[600] text-textColor">
          No media uploaded yet
        </div>
        <div className="text-[13px] text-textItemBlur max-w-[280px]">
          Upload images using the button above to start building your media
          library.
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[12px]">
      {items.map((item) => (
        <MediaCard key={item.id} item={item} minioPublicUrl={minioPublicUrl} />
      ))}
    </div>
  );
};
