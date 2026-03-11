// SOCIAL COMMAND CENTRE — Phase 7: Analytics & Dashboard
// DashboardSummaryJob: @Cron job that pre-computes DashboardCache every 15 minutes

import { Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type {
  TopPerformerEntry,
  ScheduledPostSummary,
  FailedPostSummary,
  PendingReviewSummary,
} from '../types/analytics.types';
import { DashboardRepository } from './dashboard.repository';

export class DashboardSummaryJob {
  private readonly logger = new Logger(DashboardSummaryJob.name);

  constructor(
    private readonly dashboardRepo: DashboardRepository,
    private readonly prisma: any,
  ) {}

  /**
   * Pre-compute dashboard cache for all companies every 15 minutes.
   * RUN_CRON guard ensures this only runs in the orchestrator process.
   */
  @Cron('*/15 * * * *')
  async refreshDashboardCache(): Promise<void> {
    if (!process.env.RUN_CRON) return;

    const companies: Array<{ id: string }> = await (
      this.prisma as any
    ).company.findMany({
      select: { id: true },
    });

    let successCount = 0;

    for (const company of companies) {
      try {
        await this.refreshForCompany(company.id);
        successCount++;
      } catch (err) {
        this.logger.error(
          `Failed to refresh dashboard cache for company ${company.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Dashboard cache refreshed for ${successCount}/${companies.length} companies`,
    );
  }

  /**
   * Compute and store dashboard data for a single company.
   * Runs 7 parallel Prisma queries then upserts DashboardCache.
   */
  private async refreshForCompany(companyId: string): Promise<void> {
    // Compute UTC day boundaries
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setUTCDate(today.getUTCDate() + 1);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setUTCDate(today.getUTCDate() - 7);

    const [
      scheduledTodayCount,
      pendingReviewCount,
      failedPostsCount,
      rawTopPosts,
      rawScheduledPosts,
      rawFailedPosts,
      rawPendingReview,
    ] = await Promise.all([
      // R12.1 — count of posts scheduled to publish today
      (this.prisma as any).postVariant.count({
        where: {
          post: { companyId },
          status: { in: ['SCHEDULED', 'PUBLISHING'] },
          scheduledAt: { gte: today, lt: tomorrow },
        },
      }),

      // R12.2 — count of posts awaiting review
      (this.prisma as any).postVariant.count({
        where: {
          post: { companyId },
          status: 'PENDING_REVIEW',
        },
      }),

      // R12.3 — count of failed or stale posts
      (this.prisma as any).postVariant.count({
        where: {
          post: { companyId },
          status: { in: ['FAILED', 'STALE'] },
        },
      }),

      // R12.4 — top performers from PostMetrics last 7 days
      (this.prisma as any).postMetrics.findMany({
        where: {
          companyId,
          fetchedAt: { gte: sevenDaysAgo },
        },
        orderBy: [{ likes: 'desc' }, { comments: 'desc' }, { shares: 'desc' }],
        take: 5,
        include: {
          variant: {
            select: {
              id: true,
              caption: true,
              platform: true,
              publishedAt: true,
              postId: true,
            },
          },
        },
      }),

      // R12.1 — detail list for scheduled today widget
      (this.prisma as any).postVariant.findMany({
        where: {
          post: { companyId },
          status: { in: ['SCHEDULED', 'PUBLISHING'] },
          scheduledAt: { gte: today, lt: tomorrow },
        },
        take: 20,
        orderBy: { scheduledAt: 'asc' },
        include: {
          post: {
            select: {
              brandId: true,
              brand: {
                select: { name: true },
              },
            },
          },
        },
      }),

      // R12.3 — detail list for failed posts widget
      (this.prisma as any).postVariant.findMany({
        where: {
          post: { companyId },
          status: { in: ['FAILED', 'STALE'] },
        },
        take: 20,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          postId: true,
          platform: true,
          caption: true,
          status: true,
          lastPublishError: true,
          consecutiveFailures: true,
        },
      }),

      // R12.2 — detail list for pending review widget
      (this.prisma as any).postVariant.findMany({
        where: {
          post: { companyId },
          status: 'PENDING_REVIEW',
        },
        take: 20,
        orderBy: { generatedAt: 'desc' },
        select: {
          id: true,
          postId: true,
          platform: true,
          caption: true,
          confidenceScore: true,
          generatedAt: true,
        },
      }),
    ]);

    // Map raw PostMetrics rows to TopPerformerEntry[]
    const topPosts: TopPerformerEntry[] = rawTopPosts.map(
      (m: any): TopPerformerEntry => ({
        variantId: m.variant.id,
        postId: m.variant.postId,
        platform: m.variant.platform,
        caption: m.variant.caption,
        likes: m.likes ?? null,
        comments: m.comments ?? null,
        shares: m.shares ?? null,
        totalEngagement: (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0),
        publishedAt: m.variant.publishedAt,
      }),
    );

    // Map raw PostVariant rows to ScheduledPostSummary[]
    const scheduledPosts: ScheduledPostSummary[] = rawScheduledPosts.map(
      (v: any): ScheduledPostSummary => ({
        variantId: v.id,
        postId: v.postId,
        platform: v.platform,
        caption: v.caption,
        scheduledAt: v.scheduledAt,
        brandName: v.post?.brand?.name ?? '',
      }),
    );

    // Map raw PostVariant rows to FailedPostSummary[]
    const failedPosts: FailedPostSummary[] = rawFailedPosts.map(
      (v: any): FailedPostSummary => ({
        variantId: v.id,
        postId: v.postId,
        platform: v.platform,
        caption: v.caption,
        status: v.status,
        lastPublishError: v.lastPublishError,
        consecutiveFailures: v.consecutiveFailures,
      }),
    );

    // Map raw PostVariant rows to PendingReviewSummary[] (generatedAt -> createdAt)
    const pendingReview: PendingReviewSummary[] = rawPendingReview.map(
      (v: any): PendingReviewSummary => ({
        variantId: v.id,
        postId: v.postId,
        platform: v.platform,
        caption: v.caption,
        confidenceScore: v.confidenceScore,
        createdAt: v.generatedAt,
      }),
    );

    // Upsert the pre-computed cache for this company
    await this.dashboardRepo.upsertCache(companyId, {
      scheduledTodayCount,
      pendingReviewCount,
      failedPostsCount,
      topPostsJson: topPosts,
      scheduledPostsJson: scheduledPosts,
      failedPostsJson: failedPosts,
      pendingReviewJson: pendingReview,
      computedAt: new Date(),
    });
  }
}
