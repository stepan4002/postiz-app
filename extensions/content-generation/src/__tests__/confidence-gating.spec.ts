import { applyConfidenceGating, determinePostStatus } from '../posts/confidence-gating';
import type { PostVariantStatus } from '../types/content.types';

describe('applyConfidenceGating', () => {
  describe('with requireAllReview = false (auto-gating enabled)', () => {
    it('should return APPROVED when score >= threshold', () => {
      expect(applyConfidenceGating(0.8, 0.7, false)).toBe('APPROVED');
    });

    it('should return PENDING_REVIEW when score < threshold', () => {
      expect(applyConfidenceGating(0.5, 0.7, false)).toBe('PENDING_REVIEW');
    });

    it('should return APPROVED at exactly the threshold (0.7)', () => {
      expect(applyConfidenceGating(0.7, 0.7, false)).toBe('APPROVED');
    });

    it('should return PENDING_REVIEW for score of 0.0', () => {
      expect(applyConfidenceGating(0.0, 0.7, false)).toBe('PENDING_REVIEW');
    });

    it('should return APPROVED for score of 1.0', () => {
      expect(applyConfidenceGating(1.0, 0.7, false)).toBe('APPROVED');
    });
  });

  describe('with requireAllReview = true (always pending)', () => {
    it('should return PENDING_REVIEW even when score >= threshold', () => {
      expect(applyConfidenceGating(0.8, 0.7, true)).toBe('PENDING_REVIEW');
    });

    it('should return PENDING_REVIEW when score < threshold', () => {
      expect(applyConfidenceGating(0.5, 0.7, true)).toBe('PENDING_REVIEW');
    });
  });

  describe('default threshold', () => {
    it('should use default threshold of 0.7 when not provided', () => {
      // score >= 0.7 -> APPROVED with default threshold
      expect(applyConfidenceGating(0.7)).toBe('APPROVED');
      // score < 0.7 -> PENDING_REVIEW with default threshold
      expect(applyConfidenceGating(0.69)).toBe('PENDING_REVIEW');
    });
  });
});

describe('determinePostStatus', () => {
  it('should return APPROVED when all variants are APPROVED', () => {
    const statuses: PostVariantStatus[] = ['APPROVED', 'APPROVED', 'APPROVED'];
    expect(determinePostStatus(statuses)).toBe('APPROVED');
  });

  it('should return PENDING_REVIEW when any variant is PENDING_REVIEW', () => {
    const statuses: PostVariantStatus[] = ['APPROVED', 'PENDING_REVIEW', 'APPROVED'];
    expect(determinePostStatus(statuses)).toBe('PENDING_REVIEW');
  });

  it('should return PENDING_REVIEW when all variants are PENDING_REVIEW', () => {
    const statuses: PostVariantStatus[] = ['PENDING_REVIEW', 'PENDING_REVIEW'];
    expect(determinePostStatus(statuses)).toBe('PENDING_REVIEW');
  });

  it('should return DRAFT when there are no variants', () => {
    expect(determinePostStatus([])).toBe('DRAFT');
  });

  it('should return DRAFT when variants are REJECTED', () => {
    const statuses: PostVariantStatus[] = ['REJECTED', 'REJECTED'];
    expect(determinePostStatus(statuses)).toBe('DRAFT');
  });
});
