'use client';

import React, { FC } from 'react';
import clsx from 'clsx';

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'facebook', label: 'Facebook', icon: '👥' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'x', label: 'X', icon: '𝕏' },
] as const;

interface PlatformSelectorProps {
  selected: string[];
  onChange: (platforms: string[]) => void;
}

/**
 * PlatformSelector
 *
 * Multi-select toggle buttons for choosing target social media platforms.
 * Supports Instagram, Facebook, LinkedIn, and X.
 */
export const PlatformSelector: FC<PlatformSelectorProps> = ({
  selected,
  onChange,
}) => {
  const toggle = (platformId: string) => {
    if (selected.includes(platformId)) {
      onChange(selected.filter((p) => p !== platformId));
    } else {
      onChange([...selected, platformId]);
    }
  };

  return (
    <div className="flex flex-wrap gap-[8px]">
      {PLATFORMS.map((platform) => {
        const isSelected = selected.includes(platform.id);
        return (
          <button
            key={platform.id}
            type="button"
            onClick={() => toggle(platform.id)}
            className={clsx(
              'flex items-center gap-[6px] px-[14px] py-[8px] rounded-[8px] text-[13px] font-[500] border transition-colors duration-150',
              isSelected
                ? 'bg-btnPrimary text-white border-btnPrimary'
                : 'bg-btnSimple text-textItemBlur border-newBorder hover:border-btnPrimary hover:text-textColor'
            )}
          >
            <span>{platform.icon}</span>
            <span>{platform.label}</span>
          </button>
        );
      })}
    </div>
  );
};
