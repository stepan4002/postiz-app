'use client';

import React, { FC } from 'react';
import clsx from 'clsx';
import { ScheduledPost } from './use-scheduled-posts';
import { PostCard } from './post-card';

interface CalendarDayCellProps {
  date: Date;
  posts: ScheduledPost[];
  isToday: boolean;
  isCurrentMonth: boolean;
  onPostClick?: (post: ScheduledPost) => void;
}

const MAX_VISIBLE = 3;

/**
 * CalendarDayCell
 *
 * Single day cell for the calendar grid. Displays date number,
 * up to 3 post cards, and a "+N more" overflow indicator.
 */
export const CalendarDayCell: FC<CalendarDayCellProps> = ({
  date,
  posts,
  isToday,
  isCurrentMonth,
  onPostClick,
}) => {
  const dayNumber = date.getDate();
  const visiblePosts = posts.slice(0, MAX_VISIBLE);
  const overflowCount = posts.length - MAX_VISIBLE;

  // Flatten all variants for display — show first variant of each post
  const displayItems = visiblePosts.map((post) => ({
    post,
    variant: post.variants[0],
  }));

  return (
    <div
      className={clsx(
        'min-h-[100px] p-1.5 border-b border-r border-newBorder flex flex-col gap-1',
        !isCurrentMonth && 'opacity-40',
        isToday && 'bg-btnPrimary/5'
      )}
    >
      {/* Date number */}
      <div className="flex items-center justify-end mb-0.5">
        <span
          className={clsx(
            'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
            isToday
              ? 'bg-btnPrimary text-white'
              : 'text-textItemBlur'
          )}
        >
          {dayNumber}
        </span>
      </div>

      {/* Post cards */}
      <div className="flex flex-col gap-1 flex-1">
        {displayItems.map(({ post, variant }) =>
          variant ? (
            <PostCard
              key={variant.id}
              variant={variant}
              onClick={() => onPostClick?.(post)}
            />
          ) : null
        )}

        {/* Overflow indicator */}
        {overflowCount > 0 && (
          <span className="text-[10px] text-textItemBlur px-1">
            +{overflowCount} more
          </span>
        )}
      </div>
    </div>
  );
};
