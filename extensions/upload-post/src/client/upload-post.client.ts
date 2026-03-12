/**
 * UploadPostClient
 *
 * HTTP client wrapping the Upload-Post.com REST API.
 * All requests are authenticated via the `Authorization: Apikey {key}` header.
 *
 * Endpoints:
 *   POST /api/upload_text   — publish text-only posts
 *   POST /api/upload_photo  — publish posts with photos
 *   POST /api/upload_video  — publish posts with videos
 *   GET  /api/status/{id}   — check async post status
 *
 * Response modes:
 *   - Sync:      200 with immediate results[]
 *   - Async:     200 with request_id for polling
 *   - Scheduled: 202 with job_id
 *
 * Error handling:
 *   - Network errors are caught and re-thrown with context
 *   - Non-2xx responses are mapped to typed UploadPostResponse with error detail
 */

import { Logger } from '@nestjs/common';
import {
  UploadTextRequest,
  UploadPhotoRequest,
  UploadVideoRequest,
  UploadPostResponse,
  StatusResponse,
} from './upload-post.types';

export class UploadPostClient {
  private readonly logger = new Logger(UploadPostClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || process.env.UPLOADPOST_API_URL || 'https://api.upload-post.com/api';
  }

  // ---------------------------------------------------------------------------
  // Upload endpoints
  // ---------------------------------------------------------------------------

  /**
   * Publish a text-only post via Upload-Post.
   *
   * @param params - Text post parameters (profile, post_text, platforms, etc.)
   * @returns Upload-Post API response (sync results, request_id, or job_id)
   */
  async uploadText(params: UploadTextRequest): Promise<UploadPostResponse> {
    return this.request<UploadPostResponse>('POST', '/upload_text', params);
  }

  /**
   * Publish a post with photo via Upload-Post.
   *
   * Either media_url (publicly accessible URL) or media_base64 must be provided.
   *
   * @param params - Photo post parameters
   * @returns Upload-Post API response
   */
  async uploadPhoto(params: UploadPhotoRequest): Promise<UploadPostResponse> {
    return this.request<UploadPostResponse>('POST', '/upload_photo', params);
  }

  /**
   * Publish a post with video via Upload-Post.
   *
   * video_url must be a publicly accessible URL.
   *
   * @param params - Video post parameters
   * @returns Upload-Post API response
   */
  async uploadVideo(params: UploadVideoRequest): Promise<UploadPostResponse> {
    return this.request<UploadPostResponse>('POST', '/upload_video', params);
  }

  // ---------------------------------------------------------------------------
  // Status polling
  // ---------------------------------------------------------------------------

  /**
   * Check the status of an async post by request_id.
   *
   * Upload-Post returns async responses when the publishing pipeline takes
   * longer than a few seconds. Poll this endpoint until completed/failed.
   *
   * @param requestId - The request_id from the original upload response
   * @returns Current status with results when completed
   */
  async checkStatus(requestId: string): Promise<StatusResponse> {
    return this.request<StatusResponse>('GET', `/status/${requestId}`);
  }

  // ---------------------------------------------------------------------------
  // API key verification
  // ---------------------------------------------------------------------------

  /**
   * Verify that the configured API key is valid.
   *
   * Makes a lightweight request to check authentication. Uses upload_text
   * with a dry-run / minimal payload to verify key validity without actually
   * posting anything. Falls back to checking HTTP status.
   *
   * @returns true if the API key is valid, false otherwise
   */
  async verifyApiKey(): Promise<boolean> {
    try {
      // Attempt a status check with a dummy ID to verify auth
      // Upload-Post returns 401 for invalid keys, 404 for missing IDs
      const response = await fetch(`${this.baseUrl}/status/verify-key-test`, {
        method: 'GET',
        headers: {
          Authorization: `Apikey ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // 401/403 = bad key, anything else (including 404) = key is valid
      if (response.status === 401 || response.status === 403) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('API key verification failed with network error', error);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal HTTP request helper
  // ---------------------------------------------------------------------------

  /**
   * Make an authenticated HTTP request to the Upload-Post API.
   *
   * @param method - HTTP method
   * @param path - API path (appended to base URL, e.g. "/upload_text")
   * @param body - Request body (for POST requests)
   * @returns Parsed JSON response
   * @throws Error on network failure or non-2xx response
   */
  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, any>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    this.logger.debug(`Upload-Post API: ${method} ${url}`);

    try {
      const options: RequestInit = {
        method,
        headers: {
          Authorization: `Apikey ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      };

      if (body && method === 'POST') {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        this.logger.warn(
          `Upload-Post API error: ${response.status} ${response.statusText} — ${JSON.stringify(data)}`,
        );

        // Return a typed error response instead of throwing,
        // so the provider can handle it gracefully
        return {
          success: false,
          error: (data as any)?.error || `HTTP ${response.status}: ${response.statusText}`,
        } as T;
      }

      return data as T;
    } catch (error: any) {
      this.logger.error(`Upload-Post API network error: ${method} ${url}`, error?.message);
      throw new Error(`Upload-Post API request failed: ${error?.message || 'Unknown error'}`);
    }
  }
}
