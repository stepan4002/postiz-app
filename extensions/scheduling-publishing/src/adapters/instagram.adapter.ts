// ============================================================================
// InstagramAdapter — Meta Business API (Graph API v21.0)
// Implements 2-step container publish pattern:
//   1. Create media container
//   2. Poll until FINISHED status
//   3. Publish container
//
// R10.2: Uniform PlatformAdapter interface
// R10.3: Idempotency check on platformPostId
// R10.5: Error classification (transient / permanent / rate_limit)
// NF4.3: All Instagram-specific logic lives here
// NF4.5: Pinned API version v21.0
// ============================================================================

import { BaseAdapter } from './base.adapter';
import { PublishParams, PublishResult } from '../types/publishing.types';

const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_ATTEMPTS = 15; // 30 seconds total

export class InstagramAdapter extends BaseAdapter {
  readonly platform = 'instagram';
  readonly apiVersion = 'v21.0';

  private readonly baseUrl = `https://graph.facebook.com/${this.apiVersion}`;

  async publish(params: PublishParams): Promise<PublishResult> {
    const { variant, accessToken, mediaBuffer, mediaUrl, platformAccountId } = params;

    // Instagram requires media — text-only is not supported
    if (!mediaBuffer && !mediaUrl) {
      return this.buildPublishResult(
        false,
        undefined,
        undefined,
        'Instagram requires media (image or video). Text-only posts are not supported.',
        false,
        'permanent',
      );
    }

    const igUserId = platformAccountId ?? variant.postId;
    const captionWithHashtags = this.buildCaption(variant.caption, variant.hashtags);

    try {
      // Step 1: Create media container
      const containerResult = await this.createMediaContainer(
        igUserId,
        accessToken,
        captionWithHashtags,
        mediaUrl,
      );

      if (!containerResult.success || !containerResult.containerId) {
        return containerResult.publishResult!;
      }

      const containerId = containerResult.containerId;

      // Step 2: Poll until container status is FINISHED
      const pollResult = await this.pollContainerStatus(containerId, accessToken);
      if (!pollResult.ready) {
        return this.buildPublishResult(
          false,
          undefined,
          undefined,
          pollResult.error ?? 'Media container did not become ready in time',
          true,
          'transient',
        );
      }

      // Step 3: Publish the container
      return await this.publishContainer(igUserId, containerId, accessToken);
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

  private async createMediaContainer(
    igUserId: string,
    accessToken: string,
    caption: string,
    mediaUrl?: string,
  ): Promise<{ success: boolean; containerId?: string; publishResult?: PublishResult }> {
    const body: Record<string, string> = {
      caption,
      access_token: accessToken,
    };

    if (mediaUrl) {
      body.image_url = mediaUrl;
    }

    const url = `${this.baseUrl}/${igUserId}/media`;
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
          `Failed to create media container: ${responseText}`,
          retryable,
          errorType,
        ),
      };
    }

    const data = JSON.parse(responseText);
    return { success: true, containerId: data.id };
  }

  private async pollContainerStatus(
    containerId: string,
    accessToken: string,
  ): Promise<{ ready: boolean; error?: string }> {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      const url = `${this.baseUrl}/${containerId}?fields=status_code&access_token=${accessToken}`;
      const response = await this.fetchWithTimeout(url);

      if (response.ok) {
        const data = await response.json();
        if (data.status_code === 'FINISHED') {
          return { ready: true };
        }
        if (data.status_code === 'ERROR') {
          return { ready: false, error: 'Media container processing failed' };
        }
      }

      // Wait before next poll (skip on last attempt)
      if (attempt < POLL_MAX_ATTEMPTS - 1) {
        await this.sleep(POLL_INTERVAL_MS);
      }
    }

    return { ready: false, error: 'Media container polling timed out' };
  }

  private async publishContainer(
    igUserId: string,
    containerId: string,
    accessToken: string,
  ): Promise<PublishResult> {
    const url = `${this.baseUrl}/${igUserId}/media_publish`;
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      const { retryable, errorType } = this.classifyError(response.status, responseText);
      return this.buildPublishResult(
        false,
        undefined,
        undefined,
        `Failed to publish container: ${responseText}`,
        retryable,
        errorType,
      );
    }

    const data = JSON.parse(responseText);
    const postId = data.id as string;

    return this.buildPublishResult(
      true,
      postId,
      `https://www.instagram.com/p/${postId}/`,
    );
  }

  private buildCaption(caption: string, hashtags: string[]): string {
    if (!hashtags || hashtags.length === 0) return caption;
    return `${caption}\n\n${hashtags.join(' ')}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
