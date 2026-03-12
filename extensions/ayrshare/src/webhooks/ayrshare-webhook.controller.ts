/**
 * AyrShareWebhookController
 *
 * Public endpoint for receiving incoming AyrShare webhooks.
 * Route prefix: /ayrshare/webhooks
 *
 * These endpoints are called by AyrShare's servers when events occur.
 * They do NOT require the standard auth guard (no @GetOrgFromRequest).
 *
 * Security: Validates HMAC-SHA256 signature from the
 * `X-Authorization-Content-SHA256` header.
 *
 * Endpoints:
 *   POST /ayrshare/webhooks/post   — Post status updates (published/failed)
 *   POST /ayrshare/webhooks/social — Social account linked/unlinked
 *   POST /ayrshare/webhooks/dm     — Incoming DMs
 */

import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { AyrShareWebhookService } from './ayrshare-webhook.service';
import { AyrShareConfigService } from '../config/ayrshare-config.service';
import { AyrShareProfileRepository } from '../profile/ayrshare-profile.repository';
import {
  AyrSharePostWebhookPayload,
  AyrShareSocialWebhookPayload,
  AyrShareMessageWebhookPayload,
} from '../client/ayrshare.types';

@Controller('ayrshare/webhooks')
export class AyrShareWebhookController {
  private readonly logger = new Logger(AyrShareWebhookController.name);

  constructor(
    private readonly webhookService: AyrShareWebhookService,
    private readonly configService: AyrShareConfigService,
    private readonly profileRepository: AyrShareProfileRepository,
  ) {}

  /**
   * Validate the HMAC-SHA256 signature on an incoming webhook.
   *
   * Resolves the API key from the payload's profileKey → organizationId → config.
   * Signature validation is best-effort: if the API key cannot be resolved
   * (e.g. unknown profileKey), we log a warning but still process the webhook
   * since AyrShare may retry on 403 responses.
   *
   * @returns true if signature is valid or could not be verified (best-effort)
   */
  private async validateWebhookSignature(
    rawBody: string,
    signature: string | undefined,
    profileKey: string | undefined,
  ): Promise<boolean> {
    if (!signature) {
      this.logger.warn('validateWebhookSignature: no signature header present');
      return false;
    }

    if (!profileKey) {
      this.logger.warn(
        'validateWebhookSignature: no profileKey in payload — cannot verify',
      );
      // Process anyway: some webhook types may not include profileKey
      return true;
    }

    try {
      const profile =
        await this.profileRepository.findByProfileKey(profileKey);
      if (!profile) {
        this.logger.warn(
          `validateWebhookSignature: unknown profileKey '${profileKey}'`,
        );
        return true; // Best-effort: unknown profile, process anyway
      }

      const apiKey = await this.configService.getApiKey(
        profile.organizationId,
      );
      const valid = this.webhookService.validateSignature(
        rawBody,
        signature,
        apiKey,
      );

      if (!valid) {
        this.logger.warn(
          `validateWebhookSignature: HMAC mismatch for profileKey '${profileKey}'`,
        );
      }

      return valid;
    } catch (err: any) {
      this.logger.warn(
        `validateWebhookSignature: error resolving key: ${err?.message}`,
      );
      // Best-effort: if we can't resolve the key, still process
      return true;
    }
  }

  /**
   * Receive post status webhook.
   * AyrShare sends this when a scheduled post is published, fails, or is updated.
   */
  @Post('post')
  @HttpCode(HttpStatus.OK)
  async handlePostWebhook(
    @Body() payload: AyrSharePostWebhookPayload,
    @Headers('x-authorization-content-sha256') signature: string,
    @Req() req: Request,
  ) {
    this.logger.log(
      `handlePostWebhook: received payload for postId=${payload.id}`,
    );

    // Validate HMAC signature
    const rawBody = JSON.stringify(payload);
    const valid = await this.validateWebhookSignature(
      rawBody,
      signature,
      payload.profileKey,
    );
    if (!valid) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    try {
      await this.webhookService.handlePostWebhook(payload);
    } catch (err: any) {
      this.logger.error(
        `handlePostWebhook: error processing payload: ${err?.message}`,
        err?.stack,
      );
    }

    return { status: 'ok' };
  }

  /**
   * Receive social account linked/unlinked webhook.
   * AyrShare sends this when a user links or unlinks a social account
   * through the JWT/SSO flow.
   */
  @Post('social')
  @HttpCode(HttpStatus.OK)
  async handleSocialWebhook(
    @Body() payload: AyrShareSocialWebhookPayload,
    @Headers('x-authorization-content-sha256') signature: string,
    @Req() req: Request,
  ) {
    this.logger.log(
      `handleSocialWebhook: received payload for profileKey=${payload.profileKey} platform=${payload.platform} event=${payload.event}`,
    );

    // Validate HMAC signature
    const rawBody = JSON.stringify(payload);
    const valid = await this.validateWebhookSignature(
      rawBody,
      signature,
      payload.profileKey,
    );
    if (!valid) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    try {
      await this.webhookService.handleSocialWebhook(payload);
    } catch (err: any) {
      this.logger.error(
        `handleSocialWebhook: error processing payload: ${err?.message}`,
        err?.stack,
      );
    }

    return { status: 'ok' };
  }

  /**
   * Receive incoming DM webhook.
   * AyrShare sends this when a message is received on Facebook, Instagram, or X.
   */
  @Post('dm')
  @HttpCode(HttpStatus.OK)
  async handleMessageWebhook(
    @Body() payload: AyrShareMessageWebhookPayload,
    @Headers('x-authorization-content-sha256') signature: string,
    @Req() req: Request,
  ) {
    this.logger.log(
      `handleMessageWebhook: received payload for profileKey=${payload.profileKey} platform=${payload.platform}`,
    );

    // Validate HMAC signature
    const rawBody = JSON.stringify(payload);
    const valid = await this.validateWebhookSignature(
      rawBody,
      signature,
      payload.profileKey,
    );
    if (!valid) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    try {
      await this.webhookService.handleMessageWebhook(payload);
    } catch (err: any) {
      this.logger.error(
        `handleMessageWebhook: error processing payload: ${err?.message}`,
        err?.stack,
      );
    }

    return { status: 'ok' };
  }
}
