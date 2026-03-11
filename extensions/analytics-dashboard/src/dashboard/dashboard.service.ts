// SOCIAL COMMAND CENTRE — Phase 7: Analytics & Dashboard
// DashboardService: assembles DashboardData from pre-computed DashboardCache

import type {
  DashboardData,
  TopPerformerEntry,
  ScheduledPostSummary,
  FailedPostSummary,
  PendingReviewSummary,
} from '../types/analytics.types';
import type { DashboardCache } from './dashboard.repository';
import { DashboardRepository } from './dashboard.repository';

/**
 * Extended DashboardData type that includes detail lists for each widget.
 * The base DashboardData type only exposes topPosts; the service enriches it.
 */
export interface FullDashboardData extends DashboardData {
  scheduledPosts: ScheduledPostSummary[];
  failedPosts: FailedPostSummary[];
  pendingReview: PendingReviewSummary[];
}

/** Zero-value payload returned when no cache has been computed yet. */
const EMPTY_DASHBOARD: FullDashboardData = {
  scheduledTodayCount: 0,
  pendingReviewCount: 0,
  failedPostsCount: 0,
  topPosts: [],
  scheduledPosts: [],
  failedPosts: [],
  pendingReview: [],
  computedAt: new Date(),
};

export class DashboardService {
  constructor(
    private readonly dashboardRepo: DashboardRepository,
    private readonly prisma: any,
  ) {}

  /**
   * Return pre-computed dashboard data for a single company.
   * Reads exclusively from DashboardCache — no live queries. (R12.5, NF3.1)
   */
  async getDashboard(companyId: string): Promise<FullDashboardData> {
    const cache = await this.dashboardRepo.getByCompanyId(companyId);

    if (!cache) {
      // Cache not yet computed for this company — return zero-value payload
      return { ...EMPTY_DASHBOARD, computedAt: new Date() };
    }

    return this.assembleDashboardData(cache);
  }

  /**
   * Aggregate dashboard data across all companies. (R12.6)
   * Merges top performers and re-sorts by total engagement, keeping top 5.
   * computedAt reflects the oldest (least-fresh) cache entry.
   */
  async getDashboardAllCompanies(): Promise<FullDashboardData> {
    const caches = await this.dashboardRepo.getAllCaches();

    if (caches.length === 0) {
      return { ...EMPTY_DASHBOARD, computedAt: new Date() };
    }

    let scheduledTodayCount = 0;
    let pendingReviewCount = 0;
    let failedPostsCount = 0;
    const allTopPosts: TopPerformerEntry[] = [];
    const allScheduledPosts: ScheduledPostSummary[] = [];
    const allFailedPosts: FailedPostSummary[] = [];
    const allPendingReview: PendingReviewSummary[] = [];
    let oldestComputedAt: Date = new Date();

    for (const cache of caches) {
      scheduledTodayCount += cache.scheduledTodayCount;
      pendingReviewCount += cache.pendingReviewCount;
      failedPostsCount += cache.failedPostsCount;

      allTopPosts.push(...(cache.topPostsJson as TopPerformerEntry[]));
      allScheduledPosts.push(...(cache.scheduledPostsJson as ScheduledPostSummary[]));
      allFailedPosts.push(...(cache.failedPostsJson as FailedPostSummary[]));
      allPendingReview.push(...(cache.pendingReviewJson as PendingReviewSummary[]));

      // Track the oldest computedAt (least-fresh cache entry)
      const cacheDate = new Date(cache.computedAt);
      if (cacheDate < oldestComputedAt) {
        oldestComputedAt = cacheDate;
      }
    }

    // Merge and re-sort top performers, keep best 5
    const mergedTopPosts = allTopPosts
      .sort((a, b) => b.totalEngagement - a.totalEngagement)
      .slice(0, 5);

    return {
      scheduledTodayCount,
      pendingReviewCount,
      failedPostsCount,
      topPosts: mergedTopPosts,
      scheduledPosts: allScheduledPosts,
      failedPosts: allFailedPosts,
      pendingReview: allPendingReview,
      computedAt: oldestComputedAt,
    };
  }

  /**
   * Resolve a company slug to its internal ID.
   * Returns null if no company with that slug exists.
   */
  async resolveCompanyId(companySlug: string): Promise<string | null> {
    const company = await (this.prisma as any).company.findUnique({
      where: { slug: companySlug },
      select: { id: true },
    });
    return company?.id ?? null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Parse JSON fields from DashboardCache and assemble FullDashboardData. */
  private assembleDashboardData(cache: DashboardCache): FullDashboardData {
    return {
      scheduledTodayCount: cache.scheduledTodayCount,
      pendingReviewCount: cache.pendingReviewCount,
      failedPostsCount: cache.failedPostsCount,
      topPosts: cache.topPostsJson as TopPerformerEntry[],
      scheduledPosts: cache.scheduledPostsJson as ScheduledPostSummary[],
      failedPosts: cache.failedPostsJson as FailedPostSummary[],
      pendingReview: cache.pendingReviewJson as PendingReviewSummary[],
      computedAt: new Date(cache.computedAt),
    };
  }
}
