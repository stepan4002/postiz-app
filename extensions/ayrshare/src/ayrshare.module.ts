/**
 * AyrShareModule
 *
 * NestJS module for the AyrShare API gateway extension.
 * Registers in AppModule after InboxMonitoringModule.
 *
 * Architecture (Controller >> Service >> Repository):
 * - Config:     AyrShareConfigController → AyrShareConfigService → AyrShareConfigRepository
 * - Profile:    AyrShareProfileController → AyrShareProfileService → AyrShareProfileRepository
 * - Comments:   AyrShareCommentsController → AyrShareCommentsService
 * - Messages:   AyrShareMessagesController → AyrShareMessagesService → AyrShareMessagesRepository
 * - Webhooks:   AyrShareWebhookController → AyrShareWebhookService → AyrShareWebhookRepository
 * - Analytics:  AyrShareAnalyticsController → AyrShareAnalyticsService
 * - Agent:      AyrShareAgentController → AyrShareAgentService (OpenClaw external API)
 * - Health:     AyrShareHealthService (comprehensive self-test system)
 * - Log:        AyrShareLogRepository
 *
 * Provider wiring:
 * All providers use the useFactory pattern for consistency with all other
 * extension modules (media-library, scheduling-publishing, inbox-monitoring, etc.).
 *
 * PrismaService availability:
 * PrismaService is globally provided by DatabaseModule (imported in AppModule),
 * so it is available for injection in all module factories without re-importing.
 *
 * Exports:
 * - AyrShareConfigService:       for other modules needing API key access (e.g. AyrShareProvider)
 * - AyrShareProfileService:      for profile lookup from the publishing pipeline
 * - AyrShareLogRepository:       for logging API calls from the provider
 * - AyrShareWebhookService:      for profile creation/deletion hooks
 * - AyrShareMessagesService:     for webhook-driven DM handling
 * - AyrShareHealthService:       for health checks from external consumers
 * - AyrShareAgentService:        for programmatic access from external agents (OpenClaw)
 */

import { Module, Logger } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

// Config layer
import { AyrShareConfigRepository } from './config/ayrshare-config.repository';
import { AyrShareConfigService } from './config/ayrshare-config.service';
import { AyrShareConfigController } from './config/ayrshare-config.controller';

// Profile layer
import { AyrShareProfileRepository } from './profile/ayrshare-profile.repository';
import { AyrShareProfileService } from './profile/ayrshare-profile.service';
import { AyrShareProfileController } from './profile/ayrshare-profile.controller';

// Log layer
import { AyrShareLogRepository } from './log/ayrshare-log.repository';

// Comments layer
import { AyrShareCommentsService } from './comments/ayrshare-comments.service';
import { AyrShareCommentsController } from './comments/ayrshare-comments.controller';

// Messages layer
import { AyrShareMessagesRepository } from './messages/ayrshare-messages.repository';
import { AyrShareMessagesService } from './messages/ayrshare-messages.service';
import { AyrShareMessagesController } from './messages/ayrshare-messages.controller';

// Webhooks layer
import { AyrShareWebhookRepository } from './webhooks/ayrshare-webhook.repository';
import { AyrShareWebhookService } from './webhooks/ayrshare-webhook.service';
import { AyrShareWebhookController } from './webhooks/ayrshare-webhook.controller';

// Analytics layer
import { AyrShareAnalyticsService } from './analytics/ayrshare-analytics.service';
import { AyrShareAnalyticsController } from './analytics/ayrshare-analytics.controller';

// Agent layer (OpenClaw external API)
import { AyrShareAgentService } from './agent/ayrshare-agent.service';
import { AyrShareAgentController } from './agent/ayrshare-agent.controller';

// Health layer
import { AyrShareHealthService } from './health/ayrshare-health.service';

@Module({
  controllers: [
    AyrShareConfigController,
    AyrShareProfileController,
    AyrShareCommentsController,
    AyrShareMessagesController,
    AyrShareWebhookController,
    AyrShareAnalyticsController,
    AyrShareAgentController,
  ],
  providers: [
    // =========================================================================
    // Config layer
    // =========================================================================

    {
      provide: AyrShareConfigRepository,
      useFactory: (prisma: PrismaService) =>
        new AyrShareConfigRepository(prisma as any),
      inject: [PrismaService],
    },

    {
      provide: AyrShareConfigService,
      useFactory: (repo: AyrShareConfigRepository) =>
        new AyrShareConfigService(repo),
      inject: [AyrShareConfigRepository],
    },

    {
      provide: AyrShareConfigController,
      useFactory: (service: AyrShareConfigService) =>
        new AyrShareConfigController(service),
      inject: [AyrShareConfigService],
    },

    // =========================================================================
    // Profile layer
    // =========================================================================

    {
      provide: AyrShareProfileRepository,
      useFactory: (prisma: PrismaService) =>
        new AyrShareProfileRepository(prisma as any),
      inject: [PrismaService],
    },

    {
      provide: AyrShareProfileService,
      useFactory: (
        profileRepo: AyrShareProfileRepository,
        configService: AyrShareConfigService,
        prisma: PrismaService,
      ) => new AyrShareProfileService(profileRepo, configService, prisma as any),
      inject: [
        AyrShareProfileRepository,
        AyrShareConfigService,
        PrismaService,
      ],
    },

    {
      provide: AyrShareProfileController,
      useFactory: (service: AyrShareProfileService) =>
        new AyrShareProfileController(service),
      inject: [AyrShareProfileService],
    },

    // =========================================================================
    // Log layer
    // =========================================================================

    {
      provide: AyrShareLogRepository,
      useFactory: (prisma: PrismaService) =>
        new AyrShareLogRepository(prisma as any),
      inject: [PrismaService],
    },

    // =========================================================================
    // Comments layer
    // =========================================================================

    {
      provide: AyrShareCommentsService,
      useFactory: (
        configService: AyrShareConfigService,
        profileRepo: AyrShareProfileRepository,
      ) => new AyrShareCommentsService(configService, profileRepo),
      inject: [AyrShareConfigService, AyrShareProfileRepository],
    },

    {
      provide: AyrShareCommentsController,
      useFactory: (service: AyrShareCommentsService) =>
        new AyrShareCommentsController(service),
      inject: [AyrShareCommentsService],
    },

    // =========================================================================
    // Messages layer
    // =========================================================================

    {
      provide: AyrShareMessagesRepository,
      useFactory: (prisma: PrismaService) =>
        new AyrShareMessagesRepository(prisma as any),
      inject: [PrismaService],
    },

    {
      provide: AyrShareMessagesService,
      useFactory: (
        configService: AyrShareConfigService,
        profileRepo: AyrShareProfileRepository,
        messagesRepo: AyrShareMessagesRepository,
      ) =>
        new AyrShareMessagesService(configService, profileRepo, messagesRepo),
      inject: [
        AyrShareConfigService,
        AyrShareProfileRepository,
        AyrShareMessagesRepository,
      ],
    },

    {
      provide: AyrShareMessagesController,
      useFactory: (service: AyrShareMessagesService) =>
        new AyrShareMessagesController(service),
      inject: [AyrShareMessagesService],
    },

    // =========================================================================
    // Webhooks layer
    // =========================================================================

    {
      provide: AyrShareWebhookRepository,
      useFactory: (prisma: PrismaService) =>
        new AyrShareWebhookRepository(prisma as any),
      inject: [PrismaService],
    },

    {
      provide: AyrShareWebhookService,
      useFactory: (
        webhookRepo: AyrShareWebhookRepository,
        configService: AyrShareConfigService,
        profileRepo: AyrShareProfileRepository,
        profileService: AyrShareProfileService,
        messagesService: AyrShareMessagesService,
        logRepo: AyrShareLogRepository,
      ) =>
        new AyrShareWebhookService(
          webhookRepo,
          configService,
          profileRepo,
          profileService,
          messagesService,
          logRepo,
        ),
      inject: [
        AyrShareWebhookRepository,
        AyrShareConfigService,
        AyrShareProfileRepository,
        AyrShareProfileService,
        AyrShareMessagesService,
        AyrShareLogRepository,
      ],
    },

    {
      provide: AyrShareWebhookController,
      useFactory: (
        service: AyrShareWebhookService,
        configService: AyrShareConfigService,
        profileRepo: AyrShareProfileRepository,
      ) => new AyrShareWebhookController(service, configService, profileRepo),
      inject: [
        AyrShareWebhookService,
        AyrShareConfigService,
        AyrShareProfileRepository,
      ],
    },

    // =========================================================================
    // Analytics layer
    // =========================================================================

    {
      provide: AyrShareAnalyticsService,
      useFactory: (
        configService: AyrShareConfigService,
        profileRepo: AyrShareProfileRepository,
      ) => new AyrShareAnalyticsService(configService, profileRepo),
      inject: [AyrShareConfigService, AyrShareProfileRepository],
    },

    {
      provide: AyrShareAnalyticsController,
      useFactory: (service: AyrShareAnalyticsService) =>
        new AyrShareAnalyticsController(service),
      inject: [AyrShareAnalyticsService],
    },

    // =========================================================================
    // Health layer
    // =========================================================================

    {
      provide: AyrShareHealthService,
      useFactory: (
        configService: AyrShareConfigService,
        profileRepo: AyrShareProfileRepository,
        webhookRepo: AyrShareWebhookRepository,
        prisma: PrismaService,
      ) =>
        new AyrShareHealthService(
          configService,
          profileRepo,
          webhookRepo,
          prisma as any,
        ),
      inject: [
        AyrShareConfigService,
        AyrShareProfileRepository,
        AyrShareWebhookRepository,
        PrismaService,
      ],
    },

    // =========================================================================
    // Agent layer (OpenClaw external API)
    // =========================================================================

    {
      provide: AyrShareAgentService,
      useFactory: (
        configService: AyrShareConfigService,
        profileRepo: AyrShareProfileRepository,
        logRepo: AyrShareLogRepository,
      ) => new AyrShareAgentService(configService, profileRepo, logRepo),
      inject: [
        AyrShareConfigService,
        AyrShareProfileRepository,
        AyrShareLogRepository,
      ],
    },

    {
      provide: AyrShareAgentController,
      useFactory: (
        agentService: AyrShareAgentService,
        healthService: AyrShareHealthService,
      ) => new AyrShareAgentController(agentService, healthService),
      inject: [AyrShareAgentService, AyrShareHealthService],
    },
  ],
  exports: [
    // Exported for AyrShareProvider (in the publishing pipeline)
    AyrShareConfigService,
    AyrShareProfileService,
    AyrShareLogRepository,
    // Exported for webhook-driven event handling
    AyrShareWebhookService,
    AyrShareMessagesService,
    // Exported for external consumers (health checks, agent API)
    AyrShareHealthService,
    AyrShareAgentService,
  ],
})
export class AyrShareModule {
  private readonly logger = new Logger(AyrShareModule.name);

  constructor(
    private readonly profileService: AyrShareProfileService,
    private readonly webhookService: AyrShareWebhookService,
  ) {}

  onModuleInit() {
    // Wire the lazy webhook service reference to break circular dependency.
    // ProfileService needs WebhookService for auto-registering webhooks on profile creation,
    // but WebhookService also depends on ProfileService for webhook processing.
    this.profileService.setWebhookService(this.webhookService);
    this.logger.log('AyrShare Gateway module initialized');
  }
}
