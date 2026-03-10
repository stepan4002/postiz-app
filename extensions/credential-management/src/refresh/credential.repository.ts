import { Injectable } from '@nestjs/common';

/**
 * Minimal interface for PrismaService integration table access.
 * The actual PrismaService extends PrismaClient but we use a minimal
 * interface here to allow mocking in tests without importing @prisma/client.
 */
export interface PrismaIntegrationModel {
  integration: {
    findMany(args: object): Promise<any[]>;
    update(args: object): Promise<any>;
  };
}

/**
 * CredentialRepository
 *
 * Database queries for the proactive token refresh job.
 * Handles finding tokens that are past 75% of their lifetime,
 * and updating failure tracking counters on integrations.
 *
 * Used by TokenRefreshJob (Plan 02-02) and health endpoints (Plan 02-04).
 */
@Injectable()
export class CredentialRepository {
  constructor(private readonly prisma: PrismaIntegrationModel) {}

  /**
   * Find integrations whose tokens have passed 75% of their lifetime.
   *
   * The 75% threshold is calculated as:
   *   refreshAt = tokenExpiration - 0.25 * (tokenExpiration - createdAt)
   *   = tokenExpiration * 0.75 + createdAt * 0.25
   *
   * Filters applied:
   * - tokenExpiration IS NOT NULL (only expiring tokens)
   * - deletedAt IS NULL (not soft-deleted)
   * - inBetweenSteps = false (not mid-auth-flow)
   * - refreshNeeded = false (already flagged tokens handled separately)
   * - providerIdentifier != 'x' (X tokens are non-expiring, 999999999 expiresIn)
   * - refreshAt <= now (past 75% threshold)
   * - tokenExpiration > now (not yet expired — expired handled elsewhere)
   *
   * Note: Prisma does not support computed column expressions in WHERE,
   * so we pull all candidate rows (non-expired, non-deleted, non-x) and
   * filter by the 75% threshold in JS. For production scale, a DB view
   * or raw query can replace this.
   */
  async findTokensAt75Percent(): Promise<any[]> {
    const now = new Date();

    const candidates = await this.prisma.integration.findMany({
      where: {
        deletedAt: null,
        inBetweenSteps: false,
        refreshNeeded: false,
        providerIdentifier: { not: 'x' },
        tokenExpiration: {
          not: null,
          gt: now, // exclude already-expired tokens
        },
      },
    });

    // Filter to tokens past 75% of their lifetime
    return candidates.filter((integration) => {
      if (!integration.tokenExpiration || !integration.createdAt) {
        return false;
      }
      const createdAt = new Date(integration.createdAt).getTime();
      const expiresAt = new Date(integration.tokenExpiration).getTime();
      const lifetime = expiresAt - createdAt;

      if (lifetime <= 0) {
        return false;
      }

      // refreshAt = tokenExpiration - 25% of lifetime
      const refreshAt = expiresAt - 0.25 * lifetime;
      return now.getTime() >= refreshAt;
    });
  }

  /**
   * Increment the consecutiveFailures counter for an integration.
   * Called when a token refresh attempt fails.
   */
  async incrementFailureCount(id: string): Promise<void> {
    await this.prisma.integration.update({
      where: { id },
      data: {
        consecutiveFailures: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Reset the consecutiveFailures counter and record the refresh timestamp.
   * Called when a token refresh attempt succeeds.
   */
  async resetFailureCount(id: string): Promise<void> {
    await this.prisma.integration.update({
      where: { id },
      data: {
        consecutiveFailures: 0,
        lastRefreshedAt: new Date(),
      },
    });
  }
}
