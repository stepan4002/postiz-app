// ============================================================================
// BaseAdapter — Abstract base class for all platform adapters
// Provides common error classification, fetch helpers, and result builders.
// Implements the PlatformAdapter interface contract.
// ============================================================================

import { ErrorClassification, PlatformAdapter, PublishParams, PublishResult } from '../types/publishing.types';

/**
 * Abstract base class for all platform adapters.
 * Provides shared utilities for error classification, fetch with timeout,
 * and PublishResult construction.
 *
 * Platform-specific adapters extend this class and implement publish().
 *
 * NF4.3: All platform logic lives in adapter implementations via this hierarchy.
 * NF4.5: Each subclass pins apiVersion at the class level.
 */
export abstract class BaseAdapter implements PlatformAdapter {
  abstract platform: string;
  abstract apiVersion: string;
  abstract publish(params: PublishParams): Promise<PublishResult>;

  /**
   * Classify an HTTP error response into one of three categories.
   *
   * Classification rules:
   * - 429 or "rate limit" body indicators -> rate_limit (retryable)
   * - 5xx or connection errors -> transient (retryable)
   * - 4xx (non-429) or auth/policy errors -> permanent (not retryable)
   *
   * @param statusCode HTTP status code from the platform API
   * @param responseBody Raw response body text for additional context
   * @returns Classification and retryability
   */
  protected classifyError(
    statusCode: number,
    responseBody: string,
  ): { retryable: boolean; errorType: ErrorClassification } {
    // Rate limit — always retryable
    if (statusCode === 429) {
      return { retryable: true, errorType: 'rate_limit' };
    }

    // Check body for rate limit indicators even if status code differs
    const lowerBody = responseBody.toLowerCase();
    if (
      lowerBody.includes('rate limit') ||
      lowerBody.includes('ratelimit') ||
      lowerBody.includes('too many requests')
    ) {
      return { retryable: true, errorType: 'rate_limit' };
    }

    // Server-side transient errors — safe to retry
    if (statusCode >= 500 && statusCode < 600) {
      return { retryable: true, errorType: 'transient' };
    }

    // Connection / timeout errors have statusCode 0 (set by catch handler)
    if (statusCode === 0) {
      return { retryable: true, errorType: 'transient' };
    }

    // All other 4xx errors — permanent
    return { retryable: false, errorType: 'permanent' };
  }

  /**
   * Build a standardized PublishResult.
   *
   * @param success Whether the publish was successful
   * @param platformPostId Platform-assigned post ID (on success)
   * @param platformUrl Public URL of the published post (on success)
   * @param error Human-readable error message (on failure)
   * @param retryable Whether this error can be retried
   * @param errorType Classification of the error
   */
  protected buildPublishResult(
    success: boolean,
    platformPostId?: string,
    platformUrl?: string,
    error?: string,
    retryable = false,
    errorType?: ErrorClassification,
  ): PublishResult {
    return {
      success,
      platformPostId,
      platformUrl,
      error,
      retryable,
      errorType: success ? undefined : errorType,
    };
  }

  /**
   * Wraps native fetch with an AbortController timeout.
   * Classifies ECONNRESET / AbortError as transient errors.
   *
   * @param url The URL to fetch
   * @param options Standard RequestInit options
   * @param timeoutMs Timeout in milliseconds (default 30s)
   */
  protected async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs = 30_000,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timer);
    }
  }
}
