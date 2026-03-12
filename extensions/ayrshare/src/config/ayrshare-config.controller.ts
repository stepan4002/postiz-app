/**
 * AyrShareConfigController
 *
 * REST endpoints for AyrShare API key configuration.
 * Route prefix: /ayrshare/config
 *
 * These endpoints use the organization from the request context (via @GetOrgFromRequest)
 * because the AyrShare config is org-scoped.
 *
 * Endpoints:
 *   GET    /ayrshare/config        — get current config (masked API key)
 *   POST   /ayrshare/config        — save/update API key + settings
 *   POST   /ayrshare/config/verify — verify API key validity
 *   DELETE /ayrshare/config        — remove config
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
import { AyrShareConfigService } from './ayrshare-config.service';
import { CreateAyrShareConfigDto } from '../client/ayrshare.types';

@Controller('ayrshare/config')
export class AyrShareConfigController {
  private readonly logger = new Logger(AyrShareConfigController.name);

  constructor(private readonly configService: AyrShareConfigService) {}

  // ---------------------------------------------------------------------------
  // GET /ayrshare/config
  // ---------------------------------------------------------------------------

  /**
   * Get the current AyrShare configuration.
   * Returns a masked API key — never exposes the full key.
   */
  @Get()
  async getConfig(@GetOrgFromRequest() org: Organization) {
    this.logger.log(`getConfig: org=${org.id}`);
    return this.configService.getConfig(org.id);
  }

  // ---------------------------------------------------------------------------
  // POST /ayrshare/config
  // ---------------------------------------------------------------------------

  /**
   * Save or update the AyrShare API key and settings.
   *
   * Request body:
   *   { apiKey: string, planType?: string, maxProfiles?: number }
   */
  @Post()
  async saveConfig(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateAyrShareConfigDto,
  ) {
    this.logger.log(`saveConfig: org=${org.id}`);
    return this.configService.saveConfig(org.id, body);
  }

  // ---------------------------------------------------------------------------
  // POST /ayrshare/config/verify
  // ---------------------------------------------------------------------------

  /**
   * Test whether the stored API key is valid by making a lightweight
   * request to the AyrShare API.
   */
  @Post('verify')
  async verifyApiKey(@GetOrgFromRequest() org: Organization) {
    this.logger.log(`verifyApiKey: org=${org.id}`);
    return this.configService.verifyApiKey(org.id);
  }

  // ---------------------------------------------------------------------------
  // DELETE /ayrshare/config
  // ---------------------------------------------------------------------------

  /**
   * Delete the AyrShare configuration for this organization.
   */
  @Delete()
  async deleteConfig(@GetOrgFromRequest() org: Organization) {
    this.logger.log(`deleteConfig: org=${org.id}`);
    await this.configService.deleteConfig(org.id);
    return { success: true };
  }
}
