/**
 * AyrShareMessagesRepository
 *
 * Prisma data layer for AyrShareMessage records.
 * Tracks DMs sent/received through the AyrShare API.
 *
 * Table: AyrShareMessage
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class AyrShareMessagesRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Create a new message record.
   */
  async create(data: {
    profileId: string;
    organizationId: string;
    platform: string;
    direction: 'inbound' | 'outbound';
    externalId?: string;
    senderId?: string;
    senderName?: string;
    recipientId?: string;
    content: string;
    mediaUrls?: string[];
    status?: string;
  }) {
    return this.prisma.ayrShareMessage.create({
      data: {
        profileId: data.profileId,
        organizationId: data.organizationId,
        platform: data.platform,
        direction: data.direction,
        externalId: data.externalId || null,
        senderId: data.senderId || null,
        senderName: data.senderName || null,
        recipientId: data.recipientId || null,
        content: data.content,
        mediaUrls: data.mediaUrls || [],
        status: data.status || 'delivered',
      },
    });
  }

  /**
   * Find messages for a profile, optionally filtered by platform.
   */
  async findByProfile(
    profileId: string,
    platform?: string,
    limit = 50,
  ) {
    return this.prisma.ayrShareMessage.findMany({
      where: {
        profileId,
        ...(platform && { platform }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Find messages for an organization, optionally filtered by platform.
   */
  async findByOrganization(
    organizationId: string,
    platform?: string,
    limit = 50,
  ) {
    return this.prisma.ayrShareMessage.findMany({
      where: {
        organizationId,
        ...(platform && { platform }),
      },
      include: {
        profile: { select: { title: true, profileKey: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Find a message by external (platform) ID.
   */
  async findByExternalId(externalId: string) {
    return this.prisma.ayrShareMessage.findFirst({
      where: { externalId },
    });
  }
}
