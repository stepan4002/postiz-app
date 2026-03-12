/**
 * AyrShareHealthService
 *
 * Comprehensive health-check and self-test system for the AyrShare integration.
 *
 * Verifies every layer of the integration:
 * 1. API key configuration — is it set and valid?
 * 2. AyrShare API connectivity — can we reach the API?
 * 3. Profiles — are they created and healthy?
 * 4. Social accounts — which platforms are linked per profile?
 * 5. Webhooks — are all webhook types registered?
 * 6. Integration records — do profiles have matching Postiz integrations?
 * 7. Feature flags — are environment variables set correctly?
 *
 * This service is used by:
 * - The agent API health endpoint (/ayrshare/agent/health)
 * - The internal health controller (/ayrshare/health)
 */

import { Injectable, Logger } from '@nestjs/common';
import { AyrShareConfigService } from '../config/ayrshare-config.service';
import { AyrShareProfileRepository } from '../profile/ayrshare-profile.repository';
import { AyrShareWebhookRepository } from '../webhooks/ayrshare-webhook.repository';
import { AyrShareClient } from '../client/ayrshare.client';
import { AyrShareWebhookType } from '../client/ayrshare.types';

// ---------------------------------------------------------------------------
// Health check response types
// ---------------------------------------------------------------------------

export interface HealthCheckResult {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: HealthCheckItem[];
  summary: {
    totalChecks: number;
    passed: number;
    warnings: number;
    failed: number;
  };
}

export interface HealthCheckItem {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: Record<string, any>;
  durationMs?: number;
}

@Injectable()
export class AyrShareHealthService {
  private readonly logger = new Logger(AyrShareHealthService.name);

  constructor(
    private readonly configService: AyrShareConfigService,
    private readonly profileRepository: AyrShareProfileRepository,
    private readonly webhookRepository: AyrShareWebhookRepository,
    private readonly prisma: any,
  ) {}

  // ---------------------------------------------------------------------------
  // Main health check
  // ---------------------------------------------------------------------------

  /**
   * Run a comprehensive health check.
   *
   * @param organizationId - Organization ID to check
   * @returns Full health check result with individual check details
   */
  async runHealthCheck(organizationId: string): Promise<HealthCheckResult> {
    const checks: HealthCheckItem[] = [];

    // 1. Check feature flags
    checks.push(this.checkFeatureFlags());

    // 2. Check API key configuration
    checks.push(await this.checkApiConfig(organizationId));

    // 3. Check AyrShare API connectivity
    checks.push(await this.checkApiConnectivity(organizationId));

    // 4. Check profiles
    checks.push(await this.checkProfiles(organizationId));

    // 5. Check webhook registrations
    checks.push(await this.checkWebhooks(organizationId));

    // 6. Check Integration records alignment
    checks.push(await this.checkIntegrationAlignment(organizationId));

    // 7. Check webhook base URL configuration
    checks.push(this.checkWebhookBaseUrl());

    // Calculate summary
    const passed = checks.filter((c) => c.status === 'pass').length;
    const warnings = checks.filter((c) => c.status === 'warn').length;
    const failed = checks.filter((c) => c.status === 'fail').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (failed > 0) {
      overall = 'unhealthy';
    } else if (warnings > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      timestamp: new Date().toISOString(),
      checks,
      summary: {
        totalChecks: checks.length,
        passed,
        warnings,
        failed,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Individual checks
  // ---------------------------------------------------------------------------

  /**
   * Check that required environment variables / feature flags are set.
   */
  private checkFeatureFlags(): HealthCheckItem {
    const flags = {
      ENABLE_AYRSHARE_GATEWAY: process.env.ENABLE_AYRSHARE_GATEWAY,
      ENABLE_NATIVE_PROVIDERS: process.env.ENABLE_NATIVE_PROVIDERS,
      AYRSHARE_WEBHOOK_BASE_URL: process.env.AYRSHARE_WEBHOOK_BASE_URL,
    };

    const issues: string[] = [];

    if (flags.ENABLE_AYRSHARE_GATEWAY !== 'true') {
      issues.push('ENABLE_AYRSHARE_GATEWAY is not set to "true"');
    }

    if (!flags.AYRSHARE_WEBHOOK_BASE_URL) {
      issues.push('AYRSHARE_WEBHOOK_BASE_URL is not set');
    }

    if (issues.length > 0) {
      return {
        name: 'Feature Flags',
        status: issues.some((i) => i.includes('ENABLE_AYRSHARE'))
          ? 'fail'
          : 'warn',
        message: issues.join('; '),
        details: flags,
      };
    }

    return {
      name: 'Feature Flags',
      status: 'pass',
      message: 'All required feature flags are configured',
      details: flags,
    };
  }

  /**
   * Check that an AyrShare API key is configured for the organization.
   */
  private async checkApiConfig(
    organizationId: string,
  ): Promise<HealthCheckItem> {
    const start = Date.now();
    try {
      const config = await this.configService.getConfig(organizationId);

      if (!config) {
        return {
          name: 'API Configuration',
          status: 'fail',
          message: 'No AyrShare API key configured',
          durationMs: Date.now() - start,
        };
      }

      if (!config.enabled) {
        return {
          name: 'API Configuration',
          status: 'warn',
          message: 'AyrShare configuration exists but is disabled',
          details: { planType: config.planType, maxProfiles: config.maxProfiles },
          durationMs: Date.now() - start,
        };
      }

      return {
        name: 'API Configuration',
        status: 'pass',
        message: `API key configured (${config.planType} plan, ${config.maxProfiles} max profiles)`,
        details: {
          planType: config.planType,
          maxProfiles: config.maxProfiles,
          lastVerifiedAt: config.lastVerifiedAt,
        },
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        name: 'API Configuration',
        status: 'fail',
        message: `Error checking config: ${err?.message}`,
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Check AyrShare API connectivity by listing profiles.
   */
  private async checkApiConnectivity(
    organizationId: string,
  ): Promise<HealthCheckItem> {
    const start = Date.now();
    try {
      const apiKey = await this.configService.getApiKey(organizationId);
      const client = new AyrShareClient(apiKey);

      // Use listProfiles as a lightweight connectivity test
      const profiles = await client.listProfiles();

      return {
        name: 'AyrShare API Connectivity',
        status: 'pass',
        message: `AyrShare API reachable (${Array.isArray(profiles) ? profiles.length : 0} remote profiles)`,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        name: 'AyrShare API Connectivity',
        status: 'fail',
        message: `Cannot reach AyrShare API: ${err?.message}`,
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Check local profile health: count, linked platforms, enabled status.
   */
  private async checkProfiles(
    organizationId: string,
  ): Promise<HealthCheckItem> {
    const start = Date.now();
    try {
      const profiles =
        await this.profileRepository.findAllByOrganization(organizationId);

      if (!profiles || profiles.length === 0) {
        return {
          name: 'Profiles',
          status: 'warn',
          message: 'No AyrShare profiles created yet',
          durationMs: Date.now() - start,
        };
      }

      const active = profiles.filter((p: any) => p.enabled).length;
      const withPlatforms = profiles.filter(
        (p: any) => (p.platforms || []).length > 0,
      ).length;
      const withoutPlatforms = profiles.length - withPlatforms;

      const profileDetails = profiles.map((p: any) => ({
        title: p.title,
        enabled: p.enabled,
        platforms: p.platforms || [],
        platformCount: (p.platforms || []).length,
      }));

      if (withoutPlatforms > 0) {
        return {
          name: 'Profiles',
          status: 'warn',
          message: `${profiles.length} profiles (${active} active), but ${withoutPlatforms} have no linked social accounts`,
          details: { profiles: profileDetails },
          durationMs: Date.now() - start,
        };
      }

      return {
        name: 'Profiles',
        status: 'pass',
        message: `${profiles.length} profiles (${active} active, ${withPlatforms} with linked accounts)`,
        details: { profiles: profileDetails },
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        name: 'Profiles',
        status: 'fail',
        message: `Error checking profiles: ${err?.message}`,
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Check that all profiles have their 3 webhook types registered.
   */
  private async checkWebhooks(
    organizationId: string,
  ): Promise<HealthCheckItem> {
    const start = Date.now();
    try {
      const profiles =
        await this.profileRepository.findAllByOrganization(organizationId);

      if (!profiles || profiles.length === 0) {
        return {
          name: 'Webhooks',
          status: 'pass',
          message: 'No profiles to check webhooks for',
          durationMs: Date.now() - start,
        };
      }

      const expectedTypes: AyrShareWebhookType[] = [
        'scheduled',
        'social',
        'messages',
      ];
      const issues: string[] = [];
      const details: Record<string, any> = {};

      for (const profile of profiles) {
        const subs =
          await this.webhookRepository.findByProfile(profile.id);
        const registeredTypes = subs
          .filter((s: any) => s.active)
          .map((s: any) => s.webhookType);

        const missing = expectedTypes.filter(
          (t) => !registeredTypes.includes(t),
        );

        details[profile.title || profile.id] = {
          registered: registeredTypes,
          missing,
        };

        if (missing.length > 0) {
          issues.push(
            `Profile "${profile.title}": missing webhooks [${missing.join(', ')}]`,
          );
        }
      }

      if (issues.length > 0) {
        return {
          name: 'Webhooks',
          status: 'warn',
          message: `Webhook issues found: ${issues.join('; ')}`,
          details,
          durationMs: Date.now() - start,
        };
      }

      return {
        name: 'Webhooks',
        status: 'pass',
        message: `All ${profiles.length} profiles have all 3 webhook types registered`,
        details,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        name: 'Webhooks',
        status: 'fail',
        message: `Error checking webhooks: ${err?.message}`,
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Check that each AyrShareProfile has a matching Postiz Integration record.
   */
  private async checkIntegrationAlignment(
    organizationId: string,
  ): Promise<HealthCheckItem> {
    const start = Date.now();
    try {
      const profiles =
        await this.profileRepository.findAllByOrganization(organizationId);

      if (!profiles || profiles.length === 0) {
        return {
          name: 'Integration Alignment',
          status: 'pass',
          message: 'No profiles to check integration alignment for',
          durationMs: Date.now() - start,
        };
      }

      const missingIntegration: string[] = [];
      const orphanedIntegration: string[] = [];

      for (const profile of profiles) {
        if (!profile.integrationId) {
          missingIntegration.push(profile.title || profile.id);
        } else {
          // Verify the integration actually exists
          try {
            const integration = await this.prisma.integration.findUnique({
              where: { id: profile.integrationId },
              select: { id: true, providerIdentifier: true },
            });

            if (!integration) {
              orphanedIntegration.push(profile.title || profile.id);
            } else if (integration.providerIdentifier !== 'ayrshare') {
              orphanedIntegration.push(
                `${profile.title || profile.id} (wrong provider: ${integration.providerIdentifier})`,
              );
            }
          } catch {
            orphanedIntegration.push(profile.title || profile.id);
          }
        }
      }

      const issues = [
        ...missingIntegration.map((t) => `"${t}": no Integration record`),
        ...orphanedIntegration.map((t) => `"${t}": orphaned integration`),
      ];

      if (issues.length > 0) {
        return {
          name: 'Integration Alignment',
          status: 'warn',
          message: issues.join('; '),
          details: { missingIntegration, orphanedIntegration },
          durationMs: Date.now() - start,
        };
      }

      return {
        name: 'Integration Alignment',
        status: 'pass',
        message: `All ${profiles.length} profiles have matching Integration records`,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        name: 'Integration Alignment',
        status: 'fail',
        message: `Error checking integration alignment: ${err?.message}`,
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Check that the webhook base URL is properly configured.
   */
  private checkWebhookBaseUrl(): HealthCheckItem {
    const baseUrl = process.env.AYRSHARE_WEBHOOK_BASE_URL;

    if (!baseUrl) {
      return {
        name: 'Webhook Base URL',
        status: 'warn',
        message:
          'AYRSHARE_WEBHOOK_BASE_URL is not set — webhooks may not be reachable',
      };
    }

    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      return {
        name: 'Webhook Base URL',
        status: 'warn',
        message:
          'AYRSHARE_WEBHOOK_BASE_URL points to localhost — webhooks will not work from AyrShare',
        details: { url: baseUrl },
      };
    }

    if (!baseUrl.startsWith('https://')) {
      return {
        name: 'Webhook Base URL',
        status: 'warn',
        message:
          'AYRSHARE_WEBHOOK_BASE_URL is not HTTPS — AyrShare may reject the webhook URL',
        details: { url: baseUrl },
      };
    }

    return {
      name: 'Webhook Base URL',
      status: 'pass',
      message: `Webhook base URL configured: ${baseUrl}`,
      details: { url: baseUrl },
    };
  }
}
