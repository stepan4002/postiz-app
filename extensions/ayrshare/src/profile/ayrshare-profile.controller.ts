/**
 * AyrShareProfileController
 *
 * REST endpoints for AyrShare profile management.
 * Route prefix: /ayrshare/profiles
 *
 * Profiles map Company + Brand + Language combinations to AyrShare sub-accounts.
 * Each profile auto-creates a matching Integration record so it appears
 * in the calendar, scheduling, and analytics UIs.
 *
 * Social account linking is done via AyrShare's JWT/SSO flow — the user
 * opens a URL in their browser to connect their social accounts.
 *
 * Endpoints:
 *   GET    /ayrshare/profiles           — list all profiles for org
 *   GET    /ayrshare/profiles/quota     — check remaining profile quota
 *   GET    /ayrshare/profiles/:id       — get profile details
 *   POST   /ayrshare/profiles           — create new profile (calls AyrShare API)
 *   PUT    /ayrshare/profiles/:id       — update profile
 *   DELETE /ayrshare/profiles/:id       — delete profile + linked Integration
 *   POST   /ayrshare/profiles/:id/link  — generate JWT/SSO URL for social linking
 *   POST   /ayrshare/profiles/:id/unlink — unlink a social platform
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { AyrShareProfileService } from './ayrshare-profile.service';
import {
  CreateAyrShareProfileDto,
  UpdateAyrShareProfileDto,
  AyrSharePlatform,
} from '../client/ayrshare.types';

@Controller('ayrshare/profiles')
export class AyrShareProfileController {
  private readonly logger = new Logger(AyrShareProfileController.name);

  constructor(private readonly profileService: AyrShareProfileService) {}

  // ---------------------------------------------------------------------------
  // GET /ayrshare/profiles
  // ---------------------------------------------------------------------------

  /**
   * List all AyrShare profiles for the current organization.
   *
   * @returns Array of profile records with company/brand details
   */
  @Get()
  async listProfiles(@GetOrgFromRequest() org: Organization) {
    this.logger.log(`listProfiles: org=${org.id}`);
    return this.profileService.listProfiles(org.id);
  }

  // ---------------------------------------------------------------------------
  // GET /ayrshare/profiles/quota
  // ---------------------------------------------------------------------------

  /**
   * Check the profile quota for the current organization.
   * Must be declared before ':id' to prevent "quota" from being captured as an ID.
   *
   * @returns { used, max, remaining }
   */
  @Get('quota')
  async getQuota(@GetOrgFromRequest() org: Organization) {
    this.logger.log(`getQuota: org=${org.id}`);
    return this.profileService.getQuota(org.id);
  }

  // ---------------------------------------------------------------------------
  // GET /ayrshare/profiles/:id
  // ---------------------------------------------------------------------------

  /**
   * Get details of a single profile.
   *
   * @param id - Profile record ID
   * @returns Profile record with company/brand details
   */
  @Get(':id')
  async getProfile(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
  ) {
    this.logger.log(`getProfile: org=${org.id} id=${id}`);
    return this.profileService.getProfile(id, org.id);
  }

  // ---------------------------------------------------------------------------
  // POST /ayrshare/profiles
  // ---------------------------------------------------------------------------

  /**
   * Create a new AyrShare profile.
   *
   * Request body:
   *   {
   *     companyId: string,
   *     languageCode: string,     // ISO 639-1: "cs", "sk", "hu", "en"
   *     languageName: string,     // "Czech", "Slovak", "Hungarian", "English"
   *     title: string,            // Display name: "Cadema (Czech)"
   *     brandId?: string,
   *   }
   *
   * Side effects:
   *   - Creates a remote AyrShare profile (sub-account)
   *   - Creates a local AyrShareProfile record
   *   - Creates an Integration record (providerIdentifier: "ayrshare")
   *   - Decrements available profile quota
   *
   * @returns Created profile with linked Integration
   */
  @Post()
  async createProfile(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateAyrShareProfileDto,
  ) {
    this.logger.log(
      `createProfile: org=${org.id} title=${body.title} lang=${body.languageCode}`,
    );
    return this.profileService.createProfile(body, org.id);
  }

  // ---------------------------------------------------------------------------
  // PUT /ayrshare/profiles/:id
  // ---------------------------------------------------------------------------

  /**
   * Update an existing profile.
   *
   * Request body (all fields optional):
   *   {
   *     title?: string,
   *     languageName?: string,
   *     brandId?: string,
   *     enabled?: boolean
   *   }
   *
   * @returns Updated profile
   */
  @Put(':id')
  async updateProfile(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdateAyrShareProfileDto,
  ) {
    this.logger.log(`updateProfile: org=${org.id} id=${id}`);
    return this.profileService.updateProfile(id, body, org.id);
  }

  // ---------------------------------------------------------------------------
  // DELETE /ayrshare/profiles/:id
  // ---------------------------------------------------------------------------

  /**
   * Delete a profile, its linked Integration, and the remote AyrShare profile.
   *
   * @returns { success: true }
   */
  @Delete(':id')
  async deleteProfile(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
  ) {
    this.logger.log(`deleteProfile: org=${org.id} id=${id}`);
    await this.profileService.deleteProfile(id, org.id);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // POST /ayrshare/profiles/:id/link
  // ---------------------------------------------------------------------------

  /**
   * Generate a JWT/SSO URL for social account linking.
   *
   * The user opens this URL in their browser to connect their social accounts
   * through AyrShare's managed OAuth UI. AyrShare handles all platform-specific
   * OAuth flows internally — Postiz never sees platform tokens.
   *
   * When the user links/unlinks accounts, AyrShare sends a webhook notification
   * to update the profile's platforms[] array.
   *
   * Request body:
   *   { domain?: string }  — optional, defaults to FRONTEND_URL env var
   *
   * @returns { url: string } — The SSO URL to open in browser/iframe
   */
  @Post(':id/link')
  async generateLinkUrl(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: { domain?: string },
  ) {
    this.logger.log(`generateLinkUrl: org=${org.id} profile=${id}`);
    const domain =
      body.domain || process.env.FRONTEND_URL || 'http://localhost:4200';
    return this.profileService.generateLinkUrl(id, org.id, domain);
  }

  // ---------------------------------------------------------------------------
  // POST /ayrshare/profiles/:id/unlink
  // ---------------------------------------------------------------------------

  /**
   * Unlink a social platform from a profile.
   *
   * Request body:
   *   { platform: "twitter" | "facebook" | "instagram" | ... }
   *
   * @returns { success: true }
   */
  @Post(':id/unlink')
  async unlinkPlatform(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: { platform: AyrSharePlatform },
  ) {
    this.logger.log(
      `unlinkPlatform: org=${org.id} profile=${id} platform=${body.platform}`,
    );
    await this.profileService.unlinkPlatform(id, org.id, body.platform);
    return { success: true };
  }
}
