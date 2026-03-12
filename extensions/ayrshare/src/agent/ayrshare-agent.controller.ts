/**
 * AyrShareAgentController
 *
 * External agent API for automated social media operations.
 * Route prefix: /ayrshare/agent
 *
 * Designed for the OpenClaw agent system (and any external automation tool)
 * to programmatically trigger social media actions through the AyrShare gateway.
 *
 * Authentication: Requires `X-Agent-Key` header containing the AyrShare API key
 * for the target organization. This is validated on every request.
 *
 * Endpoints:
 *   POST /ayrshare/agent/post         — Create a post across linked platforms
 *   GET  /ayrshare/agent/profiles     — List available profiles
 *   GET  /ayrshare/agent/profiles/:key — Get a single profile
 *   POST /ayrshare/agent/message      — Send a DM
 *   GET  /ayrshare/agent/history      — Get post history
 *   GET  /ayrshare/agent/health       — System health check (delegates to health service)
 */

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  AyrShareAgentService,
  AgentPostRequest,
  AgentSendMessageRequest,
} from './ayrshare-agent.service';
import { AyrShareHealthService } from '../health/ayrshare-health.service';

@Controller('ayrshare/agent')
export class AyrShareAgentController {
  private readonly logger = new Logger(AyrShareAgentController.name);

  constructor(
    private readonly agentService: AyrShareAgentService,
    private readonly healthService: AyrShareHealthService,
  ) {}

  // ---------------------------------------------------------------------------
  // Post operations
  // ---------------------------------------------------------------------------

  /**
   * Create a post across AyrShare-linked platforms.
   *
   * Body: AgentPostRequest
   * Headers: X-Agent-Key (required)
   *
   * Example:
   * ```json
   * {
   *   "organizationId": "org_abc123",
   *   "profileKey": "profile_xyz",
   *   "text": "Hello from OpenClaw!",
   *   "platforms": ["twitter", "facebook"],
   *   "mediaUrls": ["https://example.com/image.jpg"],
   *   "scheduleDate": "2026-03-15T10:00:00Z"
   * }
   * ```
   */
  @Post('post')
  @HttpCode(HttpStatus.OK)
  async createPost(
    @Body() body: AgentPostRequest,
    @Headers('x-agent-key') agentKey: string,
  ) {
    this.logger.log(
      `createPost: org=${body.organizationId} profile=${body.profileKey}`,
    );

    await this.agentService.validateAgentKey(agentKey, body.organizationId);
    return this.agentService.createPost(body);
  }

  // ---------------------------------------------------------------------------
  // Profile operations
  // ---------------------------------------------------------------------------

  /**
   * List all profiles for an organization.
   *
   * Query: organizationId (required)
   * Headers: X-Agent-Key (required)
   */
  @Get('profiles')
  async listProfiles(
    @Query('organizationId') organizationId: string,
    @Headers('x-agent-key') agentKey: string,
  ) {
    this.logger.log(`listProfiles: org=${organizationId}`);
    await this.agentService.validateAgentKey(agentKey, organizationId);
    return this.agentService.listProfiles(organizationId);
  }

  /**
   * Get a single profile by profile key.
   *
   * Query: organizationId (required)
   * Headers: X-Agent-Key (required)
   */
  @Get('profiles/:profileKey')
  async getProfile(
    @Param('profileKey') profileKey: string,
    @Query('organizationId') organizationId: string,
    @Headers('x-agent-key') agentKey: string,
  ) {
    this.logger.log(`getProfile: key=${profileKey}`);
    await this.agentService.validateAgentKey(agentKey, organizationId);
    return this.agentService.getProfile(profileKey);
  }

  // ---------------------------------------------------------------------------
  // Messaging operations
  // ---------------------------------------------------------------------------

  /**
   * Send a DM through a linked social account.
   *
   * Body: AgentSendMessageRequest
   * Headers: X-Agent-Key (required)
   *
   * Supported platforms: facebook, instagram, twitter (X)
   */
  @Post('message')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Body() body: AgentSendMessageRequest,
    @Headers('x-agent-key') agentKey: string,
  ) {
    this.logger.log(
      `sendMessage: org=${body.organizationId} platform=${body.platform}`,
    );

    await this.agentService.validateAgentKey(agentKey, body.organizationId);
    return this.agentService.sendMessage(body);
  }

  // ---------------------------------------------------------------------------
  // History / Analytics
  // ---------------------------------------------------------------------------

  /**
   * Get post history for a profile.
   *
   * Query: organizationId, profileKey, platform (optional)
   * Headers: X-Agent-Key (required)
   */
  @Get('history')
  async getHistory(
    @Query('organizationId') organizationId: string,
    @Query('profileKey') profileKey: string,
    @Query('platform') platform: string,
    @Headers('x-agent-key') agentKey: string,
  ) {
    this.logger.log(`getHistory: org=${organizationId} profile=${profileKey}`);
    await this.agentService.validateAgentKey(agentKey, organizationId);
    return this.agentService.getHistory(organizationId, profileKey, platform);
  }

  // ---------------------------------------------------------------------------
  // Health check
  // ---------------------------------------------------------------------------

  /**
   * Run a comprehensive health check on the AyrShare integration.
   *
   * Query: organizationId (required)
   * Headers: X-Agent-Key (required)
   *
   * Returns status of: API key, profiles, webhooks, AyrShare API connectivity.
   */
  @Get('health')
  async healthCheck(
    @Query('organizationId') organizationId: string,
    @Headers('x-agent-key') agentKey: string,
  ) {
    this.logger.log(`healthCheck: org=${organizationId}`);
    await this.agentService.validateAgentKey(agentKey, organizationId);
    return this.healthService.runHealthCheck(organizationId);
  }
}
