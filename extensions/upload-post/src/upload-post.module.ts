/**
 * UploadPostModule
 *
 * NestJS module for the Upload-Post gateway extension.
 * Registers in AppModule after InboxMonitoringModule.
 *
 * Architecture (Controller >> Service >> Repository):
 * - UploadPostConfigController:    API key management endpoints
 * - UploadPostConfigService:       Config business logic (masking, verification)
 * - UploadPostConfigRepository:    Prisma data layer for UploadPostConfig
 * - UploadPostProfileController:   Profile CRUD endpoints
 * - UploadPostProfileService:      Profile lifecycle + Integration auto-creation
 * - UploadPostProfileRepository:   Prisma data layer for UploadPostProfile
 * - UploadPostLogRepository:       Prisma data layer for UploadPostLog
 * - StatusSyncService:             @Cron every minute — polls pending async posts
 *
 * Provider wiring:
 * All providers use the useFactory pattern for consistency with all other
 * extension modules (media-library, scheduling-publishing, inbox-monitoring, etc.).
 *
 * PrismaService availability:
 * PrismaService is globally provided by DatabaseModule (imported in AppModule),
 * so it is available for injection in all module factories without re-importing.
 *
 * ScheduleModule:
 * Required for @Cron support in StatusSyncService. Each module that uses @Cron must
 * import ScheduleModule.forRoot() — this is safe to call multiple times.
 *
 * Exports:
 * - UploadPostConfigService:   for other modules needing API key access (e.g. UploadPostProvider)
 * - UploadPostProfileService:  for profile lookup from the publishing pipeline
 * - UploadPostLogRepository:   for logging API calls from the provider
 */

import { Module, Logger } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { UploadPostConfigRepository } from './config/upload-post-config.repository';
import { UploadPostConfigService } from './config/upload-post-config.service';
import { UploadPostConfigController } from './config/upload-post-config.controller';
import { UploadPostProfileRepository } from './profile/upload-post-profile.repository';
import { UploadPostProfileService } from './profile/upload-post-profile.service';
import { UploadPostProfileController } from './profile/upload-post-profile.controller';
import { UploadPostLogRepository } from './log/upload-post-log.repository';
import { StatusSyncService } from './sync/status-sync.service';
import { ContentAdapterService } from './adaptation/content-adapter.service';

@Module({
  imports: [
    // Required for @Cron support in StatusSyncService
    ScheduleModule.forRoot(),
  ],
  controllers: [UploadPostConfigController, UploadPostProfileController],
  providers: [
    // --- Config layer ---

    // UploadPostConfigRepository: Prisma data layer for API key config
    {
      provide: UploadPostConfigRepository,
      useFactory: (prisma: PrismaService) => new UploadPostConfigRepository(prisma as any),
      inject: [PrismaService],
    },

    // UploadPostConfigService: business logic for config management
    {
      provide: UploadPostConfigService,
      useFactory: (repo: UploadPostConfigRepository) => new UploadPostConfigService(repo),
      inject: [UploadPostConfigRepository],
    },

    // UploadPostConfigController: REST endpoints for config CRUD
    {
      provide: UploadPostConfigController,
      useFactory: (service: UploadPostConfigService) =>
        new UploadPostConfigController(service),
      inject: [UploadPostConfigService],
    },

    // --- Profile layer ---

    // UploadPostProfileRepository: Prisma data layer for profiles
    {
      provide: UploadPostProfileRepository,
      useFactory: (prisma: PrismaService) => new UploadPostProfileRepository(prisma as any),
      inject: [PrismaService],
    },

    // UploadPostProfileService: profile lifecycle + Integration auto-creation
    {
      provide: UploadPostProfileService,
      useFactory: (
        profileRepo: UploadPostProfileRepository,
        configService: UploadPostConfigService,
        prisma: PrismaService,
      ) => new UploadPostProfileService(profileRepo, configService, prisma as any),
      inject: [UploadPostProfileRepository, UploadPostConfigService, PrismaService],
    },

    // UploadPostProfileController: REST endpoints for profile CRUD
    {
      provide: UploadPostProfileController,
      useFactory: (service: UploadPostProfileService) =>
        new UploadPostProfileController(service),
      inject: [UploadPostProfileService],
    },

    // --- Log layer ---

    // UploadPostLogRepository: Prisma data layer for API call logs
    {
      provide: UploadPostLogRepository,
      useFactory: (prisma: PrismaService) => new UploadPostLogRepository(prisma as any),
      inject: [PrismaService],
    },

    // --- Sync layer ---

    // StatusSyncService: polls pending async posts every minute
    {
      provide: StatusSyncService,
      useFactory: (
        logRepo: UploadPostLogRepository,
        configRepo: UploadPostConfigRepository,
      ) => new StatusSyncService(logRepo, configRepo),
      inject: [UploadPostLogRepository, UploadPostConfigRepository],
    },

    // --- Adaptation layer ---

    // ContentAdapterService: translates/adapts content for multi-language profiles
    ContentAdapterService,
  ],
  exports: [
    // Exported for UploadPostProvider (in the publishing pipeline)
    UploadPostConfigService,
    UploadPostProfileService,
    UploadPostLogRepository,
    ContentAdapterService,
  ],
})
export class UploadPostModule {
  private readonly logger = new Logger(UploadPostModule.name);

  onModuleInit() {
    this.logger.log('Upload-Post Gateway module initialized');
  }
}
