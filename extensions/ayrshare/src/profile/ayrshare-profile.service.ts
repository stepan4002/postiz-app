/**
 * AyrShareProfileService
 *
 * Business logic for AyrShare profile lifecycle.
 * Sits between controller and repository per project convention:
 *   Controller >> Service >> Repository
 *
 * Responsibilities:
 * - Profile creation via AyrShare API (creates remote sub-account + local DB record)
 * - JWT/SSO URL generation for social account linking
 * - Quota enforcement: prevent exceeding max profiles per plan (Launch = 10)
 * - Auto-creation of matching Integration records (so profiles appear in calendar/scheduling)
 * - Platform unlinking via AyrShare API
 * - Profile CRUD with cascading Integration cleanup
 *
 * Key difference from Upload-Post:
 *   - Upload-Post profiles are local-only (no remote API call)
 *   - AyrShare profiles are created via POST /api/profiles → returns profileKey
 *   - Social account linking is done via AyrShare JWT/SSO (managed OAuth)
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AyrShareProfileRepository } from './ayrshare-profile.repository';
import { AyrShareConfigService } from '../config/ayrshare-config.service';
import { AyrShareClient } from '../client/ayrshare.client';
import {
  CreateAyrShareProfileDto,
  UpdateAyrShareProfileDto,
  AyrShareQuotaResponse,
  AyrSharePlatform,
} from '../client/ayrshare.types';

/**
 * Lazy reference type for the webhook service to avoid circular DI.
 * The webhook service depends on profile service and vice versa.
 */
type WebhookServiceRef = {
  registerWebhooksForProfile(
    profileId: string,
    organizationId: string,
  ): Promise<void>;
};

@Injectable()
export class AyrShareProfileService {
  private readonly logger = new Logger(AyrShareProfileService.name);

  /**
   * Webhook service reference, injected lazily to avoid circular dependency.
   * Set via setWebhookService() called from AyrShareModule.onModuleInit().
   */
  private webhookService: WebhookServiceRef | null = null;

  constructor(
    private readonly profileRepository: AyrShareProfileRepository,
    private readonly configService: AyrShareConfigService,
    private readonly prisma: any,
  ) {}

  /**
   * Set the webhook service reference for auto-registering webhooks on profile creation.
   * Called from AyrShareModule.onModuleInit() to break circular dependency.
   */
  setWebhookService(service: WebhookServiceRef): void {
    this.webhookService = service;
  }

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /**
   * List all AyrShare profiles for an organization.
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
      throw new NotFoundException(`AyrShare profile '${id}' not found`);
    }

    return profile;
  }

  /**
   * Check profile quota usage.
   *
   * @param organizationId - Organization ID
   * @returns Quota info: used, max, remaining
   */
  async getQuota(organizationId: string): Promise<AyrShareQuotaResponse> {
    const config = await this.configService.getConfig(organizationId);
    const used =
      await this.profileRepository.countByOrganization(organizationId);

    const maxProfiles = config?.maxProfiles || 10;

    return {
      used,
      max: maxProfiles,
      remaining: Math.max(0, maxProfiles - used),
    };
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /**
   * Create a new AyrShare profile.
   *
   * Steps:
   * 1. Check quota — prevent exceeding max profiles
   * 2. Verify AyrShare API key is configured
   * 3. Create remote profile via AyrShare API → get profileKey
   * 4. Create local AyrShareProfile record
   * 5. Auto-create a matching Integration record
   * 6. Link the Integration to the profile
   *
   * @param dto - Profile creation data
   * @param organizationId - Organization ID
   * @returns Created profile with linked Integration
   */
  async createProfile(dto: CreateAyrShareProfileDto, organizationId: string) {
    // 1. Check quota
    const quota = await this.getQuota(organizationId);
    if (quota.remaining <= 0) {
      throw new BadRequestException(
        `Profile quota exceeded. You are using ${quota.used} of ${quota.max} profiles. ` +
          'Upgrade your AyrShare plan or delete unused profiles.',
      );
    }

    // 2. Check for duplicate (company + language must be unique)
    const existing = await this.profileRepository.findByCompanyAndLanguage(
      dto.companyId,
      dto.languageCode,
    );
    if (existing) {
      throw new BadRequestException(
        `A profile already exists for this company with language '${dto.languageCode}'.`,
      );
    }

    // 3. Get API key and create remote AyrShare profile
    const apiKey = await this.configService.getApiKey(organizationId);
    const client = new AyrShareClient(apiKey);

    this.logger.log(
      `createProfile: org=${organizationId} title=${dto.title} lang=${dto.languageCode}`,
    );

    let profileKey: string;
    try {
      const remoteProfile = await client.createProfile(dto.title);

      if ((remoteProfile as any).status === 'error') {
        throw new Error(
          (remoteProfile as any).message || 'AyrShare API error',
        );
      }

      profileKey = remoteProfile.profileKey;
      this.logger.log(
        `createProfile: AyrShare returned profileKey=${profileKey}`,
      );
    } catch (err: any) {
      this.logger.error(
        `createProfile: AyrShare API call failed: ${err?.message}`,
      );
      throw new BadRequestException(
        `Failed to create AyrShare profile: ${err?.message}`,
      );
    }

    // 4. Create local profile record
    const profile = await this.profileRepository.create({
      companyId: dto.companyId,
      organizationId,
      profileKey,
      title: dto.title,
      languageCode: dto.languageCode,
      languageName: dto.languageName,
      brandId: dto.brandId,
      platforms: [], // Empty until user links social accounts via SSO
    });

    // 5. Auto-create a matching Integration record
    // This makes the profile appear in the calendar, scheduling, and analytics UIs
    try {
      const integration = await this.prisma.integration.create({
        data: {
          internalId: profileKey,
          organizationId,
          name: `AyrShare: ${dto.title}`,
          providerIdentifier: 'ayrshare',
          type: 'social',
          token: 'managed', // Real API key is in AyrShareConfig
          picture: '',
          profile: JSON.stringify({ platforms: [] }),
        },
      });

      // 6. Link integration back to profile
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

    // 7. Auto-register webhooks for the new profile (non-blocking)
    if (this.webhookService) {
      this.webhookService
        .registerWebhooksForProfile(profile.id, organizationId)
        .catch((err: any) => {
          this.logger.warn(
            `createProfile: failed to auto-register webhooks for profile ${profile.id}: ${err?.message}`,
          );
        });
    } else {
      this.logger.warn(
        'createProfile: webhookService not set — skipping webhook auto-registration',
      );
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
  async updateProfile(
    id: string,
    dto: UpdateAyrShareProfileDto,
    organizationId: string,
  ) {
    const profile = await this.profileRepository.findById(id);

    if (!profile || profile.organizationId !== organizationId) {
      throw new NotFoundException(`AyrShare profile '${id}' not found`);
    }

    this.logger.log(`updateProfile: id=${id} org=${organizationId}`);

    const updateData: Record<string, any> = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.languageName !== undefined)
      updateData.languageName = dto.languageName;
    if (dto.brandId !== undefined) updateData.brandId = dto.brandId || null;
    if (dto.enabled !== undefined) updateData.enabled = dto.enabled;

    // Also update the linked Integration's name if title changed
    if (dto.title && profile.integrationId) {
      try {
        await this.prisma.integration.update({
          where: { id: profile.integrationId },
          data: {
            name: `AyrShare: ${dto.title}`,
          },
        });
      } catch (err: any) {
        this.logger.warn(
          `updateProfile: failed to sync Integration name: ${err?.message}`,
        );
      }
    }

    return this.profileRepository.update(id, updateData);
  }

  /**
   * Delete a profile and its linked Integration.
   *
   * Also deletes the remote AyrShare profile via the API.
   *
   * @param id - Profile record ID
   * @param organizationId - Organization ID (for ownership validation)
   */
  async deleteProfile(id: string, organizationId: string): Promise<void> {
    const profile = await this.profileRepository.findById(id);

    if (!profile || profile.organizationId !== organizationId) {
      throw new NotFoundException(`AyrShare profile '${id}' not found`);
    }

    this.logger.log(
      `deleteProfile: id=${id} org=${organizationId} profileKey=${profile.profileKey}`,
    );

    // Delete the remote AyrShare profile
    try {
      const apiKey = await this.configService.getApiKey(organizationId);
      const client = new AyrShareClient(apiKey);
      await client.deleteProfile(profile.profileKey);
      this.logger.log(
        `deleteProfile: removed remote AyrShare profile ${profile.profileKey}`,
      );
    } catch (err: any) {
      this.logger.warn(
        `deleteProfile: failed to remove remote profile: ${err?.message}`,
      );
      // Continue with local cleanup even if remote delete fails
    }

    // Delete the linked Integration (if any)
    if (profile.integrationId) {
      try {
        await this.prisma.integration.delete({
          where: { id: profile.integrationId },
        });
        this.logger.log(
          `deleteProfile: removed Integration ${profile.integrationId}`,
        );
      } catch (err: any) {
        this.logger.warn(
          `deleteProfile: failed to remove Integration: ${err?.message}`,
        );
      }
    }

    // Delete the local profile record
    await this.profileRepository.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Social account linking
  // ---------------------------------------------------------------------------

  /**
   * Generate a JWT/SSO URL for social account linking.
   *
   * The user opens this URL to connect their social accounts through AyrShare's UI.
   * AyrShare manages all OAuth flows internally — Postiz never sees platform tokens.
   *
   * @param id - Profile record ID
   * @param organizationId - Organization ID (for ownership validation)
   * @param domain - Domain for the SSO callback (usually the frontend URL)
   * @returns { url: string } — The SSO URL to open in browser/iframe
   */
  async generateLinkUrl(
    id: string,
    organizationId: string,
    domain: string,
  ): Promise<{ url: string }> {
    const profile = await this.profileRepository.findById(id);

    if (!profile || profile.organizationId !== organizationId) {
      throw new NotFoundException(`AyrShare profile '${id}' not found`);
    }

    const apiKey = await this.configService.getApiKey(organizationId);
    const client = new AyrShareClient(apiKey);

    this.logger.log(
      `generateLinkUrl: profile=${id} profileKey=${profile.profileKey} domain=${domain}`,
    );

    const result = await client.generateJWT(profile.profileKey, domain);

    if ((result as any).status === 'error') {
      throw new BadRequestException(
        `Failed to generate SSO URL: ${(result as any).message || 'Unknown error'}`,
      );
    }

    return { url: result.url };
  }

  /**
   * Unlink a social platform from a profile.
   *
   * @param id - Profile record ID
   * @param organizationId - Organization ID
   * @param platform - AyrShare platform name to unlink
   */
  async unlinkPlatform(
    id: string,
    organizationId: string,
    platform: AyrSharePlatform,
  ): Promise<void> {
    const profile = await this.profileRepository.findById(id);

    if (!profile || profile.organizationId !== organizationId) {
      throw new NotFoundException(`AyrShare profile '${id}' not found`);
    }

    const apiKey = await this.configService.getApiKey(organizationId);
    const client = new AyrShareClient(apiKey);

    this.logger.log(
      `unlinkPlatform: profile=${id} platform=${platform}`,
    );

    await client.unlinkSocial({
      profileKey: profile.profileKey,
      platform,
    });

    // Remove platform from the local platforms array
    const updatedPlatforms = (profile.platforms || []).filter(
      (p: string) => p !== platform,
    );
    await this.profileRepository.update(id, { platforms: updatedPlatforms });

    // Sync Integration profile data
    if (profile.integrationId) {
      try {
        await this.prisma.integration.update({
          where: { id: profile.integrationId },
          data: {
            profile: JSON.stringify({ platforms: updatedPlatforms }),
          },
        });
      } catch (err: any) {
        this.logger.warn(
          `unlinkPlatform: failed to sync Integration: ${err?.message}`,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Webhook handler: update platforms when social accounts are linked/unlinked
  // ---------------------------------------------------------------------------

  /**
   * Update a profile's linked platforms.
   * Called by the webhook handler when AyrShare sends a social event.
   *
   * @param profileKey - AyrShare profile key
   * @param platform - Platform that was linked or unlinked
   * @param event - 'linked' or 'unlinked'
   */
  async handleSocialWebhook(
    profileKey: string,
    platform: AyrSharePlatform,
    event: 'linked' | 'unlinked',
  ): Promise<void> {
    const profile =
      await this.profileRepository.findByProfileKey(profileKey);

    if (!profile) {
      this.logger.warn(
        `handleSocialWebhook: profile not found for key ${profileKey}`,
      );
      return;
    }

    const currentPlatforms = profile.platforms || [];
    let updatedPlatforms: string[];

    if (event === 'linked') {
      // Add platform if not already present
      updatedPlatforms = currentPlatforms.includes(platform)
        ? currentPlatforms
        : [...currentPlatforms, platform];
    } else {
      // Remove platform
      updatedPlatforms = currentPlatforms.filter(
        (p: string) => p !== platform,
      );
    }

    this.logger.log(
      `handleSocialWebhook: profile=${profile.id} platform=${platform} event=${event} ` +
        `platforms=${updatedPlatforms.join(',')}`,
    );

    await this.profileRepository.update(profile.id, {
      platforms: updatedPlatforms,
    });

    // Sync Integration profile data
    if (profile.integrationId) {
      try {
        await this.prisma.integration.update({
          where: { id: profile.integrationId },
          data: {
            profile: JSON.stringify({ platforms: updatedPlatforms }),
          },
        });
      } catch (err: any) {
        this.logger.warn(
          `handleSocialWebhook: failed to sync Integration: ${err?.message}`,
        );
      }
    }
  }
}
