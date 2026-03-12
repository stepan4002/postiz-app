/**
 * UploadPostProvider
 *
 * SocialProvider implementation for the Upload-Post.com publishing gateway.
 *
 * This provider plugs into the existing Postiz publishing pipeline:
 *   PostActivity.postSocial() → IntegrationManager.getSocialIntegration() → provider.post()
 *
 * Auth model:
 *   Unlike native OAuth providers, Upload-Post uses API-key authentication.
 *   The API key is stored in UploadPostConfig (per Organization), NOT in Integration.token.
 *   Integration.token is set to "managed" — the real key is fetched at publish time.
 *
 * Publishing flow:
 *   1. Resolve API key from UploadPostConfig by organizationId
 *   2. Resolve profile from UploadPostProfile by Integration.internalId (= profileUsername)
 *   3. Determine endpoint: text / photo / video based on media presence
 *   4. Call Upload-Post API via UploadPostClient
 *   5. Return PostResponse[] mapped from Upload-Post results
 *
 * Auth URL flow:
 *   Instead of redirecting to an OAuth provider, generateAuthUrl() returns a URL
 *   pointing to the Upload-Post admin page (/upload-post) where users create profiles.
 *   authenticate() receives the profile username as the "code" parameter.
 */

import { Logger } from '@nestjs/common';
import { Integration } from '@prisma/client';
import {
  SocialProvider,
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  GenerateAuthUrlResponse,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { UploadPostClient } from '@social/upload-post/client/upload-post.client';
import {
  UploadTextRequest,
  UploadPhotoRequest,
  UploadVideoRequest,
} from '@social/upload-post/client/upload-post.types';

const logger = new Logger('UploadPostProvider');

export class UploadPostProvider extends SocialAbstract implements SocialProvider {
  identifier = 'upload-post';
  name = 'Upload Post';
  isBetweenSteps = false;
  editor = 'normal' as const;
  scopes: string[] = [];

  // Upload-Post handles per-platform truncation internally
  maxLength = () => 10000;

  // ---------------------------------------------------------------------------
  // Auth methods (API-key based, not OAuth)
  // ---------------------------------------------------------------------------

  /**
   * Generate "auth" URL.
   *
   * Instead of redirecting to an OAuth provider, returns a URL to the
   * Upload-Post configuration page where users manage profiles.
   */
  async generateAuthUrl(): Promise<GenerateAuthUrlResponse> {
    return {
      url: `${process.env.FRONTEND_URL || ''}/upload-post`,
      codeVerifier: '',
      state: 'upload-post',
    };
  }

  /**
   * "Authenticate" an Upload-Post profile.
   *
   * The "code" parameter contains the profile username.
   * Returns profile details formatted as AuthTokenDetails.
   */
  async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh?: string;
  }): Promise<AuthTokenDetails> {
    return {
      id: params.code,              // Upload-Post profile username
      name: params.code,            // Display name
      accessToken: 'managed',       // Real key is in UploadPostConfig
      username: params.code,
      picture: '',
    };
  }

  /**
   * Refresh token — no-op for Upload-Post (API key doesn't expire).
   */
  async refreshToken(): Promise<AuthTokenDetails> {
    return {
      id: '',
      name: '',
      accessToken: 'managed',
      username: '',
    };
  }

  // ---------------------------------------------------------------------------
  // Publishing
  // ---------------------------------------------------------------------------

  /**
   * Publish a post through the Upload-Post API.
   *
   * Called by the Temporal publishing pipeline via:
   *   PostActivity.postSocial() → IntegrationManager.getSocialIntegration('upload-post') → this.post()
   *
   * @param id - Upload-Post profile username (from Integration.internalId)
   * @param accessToken - 'managed' (not used — real key fetched from UploadPostConfig)
   * @param postDetails - Array of post content + media
   * @param integration - Full Integration record (gives us organizationId)
   * @returns PostResponse[] — one per post detail
   */
  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration,
  ): Promise<PostResponse[]> {
    logger.log(
      `post: profile=${id} org=${integration.organizationId} postCount=${postDetails.length}`,
    );

    // 1. Fetch API key from UploadPostConfig
    //    We need to dynamically import PrismaService because the provider
    //    is instantiated as a singleton outside the DI container
    const apiKey = await this.resolveApiKey(integration.organizationId);

    // 2. Resolve profile platforms from UploadPostProfile
    const profileData = await this.resolveProfile(id);
    const platforms = profileData?.platforms || [];

    if (platforms.length === 0) {
      logger.warn(`post: no platforms configured for profile ${id}`);
      return postDetails.map((p) => ({
        id: p.id,
        postId: '',
        releaseURL: '',
        status: 'error: no platforms configured',
      }));
    }

    const client = new UploadPostClient(apiKey);
    const responses: PostResponse[] = [];

    for (const detail of postDetails) {
      try {
        const result = await this.publishSingle(client, id, platforms, detail, profileData);
        responses.push(result);
      } catch (err: any) {
        logger.error(`post: failed for detail ${detail.id}: ${err?.message}`);
        responses.push({
          id: detail.id,
          postId: '',
          releaseURL: '',
          status: `error: ${err?.message || 'Unknown error'}`,
        });
      }
    }

    return responses;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Publish a single PostDetails entry through Upload-Post.
   *
   * Determines the correct endpoint based on media type:
   *   - No media → uploadText()
   *   - Image media → uploadPhoto()
   *   - Video media → uploadVideo()
   */
  private async publishSingle(
    client: UploadPostClient,
    profileUsername: string,
    platforms: string[],
    detail: PostDetails,
    profileData: any,
  ): Promise<PostResponse> {
    const hasMedia = detail.media && detail.media.length > 0;
    const hasVideo = hasMedia && detail.media!.some((m) => m.type === 'video');
    const hasImage = hasMedia && detail.media!.some((m) => m.type === 'image');

    // Build platform-specific settings from profile config
    const platformSettings = profileData?.platformSettings || {};

    // Base request fields
    const baseRequest: UploadTextRequest = {
      profile: profileUsername,
      post_text: detail.message,
      platforms,
      // Pass through platform-specific settings if available
      ...(platformSettings.ig_post_type && { ig_post_type: platformSettings.ig_post_type }),
      ...(platformSettings.yt_title && { yt_title: platformSettings.yt_title }),
      ...(platformSettings.yt_privacy && { yt_privacy: platformSettings.yt_privacy }),
      ...(platformSettings.pin_board_id && { pin_board_id: platformSettings.pin_board_id }),
      ...(platformSettings.reddit_subreddit && { reddit_subreddit: platformSettings.reddit_subreddit }),
    };

    let response;

    if (hasVideo) {
      // Use first video
      const video = detail.media!.find((m) => m.type === 'video')!;
      const videoRequest: UploadVideoRequest = {
        ...baseRequest,
        video_url: video.path,
      };
      response = await client.uploadVideo(videoRequest);
    } else if (hasImage) {
      // Use first image
      const image = detail.media!.find((m) => m.type === 'image')!;
      const photoRequest: UploadPhotoRequest = {
        ...baseRequest,
        media_url: image.path,
      };
      response = await client.uploadPhoto(photoRequest);
    } else {
      // Text-only
      response = await client.uploadText(baseRequest);
    }

    // Map Upload-Post response to PostResponse
    if (response.success) {
      // Sync response with immediate results
      const firstResult = response.results?.[0];
      return {
        id: detail.id,
        postId: firstResult?.post_id || response.request_id || response.job_id || 'pending',
        releaseURL: firstResult?.post_url || '',
        status: response.request_id ? 'pending' : 'success',
      };
    }

    return {
      id: detail.id,
      postId: '',
      releaseURL: '',
      status: `error: ${response.error || 'Upload-Post API returned failure'}`,
    };
  }

  /**
   * Resolve the Upload-Post API key for an organization.
   *
   * Uses a dynamic Prisma query because the provider is instantiated
   * outside the NestJS DI container.
   */
  private async resolveApiKey(organizationId: string): Promise<string> {
    // Import PrismaClient dynamically to avoid circular dependency
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      const config = await prisma.uploadPostConfig.findUnique({
        where: { organizationId },
        select: { apiKey: true, enabled: true },
      });

      if (!config) {
        throw new Error('Upload-Post is not configured. Add your API key in Settings > Upload Post.');
      }

      if (!config.enabled) {
        throw new Error('Upload-Post integration is disabled.');
      }

      return config.apiKey;
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Resolve profile data (platforms, platformSettings) from UploadPostProfile.
   */
  private async resolveProfile(profileUsername: string): Promise<any> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      return prisma.uploadPostProfile.findUnique({
        where: { profileUsername },
        select: {
          platforms: true,
          platformSettings: true,
          languageCode: true,
          languageName: true,
        },
      });
    } finally {
      await prisma.$disconnect();
    }
  }
}
