/**
 * UploadPostConfigController
 *
 * REST endpoints for Upload-Post API key configuration.
 * Route prefix: /upload-post/config
 *
 * These endpoints use the organization from the request context (via @GetOrgFromRequest)
 * rather than company slug resolution, because the Upload-Post config is org-scoped.
 *
 * Endpoints:
 *   GET    /upload-post/config        — get current config (masked API key)
 *   POST   /upload-post/config        — save/update API key + settings
 *   POST   /upload-post/config/verify — verify API key validity
 *   DELETE /upload-post/config        — remove config
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Post,
} from '@nestjs/common';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { UploadPostConfigService } from './upload-post-config.service';
import { CreateConfigDto } from '../client/upload-post.types';

@Controller('upload-post/config')
export class UploadPostConfigController {
  private readonly logger = new Logger(UploadPostConfigController.name);

  constructor(private readonly configService: UploadPostConfigService) {}

  // ---------------------------------------------------------------------------
  // GET /upload-post/config
  // ---------------------------------------------------------------------------

  /**
   * Get the current Upload-Post configuration.
   * Returns a masked API key — never exposes the full key.
   *
   * @returns ConfigResponse or null if not configured
   */
  @Get()
  async getConfig(@GetOrgFromRequest() org: Organization) {
    this.logger.log(`getConfig: org=${org.id}`);
    return this.configService.getConfig(org.id);
  }

  // ---------------------------------------------------------------------------
  // POST /upload-post/config
  // ---------------------------------------------------------------------------

  /**
   * Save or update the Upload-Post API key and settings.
   *
   * Request body:
   *   { apiKey: string, planType?: string, maxProfiles?: number }
   *
   * @returns ConfigResponse with masked API key
   */
  @Post()
  async saveConfig(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateConfigDto,
  ) {
    this.logger.log(`saveConfig: org=${org.id}`);
    return this.configService.saveConfig(org.id, body);
  }

  // ---------------------------------------------------------------------------
  // POST /upload-post/config/verify
  // ---------------------------------------------------------------------------

  /**
   * Test whether the stored API key is valid by making a lightweight
   * request to the Upload-Post API.
   *
   * @returns { valid: boolean }
   */
  @Post('verify')
  async verifyApiKey(@GetOrgFromRequest() org: Organization) {
    this.logger.log(`verifyApiKey: org=${org.id}`);
    return this.configService.verifyApiKey(org.id);
  }

  // ---------------------------------------------------------------------------
  // DELETE /upload-post/config
  // ---------------------------------------------------------------------------

  /**
   * Delete the Upload-Post configuration for this organization.
   * Does NOT delete associated profiles — those must be removed separately.
   *
   * @returns { success: true }
   */
  @Delete()
  async deleteConfig(@GetOrgFromRequest() org: Organization) {
    this.logger.log(`deleteConfig: org=${org.id}`);
    await this.configService.deleteConfig(org.id);
    return { success: true };
  }
}
