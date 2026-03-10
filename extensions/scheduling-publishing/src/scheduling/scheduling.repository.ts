/**
 * SchedulingRepository
 *
 * Database operations for the scheduling engine:
 * - Finding posts with their variants for scheduling decisions
 * - Updating variant and post scheduling state
 * - Querying due variants for the scheduler_tick cron
 * - Company timezone and posting window lookups
 *
 * Follows Phase 4/5 pattern: injects `prisma: any` to avoid circular deps.
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class SchedulingRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Find a ContentPost by ID, including all its PostVariants.
   * Used by ScheduleResolverService before any scheduling decision.
   */
  async findPostWithVariants(postId: string): Promise<any | null> {
    return (this.prisma as any).contentPost.findUnique({
      where: { id: postId },
      include: {
        variants: true,
      },
    });
  }

  /**
   * Update a single PostVariant's scheduling fields.
   */
  async updateVariantSchedule(
    variantId: string,
    data: {
      status: string;
      scheduledAt: Date | null;
      publishWindowExpiresAt: Date | null;
    }
  ): Promise<any> {
    return (this.prisma as any).postVariant.update({
      where: { id: variantId },
      data,
    });
  }

  /**
   * Update the parent ContentPost's scheduling fields.
   */
  async updatePostSchedule(
    postId: string,
    data: {
      status: string;
      scheduledAt: Date | null;
    }
  ): Promise<any> {
    return (this.prisma as any).contentPost.update({
      where: { id: postId },
      data,
    });
  }

  /**
   * Find PostVariant records that are due for publishing.
   *
   * Due = status is SCHEDULED AND scheduledAt <= now AND platformPostId IS NULL
   * (platformPostId IS NULL ensures idempotency — already-published variants skipped)
   *
   * Ordered by scheduledAt ascending (oldest due first), limited to batchSize.
   * Includes ContentPost relation to access companyId.
   */
  async findDueVariants(batchSize: number): Promise<any[]> {
    const now = new Date();
    return (this.prisma as any).postVariant.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
        platformPostId: null,
      },
      take: batchSize,
      orderBy: { scheduledAt: 'asc' },
      include: {
        post: true,
      },
    });
  }

  /**
   * Mark a variant as PUBLISHING (atomic lease before platform API call).
   * This is the first step in the publishing handoff.
   */
  async markVariantPublishing(variantId: string): Promise<any> {
    return (this.prisma as any).postVariant.update({
      where: { id: variantId },
      data: { status: 'PUBLISHING' },
    });
  }

  /**
   * Mark a variant as STALE when its publish window has expired.
   *
   * STALE is semantically distinct from FAILED:
   * - STALE = publish window expired, no publish attempt was made
   * - FAILED = platform API returned an error during an active publishing attempt
   */
  async markVariantStale(variantId: string): Promise<any> {
    return (this.prisma as any).postVariant.update({
      where: { id: variantId },
      data: {
        status: 'STALE',
        lastPublishError: 'Publish window expired',
      },
    });
  }

  /**
   * Find scheduled posts for a company in a date range.
   * Used by auto-slot to detect occupied windows and by calendar view.
   */
  async findScheduledPostsForCompany(
    companyId: string,
    from: Date,
    to: Date
  ): Promise<any[]> {
    return (this.prisma as any).contentPost.findMany({
      where: {
        companyId,
        status: 'SCHEDULED',
        scheduledAt: {
          gte: from,
          lte: to,
        },
      },
      select: { id: true, scheduledAt: true },
    });
  }

  /**
   * Get the timezone setting for a company.
   * Defaults to 'UTC' if company not found.
   */
  async findCompanyTimezone(companyId: string): Promise<string> {
    const company = await (this.prisma as any).company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    return company?.timezone ?? 'UTC';
  }

  /**
   * Get preferred posting hours for a company (hours in company's local timezone).
   * Returns default [9, 12, 17] (9am, noon, 5pm) if no custom config.
   *
   * The integration model may have a postingTimes field. If not configured,
   * falls back to standard default windows.
   */
  async findCompanyPostingTimes(companyId: string): Promise<number[]> {
    // Default posting windows: 9am, 12pm, 5pm (company local timezone)
    const DEFAULT_POSTING_HOURS = [9, 12, 17];

    try {
      const integration = await (this.prisma as any).integration.findFirst({
        where: { organizationId: companyId },
        select: { postingTimes: true },
      });

      if (integration?.postingTimes && Array.isArray(integration.postingTimes) && integration.postingTimes.length > 0) {
        return integration.postingTimes as number[];
      }
    } catch {
      // Integration model may not have postingTimes — fall through to default
    }

    return DEFAULT_POSTING_HOURS;
  }
}
