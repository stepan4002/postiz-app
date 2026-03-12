/**
 * UploadPostProfileController
 *
 * REST endpoints for Upload-Post profile management.
 * Route prefix: /upload-post/profiles
 *
 * Profiles map Company + Language combinations to Upload-Post usernames.
 * Each profile auto-creates a matching Integration record so it appears
 * in the calendar, scheduling, and analytics UIs.
 *
 * Endpoints:
 *   GET    /upload-post/profiles         — list all profiles for org
 *   GET    /upload-post/profiles/quota    — check remaining profile quota
 *   GET    /upload-post/profiles/:id      — get profile details
 *   POST   /upload-post/profiles          — create new profile
 *   PUT    /upload-post/profiles/:id      — update profile
 *   DELETE /upload-post/profiles/:id      — delete profile + linked Integration
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
import { UploadPostProfileService } from './upload-post-profile.service';
import { CreateProfileDto, UpdateProfileDto } from '../client/upload-post.types';

@Controller('upload-post/profiles')
export class UploadPostProfileController {
  private readonly logger = new Logger(UploadPostProfileController.name);

  constructor(private readonly profileService: UploadPostProfileService) {}

  // ---------------------------------------------------------------------------
  // GET /upload-post/profiles
  // ---------------------------------------------------------------------------

  /**
   * List all Upload-Post profiles for the current organization.
   *
   * @returns Array of profile records with company/brand details
   */
  @Get()
  async listProfiles(@GetOrgFromRequest() org: Organization) {
    this.logger.log(`listProfiles: org=${org.id}`);
    return this.profileService.listProfiles(org.id);
  }

  // ---------------------------------------------------------------------------
  // GET /upload-post/profiles/quota
  // ---------------------------------------------------------------------------

  /**
   * Check the profile quota for the current organization.
   * Must be declared before ':id' to prevent "quota" from being captured as an ID.
   *
   * @returns { used, max, remaining, planType }
   */
  @Get('quota')
  async getQuota(@GetOrgFromRequest() org: Organization) {
    this.logger.log(`getQuota: org=${org.id}`);
    return this.profileService.getQuota(org.id);
  }

  // ---------------------------------------------------------------------------
  // GET /upload-post/profiles/:id
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
  // POST /upload-post/profiles
  // ---------------------------------------------------------------------------

  /**
   * Create a new Upload-Post profile.
   *
   * Request body:
   *   {
   *     companyId: string,
   *     companySlug: string,
   *     languageCode: string,     // ISO 639-1: "cs", "sk", "hu", "en"
   *     languageName: string,     // "Czech", "Slovak", "Hungarian", "English"
   *     brandId?: string,
   *     brandSlug?: string,
   *     platforms: string[],      // ["instagram", "x", "linkedin"]
   *     platformSettings?: object
   *   }
   *
   * Side effects:
   *   - Creates an Integration record (providerIdentifier: "upload-post")
   *   - Decrements available profile quota
   *
   * @returns Created profile with linked Integration
   */
  @Post()
  async createProfile(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateProfileDto,
  ) {
    this.logger.log(`createProfile: org=${org.id} company=${body.companySlug} lang=${body.languageCode}`);
    return this.profileService.createProfile(body, org.id);
  }

  // ---------------------------------------------------------------------------
  // PUT /upload-post/profiles/:id
  // ---------------------------------------------------------------------------

  /**
   * Update an existing profile.
   *
   * Request body (all fields optional):
   *   {
   *     platforms?: string[],
   *     platformSettings?: object,
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
    @Body() body: UpdateProfileDto,
  ) {
    this.logger.log(`updateProfile: org=${org.id} id=${id}`);
    return this.profileService.updateProfile(id, body, org.id);
  }

  // ---------------------------------------------------------------------------
  // DELETE /upload-post/profiles/:id
  // ---------------------------------------------------------------------------

  /**
   * Delete a profile and its linked Integration.
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
}
