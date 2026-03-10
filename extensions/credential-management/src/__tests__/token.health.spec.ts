import { TokenHealthService, TokenHealthState } from '../health/token.health.service';

/**
 * Unit tests for TokenHealthService.getTokenHealth()
 *
 * These tests verify all 7 health state scenarios defined in 02-02-PLAN.md:
 * - refresh_needed: refreshNeeded flag set
 * - expired: tokenExpiration in the past
 * - warning: <7 days remaining OR any consecutive failures
 * - healthy: >7 days remaining, no failures, not expired
 * - healthy: null tokenExpiration (non-expiring provider like X)
 */

describe('TokenHealthService', () => {
  let service: TokenHealthService;

  beforeEach(() => {
    service = new TokenHealthService();
  });

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const baseIntegration = {
    id: 'test-id',
    organizationId: 'org-1',
    token: 'token',
    refreshToken: null,
    tokenExpiration: null,
    refreshNeeded: false,
    inBetweenSteps: false,
    deletedAt: null,
    providerIdentifier: 'linkedin',
    rootInternalId: null,
    lastRefreshedAt: null,
    consecutiveFailures: 0,
    tokenEncrypted: false,
  };

  describe('refresh_needed state', () => {
    it('should return "refresh_needed" when refreshNeeded flag is true', () => {
      const integration = { ...baseIntegration, refreshNeeded: true, tokenExpiration: thirtyDaysFromNow };
      const result: TokenHealthState = service.getTokenHealth(integration);
      expect(result).toBe('refresh_needed');
    });

    it('should return "refresh_needed" even with no expiration when refreshNeeded is true', () => {
      const integration = { ...baseIntegration, refreshNeeded: true, tokenExpiration: null };
      const result: TokenHealthState = service.getTokenHealth(integration);
      expect(result).toBe('refresh_needed');
    });
  });

  describe('expired state', () => {
    it('should return "expired" when tokenExpiration is in the past', () => {
      const integration = { ...baseIntegration, tokenExpiration: yesterday };
      const result: TokenHealthState = service.getTokenHealth(integration);
      expect(result).toBe('expired');
    });
  });

  describe('warning state', () => {
    it('should return "warning" when tokenExpiration is 3 days from now (< 7 days) with 0 failures', () => {
      const integration = { ...baseIntegration, tokenExpiration: threeDaysFromNow, consecutiveFailures: 0 };
      const result: TokenHealthState = service.getTokenHealth(integration);
      expect(result).toBe('warning');
    });

    it('should return "warning" when tokenExpiration is 3 days from now with 1 consecutive failure', () => {
      const integration = { ...baseIntegration, tokenExpiration: threeDaysFromNow, consecutiveFailures: 1 };
      const result: TokenHealthState = service.getTokenHealth(integration);
      expect(result).toBe('warning');
    });

    it('should return "warning" when there are consecutive failures even with 30 days remaining', () => {
      const integration = { ...baseIntegration, tokenExpiration: thirtyDaysFromNow, consecutiveFailures: 1 };
      const result: TokenHealthState = service.getTokenHealth(integration);
      expect(result).toBe('warning');
    });
  });

  describe('healthy state', () => {
    it('should return "healthy" when tokenExpiration is 30 days from now with 0 failures', () => {
      const integration = { ...baseIntegration, tokenExpiration: thirtyDaysFromNow, consecutiveFailures: 0 };
      const result: TokenHealthState = service.getTokenHealth(integration);
      expect(result).toBe('healthy');
    });

    it('should return "healthy" when tokenExpiration is null (non-expiring like X provider)', () => {
      const integration = { ...baseIntegration, tokenExpiration: null, consecutiveFailures: 0 };
      const result: TokenHealthState = service.getTokenHealth(integration);
      expect(result).toBe('healthy');
    });
  });
});

/**
 * Tests for CredentialRepository Prisma query methods.
 * Uses a mocked PrismaService to verify query shape without a real DB connection.
 */
describe('CredentialRepository', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { CredentialRepository } = require('../refresh/credential.repository');

  const mockPrismaService = {
    integration: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  let repo: InstanceType<typeof CredentialRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CredentialRepository(mockPrismaService);
    mockPrismaService.integration.findMany.mockResolvedValue([]);
    mockPrismaService.integration.update.mockResolvedValue({});
  });

  describe('findTokensAt75Percent', () => {
    it('should call integration.findMany with correct base filters', async () => {
      await repo.findTokensAt75Percent();
      expect(mockPrismaService.integration.findMany).toHaveBeenCalledTimes(1);
      const args = mockPrismaService.integration.findMany.mock.calls[0][0];
      // Must filter deleted tokens out
      expect(args.where.deletedAt).toEqual(null);
      // Must not include tokens in between steps
      expect(args.where.inBetweenSteps).toEqual(false);
      // Must exclude tokens that already need refresh
      expect(args.where.refreshNeeded).toEqual(false);
      // Must exclude X provider (non-expiring)
      expect(args.where.providerIdentifier).toEqual(expect.objectContaining({ not: 'x' }));
      // Must only query tokens with an expiration date
      expect(args.where.tokenExpiration).toEqual(expect.objectContaining({ not: null }));
    });
  });

  describe('incrementFailureCount', () => {
    it('should call integration.update with increment operation on consecutiveFailures', async () => {
      await repo.incrementFailureCount('integration-123');
      expect(mockPrismaService.integration.update).toHaveBeenCalledWith({
        where: { id: 'integration-123' },
        data: {
          consecutiveFailures: {
            increment: 1,
          },
        },
      });
    });
  });

  describe('resetFailureCount', () => {
    it('should reset consecutiveFailures to 0 and update lastRefreshedAt', async () => {
      const before = new Date();
      await repo.resetFailureCount('integration-456');
      const after = new Date();

      expect(mockPrismaService.integration.update).toHaveBeenCalledTimes(1);
      const call = mockPrismaService.integration.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'integration-456' });
      expect(call.data.consecutiveFailures).toBe(0);
      // lastRefreshedAt should be a Date between before and after
      expect(call.data.lastRefreshedAt).toBeInstanceOf(Date);
      expect(call.data.lastRefreshedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(call.data.lastRefreshedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
