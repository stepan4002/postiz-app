'use client';

import React, { FC, useState, useMemo } from 'react';
import clsx from 'clsx';
import { useScheduledPosts, ScheduledPost } from './use-scheduled-posts';
import { CalendarDayCell } from './calendar-day-cell';
import { PostCard } from './post-card';

type ViewMode = 'week' | 'day';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const HOUR_LABELS = Array.from({ length: 18 }, (_, i) => {
  const hour = i + 6; // 6am to 11pm
  return hour < 12
    ? `${hour}am`
    : hour === 12
    ? '12pm'
    : `${hour - 12}pm`;
});

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getWeekDates(date: Date): Date[] {
  const d = new Date(date);
  // Get Monday of the week
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Sunday=0 → go back 6, otherwise go back (day-1)
  d.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(d);
    dd.setDate(d.getDate() + i);
    return dd;
  });
}

function toISO(date: Date): string {
  return date.toISOString().split('T')[0] + 'T00:00:00Z';
}

function getPostsForDate(posts: ScheduledPost[], date: Date): ScheduledPost[] {
  return posts.filter((post) => {
    const scheduledDate = post.scheduledAt ? new Date(post.scheduledAt) : null;
    if (!scheduledDate) return false;
    return isSameDay(scheduledDate, date);
  });
}

function getPostHour(post: ScheduledPost): number {
  if (!post.scheduledAt) return 6;
  const d = new Date(post.scheduledAt);
  return d.getHours();
}

interface SchedulingCalendarProps {
  companySlug: string;
  onSchedulePost?: (post: ScheduledPost) => void;
}

/**
 * SchedulingCalendar
 *
 * Main calendar component with day/week toggle.
 * Fetches scheduled posts via useScheduledPosts SWR hook.
 * Week view: 7-column grid with post cards per day.
 * Day view: hourly time slots (6am-11pm) with posts positioned by time.
 */
export const SchedulingCalendar: FC<SchedulingCalendarProps> = ({
  companySlug,
  onSchedulePost,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const today = new Date();

  // Compute date range for API call
  const { from, to } = useMemo(() => {
    if (viewMode === 'week') {
      const weekDates = getWeekDates(currentDate);
      return {
        from: toISO(weekDates[0]),
        to: toISO(weekDates[6]),
      };
    } else {
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(currentDate);
      end.setHours(23, 59, 59, 999);
      return {
        from: start.toISOString(),
        to: end.toISOString(),
      };
    }
  }, [currentDate, viewMode]);

  const { data, isLoading } = useScheduledPosts(companySlug, from, to);
  const posts = data?.posts ?? [];

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);

  const navigatePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'week') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 1);
    }
    setCurrentDate(d);
  };

  const navigateNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'week') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
    }
    setCurrentDate(d);
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  // Format period label
  const periodLabel = useMemo(() => {
    if (viewMode === 'week') {
      const start = weekDates[0];
      const end = weekDates[6];
      const startStr = start.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      const endStr = end.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${startStr} – ${endStr}`;
    } else {
      return currentDate.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  }, [viewMode, currentDate, weekDates]);

  return (
    <div className="bg-newBgColorInner border border-newBorder rounded-lg overflow-hidden flex flex-col">
      {/* Calendar header */}
      <div className="flex items-center justify-between p-4 border-b border-newBorder gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={navigatePrev}
            className="p-1.5 rounded-lg hover:bg-boxHover transition-colors text-textItemBlur hover:text-textColor"
            aria-label="Previous"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 12L6 8L10 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span className="text-sm font-medium text-textColor min-w-[180px] text-center">
            {periodLabel}
          </span>
          <button
            type="button"
            onClick={navigateNext}
            className="p-1.5 rounded-lg hover:bg-boxHover transition-colors text-textItemBlur hover:text-textColor"
            aria-label="Next"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 4L10 8L6 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={navigateToday}
            className="ml-2 text-xs px-2.5 py-1 rounded-lg border border-newBorder hover:bg-boxHover transition-colors text-textItemBlur hover:text-textColor"
          >
            Today
          </button>
        </div>

        {/* View toggle */}
        <div className="flex items-center border border-newBorder rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={clsx(
              'px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'week'
                ? 'bg-btnPrimary text-white'
                : 'text-textItemBlur hover:text-textColor hover:bg-boxHover'
            )}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setViewMode('day')}
            className={clsx(
              'px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'day'
                ? 'bg-btnPrimary text-white'
                : 'text-textItemBlur hover:text-textColor hover:bg-boxHover'
            )}
          >
            Day
          </button>
        </div>
      </div>

      {/* Calendar body */}
      {isLoading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 bg-btnSimple rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : viewMode === 'week' ? (
        <WeekView
          weekDates={weekDates}
          today={today}
          posts={posts}
          onPostClick={onSchedulePost}
        />
      ) : (
        <DayView
          date={currentDate}
          today={today}
          posts={posts}
          onPostClick={onSchedulePost}
        />
      )}
    </div>
  );
};

// ---- Week View ----

interface WeekViewProps {
  weekDates: Date[];
  today: Date;
  posts: ScheduledPost[];
  onPostClick?: (post: ScheduledPost) => void;
}

const WeekView: FC<WeekViewProps> = ({
  weekDates,
  today,
  posts,
  onPostClick,
}) => {
  const totalPosts = posts.length;

  return (
    <div className="flex-1 overflow-auto">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-newBorder">
        {weekDates.map((date, i) => {
          const isToday = isSameDay(date, today);
          return (
            <div
              key={i}
              className={clsx(
                'text-center py-2 text-xs font-medium border-r border-newBorder last:border-r-0',
                isToday ? 'text-btnPrimary' : 'text-textItemBlur'
              )}
            >
              <div>{WEEKDAY_LABELS[i]}</div>
              <div
                className={clsx(
                  'text-sm mt-0.5',
                  isToday ? 'font-bold text-btnPrimary' : 'text-textColor'
                )}
              >
                {date.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day cells grid */}
      <div className="grid grid-cols-7">
        {weekDates.map((date, i) => {
          const dayPosts = getPostsForDate(posts, date);
          const isToday = isSameDay(date, today);
          const isCurrentMonth = date.getMonth() === today.getMonth();
          return (
            <CalendarDayCell
              key={i}
              date={date}
              posts={dayPosts}
              isToday={isToday}
              isCurrentMonth={isCurrentMonth}
              onPostClick={onPostClick}
            />
          );
        })}
      </div>

      {/* Empty state */}
      {totalPosts === 0 && (
        <div className="text-center py-12 text-textItemBlur text-sm">
          No posts scheduled for this week
        </div>
      )}
    </div>
  );
};

// ---- Day View ----

interface DayViewProps {
  date: Date;
  today: Date;
  posts: ScheduledPost[];
  onPostClick?: (post: ScheduledPost) => void;
}

const DayView: FC<DayViewProps> = ({ date, posts, onPostClick }) => {
  const dayPosts = getPostsForDate(posts, date);

  return (
    <div className="flex-1 overflow-auto">
      {dayPosts.length === 0 ? (
        <div className="text-center py-12 text-textItemBlur text-sm">
          No posts scheduled for this day
        </div>
      ) : (
        <div className="divide-y divide-newBorder">
          {HOUR_LABELS.map((label, i) => {
            const hour = i + 6;
            const hourPosts = dayPosts.filter(
              (p) => getPostHour(p) === hour
            );
            return (
              <div key={hour} className="flex gap-3 px-4 py-2 min-h-[56px]">
                <div className="w-12 text-xs text-textItemBlur pt-1 flex-shrink-0">
                  {label}
                </div>
                <div className="flex-1 flex flex-wrap gap-2">
                  {hourPosts.map((post) =>
                    post.variants.map((variant) => (
                      <div key={variant.id} className="w-48">
                        <PostCard
                          variant={variant}
                          onClick={() => onPostClick?.(post)}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
