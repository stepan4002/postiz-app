'use client';

import React, { FC } from 'react';
import clsx from 'clsx';
import { ScheduledVariant } from './use-scheduled-posts';

interface PostCardProps {
  variant: ScheduledVariant;
  onClick?: () => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-600',
  linkedin: 'bg-sky-500',
  x: 'bg-gray-600',
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-amber-500/10 text-amber-500 border-amber-500',
  PUBLISHING: 'bg-blue-500/10 text-blue-400 border-blue-500',
  PUBLISHED: 'bg-green-500/10 text-green-500 border-green-500',
  FAILED: 'bg-red-500/10 text-red-500 border-red-500',
  STALE: 'bg-orange-500/10 text-orange-500 border-orange-500',
};

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * PostCard
 *
 * Compact card representing a scheduled post variant on the calendar.
 * Shows platform color bar, caption preview, time, and status badge.
 */
export const PostCard: FC<PostCardProps> = ({ variant, onClick }) => {
  const platformKey = variant.platform.toLowerCase();
  const platformColor =
    PLATFORM_COLORS[platformKey] ?? 'bg-newColColor';
  const statusColor =
    STATUS_BADGE_COLORS[variant.status] ??
    'bg-newColColor text-textItemBlur border-newBorder';

  const captionPreview =
    variant.caption.length > 50
      ? variant.caption.slice(0, 50) + '…'
      : variant.caption;

  const timeDisplay = variant.scheduledAt ? formatTime(variant.scheduledAt) : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-newBgColorInner border border-newBorder rounded-md overflow-hidden hover:border-btnPrimary transition-colors duration-150 group"
    >
      {/* Platform color bar */}
      <div className={clsx('h-1 w-full', platformColor)} />

      <div className="p-2 space-y-1">
        {/* Header: platform + time */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-semibold text-textItemBlur capitalize">
            {variant.platform}
          </span>
          {timeDisplay && (
            <span className="text-[10px] text-textItemBlur">{timeDisplay}</span>
          )}
        </div>

        {/* Caption preview */}
        <p className="text-[11px] text-textColor leading-tight line-clamp-2">
          {captionPreview}
        </p>

        {/* Status badge */}
        <span
          className={clsx(
            'inline-block text-[9px] px-1.5 py-0.5 rounded-full border font-medium',
            statusColor
          )}
        >
          {variant.status}
        </span>
      </div>
    </button>
  );
};
