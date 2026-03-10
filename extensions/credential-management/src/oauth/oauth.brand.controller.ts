import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { CredentialService } from '../credential/credential.service';
import { TokenHealthService } from '../health/token.health.service';

/**
 * MVP platforms supported in the brand connection panel.
 * Each platform will appear in the BrandConnectionsResponse even if
 * no SocialAccount exists for it.
 */
const MVP_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x'] as const;

/**
 * OAuthBrandController
 *
 * Bridges Postiz OAuth integration flows to the brand hierarchy.
 * Extends the standard OAuth flow with brand-scoped context by:
 *   1. Storing brandId in Redis during OAuth start (keyed by OAuth state)
 *   2. Retrieving brandId after callback, encrypting tokens, and linking the
 *      new Integration to a SocialAccount on the brand
 *
 * Endpoints:
 *   POST /api/credentials/oauth/start             — initiate brand-scoped OAuth
 *   POST /api/credentials/oauth/callback          — complete brand-scoped OAuth
 *   GET  /api/credentials/brand-connections/:brandId — get per-platform connection state
 *
 * Redis key pattern: brand:{state} -> brandId, TTL 600s
 */
@Controller('credentials')
export class OAuthBrandController {
  private readonly logger = new Logger(OAuthBrandController.name);

  constructor(
    private readonly integrationManager: IntegrationManager,
    private readonly credentialService: CredentialService,
    private readonly prisma: PrismaService,
    private readonly tokenHealthService: TokenHealthService
  ) {}

  /**
   * POST /api/credentials/oauth/start
   *
   * Initiates a brand-scoped OAuth flow:
   * - Validates brandId belongs to the given companyId
   * - Looks up the social provider and generates an auth URL
   * - Stores brandId in Redis keyed by the OAuth state (TTL: 600s)
   * - Also stores organizationId in Redis for the standard upstream callback
   *
   * Body: { provider: string, brandId: string, companyId: string, organizationId: string }
   * Returns: { url: string, state: string }
   */
  @Post('oauth/start')
  async startOAuth(
    @Body()
    body: {
      provider: string;
      brandId: string;
      companyId: string;
      organizationId: string;
    }
  ) {
    const { provider, brandId, companyId, organizationId } = body;

    if (!provider || !brandId || !companyId || !organizationId) {
      throw new HttpException(
        'Missing required fields: provider, brandId, companyId, organizationId',
        HttpStatus.BAD_REQUEST
      );
    }

    // Validate brandId belongs to companyId
    // Cast to any since Brand is a custom model not in standard Prisma generated types
    const brand = await (this.prisma as any).brand.findFirst({
      where: { id: brandId, companyId },
    });
    if (!brand) {
      throw new HttpException(
        `Brand ${brandId} not found in company ${companyId}`,
        HttpStatus.NOT_FOUND
      );
    }

    // Validate provider is supported
    const allProviders = this.integrationManager.getAllowedSocialsIntegrations();
    if (!allProviders.includes(provider)) {
      throw new HttpException(
        `Provider '${provider}' is not supported`,
        HttpStatus.BAD_REQUEST
      );
    }

    const integrationProvider =
      this.integrationManager.getSocialIntegration(provider);

    let authUrlResponse: { url: string; codeVerifier: string; state: string };
    try {
      authUrlResponse = await integrationProvider.generateAuthUrl();
    } catch (err) {
      this.logger.error(`Failed to generate auth URL for provider ${provider}: ${err}`);
      throw new HttpException(
        'Failed to generate OAuth URL',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    const { url, state, codeVerifier } = authUrlResponse;

    // Store brand context in Redis alongside the standard upstream keys
    await ioRedis.set(`brand:${state}`, brandId, 'EX', 600);
    // Standard upstream keys expected by NoAuthIntegrationsController
    await ioRedis.set(`login:${state}`, codeVerifier, 'EX', 600);
    await ioRedis.set(`organization:${state}`, organizationId, 'EX', 600);

    this.logger.log(
      `OAuth start: provider=${provider} brand=${brandId} state=${state}`
    );

    return { url, state };
  }

  /**
   * POST /api/credentials/oauth/callback
   *
   * Completes the brand-scoped OAuth linking after the upstream OAuth callback
   * has already saved the Integration record:
   * - Retrieves brandId from Redis using the OAuth state
   * - Finds the most recently created Integration for org+provider
   * - Encrypts the token and refreshToken via CredentialService
   * - Upserts a SocialAccount linking the integration to the brand
   * - For Meta parent-child (rootInternalId set): links parent integration too
   * - Cleans up the brand:{state} Redis key
   *
   * Body: { provider: string, state: string, organizationId: string }
   * Returns: { success: boolean, integrationId: string } or { success: false, reason: string }
   */
  @Post('oauth/callback')
  async completeOAuth(
    @Body()
    body: {
      provider: string;
      state: string;
      organizationId: string;
    }
  ) {
    const { provider, state, organizationId } = body;

    if (!provider || !state || !organizationId) {
      throw new HttpException(
        'Missing required fields: provider, state, organizationId',
        HttpStatus.BAD_REQUEST
      );
    }

    // Retrieve brandId from Redis
    const brandId = await ioRedis.get(`brand:${state}`);
    if (!brandId) {
      // No brand context — this was a non-brand-scoped connect; ignore
      this.logger.log(
        `OAuth callback: no brand context found for state=${state}, skipping brand linking`
      );
      return { success: false, reason: 'no_brand_context' };
    }

    // Clean up Redis key regardless of outcome
    await ioRedis.del(`brand:${state}`);

    // Find the most recently created Integration for this org+provider
    const integration = await this.prisma.integration.findFirst({
      where: {
        organizationId,
        providerIdentifier: provider,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!integration) {
      this.logger.error(
        `OAuth callback: no integration found for org=${organizationId} provider=${provider}`
      );
      throw new HttpException(
        'Integration not found after OAuth callback',
        HttpStatus.NOT_FOUND
      );
    }

    // Encrypt the tokens stored by the upstream handler
    try {
      await this.credentialService.saveCredential({
        integrationId: integration.id,
        token: integration.token,
        refreshToken: integration.refreshToken || null,
      });
    } catch (err) {
      this.logger.error(
        `OAuth callback: failed to encrypt tokens for integration ${integration.id}: ${err}`
      );
      throw new HttpException(
        'Failed to encrypt integration tokens',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    // Link integration to the brand via SocialAccount
    // Cast to any since SocialAccount is a custom model not in standard Prisma generated types
    await (this.prisma as any).socialAccount.upsert({
      where: {
        brandId_platform: {
          brandId,
          platform: provider,
        },
      },
      create: {
        brandId,
        platform: provider,
        integrationId: integration.id,
        externalId: integration.internalId || null,
        displayName: integration.name || null,
      },
      update: {
        integrationId: integration.id,
        externalId: integration.internalId || null,
        displayName: integration.name || null,
      },
    });

    this.logger.log(
      `OAuth callback: linked integration ${integration.id} to brand ${brandId} (platform=${provider})`
    );

    // Meta parent-child: if this is a page token (has rootInternalId),
    // also find the parent user token Integration and link it
    if (integration.rootInternalId) {
      const parentIntegration = await this.prisma.integration.findFirst({
        where: {
          organizationId,
          internalId: integration.rootInternalId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (parentIntegration) {
        this.logger.log(
          `OAuth callback: Meta parent-child — parent integration ${parentIntegration.id} found via rootInternalId`
        );
        // The parent user token is already tracked via rootInternalId in the DB.
        // Encrypt the parent token too if not yet encrypted.
        // Cast to any: tokenEncrypted is a custom field added via manual migration
        if (!(parentIntegration as any).tokenEncrypted) {
          try {
            await this.credentialService.saveCredential({
              integrationId: parentIntegration.id,
              token: parentIntegration.token,
              refreshToken: parentIntegration.refreshToken || null,
            });
          } catch (err) {
            this.logger.warn(
              `OAuth callback: failed to encrypt parent integration ${parentIntegration.id}: ${err}`
            );
            // Non-fatal — child was linked successfully
          }
        }
      }
    }

    return { success: true, integrationId: integration.id };
  }

  /**
   * GET /api/credentials/brand-connections/:brandId
   *
   * Returns one entry per MVP platform indicating whether the brand has
   * connected that platform and its current token health state.
   *
   * Query pattern:
   * 1. Fetch all SocialAccounts for the brandId
   * 2. For those with an integrationId, fetch the linked Integration
   * 3. Compute TokenHealthState for each connected integration
   * 4. Return exactly 4 entries (one per MVP platform), with connected=false
   *    for platforms that have no SocialAccount, no integrationId, or
   *    whose Integration has been soft-deleted.
   *
   * Returns: { connections: BrandConnection[] }
   * Compatible with useBrandConnections.ts and BrandConnectionsResponse interface.
   */
  @Get('brand-connections/:brandId')
  async getBrandConnections(
    @Param('brandId') brandId: string
  ): Promise<{ connections: Array<{
    platform: string;
    connected: boolean;
    integrationId?: string;
    health?: string;
    displayName?: string;
  }> }> {
    // Fetch all SocialAccounts for this brand
    // Cast to any: SocialAccount is a custom model not in standard Prisma generated types
    const socialAccounts: Array<{
      id: string;
      brandId: string;
      platform: string;
      integrationId: string | null;
      displayName: string | null;
    }> = await (this.prisma as any).socialAccount.findMany({
      where: { brandId },
    });

    // Build a map from platform → SocialAccount for O(1) lookup
    const accountByPlatform = new Map<string, typeof socialAccounts[number]>();
    for (const sa of socialAccounts) {
      accountByPlatform.set(sa.platform, sa);
    }

    // Collect all integrationIds that need to be fetched
    const integrationIds = socialAccounts
      .map((sa) => sa.integrationId)
      .filter((id): id is string => id !== null);

    // Fetch all linked Integrations in one query
    const integrations =
      integrationIds.length > 0
        ? await this.prisma.integration.findMany({
            where: {
              id: { in: integrationIds },
              deletedAt: null,
            },
          })
        : [];

    // Build a map from integrationId → Integration for O(1) lookup
    const integrationById = new Map<string, (typeof integrations)[number]>();
    for (const integration of integrations) {
      integrationById.set(integration.id, integration);
    }

    // Build one connection entry per MVP platform
    const connections = MVP_PLATFORMS.map((platform) => {
      const account = accountByPlatform.get(platform);

      // No SocialAccount for this platform → not connected
      if (!account || !account.integrationId) {
        return { platform, connected: false as const };
      }

      // SocialAccount exists but Integration is missing or soft-deleted → not connected
      const integration = integrationById.get(account.integrationId);
      if (!integration) {
        return { platform, connected: false as const };
      }

      // Compute health state using TokenHealthService
      const health = this.tokenHealthService.getTokenHealth({
        tokenExpiration: (integration as any).tokenExpiration ?? null,
        refreshNeeded: (integration as any).refreshNeeded ?? false,
        consecutiveFailures: (integration as any).consecutiveFailures ?? 0,
      });

      return {
        platform,
        connected: true as const,
        integrationId: integration.id,
        health,
        displayName: account.displayName ?? integration.name ?? undefined,
      };
    });

    this.logger.debug(
      `getBrandConnections: brandId=${brandId} connections=${JSON.stringify(connections.map((c) => ({ platform: c.platform, connected: c.connected })))}`
    );

    return { connections };
  }
}
