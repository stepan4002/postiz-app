/**
 * MediaLibraryModule
 *
 * NestJS module that wires all media library providers and controllers together.
 * Registers in AppModule after AIServiceModule.
 *
 * Providers:
 * - MinioStorage: S3-compatible storage via useFactory (reads MINIO_* env vars)
 * - CompanyMediaRepository: Prisma DB layer for company-scoped media
 * - CompanyMediaService: Upload + thumbnail + metadata extraction pipeline
 * - MediaProcessingService: Sharp-based async variant generation
 * - MediaProcessingJob: @Cron every 30s, polls pending jobs
 * - PlatformMediaValidator: Pure validation service (no DB dependency)
 *
 * Controllers:
 * - CompanyMediaController: /companies/:companySlug/media REST endpoints + Uppy S3 multipart
 *
 * Exports (for Phase 5/6 consumers):
 * - CompanyMediaService, MediaProcessingService, PlatformMediaValidator, MinioStorage
 *
 * Lifecycle:
 * - onModuleInit: calls MinioStorage.ensureBucket to idempotently create bucket on startup
 */

import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { MinioStorage } from './storage/minio.storage';
import { CompanyMediaRepository } from './media/company-media.repository';
import { CompanyMediaService } from './media/company-media.service';
import { CompanyMediaController } from './media/company-media.controller';
import { MediaProcessingService } from './processing/media-processing.service';
import { MediaProcessingJob } from './processing/media-processing.job';
import { PlatformMediaValidator } from './processing/platform-media-validator';

@Module({
  imports: [
    // Required for @Cron support in MediaProcessingJob
    ScheduleModule.forRoot(),
  ],
  controllers: [CompanyMediaController],
  providers: [
    // MinioStorage via useFactory: reads MINIO_* env vars
    {
      provide: MinioStorage,
      useFactory: () => {
        return new MinioStorage(
          process.env.MINIO_ENDPOINT!,
          process.env.MINIO_ACCESS_KEY!,
          process.env.MINIO_SECRET_KEY!,
          process.env.MINIO_BUCKET!,
          process.env.MINIO_PUBLIC_URL!
        );
      },
    },

    // CompanyMediaRepository depends on PrismaService (globally available)
    {
      provide: CompanyMediaRepository,
      useFactory: (prisma: PrismaService) => new CompanyMediaRepository(prisma),
      inject: [PrismaService],
    },

    // CompanyMediaService depends on repository + MinIO config
    {
      provide: CompanyMediaService,
      useFactory: (repository: CompanyMediaRepository) => {
        return new CompanyMediaService(repository, {
          endpoint: process.env.MINIO_ENDPOINT!,
          accessKeyId: process.env.MINIO_ACCESS_KEY!,
          secretAccessKey: process.env.MINIO_SECRET_KEY!,
          bucket: process.env.MINIO_BUCKET!,
          publicUrl: process.env.MINIO_PUBLIC_URL!,
        });
      },
      inject: [CompanyMediaRepository],
    },

    // MediaProcessingService depends on PrismaService + MinIO config
    {
      provide: MediaProcessingService,
      useFactory: (prisma: PrismaService) => {
        return new MediaProcessingService(prisma, {
          endpoint: process.env.MINIO_ENDPOINT!,
          accessKeyId: process.env.MINIO_ACCESS_KEY!,
          secretAccessKey: process.env.MINIO_SECRET_KEY!,
          bucket: process.env.MINIO_BUCKET!,
          publicUrl: process.env.MINIO_PUBLIC_URL!,
        });
      },
      inject: [PrismaService],
    },

    // PlatformMediaValidator is a pure service — no external dependencies
    PlatformMediaValidator,

    // MediaProcessingJob depends on MediaProcessingService + PrismaService
    {
      provide: MediaProcessingJob,
      useFactory: (
        mediaProcessingService: MediaProcessingService,
        prisma: PrismaService
      ) => new MediaProcessingJob(mediaProcessingService, prisma),
      inject: [MediaProcessingService, PrismaService],
    },

  ],
  exports: [
    CompanyMediaService,
    MediaProcessingService,
    PlatformMediaValidator,
    MinioStorage,
  ],
})
export class MediaLibraryModule implements OnModuleInit {
  private readonly logger = new Logger(MediaLibraryModule.name);

  constructor(private readonly _minioStorage: MinioStorage) {}

  /**
   * Ensure the MinIO bucket exists on application startup.
   * Uses HeadBucketCommand to check, then CreateBucketCommand if 404.
   * This is idempotent — safe to run every startup.
   */
  async onModuleInit(): Promise<void> {
    try {
      await MinioStorage.ensureBucket(
        this._minioStorage.client,
        process.env.MINIO_BUCKET!
      );
      this.logger.log(
        `MediaLibraryModule: MinIO bucket '${process.env.MINIO_BUCKET}' ready`
      );
    } catch (err: any) {
      this.logger.warn(
        `MediaLibraryModule: ensureBucket failed (MinIO not configured or not running): ${err?.message}`
      );
      // Non-fatal: app can still run without MinIO in development
    }
  }
}
