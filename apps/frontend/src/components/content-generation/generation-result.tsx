'use client';

import React, { FC } from 'react';
import clsx from 'clsx';
import { GenerateResult } from './hooks/use-generate-post';

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  facebook: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  linkedin: 'bg-blue-800/20 text-blue-300 border-blue-700/30',
  x: 'bg-newColColor text-textItemBlur border-newBorder',
};

function getConfidenceBadgeClass(score: number): string {
  if (score > 0.7) return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (score >= 0.5) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

function getConfidenceLabel(score: number): string {
  if (score > 0.7) return 'High';
  if (score >= 0.5) return 'Medium';
  return 'Low';
}

function getStatusBadgeClass(status: string): string {
  if (status === 'APPROVED') return 'bg-green-500/20 text-green-400 border-green-500/30';
  return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
}

interface GenerationResultProps {
  result: GenerateResult | null;
  isLoading: boolean;
}

const SkeletonVariant: FC = () => (
  <div className="bg-newBgColorInner rounded-[10px] border border-newBorder p-[16px] space-y-[10px] animate-pulse">
    <div className="flex items-center gap-[8px]">
      <div className="h-[22px] w-[80px] bg-newSep rounded-full" />
      <div className="h-[22px] w-[60px] bg-newSep rounded-full" />
    </div>
    <div className="space-y-[6px]">
      <div className="h-[13px] bg-newSep rounded w-full" />
      <div className="h-[13px] bg-newSep rounded w-[90%]" />
      <div className="h-[13px] bg-newSep rounded w-[75%]" />
    </div>
    <div className="flex gap-[6px]">
      <div className="h-[20px] w-[50px] bg-newSep rounded-full" />
      <div className="h-[20px] w-[60px] bg-newSep rounded-full" />
      <div className="h-[20px] w-[45px] bg-newSep rounded-full" />
    </div>
  </div>
);

/**
 * GenerationResult
 *
 * Displays the AI-generated post variants with per-platform captions,
 * hashtag chips, confidence scores, and review status badges.
 */
export const GenerationResult: FC<GenerationResultProps> = ({
  result,
  isLoading,
}) => {
  if (!isLoading && !result) return null;

  if (isLoading) {
    return (
      <div className="space-y-[12px]">
        <div className="flex items-center gap-[8px] text-[14px] font-[600] text-textColor">
          <div className="w-[16px] h-[16px] border-[2px] border-btnPrimary border-t-transparent rounded-full animate-spin" />
          Generating captions...
        </div>
        {[1, 2, 3].map((i) => (
          <SkeletonVariant key={i} />
        ))}
      </div>
    );
  }

  const variants = result?.variants ?? [];

  if (variants.length === 0) {
    return (
      <div className="bg-newBgColorInner rounded-[10px] border border-newBorder p-[16px] text-[13px] text-textItemBlur text-center">
        No variants generated.
      </div>
    );
  }

  return (
    <div className="space-y-[12px]">
      <div className="text-[14px] font-[600] text-textColor">
        Generated Captions
      </div>
      {variants.map((variant: any, i: number) => {
        const platform = (variant.platform ?? 'unknown').toLowerCase();
        const platformColor =
          PLATFORM_COLORS[platform] ??
          'bg-newColColor text-textItemBlur border-newBorder';
        const confidence = typeof variant.confidenceScore === 'number'
          ? variant.confidenceScore
          : 0;
        const status = variant.status ?? 'PENDING_REVIEW';
        const hashtags: string[] = Array.isArray(variant.hashtags)
          ? variant.hashtags
          : [];

        return (
          <div
            key={variant.id ?? i}
            className="bg-newBgColorInner rounded-[10px] border border-newBorder p-[16px] space-y-[10px]"
          >
            {/* Header: platform + status + confidence */}
            <div className="flex items-center gap-[8px] flex-wrap">
              <span
                className={clsx(
                  'text-[11px] font-[600] px-[8px] py-[3px] rounded-full border capitalize',
                  platformColor
                )}
              >
                {platform}
              </span>
              <span
                className={clsx(
                  'text-[11px] font-[600] px-[8px] py-[3px] rounded-full border',
                  getStatusBadgeClass(status)
                )}
              >
                {status === 'APPROVED' ? 'Approved' : 'Pending Review'}
              </span>
              <span
                className={clsx(
                  'text-[11px] font-[500] px-[8px] py-[3px] rounded-full border ml-auto',
                  getConfidenceBadgeClass(confidence)
                )}
              >
                {getConfidenceLabel(confidence)} confidence ({Math.round(confidence * 100)}%)
              </span>
            </div>

            {/* Caption text */}
            <div className="text-[13px] text-textColor leading-[1.6] max-h-[120px] overflow-y-auto scrollbar-thin">
              {variant.caption ?? '(No caption generated)'}
            </div>

            {/* Hashtags */}
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-[5px]">
                {hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] bg-btnSimple text-textItemBlur px-[8px] py-[3px] rounded-full border border-newBorder"
                  >
                    #{tag.replace(/^#/, '')}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
