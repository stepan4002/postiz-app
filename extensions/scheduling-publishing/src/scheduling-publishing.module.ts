/**
 * SchedulingPublishingModule
 *
 * NestJS module wiring all Phase 6 scheduling and publishing services.
 * Registered in AppModule after ContentGenerationModule.
 *
 * Imports:
 *   - ScheduleModule: required for @Cron decorators on SchedulerTickJob and PublishingWorkerJob
 *   - ContentGenerationModule: provides ContentPostService, ContentPostRepository, ReviewQueueService
 *   - MediaLibraryModule: provides PlatformMediaValidator, MediaProcessingService
 *   - CredentialManagementModule: provides TokenEncryptionService
 *
 * Providers (all via useFactory pattern, consistent with Phase 3/4/5 modules):
 *   - SchedulingRepository: Prisma data layer for scheduling operations
 *   - PublishingRepository: Prisma data layer for publishing-specific queries
 *   - ScheduleResolverService: schedulePost, autoSlot, cancelSchedule
 *   - AdapterRegistry: maps platform string to adapter instance (no deps)
 *   - PublishAttemptLogger: non-blocking attempt audit logging
 *   - PublishingService: single-variant publish orchestration
 *   - SchedulerTickJob: cron job — SCHEDULED -> PUBLISHING/STALE transitions
 *   - PublishingWorkerJob: cron job — PUBLISHING -> PUBLISHED/FAILED with retry
 *   - SchedulingController: REST endpoints for schedule/auto-slot/cancel/calendar/retry
 *   - FailedPostsController: REST endpoints for failed post listing and attempt history
 *
 * Controllers: [SchedulingController, FailedPostsController]
 *
 * Exports (for Phase 7 Analytics & Dashboard):
 *   - ScheduleResolverService: scheduling operations
 *   - PublishingService: publish variant on demand
 *   - SchedulingRepository: calendar and post queries
 */

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { ContentGenerationModule } from '@social/content-generation';
import { MediaLibraryModule } from '@social/media-library';
import { CredentialManagementModule } from '@social/credential-management';
import { PlatformMediaValidator } from '@social/media-library';
import { TokenEncryptionService } from '@social/credential-management';
import { SchedulingRepository } from './scheduling/scheduling.repository';
import { PublishingRepository } from './publishing/publishing.repository';
import { ScheduleResolverService } from './scheduling/schedule-resolver.service';
import { AdapterRegistry } from './adapters/adapter-registry';
import { PublishAttemptLogger } from './publishing/publish-attempt-logger';
import { PublishingService } from './publishing/publishing.service';
import { SchedulerTickJob } from './scheduling/scheduler-tick.job';
import { PublishingWorkerJob } from './publishing/publishing-worker.job';
import { SchedulingController } from './scheduling/scheduling.controller';
import { FailedPostsController } from './publishing/failed-posts.controller';

@Module({
  imports: [
    // Required for @Cron support in SchedulerTickJob and PublishingWorkerJob
    ScheduleModule.forRoot(),
    // Provides ContentPostService, ContentPostRepository, ReviewQueueService
    ContentGenerationModule,
    // Provides PlatformMediaValidator (for pre-publish media validation)
    MediaLibraryModule,
    // Provides TokenEncryptionService (for credential decryption before publishing)
    CredentialManagementModule,
  ],
  controllers: [SchedulingController, FailedPostsController],
  providers: [
    // SchedulingRepository: Prisma data layer for scheduling operations
    {
      provide: SchedulingRepository,
      useFactory: (prisma: PrismaService) => new SchedulingRepository(prisma as any),
      inject: [PrismaService],
    },

    // PublishingRepository: Prisma data layer for publishing-specific queries
    {
      provide: PublishingRepository,
      useFactory: (prisma: PrismaService) => new PublishingRepository(prisma as any),
      inject: [PrismaService],
    },

    // ScheduleResolverService: schedulePost, autoSlot, cancelSchedule
    {
      provide: ScheduleResolverService,
      useFactory: (schedulingRepo: SchedulingRepository) =>
        new ScheduleResolverService(schedulingRepo),
      inject: [SchedulingRepository],
    },

    // AdapterRegistry: maps platform string to adapter instance (no deps)
    {
      provide: AdapterRegistry,
      useFactory: () => new AdapterRegistry(),
      inject: [],
    },

    // PublishAttemptLogger: non-blocking attempt audit logging (R10.6)
    {
      provide: PublishAttemptLogger,
      useFactory: (prisma: PrismaService) => new PublishAttemptLogger(prisma as any),
      inject: [PrismaService],
    },

    // PublishingService: single-variant publish orchestration
    // Resolves credentials via SocialAccount->Integration, decrypts token, calls adapter
    {
      provide: PublishingService,
      useFactory: (
        adapterRegistry: AdapterRegistry,
        tokenEncryption: TokenEncryptionService,
        attemptLogger: PublishAttemptLogger,
        platformMediaValidator: PlatformMediaValidator,
        prisma: PrismaService,
      ) =>
        new PublishingService(
          adapterRegistry,
          tokenEncryption,
          attemptLogger,
          platformMediaValidator,
          prisma as any,
        ),
      inject: [
        AdapterRegistry,
        TokenEncryptionService,
        PublishAttemptLogger,
        PlatformMediaValidator,
        PrismaService,
      ],
    },

    // SchedulerTickJob: cron job — SCHEDULED -> PUBLISHING or STALE
    // Does NOT call platform APIs — transitions status only
    {
      provide: SchedulerTickJob,
      useFactory: (schedulingRepo: SchedulingRepository) =>
        new SchedulerTickJob(schedulingRepo),
      inject: [SchedulingRepository],
    },

    // PublishingWorkerJob: cron job — PUBLISHING -> PUBLISHED or FAILED with retry/backoff
    // Calls PublishingService per variant, enforces MAX_ATTEMPTS=3 with exponential backoff
    {
      provide: PublishingWorkerJob,
      useFactory: (
        publishingRepo: PublishingRepository,
        publishingService: PublishingService,
        attemptLogger: PublishAttemptLogger,
        prisma: PrismaService,
      ) =>
        new PublishingWorkerJob(
          publishingRepo,
          publishingService,
          attemptLogger,
          prisma as any,
        ),
      inject: [PublishingRepository, PublishingService, PublishAttemptLogger, PrismaService],
    },

    // SchedulingController: REST endpoints for scheduling operations
    {
      provide: SchedulingController,
      useFactory: (
        scheduleResolverService: ScheduleResolverService,
        schedulingRepo: SchedulingRepository,
        prisma: PrismaService,
      ) =>
        new SchedulingController(
          scheduleResolverService,
          schedulingRepo,
          prisma as any,
        ),
      inject: [ScheduleResolverService, SchedulingRepository, PrismaService],
    },

    // FailedPostsController: REST endpoints for failed post listing and attempt history
    {
      provide: FailedPostsController,
      useFactory: (prisma: PrismaService) =>
        new FailedPostsController(prisma as any),
      inject: [PrismaService],
    },
  ],
  exports: [
    // Exported for Phase 7 Analytics & Dashboard
    ScheduleResolverService,
    PublishingService,
    SchedulingRepository,
  ],
})
export class SchedulingPublishingModule {}
