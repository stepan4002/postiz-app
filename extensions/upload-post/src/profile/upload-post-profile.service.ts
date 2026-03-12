/**
 * UploadPostProfileService
 *
 * Business logic for Upload-Post profile lifecycle.
 * Sits between controller and repository per project convention:
 *   Controller >> Service >> Repository
 *
 * Responsibilities:
 * - Profile username generation: {companySlug}__{brandSlug}__{langCode}
 * - Quota enforcement: prevent exceeding max profiles per plan
 * - Auto-creation of matching Integration records (so profiles appear in calendar/scheduling)
 * - Profile CRUD with cascading Integration cleanup
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { UploadPostProfileRepository } from './upload-post-profile.repository';
import { UploadPostConfigService } from '../config/upload-post-config.service';
import { CreateProfileDto, UpdateProfileDto, QuotaResponse } from '../client/upload-post.types';

@Injectable()
export class UploadPostProfileService {
  private readonly logger = new Logger(UploadPostProfileService.name);

  constructor(
    private readonly profileRepository: UploadPostProfileRepository,
    private readonly configService: UploadPostConfigService,
    private readonly prisma: any,
  ) {}

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /**
   * List all Upload-Post profiles for an organization.
   *
   * @param organizationId - Organization ID
   * @returns Array of profile records with company/brand details
   */
  async listProfiles(organizationId: string) {
    return this.profileRepository.findAllByOrganization(organizationId);
  }

  /**
   * Get a single profile by ID.
   *
   * @param id - Profile record ID
   * @param organizationId - Organization ID (for ownership validation)
   * @returns Profile record
   * @throws NotFoundException if profile not found or wrong org
   */
  async getProfile(id: string, organizationId: string) {
    const profile = await this.profileRepository.findById(id);

    if (!profile || profile.organizationId !== organizationId) {
      throw new NotFoundException(`Upload-Post profile '${id}' not found`);
    }

    return profile;
  }

  /**
   * Check profile quota usage.
   *
   * @param organizationId - Organization ID
   * @returns Quota info: used, max, remaining, planType
   */
  async getQuota(organizationId: string): Promise<QuotaResponse> {
    const config = await this.configService.getConfig(organizationId);
    const used = await this.profileRepository.countByOrganization(organizationId);

    const maxProfiles = config?.maxProfiles || 25;
    const planType = config?.planType || 'professional';

    return {
      used,
      max: maxProfiles,
      remaining: Math.max(0, maxProfiles - used),
      planType,
    };
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /**
   * Create a new Upload-Post profile.
   *
   * Steps:
   * 1. Check quota — prevent exceeding max profiles
   * 2. Generate username from company slug + brand slug + language code
   * 3. Create UploadPostProfile record
   * 4. Auto-create a matching Integration record
   * 5. Link the Integration to the profile
   *
   * @param dto - Profile creation data
   * @param organizationId - Organization ID
   * @returns Created profile with linked Integration
   */
  async createProfile(dto: CreateProfileDto, organizationId: string) {
    // 1. Check quota
    const quota = await this.getQuota(organizationId);
    if (quota.remaining <= 0) {
      throw new BadRequestException(
        `Profile quota exceeded. You are using ${quota.used} of ${quota.max} profiles. ` +
          'Upgrade your Upload-Post plan or delete unused profiles.',
      );
    }

    // 2. Generate username
    const brandSlug = dto.brandSlug || 'main';
    const profileUsername = this.generateUsername(dto.companySlug, brandSlug, dto.languageCode);

    this.logger.log(
      `createProfile: org=${organizationId} username=${profileUsername} platforms=${dto.platforms.join(',')}`,
    );

    // 3. Create profile record
    const profile = await this.profileRepository.create({
      companyId: dto.companyId,
      organizationId,
      profileUsername,
      languageCode: dto.languageCode,
      languageName: dto.languageName,
      brandId: dto.brandId,
      platforms: dto.platforms,
      platformSettings: dto.platformSettings,
    });

    // 4. Auto-create a matching Integration record
    // This makes the profile appear in the calendar, scheduling, and analytics UIs
    try {
      const integration = await this.prisma.integration.create({
        data: {
          internalId: profileUsername,
          organizationId,
          name: `Upload Post: ${dto.companySlug} (${dto.languageName})`,
          providerIdentifier: 'upload-post',
          type: 'social',
          token: 'managed', // Real API key is in UploadPostConfig
          picture: '',
          profile: JSON.stringify({ platforms: dto.platforms }),
        },
      });

      // 5. Link integration back to profile
      await this.profileRepository.update(profile.id, {
        integrationId: integration.id,
      });

      this.logger.log(
        `createProfile: auto-created Integration ${integration.id} for profile ${profile.id}`,
      );
    } catch (err: any) {
      this.logger.warn(
        `createProfile: failed to auto-create Integration for profile ${profile.id}: ${err?.message}`,
      );
      // Profile is still usable without the auto-created Integration
    }

    // Return the updated profile with integration link
    return this.profileRepository.findById(profile.id);
  }

  /**
   * Update an existing profile.
   *
   * @param id - Profile record ID
   * @param dto - Partial fields to update
   * @param organizationId - Organization ID (for ownership validation)
   * @returns Updated profile
   */
  async updateProfile(id: string, dto: UpdateProfileDto, organizationId: string) {
    const profile = await this.profileRepository.findById(id);

    if (!profile || profile.organizationId !== organizationId) {
      throw new NotFoundException(`Upload-Post profile '${id}' not found`);
    }

    this.logger.log(`updateProfile: id=${id} org=${organizationId}`);

    const updateData: Record<string, any> = {};
    if (dto.platforms !== undefined) updateData.platforms = dto.platforms;
    if (dto.platformSettings !== undefined) updateData.platformSettings = dto.platformSettings;
    if (dto.brandId !== undefined) updateData.brandId = dto.brandId || null;
    if (dto.enabled !== undefined) updateData.enabled = dto.enabled;

    // Also update the linked Integration's profile field if platforms changed
    if (dto.platforms && profile.integrationId) {
      try {
        await this.prisma.integration.update({
          where: { id: profile.integrationId },
          data: {
            profile: JSON.stringify({ platforms: dto.platforms }),
          },
        });
      } catch (err: any) {
        this.logger.warn(`updateProfile: failed to sync Integration: ${err?.message}`);
      }
    }

    return this.profileRepository.update(id, updateData);
  }

  /**
   * Delete a profile and its linked Integration.
   *
   * @param id - Profile record ID
   * @param organizationId - Organization ID (for ownership validation)
   */
  async deleteProfile(id: string, organizationId: string): Promise<void> {
    const profile = await this.profileRepository.findById(id);

    if (!profile || profile.organizationId !== organizationId) {
      throw new NotFoundException(`Upload-Post profile '${id}' not found`);
    }

    this.logger.log(`deleteProfile: id=${id} org=${organizationId} username=${profile.profileUsername}`);

    // Delete the linked Integration first (if any)
    if (profile.integrationId) {
      try {
        await this.prisma.integration.delete({
          where: { id: profile.integrationId },
        });
        this.logger.log(`deleteProfile: removed Integration ${profile.integrationId}`);
      } catch (err: any) {
        this.logger.warn(`deleteProfile: failed to remove Integration: ${err?.message}`);
      }
    }

    // Delete the profile
    await this.profileRepository.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Generate an Upload-Post profile username.
   *
   * Convention: {companySlug}__{brandSlug}__{langCode}
   * All parts are lowercased and non-alphanumeric characters (except hyphens) are stripped.
   *
   * Examples:
   *   ("cadema", "main", "cs")  → "cadema__main__cs"
   *   ("firma-b", "premium", "en") → "firma-b__premium__en"
   */
  generateUsername(companySlug: string, brandSlug: string, langCode: string): string {
    const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, '');
    return `${sanitize(companySlug)}__${sanitize(brandSlug)}__${sanitize(langCode)}`;
  }
}
