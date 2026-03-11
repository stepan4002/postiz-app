// ============================================================================
// AnalyticsRepository
// Database operations for the analytics ingestion pipeline.
//
// Responsibilities:
// - upsertMetrics: idempotent PostMetrics create-or-update on variantId+snapshotType
// - findDueForIngestion: PUBLISHED variants where next snapshot window is due
// - findByVariantId: all snapshots for a single PostVariant
// - findByPostId: all metrics for all variants of a ContentPost
//
// Follows the same prisma: any injection pattern as other repositories.
// ============================================================================

import { Injectable } from '@nestjs/common';
import { DueIngestionItem, MetricsSnapshot, SnapshotType } from '../types/analytics.types';

// One hour in milliseconds
const ONE_HOUR_MS = 60 * 60 * 1000;
// 24 hours in milliseconds
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;
// 7 days in milliseconds
const SEVEN_DAYS_MS = 7 * TWENTY_FOUR_HOURS_MS;

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Upsert a metrics snapshot for a PostVariant.
   *
   * Uses Prisma upsert on @@unique([variantId, snapshotType]) — R11.3 idempotency.
   * Safe to call multiple times: subsequent calls update metrics + fetchedAt.
   *
   * @param variantId - The PostVariant ID
   * @param snapshotType - Which time window ('1h', '24h', '7d')
   * @param metrics - MetricsSnapshot from platform adapter
   * @param postId - The parent ContentPost ID (for FK and scoped queries)
   * @param companyId - The Company ID (for multi-tenant scoping)
   * @param platform - Platform identifier (e.g., 'instagram')
   */
  async upsertMetrics(
    variantId: string,
    snapshotType: SnapshotType,
    metrics: MetricsSnapshot,
    postId: string,
    companyId: string,
    platform: string,
  ): Promise<void> {
    const metricsData = {
      impressions: metrics.impressions,
      reach: metrics.reach,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
      saves: metrics.saves,
      clicks: metrics.clicks,
      fetchedAt: new Date(),
    };

    await (this.prisma as any).postMetrics.upsert({
      where: {
        variantId_snapshotType: {
          variantId,
          snapshotType,
        },
      },
      create: {
        variantId,
        snapshotType,
        postId,
        companyId,
        platform,
        ...metricsData,
      },
      update: metricsData,
    });
  }

  /**
   * Find published PostVariants that are due for a metrics snapshot.
   *
   * Due criteria (based on elapsed time since publishedAt):
   * - elapsed >= 1h AND no '1h' snapshot exists -> due for '1h'
   * - elapsed >= 24h AND no '24h' snapshot exists -> due for '24h'
   * - elapsed >= 7d AND no '7d' snapshot exists -> due for '7d'
   *
   * Fetches batchSize*3 candidates from DB, then JS-filters to find which
   * snapshot window is due (Prisma can't compute elapsed-time math in WHERE).
   * Joins SocialAccount -> Integration to get the encrypted access token.
   *
   * @param batchSize - Maximum number of DueIngestionItems to return
   * @returns Array of DueIngestionItem ready for adapter dispatch
   */
  async findDueForIngestion(batchSize: number): Promise<DueIngestionItem[]> {
    const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);

    // Fetch candidates: PUBLISHED variants with publishedAt >= 1h ago and platformPostId set
    const candidates = await (this.prisma as any).postVariant.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { lte: oneHourAgo },
        platformPostId: { not: null },
      },
      take: batchSize * 3, // Over-fetch to account for JS filtering
      orderBy: { publishedAt: 'asc' }, // Oldest first — prioritize earliest-published
      select: {
        id: true,
        postId: true,
        platform: true,
        platformPostId: true,
        publishedAt: true,
        metrics: {
          select: { snapshotType: true },
        },
        post: {
          select: {
            companyId: true,
            brandId: true,
          },
        },
      },
    });

    const dueItems: DueIngestionItem[] = [];

    for (const variant of candidates) {
      if (dueItems.length >= batchSize) break;

      const publishedAt = new Date(variant.publishedAt as Date);
      const elapsed = Date.now() - publishedAt.getTime();
      const existingSnapshots = new Set<string>(
        (variant.metrics as Array<{ snapshotType: string }>).map((m) => m.snapshotType),
      );

      // Determine which snapshot window is due (only one per ingestion pass)
      let dueSnapshotType: SnapshotType | null = null;
      if (elapsed >= ONE_HOUR_MS && !existingSnapshots.has('1h')) {
        dueSnapshotType = '1h';
      } else if (elapsed >= TWENTY_FOUR_HOURS_MS && !existingSnapshots.has('24h')) {
        dueSnapshotType = '24h';
      } else if (elapsed >= SEVEN_DAYS_MS && !existingSnapshots.has('7d')) {
        dueSnapshotType = '7d';
      }

      if (!dueSnapshotType) continue;

      // Resolve access token via SocialAccount -> Integration join
      const socialAccount = await (this.prisma as any).socialAccount.findFirst({
        where: {
          brandId: variant.post.brandId as string,
          platform: variant.platform as string,
        },
        select: { integrationId: true, externalId: true },
      });

      if (!socialAccount?.integrationId) continue;

      const integration = await (this.prisma as any).integration.findUnique({
        where: { id: socialAccount.integrationId as string },
        select: { token: true },
      });

      if (!integration?.token) continue;

      dueItems.push({
        variantId: variant.id as string,
        postId: variant.postId as string,
        companyId: variant.post.companyId as string,
        platform: variant.platform as string,
        platformPostId: variant.platformPostId as string,
        snapshotType: dueSnapshotType,
        accessToken: integration.token as string, // encrypted — IngestionJob decrypts
        platformAccountId: socialAccount.externalId as string | undefined,
      });
    }

    return dueItems;
  }

  /**
   * Find all PostMetrics snapshots for a single PostVariant.
   * Ordered by snapshotType for consistent display (1h -> 24h -> 7d).
   *
   * @param variantId - The PostVariant ID
   * @returns Array of PostMetrics records
   */
  async findByVariantId(variantId: string): Promise<any[]> {
    return (this.prisma as any).postMetrics.findMany({
      where: { variantId },
      orderBy: { snapshotType: 'asc' },
    });
  }

  /**
   * Find all PostMetrics snapshots for all variants of a ContentPost.
   * Used by the per-post analytics view.
   *
   * @param postId - The ContentPost ID
   * @returns Array of PostMetrics records (all variants, all snapshots)
   */
  async findByPostId(postId: string): Promise<any[]> {
    return (this.prisma as any).postMetrics.findMany({
      where: { postId },
      orderBy: [{ variantId: 'asc' }, { snapshotType: 'asc' }],
    });
  }
}
