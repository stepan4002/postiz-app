/**
 * AyrShareCommentsController
 *
 * REST endpoints for reading and replying to comments via AyrShare.
 * Route prefix: /ayrshare/comments
 *
 * Endpoints:
 *   GET  /ayrshare/comments/:profileId/:postId           — get comments on a post
 *   POST /ayrshare/comments/:profileId/:postId           — post a new comment
 *   POST /ayrshare/comments/:profileId/:commentId/reply  — reply to a comment
 */

import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { AyrShareCommentsService } from './ayrshare-comments.service';
import { AyrSharePlatform } from '../client/ayrshare.types';

@Controller('ayrshare/comments')
export class AyrShareCommentsController {
  private readonly logger = new Logger(AyrShareCommentsController.name);

  constructor(private readonly commentsService: AyrShareCommentsService) {}

  /**
   * Get comments on a post.
   */
  @Get(':profileId/:postId')
  async getComments(
    @GetOrgFromRequest() org: Organization,
    @Param('profileId') profileId: string,
    @Param('postId') postId: string,
    @Query('platform') platform?: AyrSharePlatform,
  ) {
    this.logger.log(
      `getComments: org=${org.id} profile=${profileId} post=${postId}`,
    );
    return this.commentsService.getComments(
      profileId,
      postId,
      org.id,
      platform,
    );
  }

  /**
   * Post a new top-level comment.
   */
  @Post(':profileId/:postId')
  async postComment(
    @GetOrgFromRequest() org: Organization,
    @Param('profileId') profileId: string,
    @Param('postId') postId: string,
    @Body() body: { comment: string; platforms?: AyrSharePlatform[] },
  ) {
    this.logger.log(
      `postComment: org=${org.id} profile=${profileId} post=${postId}`,
    );
    return this.commentsService.postComment(
      profileId,
      postId,
      body.comment,
      org.id,
      body.platforms,
    );
  }

  /**
   * Reply to a specific comment.
   */
  @Post(':profileId/:commentId/reply')
  async replyToComment(
    @GetOrgFromRequest() org: Organization,
    @Param('profileId') profileId: string,
    @Param('commentId') commentId: string,
    @Body() body: { reply: string; platform: AyrSharePlatform },
  ) {
    this.logger.log(
      `replyToComment: org=${org.id} profile=${profileId} comment=${commentId}`,
    );
    return this.commentsService.replyToComment(
      profileId,
      commentId,
      body.reply,
      body.platform,
      org.id,
    );
  }
}
