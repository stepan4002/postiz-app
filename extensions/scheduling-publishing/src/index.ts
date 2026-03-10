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

// Platform adapters
export { BaseAdapter } from './adapters/base.adapter';
export { InstagramAdapter } from './adapters/instagram.adapter';
export { FacebookAdapter } from './adapters/facebook.adapter';
export { LinkedInAdapter } from './adapters/linkedin.adapter';
export { XAdapter } from './adapters/x.adapter';
export { AdapterRegistry } from './adapters/adapter-registry';

// Scheduling services
export { SchedulingRepository } from './scheduling/scheduling.repository';
export { ScheduleResolverService } from './scheduling/schedule-resolver.service';
export { SchedulerTickJob } from './scheduling/scheduler-tick.job';

// Publishing services
export { PublishAttemptLogger } from './publishing/publish-attempt-logger';
export { PublishingRepository } from './publishing/publishing.repository';
export { PublishingService } from './publishing/publishing.service';
export { PublishingWorkerJob } from './publishing/publishing-worker.job';
