// SOCIAL COMMAND CENTRE — Phase 7: Analytics & Dashboard
// DashboardRepository: CRUD operations for DashboardCache (one row per company)

import type {
  TopPerformerEntry,
  ScheduledPostSummary,
  FailedPostSummary,
  PendingReviewSummary,
} from '../types/analytics.types';

export interface DashboardCache {
  id: string;
  companyId: string;
  scheduledTodayCount: number;
  pendingReviewCount: number;
  failedPostsCount: number;
  topPostsJson: TopPerformerEntry[];
  scheduledPostsJson: ScheduledPostSummary[];
  failedPostsJson: FailedPostSummary[];
  pendingReviewJson: PendingReviewSummary[];
  computedAt: Date;
}

export class DashboardRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Upsert the dashboard cache for a company.
   * Called by DashboardSummaryJob after each refresh cycle.
   */
  async upsertCache(companyId: string, data: object): Promise<void> {
    await (this.prisma as any).dashboardCache.upsert({
      where: { companyId },
      create: {
        companyId,
        ...data,
        computedAt: new Date(),
      },
      update: {
        ...data,
        computedAt: new Date(),
      },
    });
  }

  /**
   * Fetch the dashboard cache for a single company.
   * Returns null if the cache has not been computed yet.
   */
  async getByCompanyId(companyId: string): Promise<DashboardCache | null> {
    return (this.prisma as any).dashboardCache.findUnique({
      where: { companyId },
    });
  }

  /**
   * Fetch all dashboard caches — used for cross-company aggregation (R12.6).
   */
  async getAllCaches(): Promise<DashboardCache[]> {
    return (this.prisma as any).dashboardCache.findMany();
  }
}
