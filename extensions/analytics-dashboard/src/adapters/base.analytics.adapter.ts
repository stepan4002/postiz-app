// ============================================================================
// BaseAnalyticsAdapter — Abstract base class for all platform analytics adapters
// Provides common helpers for building MetricsSnapshot results and classifying API errors.
// Implements the AnalyticsAdapter interface contract from Plan 01 types.
// ============================================================================

import { Logger } from '@nestjs/common';
import { AnalyticsAdapter, MetricsSnapshot } from '../types/analytics.types';

/**
 * Error classification for analytics API calls.
 * Mirrors the classification pattern from the publishing BaseAdapter.
 */
export type AnalyticsErrorType = 'rate_limit' | 'transient' | 'permanent';

/**
 * Structured error thrown by analytics adapters on API failure.
 */
export class AnalyticsAdapterError extends Error {
  constructor(
    message: string,
    public readonly errorType: AnalyticsErrorType,
    public readonly retryable: boolean,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'AnalyticsAdapterError';
  }
}

/**
 * Abstract base class for all platform analytics adapters.
 * Provides shared utilities for building MetricsSnapshot objects and
 * classifying API errors into rate_limit / transient / permanent categories.
 *
 * Platform-specific adapters extend this class and implement fetchPostMetrics().
 *
 * NF4.5: Each subclass pins apiVersion at the class level.
 */
export abstract class BaseAnalyticsAdapter implements AnalyticsAdapter {
  abstract readonly platform: string;
  abstract readonly apiVersion: string;

  protected readonly logger = new Logger(this.constructor.name);

  abstract fetchPostMetrics(
    platformPostId: string,
    accessToken: string,
    platformAccountId?: string,
  ): Promise<MetricsSnapshot>;

  /**
   * Build a complete MetricsSnapshot, filling any missing fields with null.
   * Ensures every MetricsSnapshot returned to the repository has all 7 fields
   * regardless of what the platform exposes.
   *
   * @param partial - Partial metrics from the platform API response
   * @returns Full MetricsSnapshot with null for any missing field
   */
  protected buildMetrics(partial: Partial<MetricsSnapshot>): MetricsSnapshot {
    return {
      impressions: partial.impressions ?? null,
      reach: partial.reach ?? null,
      likes: partial.likes ?? null,
      comments: partial.comments ?? null,
      shares: partial.shares ?? null,
      saves: partial.saves ?? null,
      clicks: partial.clicks ?? null,
    };
  }

  /**
   * Classify an API error and throw an AnalyticsAdapterError with the classification.
   *
   * Classification rules:
   * - 429 or "rate limit" body indicators -> rate_limit (retryable)
   * - 5xx or connection errors (status 0) -> transient (retryable)
   * - 4xx (non-429) or auth/policy errors -> permanent (not retryable)
   *
   * @param error - The caught error (may be a fetch error or HTTP status object)
   * @param platform - Platform name for logging context
   * @param statusCode - HTTP status code if available (0 for network errors)
   * @param responseBody - Raw response body text for body inspection
   * @throws AnalyticsAdapterError always
   */
  protected handleApiError(
    error: unknown,
    platform: string,
    statusCode = 0,
    responseBody = '',
  ): never {
    const lowerBody = responseBody.toLowerCase();

    // Rate limit
    if (
      statusCode === 429 ||
      lowerBody.includes('rate limit') ||
      lowerBody.includes('ratelimit') ||
      lowerBody.includes('too many requests')
    ) {
      this.logger.warn(`${platform} analytics API rate limit hit`);
      throw new AnalyticsAdapterError(
        `${platform} analytics API rate limit exceeded`,
        'rate_limit',
        true,
        error,
      );
    }

    // Server-side transient errors and network errors
    if ((statusCode >= 500 && statusCode < 600) || statusCode === 0) {
      this.logger.warn(`${platform} analytics API transient error: status=${statusCode}`);
      throw new AnalyticsAdapterError(
        `${platform} analytics API transient error (status ${statusCode})`,
        'transient',
        true,
        error,
      );
    }

    // All other errors (4xx auth/policy/not found) — permanent
    this.logger.error(
      `${platform} analytics API permanent error: status=${statusCode} body=${responseBody.slice(0, 200)}`,
    );
    throw new AnalyticsAdapterError(
      `${platform} analytics API permanent error (status ${statusCode}): ${responseBody.slice(0, 200)}`,
      'permanent',
      false,
      error,
    );
  }
}
