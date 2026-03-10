/**
 * PlatformMediaValidator
 *
 * Pure validation service — checks media variant dimensions, file size, and format
 * against PLATFORM_MEDIA_SPECS. No DB dependency.
 *
 * Used by Phase 6 (Scheduling & Publishing Engine) before publishing variants.
 */

import { Injectable } from '@nestjs/common';
import { PLATFORM_MEDIA_SPECS } from './platform-specs';
import type { PlatformValidationResult } from '../types';

export interface VariantToValidate {
  width: number;
  height: number;
  fileSize: number;
  format: string;
}

export interface VariantWithPlatform extends VariantToValidate {
  platform: string;
}

@Injectable()
export class PlatformMediaValidator {
  /**
   * Validate a single variant against the spec for a given platform.
   *
   * For Instagram (which has multiple aspect ratios), pass the aspectRatio label
   * (e.g., 'square', 'portrait', 'landscape') to select the correct sub-spec.
   * For other platforms the first (and only) variant spec is used.
   *
   * @param variant  The media to validate
   * @param platform Platform key (e.g., 'instagram', 'facebook', 'linkedin', 'x')
   * @param aspectRatio  Optional: Instagram sub-spec label ('square' | 'portrait' | 'landscape')
   */
  validate(variant: VariantToValidate, platform: string, aspectRatio?: string): PlatformValidationResult {
    const spec = PLATFORM_MEDIA_SPECS[platform];

    if (!spec) {
      return {
        platform,
        passed: false,
        reasons: [`Unknown platform: ${platform}`],
      };
    }

    const reasons: string[] = [];

    // Select the correct dimension variant from the spec
    let dimensionSpec: { width: number; height: number; label: string } | undefined;
    if (aspectRatio) {
      dimensionSpec = spec.variants.find((v) => v.label === aspectRatio);
    }
    // Default: use first variant if no aspectRatio provided or not found
    if (!dimensionSpec) {
      dimensionSpec = spec.variants[0];
    }

    // Check dimensions — must match exactly (cover fit resize should produce exact target)
    if (variant.width !== dimensionSpec.width || variant.height !== dimensionSpec.height) {
      reasons.push(
        `Dimension mismatch: expected ${dimensionSpec.width}x${dimensionSpec.height}, got ${variant.width}x${variant.height}`
      );
    }

    // Check file size
    if (variant.fileSize > spec.maxFileSizeBytes) {
      const maxMb = (spec.maxFileSizeBytes / (1024 * 1024)).toFixed(0);
      const actualMb = (variant.fileSize / (1024 * 1024)).toFixed(2);
      reasons.push(`File size ${actualMb} MB exceeds platform limit of ${maxMb} MB`);
    }

    // Check format
    const normalizedFormat = variant.format.toLowerCase().replace('jpg', 'jpeg');
    const allowedFormats = spec.formats.map((f) => f.toLowerCase().replace('jpg', 'jpeg'));
    if (!allowedFormats.includes(normalizedFormat)) {
      reasons.push(
        `Unsupported format '${variant.format}'. Allowed: ${spec.formats.join(', ')}`
      );
    }

    return {
      platform,
      passed: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Validate multiple variants against their respective platforms.
   *
   * For each platform in the `platforms` array, finds the matching variant
   * from `variants` (by platform field) and runs validate().
   * If no variant is found for a platform, returns a failed result.
   *
   * @param variants  Array of variant objects (each includes a `platform` field)
   * @param platforms  Platforms to validate against
   */
  validateAll(variants: VariantWithPlatform[], platforms: string[]): PlatformValidationResult[] {
    return platforms.map((platform) => {
      const variant = variants.find((v) => v.platform === platform);

      if (!variant) {
        return {
          platform,
          passed: false,
          reasons: [`No variant provided for platform: ${platform}`],
        };
      }

      return this.validate(variant, platform);
    });
  }
}
