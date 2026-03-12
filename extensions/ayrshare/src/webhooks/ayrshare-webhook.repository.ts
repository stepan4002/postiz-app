/**
 * AyrShareWebhookRepository
 *
 * Prisma data layer for AyrShareWebhookSubscription records.
 * Tracks registered webhook subscriptions with AyrShare API.
 *
 * Table: AyrShareWebhookSubscription
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class AyrShareWebhookRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Create a new webhook subscription record.
   */
  async create(data: {
    profileId: string;
    webhookType: string;
    ayrshareWebhookId: string;
    callbackUrl: string;
  }) {
    return this.prisma.ayrShareWebhookSubscription.create({
      data: {
        profileId: data.profileId,
        webhookType: data.webhookType,
        ayrshareWebhookId: data.ayrshareWebhookId,
        callbackUrl: data.callbackUrl,
        active: true,
      },
    });
  }

  /**
   * Find all webhook subscriptions for a profile.
   */
  async findByProfile(profileId: string) {
    return this.prisma.ayrShareWebhookSubscription.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find a specific webhook subscription by profile + type.
   * Uses the @@unique([profileId, webhookType]) constraint.
   */
  async findByProfileAndType(profileId: string, webhookType: string) {
    return this.prisma.ayrShareWebhookSubscription.findUnique({
      where: {
        profileId_webhookType: { profileId, webhookType },
      },
    });
  }

  /**
   * Find by AyrShare webhook ID (for correlation with incoming payloads).
   */
  async findByAyrshareWebhookId(ayrshareWebhookId: string) {
    return this.prisma.ayrShareWebhookSubscription.findFirst({
      where: { ayrshareWebhookId },
    });
  }

  /**
   * Update a webhook subscription.
   */
  async update(id: string, data: { active?: boolean; callbackUrl?: string }) {
    return this.prisma.ayrShareWebhookSubscription.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a webhook subscription.
   */
  async delete(id: string) {
    return this.prisma.ayrShareWebhookSubscription.delete({
      where: { id },
    });
  }

  /**
   * Delete all webhook subscriptions for a profile.
   */
  async deleteByProfile(profileId: string) {
    return this.prisma.ayrShareWebhookSubscription.deleteMany({
      where: { profileId },
    });
  }
}
