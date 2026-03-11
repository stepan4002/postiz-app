// ============================================================================
// InstagramAnalyticsAdapter
// Fetches engagement metrics for published Instagram posts via Meta Graph API v21.0.
//
// IMPORTANT: As of April 2025, 'impressions' metric is deprecated for Reels.
// We use 'views' for impressions instead. For likes/comments, we call the
// basic fields endpoint since Insights doesn't always return them.
// clicks: not available per-post on Instagram Insights (stored as null).
// ============================================================================

import { MetricsSnapshot } from '../types/analytics.types';
import { BaseAnalyticsAdapter } from './base.analytics.adapter';

const META_GRAPH_BASE = 'https://graph.facebook.com';

export class InstagramAnalyticsAdapter extends BaseAnalyticsAdapter {
  readonly platform = 'instagram';
  readonly apiVersion = 'v21.0';

  /**
   * Fetch engagement metrics for a published Instagram post/reel.
   *
   * Uses 3 parallel API calls:
   * 1. /insights?metric=reach,comments,shares,saved,total_interactions - core engagement
   * 2. /insights?metric=views - impressions (replaces deprecated 'impressions' metric)
   * 3. /?fields=like_count,comments_count - likes and comments count (more reliable)
   *
   * @param platformPostId - Instagram media ID returned at publish time
   * @param accessToken - Page access token (decrypted by caller)
   * @param _platformAccountId - Instagram account ID (unused for this API call)
   */
  async fetchPostMetrics(
    platformPostId: string,
    accessToken: string,
    _platformAccountId?: string,
  ): Promise<MetricsSnapshot> {
    const base = `${META_GRAPH_BASE}/${this.apiVersion}/${platformPostId}`;
    const token = `access_token=${encodeURIComponent(accessToken)}`;

    try {
      // Parallel calls: insights (reach/shares/saves), views (impressions), basic fields (likes)
      const [insightsRes, viewsRes, basicRes] = await Promise.all([
        fetch(`${base}/insights?metric=reach,comments,shares,saved,total_interactions&${token}`),
        fetch(`${base}/insights?metric=views&${token}`),
        fetch(`${base}?fields=like_count,comments_count&${token}`),
      ]);

      // Parse all three responses in parallel
      const [insightsBody, viewsBody, basicBody] = await Promise.all([
        insightsRes.text(),
        viewsRes.text(),
        basicRes.text(),
      ]);

      // Fail fast if the primary insights call failed
      if (!insightsRes.ok) {
        this.handleApiError(null, this.platform, insightsRes.status, insightsBody);
      }

      // Parse insights response
      const insightsData = JSON.parse(insightsBody) as {
        data?: Array<{ name: string; values?: Array<{ value: number }>; value?: number }>;
      };
      const insightsMetrics: Record<string, number> = {};
      if (insightsData?.data && Array.isArray(insightsData.data)) {
        for (const item of insightsData.data) {
          // Instagram Insights returns values as array of period objects
          const value = Array.isArray(item.values) ? item.values[0]?.value : item.value;
          insightsMetrics[item.name] = typeof value === 'number' ? value : 0;
        }
      }

      // Parse views (impressions) response
      let impressions: number | null = null;
      if (viewsRes.ok) {
        const viewsData = JSON.parse(viewsBody) as {
          data?: Array<{ name: string; values?: Array<{ value: number }>; value?: number }>;
        };
        if (viewsData?.data && Array.isArray(viewsData.data)) {
          const viewsItem = viewsData.data.find((d) => d.name === 'views');
          if (viewsItem) {
            const v = Array.isArray(viewsItem.values)
              ? viewsItem.values[0]?.value
              : viewsItem.value;
            impressions = typeof v === 'number' ? v : null;
          }
        }
        // Fallback: use total_interactions as impressions proxy if views unavailable
        if (impressions === null && insightsMetrics['total_interactions'] !== undefined) {
          impressions = insightsMetrics['total_interactions'];
        }
      }

      // Parse basic fields (likes, comments count)
      let likes: number | null = null;
      let comments: number | null = null;
      if (basicRes.ok) {
        const basicData = JSON.parse(basicBody) as {
          like_count?: number;
          comments_count?: number;
        };
        likes = typeof basicData?.like_count === 'number' ? basicData.like_count : null;
        comments =
          typeof basicData?.comments_count === 'number' ? basicData.comments_count : null;
      }

      // Fall back to insights for comments if not in basic fields
      if (comments === null && insightsMetrics['comments'] !== undefined) {
        comments = insightsMetrics['comments'];
      }

      return this.buildMetrics({
        impressions,
        reach: insightsMetrics['reach'] ?? null,
        likes,
        comments,
        shares: insightsMetrics['shares'] ?? null,
        saves: insightsMetrics['saved'] ?? null,
        clicks: null, // Not available per-post on Instagram Insights
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
