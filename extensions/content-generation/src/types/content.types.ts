import { z } from 'zod';

// ============================================================================
// Content type enum — 7 supported content types for AI generation
// ============================================================================
export type ContentType =
  | 'product'
  | 'brand_story'
  | 'educational'
  | 'seasonal'
  | 'offer'
  | 'testimonial'
  | 'behind_the_scenes';

// ============================================================================
// Status enums for ContentPost and PostVariant lifecycle
// Extended in Phase 6 with scheduling/publishing/stale states
// ============================================================================
export type ContentPostStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'STALE';

export type PostVariantStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'STALE';

export type ReviewAction = 'approve' | 'edit_approve' | 'reject' | 'regenerate';

// ============================================================================
// DTOs for creating and reviewing content posts
// ============================================================================

/**
 * Input DTO for requesting AI content generation.
 * brief is in the user message (NF1.3 prompt injection prevention).
 */
export interface CreatePostDto {
  brandId: string;
  mediaId?: string;
  brief?: string;
  contentType: ContentType;
  platforms: string[];
}

/**
 * Input DTO for reviewing a PostVariant (approve, reject, etc.)
 */
export interface ReviewActionDto {
  action: ReviewAction;
  editedCaption?: string;
}

// ============================================================================
// Zod schemas for AI response validation
// ============================================================================

/**
 * Schema for AI image analysis output.
 * Used to validate structured output from analyzeImage task.
 */
export const ImageAnalysisSchema = z.object({
  description: z.string(),
  objects: z.array(z.string()),
  mood: z.string(),
  suggestedTone: z.string(),
});

export type ImageAnalysisResult = z.infer<typeof ImageAnalysisSchema>;

/**
 * Schema for AI caption generation output.
 * Used to validate structured output from generateCaption task.
 */
export const PlatformCaptionSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
});

export type PlatformCaptionResult = z.infer<typeof PlatformCaptionSchema>;

/**
 * Schema for AI content scoring output.
 * Score must be between 0 and 1.
 */
export const ConfidenceScoreSchema = z.object({
  score: z.number().min(0).max(1),
});

export type ConfidenceScoreResult = z.infer<typeof ConfidenceScoreSchema>;
