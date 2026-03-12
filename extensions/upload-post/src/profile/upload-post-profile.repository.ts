/**
 * UploadPostProfileRepository
 *
 * Prisma data layer for UploadPostProfile records.
 * All queries are scoped by organizationId for multi-tenancy.
 *
 * Table: UploadPostProfile
 *
 * Each profile maps a Company + Language to one Upload-Post username.
 * The profile username follows the convention: {companySlug}__{brandSlug}__{langCode}
 * e.g. "cadema__main__cs", "cadema__main__sk"
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class UploadPostProfileRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Find all profiles for an organization.
   *
   * @param organizationId - Organization ID
   * @returns Array of profile records with company and brand details
   */
  async findAllByOrganization(organizationId: string) {
    return this.prisma.uploadPostProfile.findMany({
      where: { organizationId },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find a single profile by ID.
   *
   * @param id - Profile record ID
   * @returns Profile record with relations or null
   */
  async findById(id: string) {
    return this.prisma.uploadPostProfile.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /**
   * Find a profile by its Upload-Post username.
   *
   * @param profileUsername - Upload-Post profile username
   * @returns Profile record or null
   */
  async findByUsername(profileUsername: string) {
    return this.prisma.uploadPostProfile.findUnique({
      where: { profileUsername },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /**
   * Find a profile by its linked Integration ID.
   *
   * @param integrationId - Integration record ID
   * @returns Profile record or null
   */
  async findByIntegrationId(integrationId: string) {
    return this.prisma.uploadPostProfile.findUnique({
      where: { integrationId },
    });
  }

  /**
   * Count profiles for an organization (for quota tracking).
   *
   * @param organizationId - Organization ID
   * @returns Number of profiles
   */
  async countByOrganization(organizationId: string): Promise<number> {
    return this.prisma.uploadPostProfile.count({
      where: { organizationId },
    });
  }

  /**
   * Create a new profile.
   *
   * @param data - Profile creation data
   * @returns Created profile record
   */
  async create(data: {
    companyId: string;
    organizationId: string;
    profileUsername: string;
    languageCode: string;
    languageName: string;
    brandId?: string;
    platforms: string[];
    platformSettings?: Record<string, any>;
  }) {
    return this.prisma.uploadPostProfile.create({
      data: {
        companyId: data.companyId,
        organizationId: data.organizationId,
        profileUsername: data.profileUsername,
        languageCode: data.languageCode,
        languageName: data.languageName,
        brandId: data.brandId || null,
        platforms: data.platforms,
        platformSettings: data.platformSettings || {},
      },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /**
   * Update an existing profile.
   *
   * @param id - Profile record ID
   * @param data - Partial fields to update
   * @returns Updated profile record
   */
  async update(
    id: string,
    data: Partial<{
      platforms: string[];
      platformSettings: Record<string, any>;
      brandId: string | null;
      integrationId: string | null;
      enabled: boolean;
    }>,
  ) {
    return this.prisma.uploadPostProfile.update({
      where: { id },
      data,
      include: {
        company: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /**
   * Delete a profile.
   *
   * @param id - Profile record ID
   * @returns Deleted profile record
   */
  async delete(id: string) {
    return this.prisma.uploadPostProfile.delete({
      where: { id },
    });
  }
}
