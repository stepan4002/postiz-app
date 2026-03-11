// ============================================================================
// LinkedInAnalyticsAdapter
// Fetches engagement metrics for published LinkedIn posts via the REST API (2025-06).
//
// LinkedIn requires a SEPARATE API call per metric type (5 calls per post).
// We use Promise.all to make all 5 calls in parallel.
// saves/clicks: not available on LinkedIn member analytics (stored as null).
// ============================================================================

import { MetricsSnapshot } from '../types/analytics.types';
import { BaseAnalyticsAdapter } from './base.analytics.adapter';

const LINKEDIN_API_BASE = 'https://api.linkedin.com/rest';

/**
 * LinkedIn analytics queryType values mapped to MetricsSnapshot fields.
 */
const LINKEDIN_QUERY_TYPES = [
  'IMPRESSION',
  'MEMBERS_REACHED',
  'REACTION',
  'COMMENT',
  'RESHARE',
] as const;

type LinkedInQueryType = (typeof LINKEDIN_QUERY_TYPES)[number];

export class LinkedInAnalyticsAdapter extends BaseAnalyticsAdapter {
  readonly platform = 'linkedin';
  readonly apiVersion = '202506';

  /**
   * Fetch engagement metrics for a published LinkedIn post.
   *
   * Makes 5 parallel calls to memberCreatorPostAnalytics — one per queryType.
   * LinkedIn API design requires separate calls per metric (no batch endpoint).
   *
   * @param platformPostId - LinkedIn post URN (e.g., urn:li:share:1234567890)
   * @param accessToken - Member access token (decrypted by caller)
   * @param _platformAccountId - LinkedIn account ID (unused — token is member-scoped)
   */
  async fetchPostMetrics(
    platformPostId: string,
    accessToken: string,
    _platformAccountId?: string,
  ): Promise<MetricsSnapshot> {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': this.apiVersion,
      'X-Restli-Protocol-Version': '2.0.0',
    };

    const encodedPostId = encodeURIComponent(platformPostId);

    try {
      // 5 parallel calls — one per queryType (LinkedIn requires this pattern)
      const calls = LINKEDIN_QUERY_TYPES.map((queryType) =>
        fetch(
          `${LINKEDIN_API_BASE}/memberCreatorPostAnalytics?q=entity&entity=${encodedPostId}&queryType=${queryType}`,
          { headers },
        ),
      );

      const responses = await Promise.all(calls);
      const bodies = await Promise.all(responses.map((r) => r.text()));

      // Check if any call failed
      for (let i = 0; i < responses.length; i++) {
        const res = responses[i];
        const body = bodies[i];
        if (!res.ok) {
          this.handleApiError(null, this.platform, res.status, body);
        }
      }

      /**
       * Extract the first element's value from a LinkedIn analytics response.
       * Response format: { elements: [{ totalValue: { doubleValue: N } }] }
       */
      const extractValue = (body: string): number | null => {
        try {
          const data = JSON.parse(body) as {
            elements?: Array<{ totalValue?: { doubleValue?: number; longValue?: number } }>;
          };
          if (!data?.elements?.length) return null;
          const total = data.elements[0]?.totalValue;
          if (!total) return null;
          // LinkedIn uses doubleValue or longValue depending on metric
          const v = total.doubleValue ?? total.longValue;
          return typeof v === 'number' ? Math.round(v) : null;
        } catch {
          return null;
        }
      };

      // Map queryTypes in order: IMPRESSION, MEMBERS_REACHED, REACTION, COMMENT, RESHARE
      const [impressions, reach, likes, comments, shares] = bodies.map(extractValue);

      return this.buildMetrics({
        impressions,
        reach,
        likes,
        comments,
        shares,
        saves: null, // Not available on LinkedIn
        clicks: null, // Not available on LinkedIn
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
