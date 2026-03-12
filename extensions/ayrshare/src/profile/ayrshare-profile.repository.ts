/**
 * AyrShareProfileRepository
 *
 * Prisma data layer for AyrShareProfile records.
 * All queries are scoped by organizationId for multi-tenancy.
 *
 * Table: AyrShareProfile
 *
 * Each profile maps a Company + Brand + Language to an AyrShare sub-account.
 * The profileKey is obtained from the AyrShare API when creating the profile.
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class AyrShareProfileRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Find all profiles for an organization.
   *
   * @param organizationId - Organization ID
   * @returns Array of profile records with company and brand details
   */
  async findAllByOrganization(organizationId: string) {
    return this.prisma.ayrShareProfile.findMany({
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
    return this.prisma.ayrShareProfile.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /**
   * Find a profile by its AyrShare profileKey.
   *
   * @param profileKey - AyrShare API profile key
   * @returns Profile record or null
   */
  async findByProfileKey(profileKey: string) {
    return this.prisma.ayrShareProfile.findUnique({
      where: { profileKey },
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
    return this.prisma.ayrShareProfile.findUnique({
      where: { integrationId },
    });
  }

  /**
   * Find a profile by company + language code (unique constraint).
   *
   * @param companyId - Company ID
   * @param languageCode - ISO 639-1 language code
   * @returns Profile record or null
   */
  async findByCompanyAndLanguage(companyId: string, languageCode: string) {
    return this.prisma.ayrShareProfile.findUnique({
      where: {
        companyId_languageCode: { companyId, languageCode },
      },
    });
  }

  /**
   * Count profiles for an organization (for quota tracking).
   *
   * @param organizationId - Organization ID
   * @returns Number of profiles
   */
  async countByOrganization(organizationId: string): Promise<number> {
    return this.prisma.ayrShareProfile.count({
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
    profileKey: string;
    title: string;
    languageCode: string;
    languageName: string;
    brandId?: string;
    platforms?: string[];
  }) {
    return this.prisma.ayrShareProfile.create({
      data: {
        companyId: data.companyId,
        organizationId: data.organizationId,
        profileKey: data.profileKey,
        title: data.title,
        languageCode: data.languageCode,
        languageName: data.languageName,
        brandId: data.brandId || null,
        platforms: data.platforms || [],
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
      title: string;
      platforms: string[];
      brandId: string | null;
      integrationId: string | null;
      enabled: boolean;
      languageName: string;
    }>,
  ) {
    return this.prisma.ayrShareProfile.update({
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
    return this.prisma.ayrShareProfile.delete({
      where: { id },
    });
  }
}
