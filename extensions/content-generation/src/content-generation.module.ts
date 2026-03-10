import { Module } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AIServiceModule } from '@social/ai-service';
import { MediaLibraryModule } from '@social/media-library';
import { AIProviderRouter } from '@social/ai-service';
import { AIConfigService } from '@social/ai-service';
import { MediaProcessingService } from '@social/media-library';
import { ContentPostRepository } from './posts/content-post.repository';
import { ContentPostService } from './posts/content-post.service';
import { ContentPostController } from './posts/content-post.controller';
import { ReviewQueueService } from './review/review-queue.service';
import { ReviewQueueController } from './review/review-queue.controller';

/**
 * ContentGenerationModule
 *
 * Wires all Phase 5 content generation components into a NestJS module.
 * Registers in AppModule after MediaLibraryModule.
 *
 * Imports:
 *   - AIServiceModule: provides AIProviderRouter, AIConfigService
 *   - MediaLibraryModule: provides MediaProcessingService
 *
 * Providers (all via useFactory pattern, consistent with AIServiceModule):
 *   - ContentPostRepository: Prisma data layer for ContentPost and PostVariant
 *   - ContentPostService: AI generation pipeline (steps 1-9)
 *   - ReviewQueueService: review actions, audit trail, regeneration
 *   - ContentPostController: POST /generate, GET / and GET /:postId
 *   - ReviewQueueController: GET /, POST approve/reject/regenerate, PATCH variants/:id
 *
 * Exports (for Phase 6 Scheduling & Publishing Engine):
 *   - ContentPostService: for scheduling/publishing to reference generated posts
 *   - ContentPostRepository: for status updates and fetching scheduled posts
 *   - ReviewQueueService: for re-generation flows in publishing pipeline
 *
 * NOTE: MediaProcessingService is injected into ContentPostService constructor.
 * It comes from MediaLibraryModule (imported above). This wires the automatic
 * media variant generation per the locked decision:
 * "Media variant generation (Phase 4) triggered automatically when platforms are selected."
 */
@Module({
  imports: [
    AIServiceModule,
    MediaLibraryModule,
  ],
  controllers: [ContentPostController, ReviewQueueController],
  providers: [
    // ContentPostRepository: Prisma data access layer for ContentPost + PostVariant
    {
      provide: ContentPostRepository,
      useFactory: (prisma: PrismaService) => new ContentPostRepository(prisma as any),
      inject: [PrismaService],
    },

    // ContentPostService: AI generation pipeline (Steps 1-9)
    // Receives MediaProcessingService for fire-and-forget media variant generation
    {
      provide: ContentPostService,
      useFactory: (
        repository: ContentPostRepository,
        aiRouter: AIProviderRouter,
        aiConfigService: AIConfigService,
        mediaProcessingService: MediaProcessingService,
        prisma: PrismaService,
      ) =>
        new ContentPostService(
          repository,
          aiRouter,
          aiConfigService,
          mediaProcessingService,
          prisma as any,
        ),
      inject: [
        ContentPostRepository,
        AIProviderRouter,
        AIConfigService,
        MediaProcessingService,
        PrismaService,
      ],
    },

    // ReviewQueueService: review workflow (approve/reject/regenerate/editVariant)
    {
      provide: ReviewQueueService,
      useFactory: (
        repository: ContentPostRepository,
        contentPostService: ContentPostService,
        prisma: PrismaService,
      ) => new ReviewQueueService(repository, contentPostService, prisma as any),
      inject: [ContentPostRepository, ContentPostService, PrismaService],
    },

    // ContentPostController: DI-injected via useFactory
    // Controller is in controllers[] array above; also here for DI resolution
    {
      provide: ContentPostController,
      useFactory: (
        contentPostService: ContentPostService,
        contentPostRepository: ContentPostRepository,
        prisma: PrismaService,
      ) => new ContentPostController(contentPostService, contentPostRepository, prisma as any),
      inject: [ContentPostService, ContentPostRepository, PrismaService],
    },

    // ReviewQueueController: DI-injected via useFactory
    {
      provide: ReviewQueueController,
      useFactory: (
        reviewQueueService: ReviewQueueService,
        prisma: PrismaService,
      ) => new ReviewQueueController(reviewQueueService, prisma as any),
      inject: [ReviewQueueService, PrismaService],
    },
  ],
  exports: [
    ContentPostService,
    ContentPostRepository,
    ReviewQueueService,
  ],
})
export class ContentGenerationModule {}
