/**
 * AyrShareAnalyticsController
 *
 * REST endpoints for retrieving analytics from the AyrShare API.
 * Route prefix: /ayrshare/analytics
 *
 * Endpoints:
 *   GET /ayrshare/analytics/post/:profileId/:postId   — Post-level metrics
 *   GET /ayrshare/analytics/social/:profileId          — Account-level metrics
 *   GET /ayrshare/analytics/history/:profileId         — Post history from AyrShare
 */

import {
  Controller,
  Get,
  Logger,
  Param,
  Query,
} from '@nestjs/common';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { AyrShareAnalyticsService } from './ayrshare-analytics.service';
import { AyrSharePlatform } from '../client/ayrshare.types';

@Controller('ayrshare/analytics')
export class AyrShareAnalyticsController {
  private readonly logger = new Logger(AyrShareAnalyticsController.name);

  constructor(private readonly analyticsService: AyrShareAnalyticsService) {}

  /**
   * Get post-level analytics.
   */
  @Get('post/:profileId/:postId')
  async getPostAnalytics(
    @GetOrgFromRequest() org: Organization,
    @Param('profileId') profileId: string,
    @Param('postId') postId: string,
  ) {
    this.logger.log(
      `getPostAnalytics: org=${org.id} profile=${profileId} post=${postId}`,
    );
    return this.analyticsService.getPostAnalytics(profileId, postId, org.id);
  }

  /**
   * Get account-level social analytics.
   */
  @Get('social/:profileId')
  async getSocialAnalytics(
    @GetOrgFromRequest() org: Organization,
    @Param('profileId') profileId: string,
    @Query('platforms') platforms?: string,
  ) {
    this.logger.log(
      `getSocialAnalytics: org=${org.id} profile=${profileId}`,
    );

    const platformList = platforms
      ? (platforms.split(',') as AyrSharePlatform[])
      : undefined;

    return this.analyticsService.getSocialAnalytics(
      profileId,
      org.id,
      platformList,
    );
  }

  /**
   * Get post history from AyrShare.
   */
  @Get('history/:profileId')
  async getHistory(
    @GetOrgFromRequest() org: Organization,
    @Param('profileId') profileId: string,
    @Query('platform') platform?: AyrSharePlatform,
  ) {
    this.logger.log(
      `getHistory: org=${org.id} profile=${profileId}`,
    );
    return this.analyticsService.getHistory(profileId, org.id, platform);
  }
}
