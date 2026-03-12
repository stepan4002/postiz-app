/**
 * AyrShareMessagesService
 *
 * Business logic for DM sending/receiving via the AyrShare API.
 * Supports Facebook, Instagram, and X/Twitter DMs.
 *
 * Responsibilities:
 * - Send DMs via AyrShare API
 * - Get message conversations from AyrShare API
 * - Store inbound/outbound messages in local DB for history
 * - Handle incoming DM webhooks
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AyrShareConfigService } from '../config/ayrshare-config.service';
import { AyrShareProfileRepository } from '../profile/ayrshare-profile.repository';
import { AyrShareMessagesRepository } from './ayrshare-messages.repository';
import { AyrShareClient } from '../client/ayrshare.client';
import { AyrSharePlatform } from '../client/ayrshare.types';

@Injectable()
export class AyrShareMessagesService {
  private readonly logger = new Logger(AyrShareMessagesService.name);

  constructor(
    private readonly configService: AyrShareConfigService,
    private readonly profileRepository: AyrShareProfileRepository,
    private readonly messagesRepository: AyrShareMessagesRepository,
  ) {}

  /**
   * Get conversations/messages from a platform.
   *
   * @param profileId - AyrShare profile record ID
   * @param platform - Platform (facebook, instagram, twitter)
   * @param organizationId - Organization ID
   * @param conversationId - Optional specific conversation
   */
  async getMessages(
    profileId: string,
    platform: AyrSharePlatform,
    organizationId: string,
    conversationId?: string,
  ) {
    const client = await this.getClient(profileId, organizationId);

    this.logger.log(
      `getMessages: profile=${profileId} platform=${platform}`,
    );

    return client.getMessages(platform, conversationId);
  }

  /**
   * Send a DM.
   *
   * @param profileId - AyrShare profile record ID
   * @param platform - Platform (facebook, instagram, twitter)
   * @param recipientId - Platform-specific recipient ID
   * @param message - Message text
   * @param organizationId - Organization ID
   * @param mediaUrls - Optional media attachments
   */
  async sendMessage(
    profileId: string,
    platform: AyrSharePlatform,
    recipientId: string,
    message: string,
    organizationId: string,
    mediaUrls?: string[],
  ) {
    const profile = await this.profileRepository.findById(profileId);

    if (!profile || profile.organizationId !== organizationId) {
      throw new NotFoundException(`AyrShare profile '${profileId}' not found`);
    }

    const apiKey = await this.configService.getApiKey(organizationId);
    const client = new AyrShareClient(apiKey, profile.profileKey);

    this.logger.log(
      `sendMessage: profile=${profileId} platform=${platform} recipient=${recipientId}`,
    );

    const result = await client.sendMessage(platform, {
      message,
      recipientId,
      mediaUrls,
    });

    // Store outbound message in local DB
    await this.messagesRepository.create({
      profileId,
      organizationId,
      platform,
      direction: 'outbound',
      externalId: result.messageId,
      recipientId,
      content: message,
      mediaUrls,
      status: (result as any).status === 'error' ? 'failed' : 'delivered',
    });

    return result;
  }

  /**
   * Get local message history for a profile.
   */
  async getLocalMessages(
    profileId: string,
    organizationId: string,
    platform?: AyrSharePlatform,
    limit = 50,
  ) {
    // Verify access
    const profile = await this.profileRepository.findById(profileId);
    if (!profile || profile.organizationId !== organizationId) {
      throw new NotFoundException(`AyrShare profile '${profileId}' not found`);
    }

    return this.messagesRepository.findByProfile(profileId, platform, limit);
  }

  /**
   * Get all messages for an organization (across all profiles).
   */
  async getOrganizationMessages(
    organizationId: string,
    platform?: AyrSharePlatform,
    limit = 50,
  ) {
    return this.messagesRepository.findByOrganization(
      organizationId,
      platform,
      limit,
    );
  }

  /**
   * Handle incoming DM webhook.
   * Called by the webhook controller when AyrShare sends a message event.
   */
  async handleIncomingMessage(
    profileKey: string,
    platform: AyrSharePlatform,
    messageId: string,
    fromId: string,
    fromName: string,
    text: string,
    mediaUrls?: string[],
  ): Promise<void> {
    const profile =
      await this.profileRepository.findByProfileKey(profileKey);

    if (!profile) {
      this.logger.warn(
        `handleIncomingMessage: profile not found for key ${profileKey}`,
      );
      return;
    }

    // Check for duplicate
    const existing =
      await this.messagesRepository.findByExternalId(messageId);
    if (existing) {
      this.logger.debug(
        `handleIncomingMessage: duplicate message ${messageId}, skipping`,
      );
      return;
    }

    this.logger.log(
      `handleIncomingMessage: profile=${profile.id} platform=${platform} from=${fromName}`,
    );

    await this.messagesRepository.create({
      profileId: profile.id,
      organizationId: profile.organizationId,
      platform,
      direction: 'inbound',
      externalId: messageId,
      senderId: fromId,
      senderName: fromName,
      content: text,
      mediaUrls,
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

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
