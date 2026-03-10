// ============================================================================
// @social/scheduling-publishing — Public API
// Phase 6: Scheduling & Publishing Engine
// ============================================================================

// Scheduling types and DTOs
export type {
  ContentPostStatus,
  PostVariantStatus,
  SchedulePostDto,
  AutoSlotDto,
  PublishWindowConfig,
} from './types/scheduling.types';
export { DEFAULT_PUBLISH_WINDOW_HOURS } from './types/scheduling.types';

// Publishing types and interfaces
export type {
  ErrorClassification,
  PostVariantForPublish,
  PublishParams,
  PublishResult,
  PlatformAdapter,
  PublishAttemptRecord,
} from './types/publishing.types';

// State machine functions
export {
  VALID_TRANSITIONS,
  canTransition,
  assertTransition,
  getValidTransitions,
} from './state-machine/post-state-machine';
