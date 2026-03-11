// ============================================================================
// AnalyticsController
// REST endpoints for per-post and per-variant analytics data.
//
// Serves analytics from the PostMetrics table (pre-fetched by ingestion job).
// NF3.2: No live platform API calls — data served from the database only.
// ============================================================================

import { Controller, Get, Param } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /analytics/variants/:variantId
   *
   * Returns all metrics snapshots for a single PostVariant.
   * Ordered by snapshotType (1h -> 24h -> 7d).
   * Returns an empty array if no snapshots have been ingested yet.
   *
   * NF3.2: No live platform API calls — served from PostMetrics table.
   */
  @Get('variants/:variantId')
  async getVariantAnalytics(@Param('variantId') variantId: string): Promise<any[]> {
    return this.analyticsService.getVariantAnalytics(variantId);
  }

  /**
   * GET /analytics/posts/:postId
   *
   * Returns all metrics for all variants of a ContentPost.
   * Grouped by variantId, ordered by snapshotType within each variant.
   * Returns an empty array if no snapshots have been ingested yet.
   *
   * NF3.2: No live platform API calls — served from PostMetrics table.
   */
  @Get('posts/:postId')
  async getPostAnalytics(@Param('postId') postId: string): Promise<any[]> {
    return this.analyticsService.getPostAnalytics(postId);
  }
}
