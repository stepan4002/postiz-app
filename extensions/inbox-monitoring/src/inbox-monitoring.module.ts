/**
 * InboxMonitoringModule
 *
 * NestJS module for the Inbox Monitoring extension.
 * Registers in AppModule after SchedulingPublishingModule.
 *
 * Architecture (Controller >> Service >> Repository):
 * - InboxController: REST endpoints for company-scoped inbox operations
 * - InboxService: business logic, authorization, AI reply generation
 * - InboxRepository: Prisma data layer (all queries scoped by companyId)
 * - InboxCron: @Cron every 10 minutes — fetches new items from platform adapters
 *
 * Provider wiring:
 * All providers use the useFactory pattern for consistency with all other
 * extension modules in this project (media-library, scheduling-publishing, etc.).
 * This ensures every dependency is explicitly declared and testable in isolation.
 *
 * PrismaService availability:
 * PrismaService is globally provided by DatabaseModule (imported in AppModule),
 * so it is available for injection in all module factories without re-importing.
 *
 * ScheduleModule:
 * Required for @Cron support in InboxCron. Each module that uses @Cron must
 * import ScheduleModule.forRoot() — this is safe to call multiple times in the
 * same application (NestJS deduplicates it).
 *
 * Exports:
 * - InboxService: for other modules that need to query or mutate inbox state
 * - InboxRepository: for direct data access (e.g. analytics consumers)
 */

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { InboxRepository } from './inbox.repository';
import { InboxService } from './inbox.service';
import { InboxController } from './inbox.controller';
import { InboxCron } from './inbox.cron';

@Module({
  imports: [
    // Required for @Cron support in InboxCron
    ScheduleModule.forRoot(),
  ],
  controllers: [InboxController],
  providers: [
    // InboxRepository: Prisma data layer
    // Uses (prisma as any) to avoid coupling to the exact generated client type
    {
      provide: InboxRepository,
      useFactory: (prisma: PrismaService) => new InboxRepository(prisma as any),
      inject: [PrismaService],
    },

    // InboxService: business logic layer
    // Depends on InboxRepository for all data operations
    {
      provide: InboxService,
      useFactory: (repository: InboxRepository) => new InboxService(repository),
      inject: [InboxRepository],
    },

    // InboxController: HTTP request handler
    // Depends on InboxService for logic and PrismaService for slug resolution
    {
      provide: InboxController,
      useFactory: (service: InboxService, prisma: PrismaService) =>
        new InboxController(service, prisma),
      inject: [InboxService, PrismaService],
    },

    // InboxCron: scheduled fetch job (every 10 minutes)
    // Depends on InboxRepository for persistence and PrismaService for integration queries
    {
      provide: InboxCron,
      useFactory: (repository: InboxRepository, prisma: PrismaService) =>
        new InboxCron(repository, prisma as any),
      inject: [InboxRepository, PrismaService],
    },
  ],
  exports: [
    // Exported for consumers that need to query or observe inbox state
    InboxService,
    InboxRepository,
  ],
})
export class InboxMonitoringModule {}
