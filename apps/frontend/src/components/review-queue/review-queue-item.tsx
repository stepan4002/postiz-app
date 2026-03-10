'use client';

import React, { FC, useState } from 'react';
import clsx from 'clsx';
import { ReviewPost } from './hooks/use-review-queue';
import { useReviewAction } from './hooks/use-review-action';
import { ConfidenceBadge } from './confidence-badge';
import { InlineCaptionEditor } from './inline-caption-editor';

interface ReviewQueueItemProps {
  post: ReviewPost;
  companySlug: string;
  onActionComplete: () => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500/10 text-pink-500 border-pink-500',
  facebook: 'bg-blue-500/10 text-blue-500 border-blue-500',
  linkedin: 'bg-sky-500/10 text-sky-500 border-sky-500',
  x: 'bg-gray-500/10 text-gray-400 border-gray-500',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-500/10 text-amber-500 border-amber-500',
  APPROVED: 'bg-green-500/10 text-green-500 border-green-500',
  REJECTED: 'bg-red-500/10 text-red-500 border-red-500',
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * ReviewQueueItem
 *
 * Card displaying a single content post with all platform variants,
 * confidence scores, action buttons (Approve All / Reject / Regenerate),
 * and inline caption editing per variant.
 */
export const ReviewQueueItem: FC<ReviewQueueItemProps> = ({
  post,
  companySlug,
  onActionComplete,
}) => {
  const reviewAction = useReviewAction(companySlug);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    await reviewAction.approve(post.id);
    setIsProcessing(false);
    onActionComplete();
  };

  const handleReject = async () => {
    setIsProcessing(true);
    await reviewAction.reject(post.id);
    setIsProcessing(false);
    onActionComplete();
  };

  const handleRegenerate = async () => {
    setIsProcessing(true);
    await reviewAction.regenerate(post.id);
    setIsProcessing(false);
    onActionComplete();
  };

  const handleSaveVariant = async (variantId: string, editedCaption: string) => {
    setIsProcessing(true);
    await reviewAction.editVariant(post.id, variantId, editedCaption);
    setEditingVariantId(null);
    setIsProcessing(false);
    onActionComplete();
  };

  const contentTypeBadge = post.contentType.replace(/_/g, ' ');
  const minioPublicUrl = (window as typeof window & { __MINIO_PUBLIC_URL__?: string }).__MINIO_PUBLIC_URL__;

  return (
    <div className="bg-newBgColorInner border border-newBorder rounded-lg shadow-sm p-4 space-y-4">
      {/* Post header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full border border-newBorder bg-btnSimple text-textItemBlur font-medium capitalize">
            {contentTypeBadge}
          </span>
          <span className="text-xs text-textItemBlur">
            {formatDate(post.createdAt)}
          </span>
        </div>
        {post.brief && (
          <p className="text-sm text-textItemBlur italic line-clamp-2 flex-1 min-w-0">
            {post.brief}
          </p>
        )}
      </div>

      {/* Media thumbnail (if mediaId present) */}
      {post.mediaId && minioPublicUrl && (
        <div className="w-24 h-24 rounded-lg overflow-hidden bg-newBgColor flex-shrink-0">
          <img
            src={`${minioPublicUrl}/${post.mediaId}`}
            alt="Post media"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Variants */}
      <div className="space-y-3">
        {post.variants.map((variant) => {
          const platformColor =
            PLATFORM_COLORS[variant.platform.toLowerCase()] ??
            'bg-newColColor text-textItemBlur border-newBorder';
          const statusColor =
            STATUS_COLORS[variant.status] ??
            'bg-newColColor text-textItemBlur border-newBorder';

          return (
            <div
              key={variant.id}
              className="border border-newBorder rounded-lg p-3 space-y-2"
            >
              {/* Variant header */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={clsx(
                    'text-xs px-2 py-0.5 rounded-full border font-medium capitalize',
                    platformColor
                  )}
                >
                  {variant.platform}
                </span>
                <span
                  className={clsx(
                    'text-xs px-2 py-0.5 rounded-full border font-medium',
                    statusColor
                  )}
                >
                  {variant.status.replace(/_/g, ' ')}
                </span>
                <ConfidenceBadge score={variant.confidenceScore} />
                <div className="ml-auto">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingVariantId(
                        editingVariantId === variant.id ? null : variant.id
                      )
                    }
                    disabled={isProcessing}
                    className="text-xs px-2 py-0.5 rounded border border-newBorder text-textItemBlur hover:text-textColor hover:border-btnPrimary transition-colors disabled:opacity-50"
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Caption */}
              {editingVariantId === variant.id ? (
                <InlineCaptionEditor
                  initialCaption={variant.caption}
                  onSave={(editedCaption) =>
                    handleSaveVariant(variant.id, editedCaption)
                  }
                  onCancel={() => setEditingVariantId(null)}
                />
              ) : (
                <p className="text-sm text-textColor leading-relaxed">
                  {variant.caption}
                </p>
              )}

              {/* Hashtags */}
              {variant.hashtags && variant.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {variant.hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-btnSimple text-textItemBlur px-2 py-0.5 rounded-full"
                    >
                      #{tag.startsWith('#') ? tag.slice(1) : tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-newBorder flex-wrap">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isProcessing}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Approve All
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={isProcessing}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isProcessing}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Regenerate
        </button>
        {isProcessing && (
          <span className="text-xs text-textItemBlur animate-pulse ml-2">
            Processing...
          </span>
        )}
      </div>
    </div>
  );
};
