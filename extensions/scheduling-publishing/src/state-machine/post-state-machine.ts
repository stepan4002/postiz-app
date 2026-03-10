import type { ContentPostStatus } from '../types/scheduling.types';

// ============================================================================
// Post State Machine — enforces valid status transitions
//
// State distinctions:
// - STALE: Publish window expired without any publish attempt (scheduler never
//          picked it up or was down). Requires manual operator action (reschedule).
//          Origin: SCHEDULED -> STALE (window expired)
//
// - FAILED: Platform API returned an error during active publishing.
//           Can be auto-retried by the scheduler.
//           Origin: PUBLISHING -> FAILED (API error)
//
// This distinction surfaces in the dashboard: STALE = "never attempted",
// FAILED = "attempted and errored". Different operator responses needed.
// ============================================================================

/**
 * Valid state transitions map.
 * Key = current status, Value = array of valid next statuses.
 *
 * PUBLISHED is terminal — no transitions out.
 * STALE is terminal for auto-processing — only manual reschedule (-> SCHEDULED) allowed.
 */
export const VALID_TRANSITIONS: Record<ContentPostStatus, ContentPostStatus[]> = {
  DRAFT: ['PENDING_REVIEW', 'APPROVED'],
  PENDING_REVIEW: ['APPROVED', 'DRAFT'], // reject returns to DRAFT per Phase 5 decision
  APPROVED: ['SCHEDULED'],
  SCHEDULED: ['PUBLISHING', 'STALE'],    // STALE when publish window expires
  PUBLISHING: ['PUBLISHED', 'FAILED'],
  FAILED: ['SCHEDULED'],                 // retry: re-enter scheduling queue
  STALE: ['SCHEDULED'],                  // operator reschedules — manual action only
  PUBLISHED: [],                         // terminal state
};

/**
 * Returns true if transitioning from `from` to `to` is a valid state change.
 * Always returns a boolean (never truthy/falsy).
 */
export function canTransition(
  from: ContentPostStatus,
  to: ContentPostStatus
): boolean {
  const validNextStates = VALID_TRANSITIONS[from];
  if (!validNextStates) {
    return false;
  }
  return validNextStates.includes(to) === true;
}

/**
 * Asserts that transitioning from `from` to `to` is valid.
 * Throws a descriptive Error if the transition is not allowed.
 */
export function assertTransition(
  from: ContentPostStatus,
  to: ContentPostStatus
): void {
  if (!canTransition(from, to)) {
    const validNext = getValidTransitions(from);
    const validStr = validNext.length > 0 ? validNext.join(', ') : 'none (terminal state)';
    throw new Error(
      `Invalid status transition: ${from} -> ${to}. ` +
      `Valid transitions from ${from}: [${validStr}]`
    );
  }
}

/**
 * Returns the array of valid next statuses for a given current status.
 * Returns an empty array for terminal states (PUBLISHED).
 */
export function getValidTransitions(status: ContentPostStatus): ContentPostStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}
