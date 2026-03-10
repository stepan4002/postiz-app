/**
 * Platform media specifications for Social Command Centre.
 * Defines required dimensions, file size limits, and accepted formats per platform.
 */

import type { VariantSpec } from '../types';

/**
 * Detailed media spec per platform, including all supported aspect ratios.
 */
export const PLATFORM_MEDIA_SPECS: Record<
  string,
  {
    variants: Array<{ width: number; height: number; label: string }>;
    maxFileSizeBytes: number;
    formats: string[];
  }
> = {
  instagram: {
    variants: [
      { width: 1080, height: 1080, label: 'square' },
      { width: 1080, height: 1350, label: 'portrait' },
      { width: 1080, height: 566, label: 'landscape' },
    ],
    // 8 MB
    maxFileSizeBytes: 8 * 1024 * 1024,
    formats: ['jpeg', 'jpg', 'png'],
  },
  facebook: {
    variants: [{ width: 1200, height: 630, label: 'standard' }],
    // 4 MB
    maxFileSizeBytes: 4 * 1024 * 1024,
    formats: ['jpeg', 'jpg', 'png'],
  },
  linkedin: {
    variants: [{ width: 1200, height: 627, label: 'standard' }],
    // 5 MB
    maxFileSizeBytes: 5 * 1024 * 1024,
    formats: ['jpeg', 'jpg', 'png'],
  },
  x: {
    variants: [{ width: 1200, height: 675, label: 'standard' }],
    // 5 MB
    maxFileSizeBytes: 5 * 1024 * 1024,
    formats: ['jpeg', 'jpg', 'png'],
  },
};

/**
 * Flattened map of platform -> VariantSpec[] for use in image processing pipelines.
 * Each entry represents a single resizing target for the platform.
 */
export const PLATFORM_VARIANT_SPECS: Record<string, VariantSpec[]> = Object.fromEntries(
  Object.entries(PLATFORM_MEDIA_SPECS).map(([platform, spec]) => [
    platform,
    spec.variants.map((v) => ({ platform, width: v.width, height: v.height })),
  ])
);
