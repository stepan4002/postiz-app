/**
 * @social/ayrshare — Public API
 *
 * AyrShare gateway extension for Social Command Centre.
 * Provides unified social media management via AyrShare API,
 * covering posting, comments, DMs, analytics, and webhooks
 * across 13 platforms.
 *
 * Usage:
 *   import { AyrShareModule } from '@social/ayrshare';
 *   // Register in AppModule after InboxMonitoringModule
 */

// NestJS module
export { AyrShareModule } from './ayrshare.module';

// Config layer
export { AyrShareConfigRepository } from './config/ayrshare-config.repository';
export { AyrShareConfigService } from './config/ayrshare-config.service';
export { AyrShareConfigController } from './config/ayrshare-config.controller';

// Profile layer
export { AyrShareProfileRepository } from './profile/ayrshare-profile.repository';
export { AyrShareProfileService } from './profile/ayrshare-profile.service';
export { AyrShareProfileController } from './profile/ayrshare-profile.controller';

// Log layer
export { AyrShareLogRepository } from './log/ayrshare-log.repository';

// Comments layer
export { AyrShareCommentsService } from './comments/ayrshare-comments.service';
export { AyrShareCommentsController } from './comments/ayrshare-comments.controller';

// Messages layer
export { AyrShareMessagesRepository } from './messages/ayrshare-messages.repository';
export { AyrShareMessagesService } from './messages/ayrshare-messages.service';
export { AyrShareMessagesController } from './messages/ayrshare-messages.controller';

// Webhooks layer
export { AyrShareWebhookRepository } from './webhooks/ayrshare-webhook.repository';
export { AyrShareWebhookService } from './webhooks/ayrshare-webhook.service';
export { AyrShareWebhookController } from './webhooks/ayrshare-webhook.controller';

// Analytics layer
export { AyrShareAnalyticsService } from './analytics/ayrshare-analytics.service';
export { AyrShareAnalyticsController } from './analytics/ayrshare-analytics.controller';

// Agent layer (OpenClaw external API)
export { AyrShareAgentService } from './agent/ayrshare-agent.service';
export { AyrShareAgentController } from './agent/ayrshare-agent.controller';
export type {
  AgentPostRequest,
  AgentPostResponse,
  AgentSendMessageRequest,
  AgentListProfilesRequest,
  AgentProfileResponse,
} from './agent/ayrshare-agent.service';

// Health layer
export { AyrShareHealthService } from './health/ayrshare-health.service';
export type {
  HealthCheckResult,
  HealthCheckItem,
} from './health/ayrshare-health.service';

// API client
export { AyrShareClient } from './client/ayrshare.client';

// Type definitions
export type {
  AyrSharePlatform,
  AyrSharePostRequest,
  AyrSharePostResponse,
  AyrSharePostDetails,
  AyrSharePlatformResult,
  AyrShareCommentsResponse,
  AyrShareCommentRequest,
  AyrShareCommentResponse,
  AyrShareReplyRequest,
  AyrShareSendMessageRequest,
  AyrShareMessageResponse,
  AyrShareMessagesResponse,
  AyrSharePostAnalytics,
  AyrShareSocialAnalytics,
  AyrShareCreateProfileResponse,
  AyrShareGenerateJWTResponse,
  AyrShareProfileInfo,
  AyrShareMediaUploadRequest,
  AyrShareMediaUploadResponse,
  AyrSharePresignedUrlRequest,
  AyrSharePresignedUrlResponse,
  AyrShareRegisterWebhookRequest,
  AyrShareRegisterWebhookResponse,
  AyrShareWebhookType,
  AyrSharePostWebhookPayload,
  AyrShareSocialWebhookPayload,
  AyrShareMessageWebhookPayload,
  AyrShareValidatePostRequest,
  AyrShareValidationResult,
  AyrShareHistoryEntry,
  AyrShareStatusResponse,
  AyrShareErrorResponse,
  CreateAyrShareConfigDto,
  UpdateAyrShareConfigDto,
  CreateAyrShareProfileDto,
  UpdateAyrShareProfileDto,
  AyrShareConfigResponse,
  AyrShareQuotaResponse,
} from './client/ayrshare.types';

export {
  POSTIZ_TO_AYRSHARE,
  AYRSHARE_MANAGED_IDENTIFIERS,
  AYRSHARE_DM_PLATFORMS,
  AYRSHARE_COMMENT_PLATFORMS,
} from './client/ayrshare.types';
