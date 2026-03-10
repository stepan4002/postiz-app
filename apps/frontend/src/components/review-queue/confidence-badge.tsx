'use client';

import React, { FC } from 'react';
import clsx from 'clsx';

interface ConfidenceBadgeProps {
  score: number;
}

/**
 * ConfidenceBadge
 *
 * Displays an AI confidence score as a color-coded percentage badge.
 * Color coding matches CONTEXT.md specification:
 *   - red:    score < 0.5
 *   - yellow: score >= 0.5 and < 0.7
 *   - green:  score >= 0.7
 */
export const ConfidenceBadge: FC<ConfidenceBadgeProps> = ({ score }) => {
  const colorClass =
    score >= 0.7
      ? 'bg-green-500/10 text-green-500 border-green-500'
      : score >= 0.5
      ? 'bg-amber-500/10 text-amber-500 border-amber-500'
      : 'bg-red-500/10 text-red-500 border-red-500';

  const percentage = Math.round(score * 100);

  return (
    <span
      className={clsx(
        'text-xs px-2 py-0.5 rounded-full border font-medium',
        colorClass
      )}
      title={`Confidence score: ${percentage}%`}
    >
      {percentage}%
    </span>
  );
};
