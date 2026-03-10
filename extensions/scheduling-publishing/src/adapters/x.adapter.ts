// ============================================================================
// XAdapter — X (Twitter) API v2
// Implements tweet creation with OAuth 1.0a authentication:
//   - Text-only: POST /2/tweets
//   - With media: Upload via /1.1/media/upload.json, then POST tweet with media_ids
//
// OAuth 1.0a: consumer key/secret from env vars X_CLIENT_ID / X_CLIENT_SECRET.
// Access token stored as "token:secret" composite (Phase 2 decision).
//
// R10.2: Uniform PlatformAdapter interface
// R10.3: Idempotency check on platformPostId
// R10.5: Error classification (transient / permanent / rate_limit)
// NF4.3: All X-specific logic lives here
// NF4.5: Pinned API version 2
// ============================================================================

import * as crypto from 'crypto';
import { BaseAdapter } from './base.adapter';
import { PublishParams, PublishResult } from '../types/publishing.types';

const X_API_BASE = 'https://api.x.com/2';
const X_MEDIA_UPLOAD_URL = 'https://upload.x.com/1.1/media/upload.json';

export class XAdapter extends BaseAdapter {
  readonly platform = 'x';
  readonly apiVersion = '2';

  async publish(params: PublishParams): Promise<PublishResult> {
    const { variant, accessToken, mediaUrl, mediaBuffer } = params;

    const captionWithHashtags = this.buildCaption(variant.caption, variant.hashtags);

    try {
      let mediaIds: string[] | undefined;

      // If media is provided, upload it first
      if (mediaUrl || mediaBuffer) {
        const uploadResult = await this.uploadMedia(accessToken, mediaUrl, mediaBuffer);
        if (!uploadResult.success) {
          return uploadResult.publishResult!;
        }
        mediaIds = [uploadResult.mediaId!];
      }

      // Create tweet
      return await this.createTweet(accessToken, captionWithHashtags, mediaIds);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isTimeout = message.includes('abort') || message.includes('timeout');
      return this.buildPublishResult(
        false,
        undefined,
        undefined,
        message,
        true,
        isTimeout ? 'transient' : 'transient',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async uploadMedia(
    accessToken: string,
    mediaUrl?: string,
    mediaBuffer?: Buffer,
  ): Promise<{ success: boolean; mediaId?: string; publishResult?: PublishResult }> {
    // For URL-based media, we pass the URL as media_url parameter
    // For buffer-based, we use media_data (base64)
    const params: Record<string, string> = {};

    if (mediaBuffer) {
      params.media_data = mediaBuffer.toString('base64');
    } else if (mediaUrl) {
      // Pass URL directly — X API accepts media_url for remote images
      params.media_url = mediaUrl;
    }

    const formBody = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const authHeader = this.buildOAuth1Header(accessToken, 'POST', X_MEDIA_UPLOAD_URL, {});

    const response = await this.fetchWithTimeout(X_MEDIA_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody,
    });

    const responseText = await response.text();

    if (!response.ok) {
      const { retryable, errorType } = this.classifyError(response.status, responseText);
      return {
        success: false,
        publishResult: this.buildPublishResult(
          false,
          undefined,
          undefined,
          `X media upload failed: ${responseText}`,
          retryable,
          errorType,
        ),
      };
    }

    const data = JSON.parse(responseText);
    return { success: true, mediaId: data.media_id_string as string };
  }

  private async createTweet(
    accessToken: string,
    text: string,
    mediaIds?: string[],
  ): Promise<PublishResult> {
    const url = `${X_API_BASE}/tweets`;
    const body: Record<string, unknown> = { text };

    if (mediaIds && mediaIds.length > 0) {
      body.media = { media_ids: mediaIds };
    }

    const authHeader = this.buildOAuth1Header(accessToken, 'POST', url, {});

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      const { retryable, errorType } = this.classifyError(response.status, responseText);
      return this.buildPublishResult(
        false,
        undefined,
        undefined,
        `X API error: ${responseText}`,
        retryable,
        errorType,
      );
    }

    const data = JSON.parse(responseText);
    const tweetId = data.data?.id as string;

    // Platform URL needs the username, but we don't have it from the token alone.
    // Use a generic URL pattern with tweet ID — caller can resolve later.
    const platformUrl = `https://x.com/i/web/status/${tweetId}`;

    return this.buildPublishResult(true, tweetId, platformUrl);
  }

  /**
   * Generate an OAuth 1.0a Authorization header.
   *
   * The accessToken parameter is stored as "token:secret" composite string
   * per Phase 2 decision. Consumer credentials come from environment variables.
   *
   * @param accessToken Composite "oauth_token:oauth_token_secret" string
   * @param method HTTP method (e.g., 'POST')
   * @param url Full request URL (without query string)
   * @param additionalParams OAuth-relevant query/body params to include in signature
   */
  private buildOAuth1Header(
    accessToken: string,
    method: string,
    url: string,
    additionalParams: Record<string, string>,
  ): string {
    const consumerKey = process.env.X_CLIENT_ID ?? '';
    const consumerSecret = process.env.X_CLIENT_SECRET ?? '';

    // Split composite token "token:secret"
    const colonIndex = accessToken.indexOf(':');
    const oauthToken = colonIndex > -1 ? accessToken.substring(0, colonIndex) : accessToken;
    const tokenSecret = colonIndex > -1 ? accessToken.substring(colonIndex + 1) : '';

    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: oauthToken,
      oauth_version: '1.0',
    };

    // Merge all params for signature base string
    const allParams: Record<string, string> = { ...additionalParams, ...oauthParams };

    // Build signature base string
    const paramString = Object.keys(allParams)
      .sort()
      .map((k) => `${this.percentEncode(k)}=${this.percentEncode(allParams[k])}`)
      .join('&');

    const signatureBase = [
      method.toUpperCase(),
      this.percentEncode(url),
      this.percentEncode(paramString),
    ].join('&');

    // Build signing key
    const signingKey = `${this.percentEncode(consumerSecret)}&${this.percentEncode(tokenSecret)}`;

    // Calculate HMAC-SHA1 signature
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(signatureBase)
      .digest('base64');

    oauthParams['oauth_signature'] = signature;

    // Build Authorization header
    const headerParts = Object.keys(oauthParams)
      .sort()
      .map((k) => `${this.percentEncode(k)}="${this.percentEncode(oauthParams[k])}"`)
      .join(', ');

    return `OAuth ${headerParts}`;
  }

  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/!/g, '%21')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\*/g, '%2A');
  }

  private buildCaption(caption: string, hashtags: string[]): string {
    if (!hashtags || hashtags.length === 0) return caption;
    return `${caption} ${hashtags.join(' ')}`;
  }
}
