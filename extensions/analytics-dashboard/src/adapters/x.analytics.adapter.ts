// ============================================================================
// XAnalyticsAdapter
// Fetches engagement metrics for published X (Twitter) posts via API v2.
//
// public_metrics: impressions, likes, replies (comments), retweets (shares)
// non_public_metrics: url_link_clicks — only available for posts <= 30 days old.
// Posts older than 30 days: non_public_metrics returns 403 → clicks stored as null.
// reach/saves: not available on X API v2 (stored as null).
// ============================================================================

import { MetricsSnapshot } from '../types/analytics.types';
import { BaseAnalyticsAdapter } from './base.analytics.adapter';

const X_API_BASE = 'https://api.twitter.com/2';

interface XTweetResponse {
  data?: {
    public_metrics?: {
      impression_count?: number;
      like_count?: number;
      reply_count?: number;
      retweet_count?: number;
    };
    non_public_metrics?: {
      url_link_clicks?: number;
    };
  };
  errors?: Array<{ message: string; code: number }>;
}

export class XAnalyticsAdapter extends BaseAnalyticsAdapter {
  readonly platform = 'x';
  readonly apiVersion = '2';

  /**
   * Fetch engagement metrics for a published X post.
   *
   * Fetches both public_metrics and non_public_metrics in a single call.
   * If non_public_metrics is unavailable (post > 30 days old, 403 error),
   * we catch the 403 gracefully and store clicks as null.
   *
   * @param platformPostId - X tweet ID returned at publish time
   * @param accessToken - Bearer token (decrypted by caller)
   * @param _platformAccountId - X account ID (unused — bearer token is user-scoped)
   */
  async fetchPostMetrics(
    platformPostId: string,
    accessToken: string,
    _platformAccountId?: string,
  ): Promise<MetricsSnapshot> {
    const url = `${X_API_BASE}/tweets/${platformPostId}?tweet.fields=public_metrics,non_public_metrics`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
    };

    try {
      const response = await fetch(url, { headers });
      const body = await response.text();

      // Handle 403 specially — non_public_metrics not available for old posts
      // Return public metrics with null clicks rather than failing entirely
      if (response.status === 403) {
        this.logger.debug(
          `X non_public_metrics unavailable for tweet ${platformPostId} (403 — post likely >30 days old). Falling back to public metrics only.`,
        );
        // Retry with public_metrics only
        return await this.fetchPublicMetricsOnly(platformPostId, accessToken, headers);
      }

      if (!response.ok) {
        this.handleApiError(null, this.platform, response.status, body);
      }

      const data = JSON.parse(body) as XTweetResponse;

      if (data?.errors?.length && !data?.data) {
        this.handleApiError(
          null,
          this.platform,
          response.status,
          data.errors[0]?.message ?? body,
        );
      }

      const pub = data?.data?.public_metrics;
      const nonPub = data?.data?.non_public_metrics;

      return this.buildMetrics({
        impressions: pub?.impression_count ?? null,
        reach: null, // Not available on X API v2
        likes: pub?.like_count ?? null,
        comments: pub?.reply_count ?? null,
        shares: pub?.retweet_count ?? null,
        saves: null, // Not available on X API v2
        clicks: nonPub?.url_link_clicks ?? null,
      });
    } catch (error) {
      if ((error as Error)?.name === 'AnalyticsAdapterError') {
        throw error;
      }
      // Network / JSON parse errors — classify as transient
      this.handleApiError(error, this.platform, 0, String(error));
    }
  }

  /**
   * Fallback fetch using public_metrics only (no non_public_metrics).
   * Used when the post is older than 30 days and non_public_metrics returns 403.
   */
  private async fetchPublicMetricsOnly(
    platformPostId: string,
    accessToken: string,
    headers: Record<string, string>,
  ): Promise<MetricsSnapshot> {
    const url = `${X_API_BASE}/tweets/${platformPostId}?tweet.fields=public_metrics`;

    const response = await fetch(url, { headers });
    const body = await response.text();

    if (!response.ok) {
      this.handleApiError(null, this.platform, response.status, body);
    }

    const data = JSON.parse(body) as XTweetResponse;
    const pub = data?.data?.public_metrics;

    return this.buildMetrics({
      impressions: pub?.impression_count ?? null,
      reach: null,
      likes: pub?.like_count ?? null,
      comments: pub?.reply_count ?? null,
      shares: pub?.retweet_count ?? null,
      saves: null,
      clicks: null, // Unavailable — post too old
    });
  }
}
