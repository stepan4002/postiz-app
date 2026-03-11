// SOCIAL COMMAND CENTRE — Phase 7: Analytics & Dashboard
// Barrel exports for @social/analytics-dashboard extension package

// Plan 01 — Type contracts
export type {
  SnapshotType,
  MetricsSnapshot,
  AnalyticsAdapter,
  DueIngestionItem,
  TopPerformerEntry,
  ScheduledPostSummary,
  FailedPostSummary,
  PendingReviewSummary,
  DashboardData,
} from './types/analytics.types';

// Plan 02 — Analytics ingestion pipeline
export { BaseAnalyticsAdapter } from './adapters/base.analytics.adapter';
export type { AnalyticsErrorType } from './adapters/base.analytics.adapter';
export { AnalyticsAdapterError } from './adapters/base.analytics.adapter';
export { InstagramAnalyticsAdapter } from './adapters/instagram.analytics.adapter';
export { FacebookAnalyticsAdapter } from './adapters/facebook.analytics.adapter';
export { LinkedInAnalyticsAdapter } from './adapters/linkedin.analytics.adapter';
export { XAnalyticsAdapter } from './adapters/x.analytics.adapter';
export { AnalyticsAdapterRegistry } from './adapters/analytics.adapter.registry';
export { AnalyticsRepository } from './analytics/analytics.repository';
export { AnalyticsService } from './analytics/analytics.service';
export type { ITokenEncryptionService } from './analytics/analytics.service';
export { AnalyticsIngestionJob } from './analytics/analytics-ingestion.job';
export { AnalyticsController } from './analytics/analytics.controller';

// Plan 03 — Dashboard pipeline
export type { DashboardCache } from './dashboard/dashboard.repository';
export { DashboardRepository } from './dashboard/dashboard.repository';
export type { FullDashboardData } from './dashboard/dashboard.service';
export { DashboardService } from './dashboard/dashboard.service';
export { DashboardSummaryJob } from './dashboard/dashboard-summary.job';
export { DashboardController } from './dashboard/dashboard.controller';

// Plan 04 — NestJS module wiring
export { AnalyticsDashboardModule } from './analytics-dashboard.module';
