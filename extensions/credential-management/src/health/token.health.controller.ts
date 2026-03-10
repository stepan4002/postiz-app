import { Controller, Get, Headers } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { TokenHealthService, TokenHealthState } from './token.health.service';
import dayjs from 'dayjs';

/**
 * Shape returned per-integration by the health endpoint.
 */
export interface TokenHealthItem {
  id: string;
  provider: string;
  name: string;
  picture: string | null;
  brandId: string | null;
  brandName: string | null;
  health: TokenHealthState;
  lastRefreshedAt: string | null;
  expiresAt: string | null;
  consecutiveFailures: number;
  daysUntilExpiry: number | null;
}

/**
 * Full response shape for GET /api/credentials/health.
 */
export interface TokenHealthResponse {
  integrations: TokenHealthItem[];
}

/**
 * TokenHealthController
 *
 * Provides GET /api/credentials/health — returns a list of all connected
 * integrations (non-deleted) with their computed health state, brand context
 * (from SocialAccount → Brand), and expiry information.
 *
 * Optional scoping: if the `x-company-slug` header is present, the
 * CompanyContextMiddleware (registered in app.module.ts) has already
 * resolved the slug to a companyId in CLS. We read that companyId here
 * to filter integrations to only those belonging to organizations under
 * that company.
 *
 * This controller is registered in CredentialManagementModule (Plan 03).
 */
@Controller('credentials')
export class TokenHealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenHealthService: TokenHealthService
  ) {}

  @Get('health')
  async getTokenHealth(
    @Headers('x-company-slug') companySlug?: string
  ): Promise<TokenHealthResponse> {
    // Build the where clause: always exclude soft-deleted integrations
    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    // If a company slug header was provided, look up the company and filter
    // integrations to organizations that belong to that company.
    if (companySlug) {
      const company = await (this.prisma as any).company.findUnique({
        where: { slug: companySlug },
        select: { id: true },
      });

      if (company) {
        // Get org IDs under this company
        const orgs = await this.prisma.organization.findMany({
          where: { companyId: company.id },
          select: { id: true },
        });

        const orgIds = orgs.map((o: { id: string }) => o.id);
        where['organizationId'] = { in: orgIds };
      }
    }

    // Fetch all non-deleted integrations with their organization and
    // SocialAccount join data for brand context.
    const integrations = await this.prisma.integration.findMany({
      where: where as any,
      include: {
        organization: {
          select: {
            id: true,
            companyId: true,
          },
        },
      },
    });

    // Fetch SocialAccounts to derive brand context.
    // SocialAccount links: brandId → Brand, platform → matches Integration.providerIdentifier,
    // integrationId → Integration.id (set after OAuth flow, may be null pre-link).
    // We use integrationId as the primary join key since it's the direct FK.
    const integrationIds = integrations.map((i: any) => i.id);
    const socialAccounts =
      integrationIds.length > 0
        ? await (this.prisma as any).socialAccount.findMany({
            where: {
              integrationId: { in: integrationIds },
            },
            include: {
              brand: {
                select: { id: true, name: true },
              },
            },
          })
        : [];

    // Build a map from integrationId → { brandId, brandName }
    const brandMap = new Map<string, { brandId: string; brandName: string }>();
    for (const sa of socialAccounts) {
      if (sa.integrationId && sa.brand) {
        brandMap.set(sa.integrationId, {
          brandId: sa.brand.id,
          brandName: sa.brand.name,
        });
      }
    }

    // Build the health items
    const items: TokenHealthItem[] = integrations.map((integration: any) => {
      const health = this.tokenHealthService.getTokenHealth({
        tokenExpiration: integration.tokenExpiration,
        refreshNeeded: integration.refreshNeeded,
        consecutiveFailures: integration.consecutiveFailures ?? 0,
      });

      const brandContext = brandMap.get(integration.id) ?? null;

      let daysUntilExpiry: number | null = null;
      if (integration.tokenExpiration) {
        const diff = dayjs(integration.tokenExpiration).diff(dayjs(), 'day');
        daysUntilExpiry = diff;
      }

      return {
        id: integration.id,
        provider: integration.providerIdentifier,
        name: integration.name,
        picture: integration.picture ?? null,
        brandId: brandContext?.brandId ?? null,
        brandName: brandContext?.brandName ?? null,
        health,
        lastRefreshedAt: integration.lastRefreshedAt
          ? integration.lastRefreshedAt.toISOString()
          : null,
        expiresAt: integration.tokenExpiration
          ? integration.tokenExpiration.toISOString()
          : null,
        consecutiveFailures: integration.consecutiveFailures ?? 0,
        daysUntilExpiry,
      };
    });

    return { integrations: items };
  }
}
