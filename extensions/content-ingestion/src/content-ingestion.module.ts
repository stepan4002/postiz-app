/**
 * ContentIngestionModule
 *
 * NestJS module wiring all content ingestion components together.
 * Can be registered in AppModule to enable source management and
 * automated content polling.
 *
 * Imports:
 *   - ScheduleModule.forRoot(): required for @Cron decorator on ContentIngestionCron
 *
 * Providers (all via useFactory pattern, consistent with Phase 3–8 modules):
 *   - ContentIngestionRepository: Prisma data layer for ContentSource + SourceItem
 *   - ContentIngestionService: business logic, source CRUD, fetch orchestration
 *   - ContentIngestionCron: @Cron every 15 minutes, polls enabled sources
 *
 * Controllers:
 *   - ContentIngestionController: REST endpoints under /companies/:companySlug/sources
 *
 * Exports (for external consumers):
 *   - ContentIngestionService: for other modules that need to trigger fetches
 *   - ContentIngestionRepository: for modules that need direct source/item queries
 */

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { ContentIngestionRepository } from './content-ingestion.repository';
import { ContentIngestionService } from './content-ingestion.service';
import { ContentIngestionCron } from './content-ingestion.cron';
import { ContentIngestionController } from './content-ingestion.controller';

@Module({
  imports: [
    // Required for @Cron support in ContentIngestionCron
    ScheduleModule.forRoot(),
  ],
  controllers: [ContentIngestionController],
  providers: [
    // ContentIngestionRepository: Prisma data access layer for ContentSource + SourceItem
    {
      provide: ContentIngestionRepository,
      useFactory: (prisma: PrismaService) => new ContentIngestionRepository(prisma as any),
      inject: [PrismaService],
    },

    // ContentIngestionService: business logic and fetch orchestration
    // Receives ContentIngestionRepository; instantiates fetchers internally
    {
      provide: ContentIngestionService,
      useFactory: (repository: ContentIngestionRepository) =>
        new ContentIngestionService(repository),
      inject: [ContentIngestionRepository],
    },

    // ContentIngestionCron: polls enabled sources every 15 minutes (when RUN_CRON=true)
    // Depends on both repository (direct upsert) and service (runFetcher dispatch)
    {
      provide: ContentIngestionCron,
      useFactory: (
        repository: ContentIngestionRepository,
        service: ContentIngestionService,
      ) => new ContentIngestionCron(repository, service),
      inject: [ContentIngestionRepository, ContentIngestionService],
    },
  ],
  exports: [
    ContentIngestionService,
    ContentIngestionRepository,
  ],
})
export class ContentIngestionModule {}
