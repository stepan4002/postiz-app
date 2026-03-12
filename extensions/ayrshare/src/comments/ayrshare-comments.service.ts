/**
 * AyrShareCommentsService
 *
 * Business logic for reading and replying to comments via the AyrShare API.
 * Provides standalone comment management outside the Temporal posting pipeline.
 *
 * The AyrShareProvider.comment() method handles comments during the publishing
 * workflow. This service provides additional endpoints for:
 *   - Reading comments on any AyrShare post
 *   - Posting new top-level comments
 *   - Replying to specific comments
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AyrShareConfigService } from '../config/ayrshare-config.service';
import { AyrShareProfileRepository } from '../profile/ayrshare-profile.repository';
import { AyrShareClient } from '../client/ayrshare.client';
import { AyrSharePlatform } from '../client/ayrshare.types';

@Injectable()
export class AyrShareCommentsService {
  private readonly logger = new Logger(AyrShareCommentsService.name);

  constructor(
    private readonly configService: AyrShareConfigService,
    private readonly profileRepository: AyrShareProfileRepository,
  ) {}

  /**
   * Get comments on a post.
   *
   * @param profileId - AyrShare profile record ID
   * @param postId - AyrShare post ID
   * @param organizationId - Organization ID
   * @param platform - Optional platform filter
   */
  async getComments(
    profileId: string,
    postId: string,
    organizationId: string,
    platform?: AyrSharePlatform,
  ) {
    const client = await this.getClient(profileId, organizationId);

    this.logger.log(
      `getComments: profile=${profileId} post=${postId} platform=${platform || 'all'}`,
    );

    return client.getComments(postId, platform);
  }

  /**
   * Post a new top-level comment on a post.
   *
   * @param profileId - AyrShare profile record ID
   * @param postId - AyrShare post ID
   * @param comment - Comment text
   * @param organizationId - Organization ID
   * @param platforms - Optional platform filter
   */
  async postComment(
    profileId: string,
    postId: string,
    comment: string,
    organizationId: string,
    platforms?: AyrSharePlatform[],
  ) {
    const client = await this.getClient(profileId, organizationId);

    this.logger.log(
      `postComment: profile=${profileId} post=${postId}`,
    );

    return client.postComment(postId, { comment, platforms });
  }

  /**
   * Reply to a specific comment.
   *
   * @param profileId - AyrShare profile record ID
   * @param commentId - Platform-specific comment ID
   * @param reply - Reply text
   * @param platform - Platform of the comment
   * @param organizationId - Organization ID
   */
  async replyToComment(
    profileId: string,
    commentId: string,
    reply: string,
    platform: AyrSharePlatform,
    organizationId: string,
  ) {
    const client = await this.getClient(profileId, organizationId);

    this.logger.log(
      `replyToComment: profile=${profileId} comment=${commentId} platform=${platform}`,
    );

    return client.replyToComment(commentId, { reply, platform });
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
