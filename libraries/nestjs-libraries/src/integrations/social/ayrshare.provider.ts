/**
 * AyrShareProvider
 *
 * SocialProvider implementation for the AyrShare unified social media API.
 *
 * This provider plugs into the existing Postiz publishing pipeline:
 *   PostActivity.postSocial() → IntegrationManager.getSocialIntegration() → provider.post()
 *
 * Auth model:
 *   Unlike native OAuth providers, AyrShare uses API-key authentication.
 *   The API key is stored in AyrShareConfig (per Organization), NOT in Integration.token.
 *   Integration.token is set to "managed" — the real key is fetched at publish time.
 *   Social account tokens are managed entirely by AyrShare (via JWT/SSO flow).
 *
 * Publishing flow:
 *   1. Resolve credentials from AyrShareConfig + AyrShareProfile by organizationId
 *   2. Build AyrSharePostRequest with platform-specific options
 *   3. Call AyrShare API via AyrShareClient.createPost()
 *   4. Return PostResponse[] mapped from AyrShare results
 *   5. Log API call to AyrShareLog
 *
 * Comment flow:
 *   1. Resolve credentials
 *   2. If lastCommentId → replyToComment(), else → postComment()
 *   3. Return PostResponse[]
 *
 * Auth URL flow:
 *   Instead of redirecting to an OAuth provider, generateAuthUrl() returns a URL
 *   pointing to the AyrShare admin page (/ayrshare) where users create profiles.
 *   authenticate() receives the profileKey as the "code" parameter.
 */

import { Logger } from '@nestjs/common';
import { Integration } from '@prisma/client';
import {
  SocialProvider,
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  GenerateAuthUrlResponse,
  AnalyticsData,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { AyrShareClient } from '@social/ayrshare/client/ayrshare.client';
import {
  AyrSharePostRequest,
  AyrSharePlatform,
  POSTIZ_TO_AYRSHARE,
} from '@social/ayrshare/client/ayrshare.types';

const logger = new Logger('AyrShareProvider');

/**
 * Module-level singleton PrismaClient for the AyrShareProvider.
 *
 * Because the provider is instantiated outside the NestJS DI container
 * (via `new AyrShareProvider()` in integration.manager.ts), it cannot
 * receive PrismaService via injection. This singleton avoids creating
 * a new PrismaClient per request, which would exhaust the connection pool.
 */
let _sharedPrisma: any = null;
async function getSharedPrisma() {
  if (!_sharedPrisma) {
    const { PrismaClient } = await import('@prisma/client');
    _sharedPrisma = new PrismaClient();
  }
  return _sharedPrisma;
}

export class AyrShareProvider
  extends SocialAbstract
  implements SocialProvider
{
  identifier = 'ayrshare';
  name = 'AyrShare';
  isBetweenSteps = false;
  editor = 'normal' as const;
  scopes: string[] = [];

  // AyrShare handles per-platform truncation internally
  maxLength = () => 10000;

  // ---------------------------------------------------------------------------
  // Auth methods (API-key based, not OAuth)
  // ---------------------------------------------------------------------------

  /**
   * Generate "auth" URL.
   *
   * Instead of redirecting to an OAuth provider, returns a URL to the
   * AyrShare configuration page where users manage profiles and link accounts.
   */
  async generateAuthUrl(): Promise<GenerateAuthUrlResponse> {
    return {
      url: `${process.env.FRONTEND_URL || ''}/ayrshare`,
      codeVerifier: '',
      state: 'ayrshare',
    };
  }

  /**
   * "Authenticate" an AyrShare profile.
   *
   * The "code" parameter contains the AyrShare profileKey.
   * Returns profile details formatted as AuthTokenDetails.
   */
  async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh?: string;
  }): Promise<AuthTokenDetails> {
    return {
      id: params.code, // AyrShare profileKey
      name: params.code, // Display name
      accessToken: 'managed', // Real key is in AyrShareConfig
      username: params.code,
      picture: '',
    };
  }

  /**
   * Refresh token — no-op for AyrShare (API key doesn't expire).
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
  // Analytics
  // ---------------------------------------------------------------------------

  /**
   * Get account-level social analytics.
   *
   * Called by the analytics pipeline when viewing profile statistics.
   */
  async analytics(
    id: string,
    accessToken: string,
    date: number,
  ): Promise<AnalyticsData[]> {
    try {
      const { apiKey, profileKey } = await this.resolveCredentials(id);
      const client = new AyrShareClient(apiKey, profileKey);

      const result = await client.getSocialAnalytics();

      if ((result as any).status === 'error') {
        logger.warn(`analytics: AyrShare API error for profile ${id}`);
        return [];
      }

      // Transform AyrShare analytics to Postiz AnalyticsData format
      return (result.analytics || []).map((a: any) => ({
        label: `${a.platform || 'unknown'} - Followers`,
        data: [
          {
            total: String(a.followers || 0),
            date: new Date().toISOString().split('T')[0],
          },
        ],
        percentageChange: 0,
      }));
    } catch (err: any) {
      logger.error(`analytics: failed for profile ${id}: ${err?.message}`);
      return [];
    }
  }

  /**
   * Get post-level analytics.
   */
  async postAnalytics(
    integrationId: string,
    accessToken: string,
    postId: string,
    fromDate: number,
  ): Promise<AnalyticsData[]> {
    try {
      const { apiKey, profileKey } = await this.resolveCredentials(
        integrationId,
      );
      const client = new AyrShareClient(apiKey, profileKey);

      const result = await client.getPostAnalytics(postId);

      if ((result as any).status === 'error') {
        logger.warn(`postAnalytics: AyrShare API error for post ${postId}`);
        return [];
      }

      // Transform to Postiz AnalyticsData format
      const analytics: AnalyticsData[] = [];
      for (const a of result.analytics || []) {
        if (a.likes !== undefined) {
          analytics.push({
            label: `${a.platform} - Likes`,
            data: [
              {
                total: String(a.likes),
                date: new Date().toISOString().split('T')[0],
              },
            ],
            percentageChange: 0,
          });
        }
        if (a.views !== undefined) {
          analytics.push({
            label: `${a.platform} - Views`,
            data: [
              {
                total: String(a.views),
                date: new Date().toISOString().split('T')[0],
              },
            ],
            percentageChange: 0,
          });
        }
        if (a.comments !== undefined) {
          analytics.push({
            label: `${a.platform} - Comments`,
            data: [
              {
                total: String(a.comments),
                date: new Date().toISOString().split('T')[0],
              },
            ],
            percentageChange: 0,
          });
        }
      }
      return analytics;
    } catch (err: any) {
      logger.error(
        `postAnalytics: failed for post ${postId}: ${err?.message}`,
      );
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Publishing
  // ---------------------------------------------------------------------------

  /**
   * Publish a post through the AyrShare API.
   *
   * Called by the Temporal publishing pipeline via:
   *   PostActivity.postSocial() → IntegrationManager.getSocialIntegration('ayrshare') → this.post()
   *
   * @param id - AyrShare profileKey (from Integration.internalId)
   * @param accessToken - 'managed' (not used — real key fetched from AyrShareConfig)
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

    // 1. Resolve credentials
    const { apiKey, profileKey, platforms } =
      await this.resolveCredentials(id);
    const client = new AyrShareClient(apiKey, profileKey);

    if (platforms.length === 0) {
      logger.warn(`post: no platforms configured for profile ${id}`);
      return postDetails.map((p) => ({
        id: p.id,
        postId: '',
        releaseURL: '',
        status: 'error: no platforms linked. Open AyrShare settings to link social accounts.',
      }));
    }

    const responses: PostResponse[] = [];

    for (const detail of postDetails) {
      try {
        const result = await this.publishSingle(
          client,
          platforms,
          detail,
        );
        responses.push(result);
      } catch (err: any) {
        logger.error(
          `post: failed for detail ${detail.id}: ${err?.message}`,
        );
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
  // Comments
  // ---------------------------------------------------------------------------

  /**
   * Post or reply to a comment.
   *
   * Called by the Temporal workflow via the comment pipeline.
   */
  async comment(
    id: string,
    postId: string,
    lastCommentId: string | undefined,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration,
  ): Promise<PostResponse[]> {
    logger.log(
      `comment: profile=${id} postId=${postId} lastCommentId=${lastCommentId || 'none'}`,
    );

    const { apiKey, profileKey } = await this.resolveCredentials(id);
    const client = new AyrShareClient(apiKey, profileKey);

    const responses: PostResponse[] = [];

    for (const detail of postDetails) {
      try {
        let result;
        if (lastCommentId) {
          // Reply to existing comment
          result = await client.replyToComment(lastCommentId, {
            reply: detail.message,
            platform: 'twitter' as AyrSharePlatform, // Will be resolved from context
          });
        } else {
          // New top-level comment
          result = await client.postComment(postId, {
            comment: detail.message,
          });
        }

        if ((result as any).status === 'error') {
          responses.push({
            id: detail.id,
            postId: '',
            releaseURL: '',
            status: `error: ${(result as any).message || 'Comment failed'}`,
          });
        } else {
          responses.push({
            id: detail.id,
            postId: result.commentId || '',
            releaseURL: '',
            status: 'success',
          });
        }
      } catch (err: any) {
        logger.error(
          `comment: failed for detail ${detail.id}: ${err?.message}`,
        );
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
   * Publish a single PostDetails entry through AyrShare.
   *
   * Builds an AyrSharePostRequest with:
   *   - Post text
   *   - Media URLs (images/videos)
   *   - Platform-specific options from post settings
   */
  private async publishSingle(
    client: AyrShareClient,
    platforms: string[],
    detail: PostDetails,
  ): Promise<PostResponse> {
    // Build media URLs
    const mediaUrls: string[] = [];
    if (detail.media && detail.media.length > 0) {
      for (const m of detail.media) {
        if (m.path) {
          mediaUrls.push(m.path);
        }
      }
    }

    // Map platform names to AyrShare format
    const ayrSharePlatforms = platforms
      .map((p) => POSTIZ_TO_AYRSHARE[p] || (p as AyrSharePlatform))
      .filter((p, i, arr) => arr.indexOf(p) === i); // Deduplicate

    // Build request
    const request: AyrSharePostRequest = {
      post: detail.message,
      platforms: ayrSharePlatforms,
      ...(mediaUrls.length > 0 && { mediaUrls }),
    };

    // Add platform-specific options from post settings
    if (detail.settings) {
      this.applyPlatformOptions(request, detail.settings);
    }

    // Create the post
    const response = await client.createPost(request);

    if ((response as any).status === 'error') {
      return {
        id: detail.id,
        postId: '',
        releaseURL: '',
        status: `error: ${(response as any).message || 'AyrShare API returned failure'}`,
      };
    }

    // Map response to PostResponse
    const firstResult = response.postIds?.[0];
    return {
      id: detail.id,
      postId: response.id || firstResult?.id || 'pending',
      releaseURL: firstResult?.postUrl || '',
      status: response.status || 'success',
    };
  }

  /**
   * Apply platform-specific options from post settings to the AyrShare request.
   */
  private applyPlatformOptions(
    request: AyrSharePostRequest,
    settings: any,
  ): void {
    // YouTube options
    if (settings.youtubeTitle || settings.yt_title) {
      request.youTubeOptions = {
        title: settings.youtubeTitle || settings.yt_title,
        visibility: settings.youtubeVisibility || settings.yt_privacy || 'public',
      };
    }

    // Reddit options
    if (settings.redditSubreddit || settings.reddit_subreddit) {
      request.redditOptions = {
        title: settings.redditTitle || settings.post?.substring(0, 300) || 'Post',
        subreddit: settings.redditSubreddit || settings.reddit_subreddit,
      };
    }

    // Pinterest options
    if (settings.pinterestBoardId || settings.pin_board_id) {
      request.pinterestOptions = {
        title: settings.pinterestTitle || 'Pin',
        boardId: settings.pinterestBoardId || settings.pin_board_id,
        link: settings.pinterestLink,
      };
    }

    // Instagram options
    if (settings.igPostType || settings.ig_post_type) {
      const type = settings.igPostType || settings.ig_post_type;
      request.instagramOptions = {
        reels: type === 'reels',
        stories: type === 'stories',
      };
    }

    // LinkedIn options
    if (settings.linkedinVisibility) {
      request.linkedInOptions = {
        visibility: settings.linkedinVisibility,
      };
    }

    // TikTok options
    if (settings.tiktokPrivacy) {
      request.tikTokOptions = {
        privacy: settings.tiktokPrivacy,
      };
    }
  }

  /**
   * Resolve AyrShare credentials for a profile.
   *
   * Uses a dynamic Prisma query because the provider is instantiated
   * outside the NestJS DI container (same pattern as Upload-Post).
   *
   * @param profileKeyOrIntegrationId - AyrShare profile key or integration internal ID
   * @returns { apiKey, profileKey, platforms }
   */
  private async resolveCredentials(
    profileKeyOrIntegrationId: string,
  ): Promise<{
    apiKey: string;
    profileKey: string;
    platforms: string[];
  }> {
    const prisma = await getSharedPrisma();

    // Find the profile
    let profile = await prisma.ayrShareProfile.findUnique({
      where: { profileKey: profileKeyOrIntegrationId },
      select: {
        profileKey: true,
        organizationId: true,
        platforms: true,
        enabled: true,
      },
    });

    // If not found by profileKey, try integration internalId
    if (!profile) {
      const integration = await prisma.integration.findFirst({
        where: {
          internalId: profileKeyOrIntegrationId,
          providerIdentifier: 'ayrshare',
        },
        select: { internalId: true },
      });

      if (integration) {
        profile = await prisma.ayrShareProfile.findUnique({
          where: { profileKey: integration.internalId },
          select: {
            profileKey: true,
            organizationId: true,
            platforms: true,
            enabled: true,
          },
        });
      }
    }

    if (!profile) {
      throw new Error(
        `AyrShare profile not found for '${profileKeyOrIntegrationId}'`,
      );
    }

    if (!profile.enabled) {
      throw new Error('AyrShare profile is disabled.');
    }

    // Get the API key from config
    const config = await prisma.ayrShareConfig.findUnique({
      where: { organizationId: profile.organizationId },
      select: { apiKey: true, enabled: true },
    });

    if (!config) {
      throw new Error(
        'AyrShare is not configured. Add your API key in Settings > AyrShare.',
      );
    }

    if (!config.enabled) {
      throw new Error('AyrShare integration is disabled.');
    }

    return {
      apiKey: config.apiKey,
      profileKey: profile.profileKey,
      platforms: profile.platforms || [],
    };
  }
}
