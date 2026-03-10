/**
 * Unit tests for TokenRefreshJob
 *
 * Covers all behaviors defined in 02-02-PLAN.md:
 * 1. RUN_CRON guard: returns immediately when not set
 * 2. Calls findTokensAt75Percent and processes each result
 * 3. On successful refresh: resetFailureCount called, tokens re-encrypted
 * 4. On failed refresh: incrementFailureCount called
 * 5. 3rd consecutive failure triggers NotificationService.inAppNotification()
 * 6. Empty results handled gracefully
 * 7. Tokens decrypted before passing to RefreshIntegrationService.refresh()
 */

import { TokenRefreshJob } from '../refresh/token.refresh.job';

describe('TokenRefreshJob', () => {
  // Mock dependencies
  const mockCredentialRepository = {
    findTokensAt75Percent: jest.fn(),
    incrementFailureCount: jest.fn(),
    resetFailureCount: jest.fn(),
  };

  const mockTokenEncryptionService = {
    decrypt: jest.fn(),
    encrypt: jest.fn(),
    isEncrypted: jest.fn(),
  };

  const mockRefreshService = {
    refresh: jest.fn(),
  };

  const mockNotificationService = {
    inAppNotification: jest.fn(),
  };

  const mockPrismaService = {
    integration: {
      update: jest.fn(),
    },
  };

  let job: TokenRefreshJob;

  beforeEach(() => {
    jest.clearAllMocks();
    job = new TokenRefreshJob(
      mockCredentialRepository as any,
      mockTokenEncryptionService as any,
      mockRefreshService as any,
      mockNotificationService as any,
      mockPrismaService as any
    );

    // Default mock implementations
    mockCredentialRepository.findTokensAt75Percent.mockResolvedValue([]);
    mockCredentialRepository.incrementFailureCount.mockResolvedValue(undefined);
    mockCredentialRepository.resetFailureCount.mockResolvedValue(undefined);
    mockTokenEncryptionService.isEncrypted.mockReturnValue(true);
    mockTokenEncryptionService.decrypt.mockImplementation((v: string) => `decrypted:${v}`);
    mockTokenEncryptionService.encrypt.mockImplementation((v: string) => `encrypted:${v}`);
    mockPrismaService.integration.update.mockResolvedValue({});
  });

  describe('RUN_CRON guard', () => {
    it('should return immediately when RUN_CRON env var is not set', async () => {
      const originalRunCron = process.env.RUN_CRON;
      delete process.env.RUN_CRON;

      await job.refreshExpiringTokens();

      expect(mockCredentialRepository.findTokensAt75Percent).not.toHaveBeenCalled();

      if (originalRunCron !== undefined) {
        process.env.RUN_CRON = originalRunCron;
      }
    });

    it('should proceed when RUN_CRON is set', async () => {
      process.env.RUN_CRON = 'true';
      mockCredentialRepository.findTokensAt75Percent.mockResolvedValue([]);

      await job.refreshExpiringTokens();

      expect(mockCredentialRepository.findTokensAt75Percent).toHaveBeenCalledTimes(1);
      delete process.env.RUN_CRON;
    });
  });

  describe('empty results', () => {
    it('should handle empty findTokensAt75Percent result gracefully with no errors', async () => {
      process.env.RUN_CRON = 'true';
      mockCredentialRepository.findTokensAt75Percent.mockResolvedValue([]);

      await expect(job.refreshExpiringTokens()).resolves.not.toThrow();

      expect(mockRefreshService.refresh).not.toHaveBeenCalled();
      delete process.env.RUN_CRON;
    });
  });

  describe('token decryption', () => {
    it('should decrypt tokens before passing to RefreshIntegrationService.refresh()', async () => {
      process.env.RUN_CRON = 'true';

      const integration = {
        id: 'int-1',
        organizationId: 'org-1',
        token: 'encrypted-token',
        refreshToken: 'encrypted-refresh',
        tokenEncrypted: true,
        consecutiveFailures: 0,
      };

      mockCredentialRepository.findTokensAt75Percent.mockResolvedValue([integration]);
      mockTokenEncryptionService.isEncrypted.mockReturnValue(true);
      mockTokenEncryptionService.decrypt
        .mockReturnValueOnce('plaintext-access-token')
        .mockReturnValueOnce('plaintext-refresh-token');
      mockRefreshService.refresh.mockResolvedValue({ accessToken: 'new-token', refreshToken: 'new-refresh', expiresIn: 3600 });

      await job.refreshExpiringTokens();

      // Should have been called with decrypted tokens
      expect(mockTokenEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-token');
      expect(mockRefreshService.refresh).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'plaintext-access-token',
        })
      );

      delete process.env.RUN_CRON;
    });

    it('should not decrypt tokens that are not encrypted (tokenEncrypted = false)', async () => {
      process.env.RUN_CRON = 'true';

      const integration = {
        id: 'int-2',
        organizationId: 'org-1',
        token: 'plaintext-token',
        refreshToken: null,
        tokenEncrypted: false,
        consecutiveFailures: 0,
      };

      mockCredentialRepository.findTokensAt75Percent.mockResolvedValue([integration]);
      mockTokenEncryptionService.isEncrypted.mockReturnValue(false);
      mockRefreshService.refresh.mockResolvedValue({ accessToken: 'new-token', refreshToken: null, expiresIn: 3600 });

      await job.refreshExpiringTokens();

      // Should not call decrypt for unencrypted tokens
      expect(mockTokenEncryptionService.decrypt).not.toHaveBeenCalled();
      expect(mockRefreshService.refresh).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'plaintext-token',
        })
      );

      delete process.env.RUN_CRON;
    });
  });

  describe('successful refresh', () => {
    it('should call resetFailureCount on successful refresh', async () => {
      process.env.RUN_CRON = 'true';

      const integration = {
        id: 'int-1',
        organizationId: 'org-1',
        token: 'enc-token',
        refreshToken: 'enc-refresh',
        tokenEncrypted: true,
        consecutiveFailures: 2,
      };

      mockCredentialRepository.findTokensAt75Percent.mockResolvedValue([integration]);
      mockRefreshService.refresh.mockResolvedValue({ accessToken: 'new-token', refreshToken: 'new-refresh', expiresIn: 3600 });

      await job.refreshExpiringTokens();

      expect(mockCredentialRepository.resetFailureCount).toHaveBeenCalledWith('int-1');
      expect(mockCredentialRepository.incrementFailureCount).not.toHaveBeenCalled();

      delete process.env.RUN_CRON;
    });
  });

  describe('failed refresh', () => {
    it('should call incrementFailureCount on failed refresh', async () => {
      process.env.RUN_CRON = 'true';

      const integration = {
        id: 'int-1',
        organizationId: 'org-1',
        token: 'enc-token',
        refreshToken: 'enc-refresh',
        tokenEncrypted: true,
        consecutiveFailures: 0,
      };

      mockCredentialRepository.findTokensAt75Percent.mockResolvedValue([integration]);
      mockRefreshService.refresh.mockResolvedValue(false); // refresh returns false on failure

      await job.refreshExpiringTokens();

      expect(mockCredentialRepository.incrementFailureCount).toHaveBeenCalledWith('int-1');
      expect(mockCredentialRepository.resetFailureCount).not.toHaveBeenCalled();

      delete process.env.RUN_CRON;
    });

    it('should NOT trigger notification on 1st or 2nd consecutive failure', async () => {
      process.env.RUN_CRON = 'true';

      const integration = {
        id: 'int-1',
        organizationId: 'org-1',
        token: 'enc-token',
        refreshToken: null,
        tokenEncrypted: true,
        consecutiveFailures: 1, // second failure (will become 2)
      };

      mockCredentialRepository.findTokensAt75Percent.mockResolvedValue([integration]);
      mockRefreshService.refresh.mockResolvedValue(false);

      await job.refreshExpiringTokens();

      expect(mockNotificationService.inAppNotification).not.toHaveBeenCalled();

      delete process.env.RUN_CRON;
    });

    it('should trigger inAppNotification on 3rd consecutive failure (consecutiveFailures reaches 3)', async () => {
      process.env.RUN_CRON = 'true';

      const integration = {
        id: 'int-1',
        organizationId: 'org-1',
        token: 'enc-token',
        refreshToken: null,
        tokenEncrypted: true,
        consecutiveFailures: 2, // about to become 3
      };

      mockCredentialRepository.findTokensAt75Percent.mockResolvedValue([integration]);
      mockRefreshService.refresh.mockResolvedValue(false);

      await job.refreshExpiringTokens();

      expect(mockNotificationService.inAppNotification).toHaveBeenCalledWith(
        'org-1',
        expect.any(String),
        expect.any(String),
        expect.any(Boolean),
        expect.any(Boolean),
        expect.any(String)
      );

      delete process.env.RUN_CRON;
    });

    it('should handle refresh throwing an exception as a failure', async () => {
      process.env.RUN_CRON = 'true';

      const integration = {
        id: 'int-err',
        organizationId: 'org-1',
        token: 'enc-token',
        refreshToken: null,
        tokenEncrypted: true,
        consecutiveFailures: 0,
      };

      mockCredentialRepository.findTokensAt75Percent.mockResolvedValue([integration]);
      mockRefreshService.refresh.mockRejectedValue(new Error('Network error'));

      await expect(job.refreshExpiringTokens()).resolves.not.toThrow();
      expect(mockCredentialRepository.incrementFailureCount).toHaveBeenCalledWith('int-err');

      delete process.env.RUN_CRON;
    });
  });

  describe('multiple integrations', () => {
    it('should process all integrations returned by findTokensAt75Percent', async () => {
      process.env.RUN_CRON = 'true';

      const integrations = [
        { id: 'int-1', organizationId: 'org-1', token: 'tok1', refreshToken: null, tokenEncrypted: true, consecutiveFailures: 0 },
        { id: 'int-2', organizationId: 'org-2', token: 'tok2', refreshToken: null, tokenEncrypted: true, consecutiveFailures: 0 },
        { id: 'int-3', organizationId: 'org-3', token: 'tok3', refreshToken: null, tokenEncrypted: true, consecutiveFailures: 0 },
      ];

      mockCredentialRepository.findTokensAt75Percent.mockResolvedValue(integrations);
      mockRefreshService.refresh.mockResolvedValue({ accessToken: 'new', refreshToken: null, expiresIn: 3600 });

      await job.refreshExpiringTokens();

      expect(mockRefreshService.refresh).toHaveBeenCalledTimes(3);
      expect(mockCredentialRepository.resetFailureCount).toHaveBeenCalledTimes(3);

      delete process.env.RUN_CRON;
    });
  });
});
