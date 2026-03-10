'use client';

import React, { FC } from 'react';

const CONTENT_TYPES = [
  { value: 'product', label: 'Product' },
  { value: 'brand_story', label: 'Brand Story' },
  { value: 'educational', label: 'Educational' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'offer', label: 'Offer' },
  { value: 'testimonial', label: 'Testimonial' },
  { value: 'behind_the_scenes', label: 'Behind the Scenes' },
] as const;

interface ContentTypeSelectorProps {
  value: string;
  onChange: (type: string) => void;
}

/**
 * ContentTypeSelector
 *
 * Dropdown for selecting the AI content generation type.
 * Provides 7 options matching the backend content type union.
 */
export const ContentTypeSelector: FC<ContentTypeSelectorProps> = ({
  value,
  onChange,
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-[8px] border border-newBorder bg-newBgColorInner text-textColor text-[13px] p-[10px] focus:outline-none focus:border-btnPrimary transition-colors duration-150"
    >
      {CONTENT_TYPES.map((type) => (
        <option key={type.value} value={type.value}>
          {type.label}
        </option>
      ))}
    </select>
  );
};
