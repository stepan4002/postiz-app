import {
  canTransition,
  assertTransition,
  getValidTransitions,
} from '../state-machine/post-state-machine';
import type { ContentPostStatus } from '../types/scheduling.types';

describe('PostStateMachine', () => {
  // ============================================================================
  // Valid transitions
  // ============================================================================

  describe('valid transitions', () => {
    it('Test 1: APPROVED -> SCHEDULED is valid transition', () => {
      expect(canTransition('APPROVED', 'SCHEDULED')).toBe(true);
    });

    it('Test 2: SCHEDULED -> PUBLISHING is valid transition', () => {
      expect(canTransition('SCHEDULED', 'PUBLISHING')).toBe(true);
    });

    it('Test 3: PUBLISHING -> PUBLISHED is valid transition', () => {
      expect(canTransition('PUBLISHING', 'PUBLISHED')).toBe(true);
    });

    it('Test 4: PUBLISHING -> FAILED is valid transition', () => {
      expect(canTransition('PUBLISHING', 'FAILED')).toBe(true);
    });

    it('Test 5: FAILED -> SCHEDULED is valid (retry)', () => {
      expect(canTransition('FAILED', 'SCHEDULED')).toBe(true);
    });

    it('Test 11: SCHEDULED -> STALE is valid transition (publish window expired)', () => {
      expect(canTransition('SCHEDULED', 'STALE')).toBe(true);
    });

    it('Test 12: STALE -> SCHEDULED is valid (operator reschedules)', () => {
      expect(canTransition('STALE', 'SCHEDULED')).toBe(true);
    });
  });

  // ============================================================================
  // Invalid transitions
  // ============================================================================

  describe('invalid transitions', () => {
    it('Test 6: DRAFT -> PUBLISHED is invalid (skipping states)', () => {
      expect(canTransition('DRAFT', 'PUBLISHED')).toBe(false);
    });

    it('Test 7: PUBLISHED -> SCHEDULED is invalid (already published)', () => {
      expect(canTransition('PUBLISHED', 'SCHEDULED')).toBe(false);
    });

    it('Test 8: APPROVED -> PUBLISHED is invalid (must go through SCHEDULED)', () => {
      expect(canTransition('APPROVED', 'PUBLISHED')).toBe(false);
    });

    it('Test 13: STALE is terminal for auto-processing (no auto-transitions out except SCHEDULED via operator)', () => {
      // STALE can only go to SCHEDULED (manual operator action), not auto-proceed to PUBLISHING
      expect(canTransition('STALE', 'PUBLISHING')).toBe(false);
      expect(canTransition('STALE', 'PUBLISHED')).toBe(false);
      expect(canTransition('STALE', 'FAILED')).toBe(false);
    });
  });

  // ============================================================================
  // getValidTransitions
  // ============================================================================

  describe('getValidTransitions', () => {
    it('Test 9: getValidTransitions returns correct next states for each status', () => {
      expect(getValidTransitions('DRAFT')).toEqual(
        expect.arrayContaining(['PENDING_REVIEW', 'APPROVED'])
      );
      expect(getValidTransitions('DRAFT')).toHaveLength(2);

      expect(getValidTransitions('PENDING_REVIEW')).toEqual(
        expect.arrayContaining(['APPROVED', 'DRAFT'])
      );
      expect(getValidTransitions('PENDING_REVIEW')).toHaveLength(2);

      expect(getValidTransitions('APPROVED')).toEqual(['SCHEDULED']);

      expect(getValidTransitions('SCHEDULED')).toEqual(
        expect.arrayContaining(['PUBLISHING', 'STALE'])
      );
      expect(getValidTransitions('SCHEDULED')).toHaveLength(2);

      expect(getValidTransitions('PUBLISHING')).toEqual(
        expect.arrayContaining(['PUBLISHED', 'FAILED'])
      );
      expect(getValidTransitions('PUBLISHING')).toHaveLength(2);

      expect(getValidTransitions('FAILED')).toEqual(['SCHEDULED']);

      expect(getValidTransitions('STALE')).toEqual(['SCHEDULED']);

      expect(getValidTransitions('PUBLISHED')).toEqual([]);
    });
  });

  // ============================================================================
  // canTransition boolean correctness
  // ============================================================================

  describe('canTransition', () => {
    it('Test 10: canTransition returns boolean correctly', () => {
      // Valid: returns true
      expect(canTransition('DRAFT', 'PENDING_REVIEW')).toBe(true);
      expect(canTransition('SCHEDULED', 'PUBLISHING')).toBe(true);

      // Invalid: returns false
      expect(canTransition('PUBLISHED', 'DRAFT')).toBe(false);
      expect(canTransition('DRAFT', 'PUBLISHING')).toBe(false);

      // Ensure it really returns a boolean, not truthy/falsy
      expect(typeof canTransition('APPROVED', 'SCHEDULED')).toBe('boolean');
      expect(typeof canTransition('APPROVED', 'PUBLISHED')).toBe('boolean');
    });
  });

  // ============================================================================
  // assertTransition
  // ============================================================================

  describe('assertTransition', () => {
    it('should not throw for valid transition', () => {
      expect(() => assertTransition('APPROVED', 'SCHEDULED')).not.toThrow();
      expect(() => assertTransition('FAILED', 'SCHEDULED')).not.toThrow();
      expect(() => assertTransition('STALE', 'SCHEDULED')).not.toThrow();
    });

    it('should throw descriptive error for invalid transition', () => {
      expect(() => assertTransition('DRAFT', 'PUBLISHED')).toThrow(
        /Invalid status transition/
      );
      expect(() => assertTransition('PUBLISHED', 'SCHEDULED')).toThrow(
        /PUBLISHED.*SCHEDULED/
      );
    });

    it('STALE and FAILED are distinct states', () => {
      // STALE = publish window expired (never attempted from PUBLISHING)
      // FAILED = platform API error occurred during PUBLISHING
      const staleTransitions = getValidTransitions('STALE');
      const failedTransitions = getValidTransitions('FAILED');

      // Both can go back to SCHEDULED for retry/reschedule
      expect(staleTransitions).toContain('SCHEDULED');
      expect(failedTransitions).toContain('SCHEDULED');

      // STALE comes from SCHEDULED (window expired), FAILED comes from PUBLISHING (API error)
      expect(canTransition('SCHEDULED', 'STALE')).toBe(true);
      expect(canTransition('PUBLISHING', 'FAILED')).toBe(true);

      // STALE does NOT come from PUBLISHING (that's FAILED's origin)
      expect(canTransition('PUBLISHING', 'STALE')).toBe(false);

      // FAILED does NOT come from SCHEDULED (that's STALE's origin)
      expect(canTransition('SCHEDULED', 'FAILED')).toBe(false);
    });
  });
});
