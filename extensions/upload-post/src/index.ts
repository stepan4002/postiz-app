/**
 * @social/upload-post — Public API
 *
 * Upload-Post gateway extension for Social Command Centre.
 * Provides unified social media publishing via Upload-Post.com API,
 * replacing the need for individual OAuth apps per platform.
 *
 * Usage:
 *   import { UploadPostModule } from '@social/upload-post';
 *   // Register in AppModule after InboxMonitoringModule
 */

// NestJS module
export { UploadPostModule } from './upload-post.module';

// Config layer
export { UploadPostConfigRepository } from './config/upload-post-config.repository';
export { UploadPostConfigService } from './config/upload-post-config.service';
export { UploadPostConfigController } from './config/upload-post-config.controller';

// Profile layer
export { UploadPostProfileRepository } from './profile/upload-post-profile.repository';
export { UploadPostProfileService } from './profile/upload-post-profile.service';
export { UploadPostProfileController } from './profile/upload-post-profile.controller';

// Log layer
export { UploadPostLogRepository } from './log/upload-post-log.repository';

// Sync layer
export { StatusSyncService } from './sync/status-sync.service';

// Adaptation layer
export { ContentAdapterService } from './adaptation/content-adapter.service';
export type { AdaptContentRequest, AdaptedContent } from './adaptation/content-adapter.service';

// API client
export { UploadPostClient } from './client/upload-post.client';

// Type definitions
export type {
  UploadTextRequest,
  UploadPhotoRequest,
  UploadVideoRequest,
  UploadPostResponse,
  StatusResponse,
  PlatformResult,
  CreateConfigDto,
  UpdateConfigDto,
  CreateProfileDto,
  UpdateProfileDto,
  ConfigResponse,
  QuotaResponse,
  UploadPostPlatform,
} from './client/upload-post.types';

export { POSTIZ_TO_UPLOADPOST_PLATFORM } from './client/upload-post.types';
