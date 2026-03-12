/**
 * AyrShareAnalyticsService
 *
 * Business logic for retrieving analytics from the AyrShare API.
 * Provides proxy endpoints for post-level and account-level metrics.
 *
 * Analytics types:
 * - Post analytics: views, likes, shares, comments, impressions, reach
 * - Social analytics: followers, following, posts, engagement rate
 *
 * The AyrShareProvider also integrates with the existing Postiz analytics
 * pipeline (IntegrationService.checkAnalytics). This service provides
 * additional standalone endpoints for the frontend.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AyrShareConfigService } from '../config/ayrshare-config.service';
import { AyrShareProfileRepository } from '../profile/ayrshare-profile.repository';
import { AyrShareClient } from '../client/ayrshare.client';
import { AyrSharePlatform } from '../client/ayrshare.types';

@Injectable()
export class AyrShareAnalyticsService {
  private readonly logger = new Logger(AyrShareAnalyticsService.name);

  constructor(
    private readonly configService: AyrShareConfigService,
    private readonly profileRepository: AyrShareProfileRepository,
  ) {}

  /**
   * Get post-level analytics.
   *
   * @param profileId - AyrShare profile record ID
   * @param postId - AyrShare post ID
   * @param organizationId - Organization ID (for ownership validation)
   */
  async getPostAnalytics(
    profileId: string,
    postId: string,
    organizationId: string,
  ) {
    const client = await this.getClient(profileId, organizationId);

    this.logger.log(
      `getPostAnalytics: profile=${profileId} post=${postId}`,
    );

    return client.getPostAnalytics(postId);
  }

  /**
   * Get account-level social analytics.
   *
   * @param profileId - AyrShare profile record ID
   * @param organizationId - Organization ID (for ownership validation)
   * @param platforms - Optional platform filter
   */
  async getSocialAnalytics(
    profileId: string,
    organizationId: string,
    platforms?: AyrSharePlatform[],
  ) {
    const client = await this.getClient(profileId, organizationId);

    this.logger.log(
      `getSocialAnalytics: profile=${profileId} platforms=${platforms?.join(',') || 'all'}`,
    );

    return client.getSocialAnalytics(platforms);
  }

  /**
   * Get post history from AyrShare (all posts tracked by AyrShare).
   *
   * @param profileId - AyrShare profile record ID
   * @param organizationId - Organization ID
   * @param platform - Optional platform filter
   */
  async getHistory(
    profileId: string,
    organizationId: string,
    platform?: AyrSharePlatform,
  ) {
    const client = await this.getClient(profileId, organizationId);

    this.logger.log(
      `getHistory: profile=${profileId} platform=${platform || 'all'}`,
    );

    return client.getHistory(platform);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Build an authenticated AyrShareClient for a profile.
   */
  private async getClient(
    profileId: string,
    organizationId: string,
  ): Promise<AyrShareClient> {
    const profile = await this.profileRepository.findById(profileId);

    if (!profile || profile.organizationId !== organizationId) {
      throw new NotFoundException(`AyrShare profile '${profileId}' not found`);
    }

    const apiKey = await this.configService.getApiKey(organizationId);
    return new AyrShareClient(apiKey, profile.profileKey);
  }
}
