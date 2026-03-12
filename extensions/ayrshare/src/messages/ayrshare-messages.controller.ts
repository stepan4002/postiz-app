/**
 * AyrShareMessagesController
 *
 * REST endpoints for DM management via AyrShare.
 * Route prefix: /ayrshare/messages
 *
 * Supported platforms: Facebook, Instagram, X/Twitter
 *
 * Endpoints:
 *   GET  /ayrshare/messages/:platform              — get conversations/messages
 *   GET  /ayrshare/messages/history                 — get local message history
 *   POST /ayrshare/messages/:platform               — send a DM
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
import { AyrShareMessagesService } from './ayrshare-messages.service';
import { AyrSharePlatform } from '../client/ayrshare.types';

@Controller('ayrshare/messages')
export class AyrShareMessagesController {
  private readonly logger = new Logger(AyrShareMessagesController.name);

  constructor(private readonly messagesService: AyrShareMessagesService) {}

  /**
   * Get local message history for the organization.
   * Must be declared before ':platform' to prevent "history" from being captured as platform.
   */
  @Get('history')
  async getHistory(
    @GetOrgFromRequest() org: Organization,
    @Query('platform') platform?: AyrSharePlatform,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`getHistory: org=${org.id} platform=${platform || 'all'}`);
    return this.messagesService.getOrganizationMessages(
      org.id,
      platform,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /**
   * Get conversations/messages from a platform via AyrShare API.
   */
  @Get(':platform')
  async getMessages(
    @GetOrgFromRequest() org: Organization,
    @Param('platform') platform: AyrSharePlatform,
    @Query('profileId') profileId: string,
    @Query('conversationId') conversationId?: string,
  ) {
    this.logger.log(
      `getMessages: org=${org.id} profile=${profileId} platform=${platform}`,
    );
    return this.messagesService.getMessages(
      profileId,
      platform,
      org.id,
      conversationId,
    );
  }

  /**
   * Send a DM.
   */
  @Post(':platform')
  async sendMessage(
    @GetOrgFromRequest() org: Organization,
    @Param('platform') platform: AyrSharePlatform,
    @Body()
    body: {
      profileId: string;
      recipientId: string;
      message: string;
      mediaUrls?: string[];
    },
  ) {
    this.logger.log(
      `sendMessage: org=${org.id} profile=${body.profileId} platform=${platform}`,
    );
    return this.messagesService.sendMessage(
      body.profileId,
      platform,
      body.recipientId,
      body.message,
      org.id,
      body.mediaUrls,
    );
  }
}
