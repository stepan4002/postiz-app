// ============================================================================
// FacebookAdapter — Meta Graph API v21.0
// Implements Facebook Page post creation:
//   - Text-only: POST /{page-id}/feed
//   - With image: POST /{page-id}/photos
//
// R10.2: Uniform PlatformAdapter interface
// R10.3: Idempotency check on platformPostId
// R10.5: Error classification (transient / permanent / rate_limit)
// NF4.3: All Facebook-specific logic lives here
// NF4.5: Pinned API version v21.0
// ============================================================================

import { BaseAdapter } from './base.adapter';
import { PublishParams, PublishResult } from '../types/publishing.types';

export class FacebookAdapter extends BaseAdapter {
  readonly platform = 'facebook';
  readonly apiVersion = 'v21.0';

  private readonly baseUrl = `https://graph.facebook.com/${this.apiVersion}`;

  async publish(params: PublishParams): Promise<PublishResult> {
    const { variant, accessToken, mediaUrl, platformAccountId } = params;

    const pageId = platformAccountId ?? variant.postId;
    const captionWithHashtags = this.buildCaption(variant.caption, variant.hashtags);

    try {
      if (mediaUrl) {
        return await this.publishPhotoPost(pageId, accessToken, captionWithHashtags, mediaUrl);
      } else {
        return await this.publishTextPost(pageId, accessToken, captionWithHashtags);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.buildPublishResult(
        false,
        undefined,
        undefined,
        message,
        true,
        'transient',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async publishTextPost(
    pageId: string,
    accessToken: string,
    message: string,
  ): Promise<PublishResult> {
    const url = `${this.baseUrl}/${pageId}/feed`;
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        access_token: accessToken,
      }),
    });

    return this.handleResponse(response, pageId);
  }

  private async publishPhotoPost(
    pageId: string,
    accessToken: string,
    message: string,
    photoUrl: string,
  ): Promise<PublishResult> {
    const url = `${this.baseUrl}/${pageId}/photos`;
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: photoUrl,
        message,
        access_token: accessToken,
      }),
    });

    return this.handleResponse(response, pageId);
  }

  private async handleResponse(response: Response, pageId: string): Promise<PublishResult> {
    const responseText = await response.text();

    if (!response.ok) {
      const { retryable, errorType } = this.classifyError(response.status, responseText);
      return this.buildPublishResult(
        false,
        undefined,
        undefined,
        `Facebook API error: ${responseText}`,
        retryable,
        errorType,
      );
    }

    const data = JSON.parse(responseText);
    // Facebook returns composite id like "page-123_post-456"
    const postId = (data.id as string) ?? '';

    // Build canonical URL — extract the post portion after the underscore
    const postPart = postId.includes('_') ? postId.split('_')[1] : postId;
    const platformUrl = `https://www.facebook.com/${pageId}/posts/${postPart}`;

    return this.buildPublishResult(true, postId, platformUrl);
  }

  private buildCaption(caption: string, hashtags: string[]): string {
    if (!hashtags || hashtags.length === 0) return caption;
    return `${caption}\n\n${hashtags.join(' ')}`;
  }
}
