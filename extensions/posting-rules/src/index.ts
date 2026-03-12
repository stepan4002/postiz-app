/**
 * @social/posting-rules — Public API
 *
 * Posting rules engine for Social Command Centre:
 * - Rule lifecycle management (CRUD, enable/disable)
 * - Available slot calculation based on rules and existing posts
 * - Content gap detection for days below expected frequency
 * - Daily cron job for gap reporting
 */

// NestJS module
export { PostingRulesModule } from './posting-rules.module';

// Repository
export { PostingRulesRepository } from './posting-rules.repository';
export type { PostingRuleCreateData, PostingRuleUpdateData } from './posting-rules.repository';

// Service + DTOs
export { PostingRulesService } from './posting-rules.service';
export type { CreatePostingRuleDto, UpdatePostingRuleDto } from './posting-rules.service';

// Slot finder
export { SlotFinderService } from './slot-finder.service';
export type { AvailableSlot } from './slot-finder.service';

// Content gap detection
export { ContentGapService } from './content-gap.service';
export type { ContentGap } from './content-gap.service';

// Cron job
export { ContentGapCron } from './content-gap.cron';

// Controller
export { PostingRulesController } from './posting-rules.controller';
