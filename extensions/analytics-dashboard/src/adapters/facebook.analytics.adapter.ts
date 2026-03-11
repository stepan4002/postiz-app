// ============================================================================
// FacebookAnalyticsAdapter
// Fetches engagement metrics for published Facebook posts via Meta Graph API v21.0.
//
// IMPORTANT: As of November 2025, 'post_impressions' metric is deprecated.
// We use 'post_media_views' instead.
// shares/saves: not available at post level on Facebook Insights (stored as null).
// ============================================================================

import { MetricsSnapshot } from '../types/analytics.types';
import { BaseAnalyticsAdapter } from './base.analytics.adapter';

const META_GRAPH_BASE = 'https://graph.facebook.com';

export class FacebookAnalyticsAdapter extends BaseAnalyticsAdapter {
  readonly platform = 'facebook';
  readonly apiVersion = 'v21.0';

  /**
   * Fetch engagement metrics for a published Facebook post.
   *
   * Uses 3 parallel API calls:
   * 1. /insights?metric=post_media_views,post_engaged_users,post_clicks - views/engagement/clicks
   * 2. /insights?metric=post_reach - reach (separate call per API design)
   * 3. /?fields=likes.summary(true),comments.summary(true) - likes and comments counts
   *
   * @param platformPostId - Facebook post ID returned at publish time
   * @param accessToken - Page access token (decrypted by caller)
   * @param _platformAccountId - Facebook page ID (unused — token is page-scoped)
   */
  async fetchPostMetrics(
    platformPostId: string,
    accessToken: string,
    _platformAccountId?: string,
  ): Promise<MetricsSnapshot> {
    const base = `${META_GRAPH_BASE}/${this.apiVersion}/${platformPostId}`;
    const token = `access_token=${encodeURIComponent(accessToken)}`;

    try {
      // Parallel API calls for different metric groups
      const [viewsRes, reachRes, engagementRes] = await Promise.all([
        fetch(
          `${base}/insights?metric=post_media_views,post_engaged_users,post_clicks&${token}`,
        ),
        fetch(`${base}/insights?metric=post_reach&${token}`),
        fetch(`${base}?fields=likes.summary(true),comments.summary(true)&${token}`),
      ]);

      const [viewsBody, reachBody, engagementBody] = await Promise.all([
        viewsRes.text(),
        reachRes.text(),
        engagementRes.text(),
      ]);

      // Fail fast if the primary views/clicks call failed
      if (!viewsRes.ok) {
        this.handleApiError(null, this.platform, viewsRes.status, viewsBody);
      }

      // Parse insights metrics (views/clicks)
      const insightsMap: Record<string, number> = {};
      const viewsData = JSON.parse(viewsBody) as {
        data?: Array<{ name: string; values?: Array<{ value: number }>; value?: number }>;
      };
      if (viewsData?.data && Array.isArray(viewsData.data)) {
        for (const item of viewsData.data) {
          // Facebook Insights returns values as period objects
          const value = Array.isArray(item.values) ? item.values[0]?.value : item.value;
          insightsMap[item.name] = typeof value === 'number' ? value : 0;
        }
      }

      // Parse reach (separate insights call)
      let reach: number | null = null;
      if (reachRes.ok) {
        const reachData = JSON.parse(reachBody) as {
          data?: Array<{ name: string; values?: Array<{ value: number }>; value?: number }>;
        };
        if (reachData?.data && Array.isArray(reachData.data)) {
          const reachItem = reachData.data.find((d) => d.name === 'post_reach');
          if (reachItem) {
            const v = Array.isArray(reachItem.values)
              ? reachItem.values[0]?.value
              : reachItem.value;
            reach = typeof v === 'number' ? v : null;
          }
        }
      }

      // Parse likes and comments from basic fields
      let likes: number | null = null;
      let comments: number | null = null;
      if (engagementRes.ok) {
        const engagementData = JSON.parse(engagementBody) as {
          likes?: { summary?: { total_count?: number } };
          comments?: { summary?: { total_count?: number } };
        };
        likes = engagementData?.likes?.summary?.total_count ?? null;
        comments = engagementData?.comments?.summary?.total_count ?? null;
      }

      return this.buildMetrics({
        impressions: insightsMap['post_media_views'] ?? null,
        reach,
        likes,
        comments,
        shares: null, // Not available at post level on Facebook Insights
        saves: null, // Not available on Facebook
        clicks: insightsMap['post_clicks'] ?? null,
      });
    } catch (error) {
      if ((error as Error)?.name === 'AnalyticsAdapterError') {
        throw error;
      }
      // Network / JSON parse errors — classify as transient
      this.handleApiError(error, this.platform, 0, String(error));
    }
  }
}
