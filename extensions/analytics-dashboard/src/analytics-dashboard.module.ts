/**
 * AnalyticsDashboardModule
 *
 * NestJS module wiring all Phase 7 analytics and dashboard services.
 * Registered in AppModule after SchedulingPublishingModule.
 *
 * Imports:
 *   - ScheduleModule: required for @Cron on AnalyticsIngestionJob and DashboardSummaryJob
 *   - CredentialManagementModule: provides TokenEncryptionService for OAuth token decryption
 *
 * Providers (all via useFactory pattern, consistent with Phases 2-6 modules):
 *   - AnalyticsRepository: Prisma data layer for PostMetrics CRUD and ingestion queries
 *   - DashboardRepository: Prisma data layer for DashboardCache CRUD
 *   - AnalyticsAdapterRegistry: maps platform string to adapter instance (no deps)
 *   - AnalyticsService: decrypt -> adapter -> upsert pipeline for a single PostVariant
 *   - DashboardService: reads DashboardCache, cross-company aggregation, slug resolution
 *   - AnalyticsIngestionJob: @Cron every 5 minutes cron job with RUN_CRON guard
 *   - DashboardSummaryJob: @Cron every 15 minutes cron job with RUN_CRON guard
 *   - AnalyticsController: GET /analytics/variants/:variantId and GET /analytics/posts/:postId
 *   - DashboardController: GET /dashboard?companySlug= and GET /dashboard/companies/:slug
 *
 * Controllers: [AnalyticsController, DashboardController]
 *
 * Exports:
 *   - AnalyticsService: for upstream consumers needing programmatic analytics access
 *   - DashboardService: for upstream consumers needing dashboard data access
 *   - AnalyticsRepository: for upstream consumers needing direct metrics access
 */

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { CredentialManagementModule } from '@social/credential-management';
import { TokenEncryptionService } from '@social/credential-management';

// Analytics pipeline
import { AnalyticsRepository } from './analytics/analytics.repository';
import { AnalyticsAdapterRegistry } from './adapters/analytics.adapter.registry';
import { AnalyticsService } from './analytics/analytics.service';
import { AnalyticsIngestionJob } from './analytics/analytics-ingestion.job';
import { AnalyticsController } from './analytics/analytics.controller';

// Dashboard pipeline
import { DashboardRepository } from './dashboard/dashboard.repository';
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardSummaryJob } from './dashboard/dashboard-summary.job';
import { DashboardController } from './dashboard/dashboard.controller';

// Report pipeline
import { ReportService } from './reports/report.service';
import { ReportCronJob } from './reports/report.cron';
import { ReportController } from './reports/report.controller';

@Module({
  imports: [
    // Required for @Cron support in AnalyticsIngestionJob and DashboardSummaryJob
    ScheduleModule.forRoot(),
    // Provides TokenEncryptionService for decrypting OAuth access tokens before adapter dispatch
    CredentialManagementModule,
  ],
  controllers: [AnalyticsController, DashboardController, ReportController],
  providers: [
    // AnalyticsRepository: Prisma data layer — PostMetrics upsert, findDueForIngestion, findByPostId
    {
      provide: AnalyticsRepository,
      useFactory: (prisma: PrismaService) => new AnalyticsRepository(prisma as any),
      inject: [PrismaService],
    },

    // DashboardRepository: Prisma data layer — DashboardCache upsert, getByCompanyId, getAllCaches
    {
      provide: DashboardRepository,
      useFactory: (prisma: PrismaService) => new DashboardRepository(prisma as any),
      inject: [PrismaService],
    },

    // AnalyticsAdapterRegistry: maps platform string to analytics adapter instance (no deps)
    {
      provide: AnalyticsAdapterRegistry,
      useFactory: () => new AnalyticsAdapterRegistry(),
      inject: [],
    },

    // AnalyticsService: orchestrates decrypt -> adapter -> upsert for a single PostVariant
    {
      provide: AnalyticsService,
      useFactory: (
        analyticsRepo: AnalyticsRepository,
        tokenEncryption: TokenEncryptionService,
        adapterRegistry: AnalyticsAdapterRegistry,
      ) => new AnalyticsService(analyticsRepo, tokenEncryption, adapterRegistry),
      inject: [AnalyticsRepository, TokenEncryptionService, AnalyticsAdapterRegistry],
    },

    // DashboardService: cache-only reads, cross-company aggregation, company slug resolution
    {
      provide: DashboardService,
      useFactory: (dashboardRepo: DashboardRepository, prisma: PrismaService) =>
        new DashboardService(dashboardRepo, prisma as any),
      inject: [DashboardRepository, PrismaService],
    },

    // AnalyticsIngestionJob: cron every 5 minutes — fetches due variants, dispatches to platform adapters
    {
      provide: AnalyticsIngestionJob,
      useFactory: (
        analyticsService: AnalyticsService,
        analyticsRepo: AnalyticsRepository,
      ) => new AnalyticsIngestionJob(analyticsService, analyticsRepo),
      inject: [AnalyticsService, AnalyticsRepository],
    },

    // DashboardSummaryJob: cron every 15 minutes — pre-computes per-company dashboard data
    {
      provide: DashboardSummaryJob,
      useFactory: (dashboardRepo: DashboardRepository, prisma: PrismaService) =>
        new DashboardSummaryJob(dashboardRepo, prisma as any),
      inject: [DashboardRepository, PrismaService],
    },

    // AnalyticsController: GET /analytics/variants/:variantId and GET /analytics/posts/:postId
    {
      provide: AnalyticsController,
      useFactory: (analyticsService: AnalyticsService) =>
        new AnalyticsController(analyticsService),
      inject: [AnalyticsService],
    },

    // DashboardController: GET /dashboard and GET /dashboard/companies/:slug
    {
      provide: DashboardController,
      useFactory: (dashboardService: DashboardService) =>
        new DashboardController(dashboardService),
      inject: [DashboardService],
    },

    // ReportService: aggregates weekly/monthly metrics and upserts ReportSummary records
    {
      provide: ReportService,
      useFactory: (prisma: PrismaService) => new ReportService(prisma as any),
      inject: [PrismaService],
    },

    // ReportCronJob: weekly (Sun midnight) and monthly (1st at 1am) report generation
    {
      provide: ReportCronJob,
      useFactory: (reportService: ReportService, prisma: PrismaService) =>
        new ReportCronJob(reportService, prisma as any),
      inject: [ReportService, PrismaService],
    },

    // ReportController: GET /companies/:companySlug/reports and GET /companies/:companySlug/reports/:reportId
    {
      provide: ReportController,
      useFactory: (reportService: ReportService, prisma: PrismaService) => {
        const controller = new ReportController(reportService);
        controller.setPrisma(prisma as any);
        return controller;
      },
      inject: [ReportService, PrismaService],
    },

  ],
  exports: [
    // Exported for potential downstream consumers
    AnalyticsService,
    DashboardService,
    AnalyticsRepository,
    // Report service exported for downstream consumers
    ReportService,
  ],
})
export class AnalyticsDashboardModule {}
