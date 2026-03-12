/**
 * AyrShareAgentService
 *
 * Business logic for the external agent API (OpenClaw integration).
 *
 * Provides a simplified, automation-friendly interface for external agents to:
 * - Create posts across AyrShare-linked social platforms
 * - Manage profiles and their linked accounts
 * - Read analytics and post history
 * - Send DMs through linked social accounts
 * - Check system health and connection status
 *
 * Security: All endpoints require a valid API key passed via
 * `X-Agent-Key` header. The key is validated against the AyrShareConfig
 * for the organization.
 *
 * Pattern: Controller >> Service >> (delegates to existing services/repos)
 */

import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AyrShareConfigService } from '../config/ayrshare-config.service';
import { AyrShareProfileRepository } from '../profile/ayrshare-profile.repository';
import { AyrShareLogRepository } from '../log/ayrshare-log.repository';
import { AyrShareClient } from '../client/ayrshare.client';
import {
  AyrSharePostRequest,
  AyrSharePlatform,
  POSTIZ_TO_AYRSHARE,
} from '../client/ayrshare.types';

// ---------------------------------------------------------------------------
// DTOs for agent requests
// ---------------------------------------------------------------------------

export interface AgentPostRequest {
  /** Organization ID (required for multi-tenant key resolution) */
  organizationId: string;
  /** AyrShare profile key OR profile ID to post through */
  profileKey: string;
  /** Post text content */
  text: string;
  /** Optional: specific platforms to post to (defaults to all linked) */
  platforms?: string[];
  /** Optional: media URLs to attach */
  mediaUrls?: string[];
  /** Optional: schedule date in ISO 8601 UTC */
  scheduleDate?: string;
  /** Optional: platform-specific options */
  platformOptions?: Record<string, any>;
}

export interface AgentPostResponse {
  success: boolean;
  postId?: string;
  platformResults?: Array<{
    platform: string;
    id: string;
    postUrl: string;
    status: string;
  }>;
  error?: string;
}

export interface AgentSendMessageRequest {
  organizationId: string;
  profileKey: string;
  platform: 'facebook' | 'instagram' | 'twitter';
  recipientId: string;
  message: string;
  mediaUrls?: string[];
}

export interface AgentListProfilesRequest {
  organizationId: string;
}

export interface AgentProfileResponse {
  id: string;
  profileKey: string;
  title: string;
  platforms: string[];
  enabled: boolean;
  languageCode: string;
  languageName: string;
}

@Injectable()
export class AyrShareAgentService {
  private readonly logger = new Logger(AyrShareAgentService.name);

  constructor(
    private readonly configService: AyrShareConfigService,
    private readonly profileRepository: AyrShareProfileRepository,
    private readonly logRepository: AyrShareLogRepository,
  ) {}

  // ---------------------------------------------------------------------------
  // Agent key validation
  // ---------------------------------------------------------------------------

  /**
   * Validate the agent API key.
   *
   * The agent key is the same as the AyrShare API key for the organization.
   * This validates that the key matches a stored config.
   *
   * @param agentKey - Key from X-Agent-Key header
   * @param organizationId - Organization ID from the request body
   * @returns true if valid
   * @throws UnauthorizedException if invalid
   */
  async validateAgentKey(
    agentKey: string,
    organizationId: string,
  ): Promise<void> {
    if (!agentKey) {
      throw new UnauthorizedException('Missing X-Agent-Key header');
    }

    try {
      const storedKey = await this.configService.getApiKey(organizationId);
      if (storedKey !== agentKey) {
        throw new UnauthorizedException('Invalid agent key');
      }
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(
        'AyrShare not configured for this organization',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Post operations
  // ---------------------------------------------------------------------------

  /**
   * Create a post through AyrShare on behalf of an external agent.
   */
  async createPost(req: AgentPostRequest): Promise<AgentPostResponse> {
    this.logger.log(
      `createPost: org=${req.organizationId} profile=${req.profileKey} textLen=${req.text?.length}`,
    );

    // Resolve profile
    const profile = await this.profileRepository.findByProfileKey(
      req.profileKey,
    );
    if (!profile) {
      throw new NotFoundException(
        `Profile '${req.profileKey}' not found`,
      );
    }
    if (!profile.enabled) {
      throw new BadRequestException('Profile is disabled');
    }

    // Determine platforms
    let platforms = req.platforms?.length
      ? req.platforms.map((p) => POSTIZ_TO_AYRSHARE[p] || p)
      : [...(profile.platforms || [])];

    if (platforms.length === 0) {
      throw new BadRequestException(
        'No platforms specified and no accounts linked to this profile',
      );
    }

    // Deduplicate
    platforms = [...new Set(platforms)];

    // Get API key
    const apiKey = await this.configService.getApiKey(req.organizationId);
    const client = new AyrShareClient(apiKey, profile.profileKey);

    // Build post request
    const postReq: AyrSharePostRequest = {
      post: req.text,
      platforms: platforms as AyrSharePlatform[],
      ...(req.mediaUrls?.length && { mediaUrls: req.mediaUrls }),
      ...(req.scheduleDate && { scheduleDate: req.scheduleDate }),
    };

    // Apply platform options if provided
    if (req.platformOptions) {
      if (req.platformOptions.youTubeOptions) {
        postReq.youTubeOptions = req.platformOptions.youTubeOptions;
      }
      if (req.platformOptions.redditOptions) {
        postReq.redditOptions = req.platformOptions.redditOptions;
      }
      if (req.platformOptions.pinterestOptions) {
        postReq.pinterestOptions = req.platformOptions.pinterestOptions;
      }
      if (req.platformOptions.instagramOptions) {
        postReq.instagramOptions = req.platformOptions.instagramOptions;
      }
      if (req.platformOptions.linkedInOptions) {
        postReq.linkedInOptions = req.platformOptions.linkedInOptions;
      }
      if (req.platformOptions.tikTokOptions) {
        postReq.tikTokOptions = req.platformOptions.tikTokOptions;
      }
    }

    try {
      const response = await client.createPost(postReq);

      // Log the API call
      await this.logRepository.create({
        profileId: profile.id,
        endpoint: '/post',
        method: 'POST',
        requestPayload: postReq as any,
        responseCode: 200,
        responseBody: response as any,
        ayrsharePostId: response.id,
        status: (response as any).status === 'error' ? 'failed' : 'success',
        errorMessage: (response as any).status === 'error'
          ? (response as any).message
          : undefined,
      });

      if ((response as any).status === 'error') {
        return {
          success: false,
          error: (response as any).message || 'AyrShare API error',
        };
      }

      return {
        success: true,
        postId: response.id,
        platformResults: (response.postIds || []).map((r: any) => ({
          platform: r.platform,
          id: r.id,
          postUrl: r.postUrl || '',
          status: r.status || 'success',
        })),
      };
    } catch (err: any) {
      this.logger.error(`createPost: failed: ${err?.message}`);
      return {
        success: false,
        error: err?.message || 'Unknown error',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Profile operations
  // ---------------------------------------------------------------------------

  /**
   * List all profiles for an organization.
   */
  async listProfiles(
    organizationId: string,
  ): Promise<AgentProfileResponse[]> {
    const profiles =
      await this.profileRepository.findAllByOrganization(organizationId);

    return profiles.map((p: any) => ({
      id: p.id,
      profileKey: p.profileKey,
      title: p.title,
      platforms: p.platforms || [],
      enabled: p.enabled,
      languageCode: p.languageCode,
      languageName: p.languageName,
    }));
  }

  /**
   * Get a single profile.
   */
  async getProfile(profileKey: string): Promise<AgentProfileResponse | null> {
    const p = await this.profileRepository.findByProfileKey(profileKey);
    if (!p) return null;
    return {
      id: p.id,
      profileKey: p.profileKey,
      title: p.title,
      platforms: p.platforms || [],
      enabled: p.enabled,
      languageCode: p.languageCode,
      languageName: p.languageName,
    };
  }

  // ---------------------------------------------------------------------------
  // Messaging operations
  // ---------------------------------------------------------------------------

  /**
   * Send a DM through AyrShare.
   */
  async sendMessage(req: AgentSendMessageRequest): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    this.logger.log(
      `sendMessage: org=${req.organizationId} profile=${req.profileKey} platform=${req.platform}`,
    );

    const profile = await this.profileRepository.findByProfileKey(
      req.profileKey,
    );
    if (!profile) {
      throw new NotFoundException(
        `Profile '${req.profileKey}' not found`,
      );
    }

    const apiKey = await this.configService.getApiKey(req.organizationId);
    const client = new AyrShareClient(apiKey, profile.profileKey);

    try {
      const result = await client.sendMessage(req.platform, {
        recipientId: req.recipientId,
        message: req.message,
        ...(req.mediaUrls?.length && { mediaUrls: req.mediaUrls }),
      });

      if ((result as any).status === 'error') {
        return {
          success: false,
          error: (result as any).message || 'AyrShare API error',
        };
      }

      return {
        success: true,
        messageId: (result as any).id || 'sent',
      };
    } catch (err: any) {
      this.logger.error(`sendMessage: failed: ${err?.message}`);
      return {
        success: false,
        error: err?.message || 'Unknown error',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Analytics operations
  // ---------------------------------------------------------------------------

  /**
   * Get post history for a profile.
   */
  async getHistory(
    organizationId: string,
    profileKey: string,
    platform?: string,
  ): Promise<any[]> {
    const profile = await this.profileRepository.findByProfileKey(profileKey);
    if (!profile) {
      throw new NotFoundException(`Profile '${profileKey}' not found`);
    }

    const apiKey = await this.configService.getApiKey(organizationId);
    const client = new AyrShareClient(apiKey, profile.profileKey);

    return client.getHistory(platform as AyrSharePlatform);
  }
}
