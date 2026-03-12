/**
 * UploadPostConfigRepository
 *
 * Prisma data layer for UploadPostConfig records.
 * All queries are scoped by organizationId — each org has at most one config.
 *
 * Table: UploadPostConfig (one-to-one with Organization)
 *
 * Follows the Repository pattern established by all other extension modules.
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class UploadPostConfigRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Find the Upload-Post config for an organization.
   *
   * @param organizationId - Organization ID
   * @returns Config record or null if not configured
   */
  async findByOrganizationId(organizationId: string) {
    return this.prisma.uploadPostConfig.findUnique({
      where: { organizationId },
    });
  }

  /**
   * Create or update the Upload-Post config for an organization.
   *
   * Uses upsert because each organization can have at most one config
   * (enforced by @unique on organizationId).
   *
   * @param organizationId - Organization ID
   * @param data - Config fields to set
   * @returns Created or updated config record
   */
  async upsert(
    organizationId: string,
    data: {
      apiKey: string;
      planType?: string;
      maxProfiles?: number;
      enabled?: boolean;
    },
  ) {
    return this.prisma.uploadPostConfig.upsert({
      where: { organizationId },
      create: {
        organizationId,
        apiKey: data.apiKey,
        planType: data.planType || 'professional',
        maxProfiles: data.maxProfiles || 25,
        enabled: data.enabled ?? true,
      },
      update: {
        apiKey: data.apiKey,
        ...(data.planType !== undefined && { planType: data.planType }),
        ...(data.maxProfiles !== undefined && { maxProfiles: data.maxProfiles }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
    });
  }

  /**
   * Update specific fields on the config record.
   *
   * @param organizationId - Organization ID
   * @param data - Partial fields to update
   * @returns Updated config record
   */
  async update(
    organizationId: string,
    data: Partial<{
      apiKey: string;
      planType: string;
      maxProfiles: number;
      enabled: boolean;
      lastVerifiedAt: Date;
    }>,
  ) {
    return this.prisma.uploadPostConfig.update({
      where: { organizationId },
      data,
    });
  }

  /**
   * Delete the Upload-Post config for an organization.
   *
   * @param organizationId - Organization ID
   * @returns Deleted config record
   */
  async delete(organizationId: string) {
    return this.prisma.uploadPostConfig.delete({
      where: { organizationId },
    });
  }
}
