import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '@gitroom/nestjs-libraries/database/prisma/database.module';
import { ApiModule } from '@gitroom/backend/api/api.module';
import { APP_GUARD } from '@nestjs/core';
import { PoliciesGuard } from '@gitroom/backend/services/auth/permissions/permissions.guard';
import { PublicApiModule } from '@gitroom/backend/public-api/public.api.module';
import { ThrottlerBehindProxyGuard } from '@gitroom/nestjs-libraries/throttler/throttler.provider';
import { ThrottlerModule } from '@nestjs/throttler';
import { AgentModule } from '@gitroom/nestjs-libraries/agent/agent.module';
import { ThirdPartyModule } from '@gitroom/nestjs-libraries/3rdparties/thirdparty.module';
import { VideoModule } from '@gitroom/nestjs-libraries/videos/video.module';
import { SentryModule } from '@sentry/nestjs/setup';
import { FILTER } from '@gitroom/nestjs-libraries/sentry/sentry.exception';
import { ChatModule } from '@gitroom/nestjs-libraries/chat/chat.module';
import { getTemporalModule } from '@gitroom/nestjs-libraries/temporal/temporal.module';
import { TemporalRegisterMissingSearchAttributesModule } from '@gitroom/nestjs-libraries/temporal/temporal.register';
import { InfiniteWorkflowRegisterModule } from '@gitroom/nestjs-libraries/temporal/infinite.workflow.register';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
// SOCIAL COMMAND CENTRE — Phase 1 Plan 02: company context CLS + Prisma scoping
import { CompanyContextModule } from '@social/company-context';
// SOCIAL COMMAND CENTRE — Phase 1 Plan 03: Company/Brand/BrandVoice CRUD API
import { MultiCompanyModule } from '@social/multi-company';
// SOCIAL COMMAND CENTRE — Phase 2 Plan 03: Credential management, OAuth brand context, token health
import { CredentialManagementModule } from '@social/credential-management';
// SOCIAL COMMAND CENTRE -- Phase 3: AI Service Layer
import { AIServiceModule } from '@social/ai-service';
// SOCIAL COMMAND CENTRE — Phase 4: Media Library & Processing
import { MediaLibraryModule } from '@social/media-library';
// SOCIAL COMMAND CENTRE -- Phase 5: Content Generation Pipeline
import { ContentGenerationModule } from '@social/content-generation';
// SOCIAL COMMAND CENTRE — Phase 6: Scheduling & Publishing Engine
import { SchedulingPublishingModule } from '@social/scheduling-publishing';
// SOCIAL COMMAND CENTRE -- Phase 7: Analytics & Dashboard
import { AnalyticsDashboardModule } from '@social/analytics-dashboard';
// SOCIAL COMMAND CENTRE — Phase 8: Production Hardening — health checks + structured logging
import { HealthModule } from '@social/health';
// SOCIAL COMMAND CENTRE — Phase 9: Posting Rules Engine
import { PostingRulesModule } from '@social/posting-rules';
// SOCIAL COMMAND CENTRE — Phase 10: Content Ingestion / Sources
import { ContentIngestionModule } from '@social/content-ingestion';
// SOCIAL COMMAND CENTRE — Phase 11: Inbox Monitoring
import { InboxMonitoringModule } from '@social/inbox-monitoring';
// SOCIAL COMMAND CENTRE — Phase 12: Upload-Post Gateway
import { UploadPostModule } from '@social/upload-post';
// SOCIAL COMMAND CENTRE — Phase 13: AyrShare Unified API Gateway
import { AyrShareModule } from '@social/ayrshare';
import { LoggerModule } from 'nestjs-pino';

@Global()
@Module({
  imports: [
    SentryModule.forRoot(),
    DatabaseModule,
    // SOCIAL COMMAND CENTRE — must be imported before ApiModule so ClsModule is global
    // and CLS context is available in all request handlers
    CompanyContextModule,
    // SOCIAL COMMAND CENTRE — Phase 1 Plan 03: Company/Brand/BrandVoice CRUD API
    MultiCompanyModule,
    // SOCIAL COMMAND CENTRE — Phase 2 Plan 03: Credential management, OAuth brand context, token health
    CredentialManagementModule,
    // SOCIAL COMMAND CENTRE -- Phase 3: AI Service Layer
    AIServiceModule,
    // SOCIAL COMMAND CENTRE — Phase 4: Media Library & Processing
    MediaLibraryModule,
    // SOCIAL COMMAND CENTRE -- Phase 5: Content Generation Pipeline
    ContentGenerationModule,
    // SOCIAL COMMAND CENTRE — Phase 6: Scheduling & Publishing Engine
    SchedulingPublishingModule,
    // SOCIAL COMMAND CENTRE -- Phase 7: Analytics & Dashboard
    AnalyticsDashboardModule,
    // SOCIAL COMMAND CENTRE — Phase 8: Health check endpoints (GET /health/live, GET /health/ready)
    HealthModule,
    // SOCIAL COMMAND CENTRE — Phase 9: Posting Rules Engine
    PostingRulesModule,
    // SOCIAL COMMAND CENTRE — Phase 10: Content Ingestion / Sources
    ContentIngestionModule,
    // SOCIAL COMMAND CENTRE — Phase 11: Inbox Monitoring
    InboxMonitoringModule,
    // SOCIAL COMMAND CENTRE — Phase 12: Upload-Post Gateway
    UploadPostModule,
    // SOCIAL COMMAND CENTRE — Phase 13: AyrShare Unified API Gateway
    AyrShareModule,
    // SOCIAL COMMAND CENTRE — Phase 8: Structured JSON logging via nestjs-pino
    // Production: emits pure JSON to stdout. Development: uses pino-pretty for readable output.
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
      },
    }),
    ApiModule,
    PublicApiModule,
    AgentModule,
    ThirdPartyModule,
    VideoModule,
    ChatModule,
    getTemporalModule(false),
    TemporalRegisterMissingSearchAttributesModule,
    InfiniteWorkflowRegisterModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 3600000,
          limit: process.env.API_LIMIT ? Number(process.env.API_LIMIT) : 30,
        },
      ],
      storage: new ThrottlerStorageRedisService(ioRedis),
    }),
  ],
  controllers: [],
  providers: [
    FILTER,
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PoliciesGuard,
    },
  ],
  exports: [
    DatabaseModule,
    ApiModule,
    PublicApiModule,
    AgentModule,
    ThrottlerModule,
    ChatModule,
  ],
})
export class AppModule {}
