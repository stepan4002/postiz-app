import type { ContentPostStatus, PostVariantStatus } from '../types/content.types';

/**
 * Applies confidence gating to determine PostVariant review status.
 *
 * Rules:
 *   1. If requireAllReview is true → always PENDING_REVIEW (company policy override)
 *   2. If score >= threshold → APPROVED
 *   3. Otherwise → PENDING_REVIEW
 *
 * Default threshold is 0.7 (70% confidence required for auto-approval).
 *
 * @param score - Confidence score from AIProviderRouter.execute('scoreContent'), range [0, 1]
 * @param threshold - Minimum score for auto-approval (default 0.7)
 * @param requireAllReview - If true, override threshold and always require human review
 * @returns PostVariantStatus: 'APPROVED' or 'PENDING_REVIEW'
 */
export function applyConfidenceGating(
  score: number,
  threshold: number = 0.7,
  requireAllReview: boolean = false,
): PostVariantStatus {
  // Company policy override — always require human review regardless of score
  if (requireAllReview) {
    return 'PENDING_REVIEW';
  }

  // Auto-approve if score meets or exceeds threshold
  if (score >= threshold) {
    return 'APPROVED';
  }

  return 'PENDING_REVIEW';
}

/**
 * Derives the parent ContentPost status from all variant statuses.
 *
 * Rules (in priority order):
 *   1. Any PENDING_REVIEW variant → parent post is PENDING_REVIEW
 *   2. All APPROVED variants → parent post is APPROVED
 *   3. No variants, or all REJECTED → parent post is DRAFT
 *
 * @param variantStatuses - Array of PostVariantStatus values for all variants
 * @returns ContentPostStatus derived from variant statuses
 */
export function determinePostStatus(variantStatuses: PostVariantStatus[]): ContentPostStatus {
  if (variantStatuses.length === 0) {
    return 'DRAFT';
  }

  // Any PENDING_REVIEW → the post needs human attention
  if (variantStatuses.some((s) => s === 'PENDING_REVIEW')) {
    return 'PENDING_REVIEW';
  }

  // All APPROVED → post is auto-approved
  if (variantStatuses.every((s) => s === 'APPROVED')) {
    return 'APPROVED';
  }

  // All REJECTED or mixed REJECTED → back to DRAFT
  return 'DRAFT';
}
