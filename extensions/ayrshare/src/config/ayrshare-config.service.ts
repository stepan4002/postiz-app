/**
 * AyrShareConfigService
 *
 * Business logic for AyrShare API key management.
 * Sits between controller and repository per project convention:
 *   Controller >> Service >> Repository
 *
 * Responsibilities:
 * - API key masking for safe display (shows last 4 characters only)
 * - API key verification via AyrShareClient
 * - Config CRUD with validation
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AyrShareConfigRepository } from './ayrshare-config.repository';
import { AyrShareClient } from '../client/ayrshare.client';
import {
  AyrShareConfigResponse,
  CreateAyrShareConfigDto,
} from '../client/ayrshare.types';

@Injectable()
export class AyrShareConfigService {
  private readonly logger = new Logger(AyrShareConfigService.name);

  constructor(
    private readonly configRepository: AyrShareConfigRepository,
  ) {}

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /**
   * Get the AyrShare config for an organization.
   * Returns a masked version of the API key for safe display.
   */
  async getConfig(
    organizationId: string,
  ): Promise<AyrShareConfigResponse | null> {
    const config =
      await this.configRepository.findByOrganizationId(organizationId);

    if (!config) {
      return null;
    }

    return {
      id: config.id,
      organizationId: config.organizationId,
      apiKeyMasked: this.maskApiKey(config.apiKey),
      planType: config.planType,
      maxProfiles: config.maxProfiles,
      enabled: config.enabled,
      lastVerifiedAt: config.lastVerifiedAt || null,
    };
  }

  /**
   * Get the raw (unmasked) API key for an organization.
   * Used internally by the publishing pipeline — never exposed via REST.
   */
  async getApiKey(organizationId: string): Promise<string> {
    const config =
      await this.configRepository.findByOrganizationId(organizationId);

    if (!config) {
      throw new NotFoundException(
        'AyrShare is not configured for this organization. Add your API key in Settings > AyrShare.',
      );
    }

    if (!config.enabled) {
      throw new NotFoundException(
        'AyrShare integration is disabled for this organization.',
      );
    }

    return config.apiKey;
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /**
   * Save or update the AyrShare API key for an organization.
   */
  async saveConfig(
    organizationId: string,
    dto: CreateAyrShareConfigDto,
  ): Promise<AyrShareConfigResponse> {
    this.logger.log(
      `saveConfig: org=${organizationId} planType=${dto.planType || 'launch'}`,
    );

    const config = await this.configRepository.upsert(organizationId, {
      apiKey: dto.apiKey,
      planType: dto.planType,
      maxProfiles: dto.maxProfiles,
    });

    return {
      id: config.id,
      organizationId: config.organizationId,
      apiKeyMasked: this.maskApiKey(config.apiKey),
      planType: config.planType,
      maxProfiles: config.maxProfiles,
      enabled: config.enabled,
      lastVerifiedAt: config.lastVerifiedAt || null,
    };
  }

  /**
   * Verify the stored API key by making a test request to AyrShare.
   */
  async verifyApiKey(
    organizationId: string,
  ): Promise<{ valid: boolean }> {
    const config =
      await this.configRepository.findByOrganizationId(organizationId);

    if (!config) {
      throw new NotFoundException(
        'AyrShare config not found. Save an API key first.',
      );
    }

    const client = new AyrShareClient(config.apiKey);
    const valid = await client.verifyApiKey();

    // Update verification timestamp
    if (valid) {
      await this.configRepository.update(organizationId, {
        lastVerifiedAt: new Date(),
      });
    }

    this.logger.log(
      `verifyApiKey: org=${organizationId} valid=${valid}`,
    );

    return { valid };
  }

  /**
   * Delete the AyrShare config for an organization.
   */
  async deleteConfig(organizationId: string): Promise<void> {
    const config =
      await this.configRepository.findByOrganizationId(organizationId);

    if (!config) {
      throw new NotFoundException('AyrShare config not found.');
    }

    await this.configRepository.delete(organizationId);
    this.logger.log(`deleteConfig: org=${organizationId}`);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Mask an API key for safe display: shows only the last 4 characters.
   */
  private maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length <= 4) {
      return '****';
    }
    return '*'.repeat(apiKey.length - 4) + apiKey.slice(-4);
  }
}
