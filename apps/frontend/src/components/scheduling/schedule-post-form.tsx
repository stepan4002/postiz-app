'use client';

import React, { FC, useState, useCallback } from 'react';
import clsx from 'clsx';
import { ScheduledPost } from './use-scheduled-posts';
import { useScheduleActions } from './use-schedule-actions';

interface SchedulePostFormProps {
  post: ScheduledPost | null;
  companySlug: string;
  onClose: () => void;
  onScheduled?: () => void;
}

const PLATFORM_BADGE_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500/10 text-pink-500 border-pink-500',
  facebook: 'bg-blue-500/10 text-blue-500 border-blue-500',
  linkedin: 'bg-sky-500/10 text-sky-500 border-sky-500',
  x: 'bg-gray-500/10 text-gray-400 border-gray-500',
};

function toDatetimeLocalValue(isoString?: string): string {
  if (!isoString) return '';
  // datetime-local requires format: YYYY-MM-DDTHH:mm
  const d = new Date(isoString);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromDatetimeLocalValue(value: string): string {
  if (!value) return '';
  return new Date(value).toISOString();
}

/**
 * SchedulePostForm
 *
 * Modal form for scheduling a post. Provides:
 * - Date/time picker (native datetime-local input)
 * - Auto-slot button to get system-assigned time
 * - Cancel scheduling (if already scheduled)
 * - Post preview with caption and platform badges
 */
export const SchedulePostForm: FC<SchedulePostFormProps> = ({
  post,
  companySlug,
  onClose,
  onScheduled,
}) => {
  const actions = useScheduleActions(companySlug);
  const [scheduledAtLocal, setScheduledAtLocal] = useState(
    toDatetimeLocalValue(post?.scheduledAt)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoSlotting, setIsAutoSlotting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAlreadyScheduled = Boolean(post?.scheduledAt);
  const platforms = post?.variants.map((v) => v.platform) ?? [];
  const captionPreview = post?.variants[0]?.caption ?? '';

  const handleAutoSlot = useCallback(async () => {
    if (!post) return;
    setIsAutoSlotting(true);
    setError(null);
    try {
      const result = await actions.autoSlot(post.id);
      setScheduledAtLocal(toDatetimeLocalValue(result.scheduledAt));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to get auto-slot time'
      );
    } finally {
      setIsAutoSlotting(false);
    }
  }, [post, actions]);

  const handleSchedule = useCallback(async () => {
    if (!post || !scheduledAtLocal) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const isoTime = fromDatetimeLocalValue(scheduledAtLocal);
      await actions.schedule(post.id, isoTime);
      onScheduled?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule post');
    } finally {
      setIsSubmitting(false);
    }
  }, [post, scheduledAtLocal, actions, onScheduled, onClose]);

  const handleCancel = useCallback(async () => {
    if (!post) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await actions.cancel(post.id);
      onScheduled?.();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to cancel schedule'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [post, actions, onScheduled, onClose]);

  if (!post) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-newBgColorInner border border-newBorder rounded-xl shadow-menu w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-newBorder">
          <h2 className="text-base font-semibold text-textColor">
            Schedule Post
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-boxHover text-textItemBlur hover:text-textColor transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Post preview */}
          <div className="p-3 bg-newBgColor rounded-lg border border-newBorder space-y-2">
            {/* Platform badges */}
            <div className="flex flex-wrap gap-1.5">
              {platforms.map((platform) => {
                const key = platform.toLowerCase();
                const colorClass =
                  PLATFORM_BADGE_COLORS[key] ??
                  'bg-newColColor text-textItemBlur border-newBorder';
                return (
                  <span
                    key={platform}
                    className={clsx(
                      'text-xs px-2 py-0.5 rounded-full border font-medium capitalize',
                      colorClass
                    )}
                  >
                    {platform}
                  </span>
                );
              })}
            </div>

            {/* Caption preview */}
            <p className="text-sm text-textColor leading-relaxed line-clamp-3">
              {captionPreview}
            </p>
          </div>

          {/* Date/time picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-textItemBlur">
              Scheduled Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={scheduledAtLocal}
              onChange={(e) => setScheduledAtLocal(e.target.value)}
              className="w-full bg-input text-textColor text-sm rounded-lg border border-newBorder px-3 py-2 focus:border-btnPrimary outline-none transition-colors"
            />
          </div>

          {/* Auto-slot button */}
          <button
            type="button"
            onClick={handleAutoSlot}
            disabled={isAutoSlotting || isSubmitting}
            className="w-full py-2 text-sm font-medium rounded-lg border border-newBorder text-textItemBlur hover:text-textColor hover:bg-boxHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAutoSlotting ? 'Finding best time…' : 'Auto-slot (pick best time)'}
          </button>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-newBorder flex-wrap">
          {/* Cancel scheduling (only if already scheduled) */}
          <div>
            {isAlreadyScheduled && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="text-sm font-medium text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                Remove Schedule
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-newBorder text-textItemBlur hover:text-textColor hover:bg-boxHover transition-colors disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSchedule}
              disabled={isSubmitting || !scheduledAtLocal}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-btnPrimary text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
