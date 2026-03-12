/**
 * AyrShareClient
 *
 * HTTP client wrapping the AyrShare REST API (https://api.ayrshare.com/api).
 * All requests are authenticated via the `Authorization: Bearer {API_KEY}` header.
 * Multi-tenant requests include a `Profile-Key: {PROFILE_KEY}` header.
 *
 * Endpoints:
 *   POST /post                — create post across platforms
 *   GET  /post/{id}           — get post details
 *   DELETE /post/{id}         — delete a post
 *   POST /post/{id}/retry     — retry a failed post
 *   GET  /comments/{id}       — get comments on a post
 *   POST /comments/{id}       — post a comment
 *   POST /comments/{id}/reply — reply to a comment
 *   POST /messages/{platform} — send DM
 *   GET  /messages/{platform} — get messages/conversations
 *   GET  /analytics/post/{id} — post-level analytics
 *   GET  /analytics/social    — account-level analytics
 *   POST /profiles            — create profile
 *   POST /profiles/generateJWT — SSO link for social account linking
 *   POST /profiles/unlink     — unlink a social network
 *   POST /media/upload        — upload media (Base64)
 *   POST /media/upload-url    — get presigned URL for large files
 *   POST /webhooks            — register webhook
 *   GET  /webhooks            — list webhooks
 *   DELETE /webhooks           — delete webhook
 *   POST /validate/post       — validate before posting
 *   GET  /history             — post history
 *
 * Rate limit: 300 requests per 5-minute interval per profile.
 */

import { Logger } from '@nestjs/common';
import {
  AyrSharePostRequest,
  AyrSharePostResponse,
  AyrSharePostDetails,
  AyrShareCommentsResponse,
  AyrShareCommentRequest,
  AyrShareCommentResponse,
  AyrShareReplyRequest,
  AyrShareSendMessageRequest,
  AyrShareMessageResponse,
  AyrShareMessagesResponse,
  AyrSharePostAnalytics,
  AyrShareSocialAnalytics,
  AyrShareCreateProfileResponse,
  AyrShareGenerateJWTResponse,
  AyrShareProfileInfo,
  AyrShareMediaUploadRequest,
  AyrShareMediaUploadResponse,
  AyrSharePresignedUrlRequest,
  AyrSharePresignedUrlResponse,
  AyrShareRegisterWebhookRequest,
  AyrShareRegisterWebhookResponse,
  AyrShareValidatePostRequest,
  AyrShareValidationResult,
  AyrShareHistoryEntry,
  AyrShareStatusResponse,
  AyrSharePlatform,
  AyrShareUnlinkRequest,
} from './ayrshare.types';

export class AyrShareClient {
  private readonly logger = new Logger(AyrShareClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly profileKey?: string;

  constructor(apiKey: string, profileKey?: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.profileKey = profileKey;
    this.baseUrl =
      baseUrl ||
      process.env.AYRSHARE_API_URL ||
      'https://api.ayrshare.com/api';
  }

  // ---------------------------------------------------------------------------
  // Posting
  // ---------------------------------------------------------------------------

  /**
   * Create a post across one or more platforms.
   *
   * @param params - Post content, platforms, media, scheduling, and platform-specific options
   * @returns Post response with platform results or async ID
   */
  async createPost(params: AyrSharePostRequest): Promise<AyrSharePostResponse> {
    return this.request<AyrSharePostResponse>('POST', '/post', params);
  }

  /**
   * Get details of a specific post by AyrShare post ID.
   */
  async getPost(postId: string): Promise<AyrSharePostDetails> {
    return this.request<AyrSharePostDetails>('GET', `/post/${postId}`);
  }

  /**
   * Delete a post across all platforms.
   */
  async deletePost(postId: string): Promise<AyrShareStatusResponse> {
    return this.request<AyrShareStatusResponse>('DELETE', `/post/${postId}`);
  }

  /**
   * Retry a failed post.
   */
  async retryPost(postId: string): Promise<AyrSharePostResponse> {
    return this.request<AyrSharePostResponse>('POST', `/post/${postId}/retry`);
  }

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  /**
   * Get comments on a post.
   *
   * @param postId - AyrShare post ID
   * @param platform - Optional platform filter
   */
  async getComments(
    postId: string,
    platform?: AyrSharePlatform,
  ): Promise<AyrShareCommentsResponse> {
    const query = platform ? `?platform=${platform}` : '';
    return this.request<AyrShareCommentsResponse>(
      'GET',
      `/comments/${postId}${query}`,
    );
  }

  /**
   * Post a comment on a post.
   *
   * @param postId - AyrShare post ID
   * @param params - Comment text and optional platform filter
   */
  async postComment(
    postId: string,
    params: AyrShareCommentRequest,
  ): Promise<AyrShareCommentResponse> {
    return this.request<AyrShareCommentResponse>(
      'POST',
      `/comments/${postId}`,
      params,
    );
  }

  /**
   * Reply to a specific comment.
   *
   * @param commentId - Platform-specific comment ID
   * @param params - Reply text and platform
   */
  async replyToComment(
    commentId: string,
    params: AyrShareReplyRequest,
  ): Promise<AyrShareCommentResponse> {
    return this.request<AyrShareCommentResponse>(
      'POST',
      `/comments/${commentId}/reply`,
      params,
    );
  }

  // ---------------------------------------------------------------------------
  // Messages / DMs
  // ---------------------------------------------------------------------------

  /**
   * Send a DM on a supported platform (facebook, instagram, twitter).
   */
  async sendMessage(
    platform: AyrSharePlatform,
    params: AyrShareSendMessageRequest,
  ): Promise<AyrShareMessageResponse> {
    return this.request<AyrShareMessageResponse>(
      'POST',
      `/messages/${platform}`,
      params,
    );
  }

  /**
   * Get messages/conversations on a platform.
   *
   * @param platform - facebook, instagram, or twitter
   * @param conversationId - Optional specific conversation
   */
  async getMessages(
    platform: AyrSharePlatform,
    conversationId?: string,
  ): Promise<AyrShareMessagesResponse> {
    const query = conversationId
      ? `?conversationId=${conversationId}`
      : '';
    return this.request<AyrShareMessagesResponse>(
      'GET',
      `/messages/${platform}${query}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Analytics
  // ---------------------------------------------------------------------------

  /**
   * Get analytics for a specific post.
   */
  async getPostAnalytics(
    postId: string,
  ): Promise<{ analytics: AyrSharePostAnalytics[] }> {
    return this.request<{ analytics: AyrSharePostAnalytics[] }>(
      'GET',
      `/analytics/post/${postId}`,
    );
  }

  /**
   * Get account-level social analytics.
   *
   * @param platforms - Optional platform filter
   */
  async getSocialAnalytics(
    platforms?: AyrSharePlatform[],
  ): Promise<{ analytics: AyrShareSocialAnalytics[] }> {
    const query = platforms?.length
      ? `?platforms=${platforms.join(',')}`
      : '';
    return this.request<{ analytics: AyrShareSocialAnalytics[] }>(
      'GET',
      `/analytics/social${query}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Profiles (multi-tenant)
  // ---------------------------------------------------------------------------

  /**
   * Create a new AyrShare profile (sub-account).
   */
  async createProfile(
    title: string,
  ): Promise<AyrShareCreateProfileResponse> {
    return this.request<AyrShareCreateProfileResponse>('POST', '/profiles', {
      title,
    });
  }

  /**
   * Generate a JWT/SSO URL for social account linking.
   * The user opens this URL to connect their social accounts through AyrShare's UI.
   */
  async generateJWT(
    profileKey: string,
    domain: string,
  ): Promise<AyrShareGenerateJWTResponse> {
    return this.request<AyrShareGenerateJWTResponse>(
      'POST',
      '/profiles/generateJWT',
      { profileKey, domain },
    );
  }

  /**
   * List all profiles under the API key.
   */
  async listProfiles(): Promise<AyrShareProfileInfo[]> {
    return this.request<AyrShareProfileInfo[]>('GET', '/profiles');
  }

  /**
   * Delete an AyrShare profile.
   */
  async deleteProfile(
    profileKey: string,
  ): Promise<AyrShareStatusResponse> {
    return this.request<AyrShareStatusResponse>('DELETE', '/profiles', {
      profileKey,
    });
  }

  /**
   * Unlink a social network from a profile.
   */
  async unlinkSocial(
    params: AyrShareUnlinkRequest,
  ): Promise<AyrShareStatusResponse> {
    return this.request<AyrShareStatusResponse>(
      'POST',
      '/profiles/unlink',
      params,
    );
  }

  // ---------------------------------------------------------------------------
  // Media
  // ---------------------------------------------------------------------------

  /**
   * Upload media (Base64 encoded).
   */
  async uploadMedia(
    params: AyrShareMediaUploadRequest,
  ): Promise<AyrShareMediaUploadResponse> {
    return this.request<AyrShareMediaUploadResponse>(
      'POST',
      '/media/upload',
      params,
    );
  }

  /**
   * Get a presigned URL for uploading large files.
   */
  async getPresignedUrl(
    params: AyrSharePresignedUrlRequest,
  ): Promise<AyrSharePresignedUrlResponse> {
    return this.request<AyrSharePresignedUrlResponse>(
      'POST',
      '/media/upload-url',
      params,
    );
  }

  // ---------------------------------------------------------------------------
  // Webhooks
  // ---------------------------------------------------------------------------

  /**
   * Register a webhook for a specific event type.
   */
  async registerWebhook(
    params: AyrShareRegisterWebhookRequest,
  ): Promise<AyrShareRegisterWebhookResponse> {
    return this.request<AyrShareRegisterWebhookResponse>(
      'POST',
      '/webhooks',
      params,
    );
  }

  /**
   * List registered webhooks.
   */
  async listWebhooks(): Promise<
    Array<{ id: string; action: string; url: string }>
  > {
    return this.request<Array<{ id: string; action: string; url: string }>>(
      'GET',
      '/webhooks',
    );
  }

  /**
   * Delete a webhook.
   */
  async deleteWebhook(
    webhookId: string,
  ): Promise<AyrShareStatusResponse> {
    return this.request<AyrShareStatusResponse>('DELETE', '/webhooks', {
      id: webhookId,
    });
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  /**
   * Validate a post before publishing.
   */
  async validatePost(
    params: AyrShareValidatePostRequest,
  ): Promise<AyrShareValidationResult> {
    return this.request<AyrShareValidationResult>(
      'POST',
      '/validate/post',
      params,
    );
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  /**
   * Get post history.
   *
   * @param platform - Optional platform filter
   */
  async getHistory(
    platform?: AyrSharePlatform,
  ): Promise<AyrShareHistoryEntry[]> {
    const query = platform ? `?platform=${platform}` : '';
    return this.request<AyrShareHistoryEntry[]>('GET', `/history${query}`);
  }

  // ---------------------------------------------------------------------------
  // API key verification
  // ---------------------------------------------------------------------------

  /**
   * Verify that the configured API key is valid.
   * Makes a lightweight GET /profiles request and checks for auth errors.
   *
   * @returns true if the API key is valid, false otherwise
   */
  async verifyApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/profiles`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401 || response.status === 403) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        'API key verification failed with network error',
        error,
      );
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal HTTP request helper
  // ---------------------------------------------------------------------------

  /**
   * Make an authenticated HTTP request to the AyrShare API.
   *
   * @param method - HTTP method
   * @param path - API path (appended to base URL, e.g. "/post")
   * @param body - Request body (for POST/PUT/DELETE requests with body)
   * @returns Parsed JSON response
   * @throws Error on network failure
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, any>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    this.logger.debug(`AyrShare API: ${method} ${url}`);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      };

      // Multi-tenant: include Profile-Key if available
      if (this.profileKey) {
        headers['Profile-Key'] = this.profileKey;
      }

      const options: RequestInit = { method, headers };

      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        this.logger.warn(
          `AyrShare API error: ${response.status} ${response.statusText} — ${JSON.stringify(data)}`,
        );

        // Return a typed error response instead of throwing,
        // so the provider can handle it gracefully
        return {
          status: 'error',
          message:
            (data as any)?.message ||
            (data as any)?.error ||
            `HTTP ${response.status}: ${response.statusText}`,
          code: response.status,
        } as T;
      }

      return data as T;
    } catch (error: any) {
      this.logger.error(
        `AyrShare API network error: ${method} ${url}`,
        error?.message,
      );
      throw new Error(
        `AyrShare API request failed: ${error?.message || 'Unknown error'}`,
      );
    }
  }
}
