/**
 * PostingRulesModule
 *
 * NestJS module that wires all posting rules providers and controllers together.
 * Registers in AppModule after SchedulingPublishingModule.
 *
 * Providers (all via useFactory pattern, consistent with media-library,
 * scheduling-publishing, and content-generation modules):
 * - PostingRulesRepository: Prisma data layer for posting rule CRUD and post queries
 * - PostingRulesService: business logic — CRUD, validation, enable/disable
 * - SlotFinderService: calculates available slots by cross-referencing rules + existing posts
 * - ContentGapService: detects gaps where actual post count < rule frequency
 * - ContentGapCron: daily @Cron job that logs gaps for all companies with enabled rules
 *
 * Controllers:
 * - PostingRulesController: /companies/:companySlug/posting-rules REST endpoints
 *
 * Exports (for other modules that need to query rules or slots):
 * - PostingRulesService
 * - SlotFinderService
 * - ContentGapService
 * - PostingRulesRepository
 */
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { PostingRulesRepository } from './posting-rules.repository';
import { PostingRulesService } from './posting-rules.service';
import { SlotFinderService } from './slot-finder.service';
import { PostingRulesController } from './posting-rules.controller';
import { ContentGapService } from './content-gap.service';
import { ContentGapCron } from './content-gap.cron';

@Module({
  imports: [
    // Required for @Cron support in ContentGapCron
    ScheduleModule.forRoot(),
  ],
  controllers: [PostingRulesController],
  providers: [
    // PostingRulesRepository: Prisma data layer for rule CRUD and post range queries
    {
      provide: PostingRulesRepository,
      useFactory: (prisma: PrismaService) => new PostingRulesRepository(prisma as any),
      inject: [PrismaService],
    },

    // PostingRulesService: business logic — CRUD, validation, ownership enforcement
    {
      provide: PostingRulesService,
      useFactory: (repo: PostingRulesRepository) => new PostingRulesService(repo),
      inject: [PostingRulesRepository],
    },

    // SlotFinderService: computes available posting slots from rules + existing posts
    {
      provide: SlotFinderService,
      useFactory: (repo: PostingRulesRepository) => new SlotFinderService(repo),
      inject: [PostingRulesRepository],
    },

    // ContentGapService: detects days where actual posts < rule frequency
    {
      provide: ContentGapService,
      useFactory: (repo: PostingRulesRepository) => new ContentGapService(repo),
      inject: [PostingRulesRepository],
    },

    // ContentGapCron: daily midnight job (guarded by RUN_CRON=true)
    {
      provide: ContentGapCron,
      useFactory: (gapService: ContentGapService) => new ContentGapCron(gapService),
      inject: [ContentGapService],
    },
  ],
  exports: [
    PostingRulesService,
    SlotFinderService,
    ContentGapService,
    PostingRulesRepository,
  ],
})
export class PostingRulesModule {}
