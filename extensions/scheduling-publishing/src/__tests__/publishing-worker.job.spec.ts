/**
 * PublishingWorkerJob unit tests.
 *
 * Tests cron job behaviors:
 * - Test 3: RUN_CRON guard prevents execution when not set
 * - Test 4: Finds PUBLISHING variants and calls publishingService.publishVariant for each
 * - Test 5: On success: updates variant with platformPostId, platformUrl, status=PUBLISHED, publishedAt
 * - Test 6: On retryable failure with attempts < 3: schedules retry (variant stays PUBLISHING with incremented failures)
 * - Test 7: On retryable failure with attempts >= 3: marks FAILED, stores lastPublishError
 * - Test 8: On permanent failure: marks FAILED immediately (no retry)
 * - Test 9: Updates parent ContentPost status when all variants reach terminal state
 * - Test 10: Per-variant error isolation — one failure does not block others
 * - Test 11: Exponential backoff with jitter: base delays 60s, 300s, 900s
 */

import { PublishingWorkerJob } from '../publishing/publishing-worker.job';
import { PublishingRepository } from '../publishing/publishing.repository';
import { PublishingService } from '../publishing/publishing.service';
import { PublishAttemptLogger } from '../publishing/publish-attempt-logger';

describe('PublishingWorkerJob', () => {
  let job: PublishingWorkerJob;
  let mockPublishingRepo: jest.Mocked<PublishingRepository>;
  let mockPublishingService: jest.Mocked<PublishingService>;
  let mockAttemptLogger: jest.Mocked<PublishAttemptLogger>;
  let mockPrisma: any;

  const makeVariant = (overrides: Partial<{
    id: string;
    postId: string;
    platform: string;
    caption: string;
    hashtags: string[];
    status: string;
    publishAttempts: number;
    consecutiveFailures: number;
    lastPublishError: string | null;
    publishedAt: Date | null;
    scheduledAt: Date;
    publishWindowExpiresAt: Date | null;
    platformPostId: string | null;
    platformUrl: string | null;
    post: { id: string; companyId: string; brandId: string };
  }> = {}) => ({
    id: 'variant-1',
    postId: 'post-1',
    platform: 'instagram',
    caption: 'Test caption',
    hashtags: ['#test'],
    status: 'PUBLISHING',
    publishAttempts: 0,
    consecutiveFailures: 0,
    lastPublishError: null,
    publishedAt: null,
    scheduledAt: new Date('2026-03-11T09:00:00Z'),
    publishWindowExpiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    platformPostId: null,
    platformUrl: null,
    post: { id: 'post-1', companyId: 'company-1', brandId: 'brand-1' },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.RUN_CRON;

    mockPublishingRepo = {
      findPublishingVariants: jest.fn(),
      updateVariantPublishResult: jest.fn(),
      findVariantsByPostId: jest.fn(),
      updateContentPostStatus: jest.fn(),
    } as any;

    mockPublishingService = {
      publishVariant: jest.fn(),
    } as any;

    mockAttemptLogger = {
      logAttempt: jest.fn().mockResolvedValue(undefined),
      getAttemptsForVariant: jest.fn(),
    } as any;

    mockPrisma = {};

    job = new PublishingWorkerJob(
      mockPublishingRepo,
      mockPublishingService,
      mockAttemptLogger,
      mockPrisma,
    );
  });

  afterEach(() => {
    delete process.env.RUN_CRON;
    jest.useRealTimers();
  });

  describe('Test 3: RUN_CRON guard prevents execution when not set', () => {
    it('should skip all processing when RUN_CRON env var is not set', async () => {
      // RUN_CRON not set (cleared in beforeEach)
      await job.processPublishingVariants();

      expect(mockPublishingRepo.findPublishingVariants).not.toHaveBeenCalled();
      expect(mockPublishingService.publishVariant).not.toHaveBeenCalled();
    });

    it('should execute when RUN_CRON is set', async () => {
      process.env.RUN_CRON = '1';
      mockPublishingRepo.findPublishingVariants.mockResolvedValue([]);

      await job.processPublishingVariants();

      expect(mockPublishingRepo.findPublishingVariants).toHaveBeenCalled();
    });
  });

  describe('Test 4: Finds PUBLISHING variants and calls publishingService.publishVariant', () => {
    it('should query for PUBLISHING variants with batch size 50', async () => {
      process.env.RUN_CRON = '1';
      mockPublishingRepo.findPublishingVariants.mockResolvedValue([]);

      await job.processPublishingVariants();

      expect(mockPublishingRepo.findPublishingVariants).toHaveBeenCalledWith(50);
    });

    it('should call publishVariant for each found variant', async () => {
      process.env.RUN_CRON = '1';
      const variant1 = makeVariant({ id: 'variant-1' });
      const variant2 = makeVariant({ id: 'variant-2' });

      mockPublishingRepo.findPublishingVariants.mockResolvedValue([variant1 as any, variant2 as any]);
      mockPublishingService.publishVariant.mockResolvedValue({
        success: true,
        platformPostId: 'post-123',
        platformUrl: 'https://instagram.com/p/123',
        retryable: false,
      });
      mockPublishingRepo.updateVariantPublishResult.mockResolvedValue({} as any);
      mockPublishingRepo.findVariantsByPostId.mockResolvedValue([
        { ...variant1, status: 'PUBLISHED' },
        { ...variant2, status: 'PUBLISHED' },
      ] as any);
      mockPublishingRepo.updateContentPostStatus.mockResolvedValue({} as any);

      await job.processPublishingVariants();

      expect(mockPublishingService.publishVariant).toHaveBeenCalledTimes(2);
      expect(mockPublishingService.publishVariant).toHaveBeenCalledWith(variant1);
      expect(mockPublishingService.publishVariant).toHaveBeenCalledWith(variant2);
    });
  });

  describe('Test 5: On success — updates variant with PUBLISHED status', () => {
    it('should update variant to PUBLISHED with platformPostId, platformUrl, publishedAt', async () => {
      process.env.RUN_CRON = '1';
      const variant = makeVariant();

      mockPublishingRepo.findPublishingVariants.mockResolvedValue([variant as any]);
      mockPublishingService.publishVariant.mockResolvedValue({
        success: true,
        platformPostId: 'insta-post-456',
        platformUrl: 'https://instagram.com/p/456',
        retryable: false,
      });
      mockPublishingRepo.updateVariantPublishResult.mockResolvedValue({} as any);
      mockPublishingRepo.findVariantsByPostId.mockResolvedValue([
        { ...variant, status: 'PUBLISHED' },
      ] as any);
      mockPublishingRepo.updateContentPostStatus.mockResolvedValue({} as any);

      await job.processPublishingVariants();

      expect(mockPublishingRepo.updateVariantPublishResult).toHaveBeenCalledWith(
        'variant-1',
        expect.objectContaining({
          status: 'PUBLISHED',
          platformPostId: 'insta-post-456',
          platformUrl: 'https://instagram.com/p/456',
          publishedAt: expect.any(Date),
        })
      );
    });

    it('should log the successful attempt', async () => {
      process.env.RUN_CRON = '1';
      const variant = makeVariant();

      mockPublishingRepo.findPublishingVariants.mockResolvedValue([variant as any]);
      mockPublishingService.publishVariant.mockResolvedValue({
        success: true,
        platformPostId: 'post-789',
        platformUrl: 'https://instagram.com/p/789',
        retryable: false,
      });
      mockPublishingRepo.updateVariantPublishResult.mockResolvedValue({} as any);
      mockPublishingRepo.findVariantsByPostId.mockResolvedValue([
        { ...variant, status: 'PUBLISHED' },
      ] as any);
      mockPublishingRepo.updateContentPostStatus.mockResolvedValue({} as any);

      await job.processPublishingVariants();

      expect(mockAttemptLogger.logAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          variantId: 'variant-1',
          success: true,
          attemptNumber: 1,
        })
      );
    });
  });

  describe('Test 6: On retryable failure with attempts < 3 — stays PUBLISHING', () => {
    it('should increment publishAttempts and consecutiveFailures on retryable failure', async () => {
      process.env.RUN_CRON = '1';
      const variant = makeVariant({ publishAttempts: 1, consecutiveFailures: 1 });

      mockPublishingRepo.findPublishingVariants.mockResolvedValue([variant as any]);
      mockPublishingService.publishVariant.mockResolvedValue({
        success: false,
        error: 'Rate limit hit',
        retryable: true,
        errorType: 'rate_limit',
      });
      mockPublishingRepo.updateVariantPublishResult.mockResolvedValue({} as any);
      // After update: still PUBLISHING
      mockPublishingRepo.findVariantsByPostId.mockResolvedValue([
        { ...variant, status: 'PUBLISHING', publishAttempts: 2 },
      ] as any);

      await job.processPublishingVariants();

      expect(mockPublishingRepo.updateVariantPublishResult).toHaveBeenCalledWith(
        'variant-1',
        expect.objectContaining({
          status: 'PUBLISHING',
          publishAttempts: 2,
          consecutiveFailures: 2,
          lastPublishError: 'Rate limit hit',
        })
      );
    });

    it('should NOT mark FAILED when attempts < 3 and error is retryable', async () => {
      process.env.RUN_CRON = '1';
      const variant = makeVariant({ publishAttempts: 1 });

      mockPublishingRepo.findPublishingVariants.mockResolvedValue([variant as any]);
      mockPublishingService.publishVariant.mockResolvedValue({
        success: false,
        error: 'Transient error',
        retryable: true,
        errorType: 'transient',
      });
      mockPublishingRepo.updateVariantPublishResult.mockResolvedValue({} as any);
      mockPublishingRepo.findVariantsByPostId.mockResolvedValue([
        { ...variant, status: 'PUBLISHING' },
      ] as any);

      await job.processPublishingVariants();

      const updateCall = mockPublishingRepo.updateVariantPublishResult.mock.calls[0];
      expect(updateCall[1].status).toBe('PUBLISHING');
    });
  });

  describe('Test 7: On retryable failure with attempts >= 3 — marks FAILED', () => {
    it('should mark FAILED when publishAttempts reaches 3', async () => {
      process.env.RUN_CRON = '1';
      // Already has 2 attempts, this will be the 3rd
      const variant = makeVariant({ publishAttempts: 2, consecutiveFailures: 2 });

      mockPublishingRepo.findPublishingVariants.mockResolvedValue([variant as any]);
      mockPublishingService.publishVariant.mockResolvedValue({
        success: false,
        error: 'Still rate limited',
        retryable: true,
        errorType: 'rate_limit',
      });
      mockPublishingRepo.updateVariantPublishResult.mockResolvedValue({} as any);
      mockPublishingRepo.findVariantsByPostId.mockResolvedValue([
        { ...variant, status: 'FAILED' },
      ] as any);
      mockPublishingRepo.updateContentPostStatus.mockResolvedValue({} as any);

      await job.processPublishingVariants();

      expect(mockPublishingRepo.updateVariantPublishResult).toHaveBeenCalledWith(
        'variant-1',
        expect.objectContaining({
          status: 'FAILED',
          lastPublishError: 'Still rate limited',
        })
      );
    });

    it('should store lastPublishError on max attempts reached', async () => {
      process.env.RUN_CRON = '1';
      const variant = makeVariant({ publishAttempts: 2 });

      mockPublishingRepo.findPublishingVariants.mockResolvedValue([variant as any]);
      mockPublishingService.publishVariant.mockResolvedValue({
        success: false,
        error: 'API temporarily unavailable',
        retryable: true,
        errorType: 'transient',
      });
      mockPublishingRepo.updateVariantPublishResult.mockResolvedValue({} as any);
      mockPublishingRepo.findVariantsByPostId.mockResolvedValue([
        { ...variant, status: 'FAILED' },
      ] as any);
      mockPublishingRepo.updateContentPostStatus.mockResolvedValue({} as any);

      await job.processPublishingVariants();

      const updateArgs = mockPublishingRepo.updateVariantPublishResult.mock.calls[0][1];
      expect(updateArgs.status).toBe('FAILED');
      expect(updateArgs.lastPublishError).toBe('API temporarily unavailable');
    });
  });

  describe('Test 8: On permanent failure — marks FAILED immediately', () => {
    it('should mark FAILED immediately on permanent error (no retry)', async () => {
      process.env.RUN_CRON = '1';
      // Only 0 attempts — but permanent failure goes straight to FAILED
      const variant = makeVariant({ publishAttempts: 0 });

      mockPublishingRepo.findPublishingVariants.mockResolvedValue([variant as any]);
      mockPublishingService.publishVariant.mockResolvedValue({
        success: false,
        error: 'Account suspended',
        retryable: false,
        errorType: 'permanent',
      });
      mockPublishingRepo.updateVariantPublishResult.mockResolvedValue({} as any);
      mockPublishingRepo.findVariantsByPostId.mockResolvedValue([
        { ...variant, status: 'FAILED' },
      ] as any);
      mockPublishingRepo.updateContentPostStatus.mockResolvedValue({} as any);

      await job.processPublishingVariants();

      expect(mockPublishingRepo.updateVariantPublishResult).toHaveBeenCalledWith(
        'variant-1',
        expect.objectContaining({
          status: 'FAILED',
          lastPublishError: 'Account suspended',
        })
      );
    });

    it('should not retry permanent failure even when attempts < 3', async () => {
      process.env.RUN_CRON = '1';
      const variant = makeVariant({ publishAttempts: 0 });

      mockPublishingRepo.findPublishingVariants.mockResolvedValue([variant as any]);
      mockPublishingService.publishVariant.mockResolvedValue({
        success: false,
        error: 'Content violates policies',
        retryable: false,
        errorType: 'permanent',
      });
      mockPublishingRepo.updateVariantPublishResult.mockResolvedValue({} as any);
      mockPublishingRepo.findVariantsByPostId.mockResolvedValue([
        { ...variant, status: 'FAILED' },
      ] as any);
      mockPublishingRepo.updateContentPostStatus.mockResolvedValue({} as any);

      await job.processPublishingVariants();

      const updateArgs = mockPublishingRepo.updateVariantPublishResult.mock.calls[0][1];
      // Status must be FAILED, not PUBLISHING (no retry)
      expect(updateArgs.status).toBe('FAILED');
    });
  });

  describe('Test 9: Updates parent ContentPost status on terminal state', () => {
    it('should update parent ContentPost to PUBLISHED when all variants are PUBLISHED', async () => {
      process.env.RUN_CRON = '1';
      const variant = makeVariant();

      mockPublishingRepo.findPublishingVariants.mockResolvedValue([variant as any]);
      mockPublishingService.publishVariant.mockResolvedValue({
        success: true,
        platformPostId: 'post-123',
        platformUrl: 'https://instagram.com/p/123',
        retryable: false,
      });
      mockPublishingRepo.updateVariantPublishResult.mockResolvedValue({} as any);
      // All variants are now PUBLISHED
      mockPublishingRepo.findVariantsByPostId.mockResolvedValue([
        { ...variant, status: 'PUBLISHED' },
      ] as any);
      mockPublishingRepo.updateContentPostStatus.mockResolvedValue({} as any);

      await job.processPublishingVariants();

      expect(mockPublishingRepo.updateContentPostStatus).toHaveBeenCalledWith(
        'post-1',
        'PUBLISHED'
      );
    });

    it('should update parent ContentPost to FAILED when any variant is FAILED and all are terminal', async () => {
      process.env.RUN_CRON = '1';
      const variant = makeVariant({ publishAttempts: 2 });

      mockPublishingRepo.findPublishingVariants.mockResolvedValue([variant as any]);
      mockPublishingService.publishVariant.mockResolvedValue({
        success: false,
        error: 'Rate limit',
        retryable: true,
        errorType: 'rate_limit',
      });
      mockPublishingRepo.updateVariantPublishResult.mockResolvedValue({} as any);
      // All variants are now terminal (FAILED)
      mockPublishingRepo.findVariantsByPostId.mockResolvedValue([
        { ...variant, status: 'FAILED' },
      ] as any);
      mockPublishingRepo.updateContentPostStatus.mockResolvedValue({} as any);

      await job.processPublishingVariants();

      expect(mockPublishingRepo.updateContentPostStatus).toHaveBeenCalledWith(
        'post-1',
        'FAILED'
      );
    });

    it('should NOT update parent ContentPost when some variants are still PUBLISHING', async () => {
      process.env.RUN_CRON = '1';
      const variant = makeVariant({ publishAttempts: 0 });

      mockPublishingRepo.findPublishingVariants.mockResolvedValue([variant as any]);
      mockPublishingService.publishVariant.mockResolvedValue({
        success: true,
        platformPostId: 'post-123',
        platformUrl: 'https://instagram.com/p/123',
        retryable: false,
      });
      mockPublishingRepo.updateVariantPublishResult.mockResolvedValue({} as any);
      // Another variant is still PUBLISHING
      mockPublishingRepo.findVariantsByPostId.mockResolvedValue([
        { ...variant, status: 'PUBLISHED' },
        { ...variant, id: 'variant-2', status: 'PUBLISHING' },
      ] as any);

      await job.processPublishingVariants();

      // Should NOT update parent status because variant-2 is still PUBLISHING
      expect(mockPublishingRepo.updateContentPostStatus).not.toHaveBeenCalled();
    });
  });

  describe('Test 10: Per-variant error isolation', () => {
    it('should not throw when one variant causes an unhandled exception', async () => {
      process.env.RUN_CRON = '1';
      const variant1 = makeVariant({ id: 'variant-1' });
      const variant2 = makeVariant({ id: 'variant-2' });

      mockPublishingRepo.findPublishingVariants.mockResolvedValue([variant1 as any, variant2 as any]);

      // variant-1 causes an unhandled error (service throws unexpectedly)
      mockPublishingService.publishVariant
        .mockRejectedValueOnce(new Error('Unexpected service error'))
        .mockResolvedValueOnce({
          success: true,
          platformPostId: 'post-123',
          platformUrl: 'https://instagram.com/p/123',
          retryable: false,
        });
      mockPublishingRepo.updateVariantPublishResult.mockResolvedValue({} as any);
      mockPublishingRepo.findVariantsByPostId.mockResolvedValue([
        { ...variant2, status: 'PUBLISHED' },
      ] as any);
      mockPublishingRepo.updateContentPostStatus.mockResolvedValue({} as any);

      // Must not throw
      await expect(job.processPublishingVariants()).resolves.not.toThrow();
    });

    it('should process variant2 even when variant1 throws', async () => {
      process.env.RUN_CRON = '1';
      const variant1 = makeVariant({ id: 'variant-1' });
      const variant2 = makeVariant({ id: 'variant-2' });

      mockPublishingRepo.findPublishingVariants.mockResolvedValue([variant1 as any, variant2 as any]);

      mockPublishingService.publishVariant
        .mockRejectedValueOnce(new Error('Service crashed'))
        .mockResolvedValueOnce({
          success: true,
          platformPostId: 'post-456',
          platformUrl: 'https://instagram.com/p/456',
          retryable: false,
        });

      mockPublishingRepo.updateVariantPublishResult.mockResolvedValue({} as any);
      mockPublishingRepo.findVariantsByPostId.mockResolvedValue([
        { ...variant2, status: 'PUBLISHED' },
      ] as any);
      mockPublishingRepo.updateContentPostStatus.mockResolvedValue({} as any);

      await job.processPublishingVariants();

      // publishVariant called for both variants
      expect(mockPublishingService.publishVariant).toHaveBeenCalledTimes(2);
      // variant-2 should have been updated
      expect(mockPublishingRepo.updateVariantPublishResult).toHaveBeenCalledWith(
        'variant-2',
        expect.objectContaining({ status: 'PUBLISHED' })
      );
    });
  });

  describe('Test 11: Exponential backoff with jitter', () => {
    it('should skip a variant that is within its backoff window (attempt 1 = 60s base)', async () => {
      process.env.RUN_CRON = '1';
      jest.useFakeTimers();

      // Simulate: 1 attempt already done 10s ago (within 60s backoff)
      const now = new Date('2026-03-11T10:00:00Z');
      jest.setSystemTime(now);

      // Variant with 1 attempt done 10s ago — still within 60s backoff
      const variant = makeVariant({
        publishAttempts: 1,
        consecutiveFailures: 1,
        lastPublishError: 'Transient error',
      });

      mockPublishingRepo.findPublishingVariants.mockResolvedValue([variant as any]);

      // Provide lastAttemptAt via mock attempts
      mockAttemptLogger.getAttemptsForVariant.mockResolvedValue([
        {
          id: 'a1',
          variantId: 'variant-1',
          attemptNumber: 1,
          timestamp: new Date(now.getTime() - 10 * 1000), // 10s ago
          success: false,
        },
      ] as any);

      await job.processPublishingVariants();

      // Since we're still within the 60s backoff window, publishVariant should NOT be called
      expect(mockPublishingService.publishVariant).not.toHaveBeenCalled();
    });

    it('should process a variant after its backoff window has passed', async () => {
      process.env.RUN_CRON = '1';
      jest.useFakeTimers();

      const now = new Date('2026-03-11T10:00:00Z');
      jest.setSystemTime(now);

      // Variant with 1 attempt done 120s ago — past 60s backoff
      const variant = makeVariant({
        publishAttempts: 1,
        consecutiveFailures: 1,
      });

      mockPublishingRepo.findPublishingVariants.mockResolvedValue([variant as any]);

      mockAttemptLogger.getAttemptsForVariant.mockResolvedValue([
        {
          id: 'a1',
          variantId: 'variant-1',
          attemptNumber: 1,
          timestamp: new Date(now.getTime() - 120 * 1000), // 120s ago — past 60s backoff
          success: false,
        },
      ] as any);

      mockPublishingService.publishVariant.mockResolvedValue({
        success: true,
        platformPostId: 'post-123',
        platformUrl: 'https://instagram.com/p/123',
        retryable: false,
      });
      mockPublishingRepo.updateVariantPublishResult.mockResolvedValue({} as any);
      mockPublishingRepo.findVariantsByPostId.mockResolvedValue([
        { ...variant, status: 'PUBLISHED' },
      ] as any);
      mockPublishingRepo.updateContentPostStatus.mockResolvedValue({} as any);

      await job.processPublishingVariants();

      // Should process now that backoff has passed
      expect(mockPublishingService.publishVariant).toHaveBeenCalledWith(variant);
    });
  });
});
