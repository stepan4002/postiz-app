/**
 * @social/inbox-monitoring — Public API
 *
 * Inbox monitoring extension for Social Command Centre.
 * Fetches and manages comments, DMs, mentions, and reviews
 * from connected social media platform integrations.
 *
 * Usage:
 *   import { InboxMonitoringModule } from '@social/inbox-monitoring';
 *   // Register in AppModule after SchedulingPublishingModule
 */

// NestJS module
export { InboxMonitoringModule } from './inbox-monitoring.module';

// Repository (data layer)
export { InboxRepository } from './inbox.repository';
export type { CreateInboxItemData, InboxFilters, PaginatedInboxResult } from './inbox.repository';

// Service (business logic)
export { InboxService } from './inbox.service';

// Controller
export { InboxController } from './inbox.controller';

// Cron job
export { InboxCron } from './inbox.cron';

// Adapter contracts
export { BaseInboxAdapter } from './adapters/base.adapter';
export type { InboxFetchResult } from './adapters/base.adapter';
export { StubInboxAdapter } from './adapters/stub.adapter';
