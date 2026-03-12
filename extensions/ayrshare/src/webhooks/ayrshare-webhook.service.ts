/**
 * AyrShareWebhookService
 *
 * Business logic for webhook registration and incoming webhook processing.
 *
 * Responsibilities:
 * - Register webhooks with AyrShare API when profiles are created
 * - Process incoming webhook payloads (post status, social link/unlink, DMs)
 * - Validate webhook signatures (HMAC-SHA256)
 * - Route webhook events to the appropriate handler services
 *
 * Webhook types:
 * - "scheduled" — Post published/failed status updates
 * - "social"    — Social account linked/unlinked events
 * - "messages"  — Incoming DMs (Facebook, Instagram, X/Twitter)
 */

import { Injectable, Logger } from '@nestjs/common';
import { AyrShareWebhookRepository } from './ayrshare-webhook.repository';
import { AyrShareConfigService } from '../config/ayrshare-config.service';
import { AyrShareProfileRepository } from '../profile/ayrshare-profile.repository';
import { AyrShareProfileService } from '../profile/ayrshare-profile.service';
import { AyrShareMessagesService } from '../messages/ayrshare-messages.service';
import { AyrShareLogRepository } from '../log/ayrshare-log.repository';
import { AyrShareClient } from '../client/ayrshare.client';
import {
  AyrShareWebhookType,
  AyrSharePostWebhookPayload,
  AyrShareSocialWebhookPayload,
  AyrShareMessageWebhookPayload,
} from '../client/ayrshare.types';
import * as crypto from 'crypto';

@Injectable()
export class AyrShareWebhookService {
  private readonly logger = new Logger(AyrShareWebhookService.name);

  constructor(
    private readonly webhookRepository: AyrShareWebhookRepository,
    private readonly configService: AyrShareConfigService,
    private readonly profileRepository: AyrShareProfileRepository,
    private readonly profileService: AyrShareProfileService,
    private readonly messagesService: AyrShareMessagesService,
    private readonly logRepository: AyrShareLogRepository,
  ) {}

  // ---------------------------------------------------------------------------
  // Webhook registration
  // ---------------------------------------------------------------------------

  /**
   * Register all 3 webhook types for a profile.
   * Called automatically when an AyrShare profile is created.
   *
   * @param profileId - Local profile record ID
   * @param organizationId - Organization ID (for API key lookup)
   */
  async registerWebhooksForProfile(
    profileId: string,
    organizationId: string,
  ): Promise<void> {
    const profile = await this.profileRepository.findById(profileId);
    if (!profile) {
      this.logger.warn(
        `registerWebhooksForProfile: profile ${profileId} not found`,
      );
      return;
    }

    const apiKey = await this.configService.getApiKey(organizationId);
    const client = new AyrShareClient(apiKey, profile.profileKey);

    const baseUrl =
      process.env.AYRSHARE_WEBHOOK_BASE_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://localhost:3000';

    const webhookTypes: AyrShareWebhookType[] = [
      'scheduled',
      'social',
      'messages',
    ];

    for (const type of webhookTypes) {
      try {
        // Check if already registered
        const existing = await this.webhookRepository.findByProfileAndType(
          profileId,
          type,
        );
        if (existing?.active) {
          this.logger.debug(
            `registerWebhooksForProfile: ${type} webhook already registered for profile ${profileId}`,
          );
          continue;
        }

        const callbackUrl = `${baseUrl}/ayrshare/webhooks/${this.getWebhookPath(type)}`;

        const result = await client.registerWebhook({
          action: type,
          url: callbackUrl,
        });

        if (existing) {
          // Update inactive subscription
          await this.webhookRepository.update(existing.id, {
            active: true,
            callbackUrl,
          });
        } else {
          await this.webhookRepository.create({
            profileId,
            webhookType: type,
            ayrshareWebhookId: result.id,
            callbackUrl,
          });
        }

        this.logger.log(
          `registerWebhooksForProfile: registered ${type} webhook for profile ${profileId}`,
        );
      } catch (err: any) {
        this.logger.warn(
          `registerWebhooksForProfile: failed to register ${type} webhook: ${err?.message}`,
        );
      }
    }
  }

  /**
   * Unregister all webhooks for a profile.
   * Called when a profile is deleted.
   */
  async unregisterWebhooksForProfile(
    profileId: string,
    organizationId: string,
  ): Promise<void> {
    const profile = await this.profileRepository.findById(profileId);
    if (!profile) return;

    const subscriptions =
      await this.webhookRepository.findByProfile(profileId);
    if (!subscriptions.length) return;

    try {
      const apiKey = await this.configService.getApiKey(organizationId);
      const client = new AyrShareClient(apiKey, profile.profileKey);

      for (const sub of subscriptions) {
        try {
          await client.deleteWebhook(sub.ayrshareWebhookId);
          this.logger.log(
            `unregisterWebhooksForProfile: deleted ${sub.webhookType} webhook ${sub.ayrshareWebhookId}`,
          );
        } catch (err: any) {
          this.logger.warn(
            `unregisterWebhooksForProfile: failed to delete webhook ${sub.ayrshareWebhookId}: ${err?.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `unregisterWebhooksForProfile: failed to get client: ${err?.message}`,
      );
    }

    // Clean up local records regardless
    await this.webhookRepository.deleteByProfile(profileId);
  }

  // ---------------------------------------------------------------------------
  // Incoming webhook processing
  // ---------------------------------------------------------------------------

  /**
   * Validate incoming webhook signature (HMAC-SHA256).
   * AyrShare sends the signature in the `X-Authorization-Content-SHA256` header.
   *
   * @param body - Raw request body string
   * @param signature - Value from X-Authorization-Content-SHA256 header
   * @param apiKey - API key to use as HMAC secret
   * @returns true if valid
   */
  validateSignature(body: string, signature: string, apiKey: string): boolean {
    if (!signature || !apiKey) return false;

    const computed = crypto
      .createHmac('sha256', apiKey)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  }

  /**
   * Process an incoming post status webhook.
   *
   * Updates the AyrShareLog record and can trigger notifications.
   */
  async handlePostWebhook(payload: AyrSharePostWebhookPayload): Promise<void> {
    this.logger.log(
      `handlePostWebhook: postId=${payload.id} status=${payload.status}`,
    );

    // Update the log record if we have one for this AyrShare post ID
    if (payload.id) {
      const logEntry = await this.logRepository.findByAyrsharePostId(
        payload.id,
      );
      if (logEntry) {
        await this.logRepository.update(logEntry.id, {
          status: payload.status === 'success' ? 'completed' : 'failed',
          responseBody: payload as any,
          errorMessage:
            payload.errors?.length
              ? JSON.stringify(payload.errors)
              : undefined,
        });
        this.logger.log(
          `handlePostWebhook: updated log ${logEntry.id} status → ${payload.status}`,
        );
      }
    }
  }

  /**
   * Process an incoming social account linked/unlinked webhook.
   *
   * Delegates to AyrShareProfileService.handleSocialWebhook()
   * to update the profile's platforms[] array.
   */
  async handleSocialWebhook(
    payload: AyrShareSocialWebhookPayload,
  ): Promise<void> {
    this.logger.log(
      `handleSocialWebhook: profileKey=${payload.profileKey} platform=${payload.platform} event=${payload.event}`,
    );

    await this.profileService.handleSocialWebhook(
      payload.profileKey,
      payload.platform,
      payload.event,
    );
  }

  /**
   * Process an incoming DM webhook.
   *
   * Delegates to AyrShareMessagesService.handleIncomingMessage()
   * to store the message and trigger auto-respond if configured.
   */
  async handleMessageWebhook(
    payload: AyrShareMessageWebhookPayload,
  ): Promise<void> {
    this.logger.log(
      `handleMessageWebhook: profileKey=${payload.profileKey} platform=${payload.platform} from=${payload.from}`,
    );

    await this.messagesService.handleIncomingMessage(
      payload.profileKey,
      payload.platform,
      payload.messageId,
      payload.fromId,
      payload.from,
      payload.text,
      payload.mediaUrls,
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Map webhook type to URL path segment.
   */
  private getWebhookPath(type: AyrShareWebhookType): string {
    switch (type) {
      case 'scheduled':
        return 'post';
      case 'social':
        return 'social';
      case 'messages':
        return 'dm';
      default:
        return type;
    }
  }
}
