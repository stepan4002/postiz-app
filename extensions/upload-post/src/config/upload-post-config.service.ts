/**
 * UploadPostConfigService
 *
 * Business logic for Upload-Post API key management.
 * Sits between controller and repository per project convention:
 *   Controller >> Service >> Repository
 *
 * Responsibilities:
 * - API key masking for safe display (shows last 4 characters only)
 * - API key verification via UploadPostClient
 * - Config CRUD with validation
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UploadPostConfigRepository } from './upload-post-config.repository';
import { UploadPostClient } from '../client/upload-post.client';
import { ConfigResponse, CreateConfigDto, UpdateConfigDto } from '../client/upload-post.types';

@Injectable()
export class UploadPostConfigService {
  private readonly logger = new Logger(UploadPostConfigService.name);

  constructor(private readonly configRepository: UploadPostConfigRepository) {}

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /**
   * Get the Upload-Post config for an organization.
   * Returns a masked version of the API key for safe display.
   *
   * @param organizationId - Organization ID
   * @returns Masked config or null if not configured
   */
  async getConfig(organizationId: string): Promise<ConfigResponse | null> {
    const config = await this.configRepository.findByOrganizationId(organizationId);

    if (!config) {
      return null;
    }

    return {
      id: config.id,
      apiKeyMasked: this.maskApiKey(config.apiKey),
      planType: config.planType,
      maxProfiles: config.maxProfiles,
      enabled: config.enabled,
      lastVerifiedAt: config.lastVerifiedAt?.toISOString() || null,
    };
  }

  /**
   * Get the raw (unmasked) API key for an organization.
   * Used internally by the publishing pipeline — never exposed via REST.
   *
   * @param organizationId - Organization ID
   * @returns Raw API key string
   * @throws NotFoundException if no config exists
   */
  async getApiKey(organizationId: string): Promise<string> {
    const config = await this.configRepository.findByOrganizationId(organizationId);

    if (!config) {
      throw new NotFoundException(
        'Upload-Post is not configured for this organization. Add your API key in Settings > Upload Post.',
      );
    }

    if (!config.enabled) {
      throw new NotFoundException('Upload-Post integration is disabled for this organization.');
    }

    return config.apiKey;
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /**
   * Save or update the Upload-Post API key for an organization.
   *
   * @param organizationId - Organization ID
   * @param dto - API key and optional plan settings
   * @returns Masked config response
   */
  async saveConfig(organizationId: string, dto: CreateConfigDto): Promise<ConfigResponse> {
    this.logger.log(`saveConfig: org=${organizationId} planType=${dto.planType || 'professional'}`);

    const config = await this.configRepository.upsert(organizationId, {
      apiKey: dto.apiKey,
      planType: dto.planType,
      maxProfiles: dto.maxProfiles,
    });

    return {
      id: config.id,
      apiKeyMasked: this.maskApiKey(config.apiKey),
      planType: config.planType,
      maxProfiles: config.maxProfiles,
      enabled: config.enabled,
      lastVerifiedAt: config.lastVerifiedAt?.toISOString() || null,
    };
  }

  /**
   * Verify the stored API key by making a test request to Upload-Post.
   *
   * @param organizationId - Organization ID
   * @returns { valid: boolean }
   */
  async verifyApiKey(organizationId: string): Promise<{ valid: boolean }> {
    const config = await this.configRepository.findByOrganizationId(organizationId);

    if (!config) {
      throw new NotFoundException('Upload-Post config not found. Save an API key first.');
    }

    const client = new UploadPostClient(config.apiKey);
    const valid = await client.verifyApiKey();

    // Update verification timestamp
    if (valid) {
      await this.configRepository.update(organizationId, {
        lastVerifiedAt: new Date(),
      });
    }

    this.logger.log(`verifyApiKey: org=${organizationId} valid=${valid}`);

    return { valid };
  }

  /**
   * Delete the Upload-Post config for an organization.
   *
   * @param organizationId - Organization ID
   */
  async deleteConfig(organizationId: string): Promise<void> {
    const config = await this.configRepository.findByOrganizationId(organizationId);

    if (!config) {
      throw new NotFoundException('Upload-Post config not found.');
    }

    await this.configRepository.delete(organizationId);
    this.logger.log(`deleteConfig: org=${organizationId}`);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Mask an API key for safe display: shows only the last 4 characters.
   * e.g. "abcdefgh12345678" → "************5678"
   */
  private maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length <= 4) {
      return '****';
    }
    return '*'.repeat(apiKey.length - 4) + apiKey.slice(-4);
  }
}
