/**
 * PlatformMediaValidator unit tests.
 *
 * Validates platform media specs for Instagram, Facebook, LinkedIn, X.
 * Tests all validation cases: pass, wrong dimensions, oversized file,
 * unsupported format, and unknown platform.
 */

import { PlatformMediaValidator } from '../processing/platform-media-validator';

describe('PlatformMediaValidator', () => {
  let validator: PlatformMediaValidator;

  beforeEach(() => {
    validator = new PlatformMediaValidator();
  });

  describe('validate', () => {
    describe('instagram - square variant', () => {
      it('should pass when dimensions, fileSize, and format match spec', () => {
        const result = validator.validate(
          { width: 1080, height: 1080, fileSize: 1024 * 1024, format: 'jpeg' },
          'instagram',
          'square'
        );

        expect(result.platform).toBe('instagram');
        expect(result.passed).toBe(true);
        expect(result.reasons).toHaveLength(0);
      });

      it('should fail with reason when dimensions are wrong', () => {
        const result = validator.validate(
          { width: 800, height: 600, fileSize: 1024 * 1024, format: 'jpeg' },
          'instagram',
          'square'
        );

        expect(result.passed).toBe(false);
        expect(result.reasons.length).toBeGreaterThan(0);
        expect(result.reasons.some((r) => r.toLowerCase().includes('dimension'))).toBe(true);
      });

      it('should fail with reason when file is too large', () => {
        // 8 MB limit for instagram, use 10 MB
        const result = validator.validate(
          { width: 1080, height: 1080, fileSize: 10 * 1024 * 1024, format: 'jpeg' },
          'instagram',
          'square'
        );

        expect(result.passed).toBe(false);
        expect(result.reasons.some((r) => r.toLowerCase().includes('file size'))).toBe(true);
      });

      it('should fail with reason when format is unsupported', () => {
        const result = validator.validate(
          { width: 1080, height: 1080, fileSize: 1024 * 1024, format: 'webp' },
          'instagram',
          'square'
        );

        expect(result.passed).toBe(false);
        expect(result.reasons.some((r) => r.toLowerCase().includes('format'))).toBe(true);
      });
    });

    describe('instagram - portrait variant', () => {
      it('should pass for portrait dimensions', () => {
        const result = validator.validate(
          { width: 1080, height: 1350, fileSize: 2 * 1024 * 1024, format: 'jpeg' },
          'instagram',
          'portrait'
        );

        expect(result.passed).toBe(true);
      });
    });

    describe('instagram - landscape variant', () => {
      it('should pass for landscape dimensions', () => {
        const result = validator.validate(
          { width: 1080, height: 566, fileSize: 2 * 1024 * 1024, format: 'jpeg' },
          'instagram',
          'landscape'
        );

        expect(result.passed).toBe(true);
      });
    });

    describe('facebook', () => {
      it('should pass for correct facebook standard spec', () => {
        const result = validator.validate(
          { width: 1200, height: 630, fileSize: 2 * 1024 * 1024, format: 'jpeg' },
          'facebook'
        );

        expect(result.passed).toBe(true);
        expect(result.platform).toBe('facebook');
      });

      it('should fail when exceeding 4 MB limit', () => {
        const result = validator.validate(
          { width: 1200, height: 630, fileSize: 5 * 1024 * 1024, format: 'jpeg' },
          'facebook'
        );

        expect(result.passed).toBe(false);
        expect(result.reasons.some((r) => r.toLowerCase().includes('file size'))).toBe(true);
      });
    });

    describe('linkedin', () => {
      it('should pass for correct linkedin standard spec', () => {
        const result = validator.validate(
          { width: 1200, height: 627, fileSize: 3 * 1024 * 1024, format: 'png' },
          'linkedin'
        );

        expect(result.passed).toBe(true);
      });
    });

    describe('x (twitter)', () => {
      it('should pass for correct x standard spec', () => {
        const result = validator.validate(
          { width: 1200, height: 675, fileSize: 4 * 1024 * 1024, format: 'jpeg' },
          'x'
        );

        expect(result.passed).toBe(true);
      });
    });

    describe('unknown platform', () => {
      it('should return passed=false with unknown platform reason', () => {
        const result = validator.validate(
          { width: 1200, height: 630, fileSize: 1024 * 1024, format: 'jpeg' },
          'tiktok'
        );

        expect(result.passed).toBe(false);
        expect(result.reasons.some((r) => r.toLowerCase().includes('unknown platform'))).toBe(true);
      });
    });
  });

  describe('validateAll', () => {
    it('should validate multiple variants against multiple platforms', () => {
      const variants = [
        { platform: 'instagram', width: 1080, height: 1080, fileSize: 2 * 1024 * 1024, format: 'jpeg' },
        { platform: 'facebook', width: 1200, height: 630, fileSize: 2 * 1024 * 1024, format: 'jpeg' },
      ];

      const results = validator.validateAll(variants, ['instagram', 'facebook']);

      expect(results).toHaveLength(2);
      expect(results.find((r) => r.platform === 'instagram')?.passed).toBe(true);
      expect(results.find((r) => r.platform === 'facebook')?.passed).toBe(true);
    });

    it('should return failed result for platform with no matching variant', () => {
      // LinkedIn has no variant provided — should report failure
      const variants = [
        { platform: 'instagram', width: 1080, height: 1080, fileSize: 2 * 1024 * 1024, format: 'jpeg' },
      ];

      const results = validator.validateAll(variants, ['instagram', 'linkedin']);

      expect(results).toHaveLength(2);
      expect(results.find((r) => r.platform === 'linkedin')?.passed).toBe(false);
    });
  });
});
