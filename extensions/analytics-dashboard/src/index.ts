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

// Plan 03 — Dashboard pipeline
export type { DashboardCache } from './dashboard/dashboard.repository';
export { DashboardRepository } from './dashboard/dashboard.repository';
export type { FullDashboardData } from './dashboard/dashboard.service';
export { DashboardService } from './dashboard/dashboard.service';
export { DashboardSummaryJob } from './dashboard/dashboard-summary.job';
export { DashboardController } from './dashboard/dashboard.controller';
