/**
 * AyrShareConfigRepository
 *
 * Prisma data layer for AyrShareConfig records.
 * All queries are scoped by organizationId — each org has at most one config.
 *
 * Table: AyrShareConfig (one-to-one with Organization)
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class AyrShareConfigRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Find the AyrShare config for an organization.
   */
  async findByOrganizationId(organizationId: string) {
    return this.prisma.ayrShareConfig.findUnique({
      where: { organizationId },
    });
  }

  /**
   * Create or update the AyrShare config for an organization.
   * Uses upsert because each organization can have at most one config.
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
    return this.prisma.ayrShareConfig.upsert({
      where: { organizationId },
      create: {
        organizationId,
        apiKey: data.apiKey,
        planType: data.planType || 'launch',
        maxProfiles: data.maxProfiles || 10,
        enabled: data.enabled ?? true,
      },
      update: {
        apiKey: data.apiKey,
        ...(data.planType !== undefined && { planType: data.planType }),
        ...(data.maxProfiles !== undefined && {
          maxProfiles: data.maxProfiles,
        }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
    });
  }

  /**
   * Update specific fields on the config record.
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
    return this.prisma.ayrShareConfig.update({
      where: { organizationId },
      data,
    });
  }

  /**
   * Delete the AyrShare config for an organization.
   */
  async delete(organizationId: string) {
    return this.prisma.ayrShareConfig.delete({
      where: { organizationId },
    });
  }
}
