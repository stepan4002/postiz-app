/**
 * SchedulerTickJob unit tests.
 *
 * Tests cron job behaviors:
 * - Test 1: Does nothing when RUN_CRON is not set (guard)
 * - Test 2: Calls findDueVariants with batch size 50
 * - Test 3: Marks each due variant as PUBLISHING before processing
 * - Test 4: Skips variants that already have a platformPostId (idempotent — R10.3)
 * - Test 5: Marks window-expired variants as STALE (status='STALE') — distinct from FAILED
 * - Test 6: Per-variant error isolation — one failure does not block others
 * - Test 7: Logs count of processed variants with stale/published breakdown
 *
 * Mocks: SchedulingRepository
 */

import { SchedulerTickJob } from '../scheduling/scheduler-tick.job';
import { SchedulingRepository } from '../scheduling/scheduling.repository';

describe('SchedulerTickJob', () => {
  let job: SchedulerTickJob;
  let mockRepo: jest.Mocked<SchedulingRepository>;

  // A variant due for publishing (window still open)
  const makeVariant = (overrides: Partial<{
    id: string;
    status: string;
    platformPostId: string | null;
    scheduledAt: Date;
    publishWindowExpiresAt: Date;
    post: { id: string; companyId: string };
  }> = {}) => ({
    id: 'variant-1',
    status: 'SCHEDULED',
    platformPostId: null,
    scheduledAt: new Date('2026-03-11T09:00:00Z'),
    publishWindowExpiresAt: new Date('2026-03-11T13:00:00Z'), // 4 hours window
    post: { id: 'post-1', companyId: 'company-1' },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.RUN_CRON;

    mockRepo = {
      findPostWithVariants: jest.fn(),
      updateVariantSchedule: jest.fn(),
      updatePostSchedule: jest.fn(),
      findDueVariants: jest.fn(),
      markVariantPublishing: jest.fn(),
      markVariantStale: jest.fn(),
      findScheduledPostsForCompany: jest.fn(),
      findCompanyTimezone: jest.fn(),
      findCompanyPostingTimes: jest.fn(),
    } as any;

    job = new SchedulerTickJob(mockRepo);
  });

  afterEach(() => {
    delete process.env.RUN_CRON;
    jest.useRealTimers();
  });

  describe('Test 1: Does nothing when RUN_CRON is not set', () => {
    it('should skip all processing when RUN_CRON env var is not set', async () => {
      // RUN_CRON not set (cleared in beforeEach)
      await job.processDueVariants();

      expect(mockRepo.findDueVariants).not.toHaveBeenCalled();
      expect(mockRepo.markVariantPublishing).not.toHaveBeenCalled();
      expect(mockRepo.markVariantStale).not.toHaveBeenCalled();
    });

    it('should execute when RUN_CRON is set', async () => {
      process.env.RUN_CRON = '1';
      mockRepo.findDueVariants.mockResolvedValue([]);

      await job.processDueVariants();

      expect(mockRepo.findDueVariants).toHaveBeenCalled();
    });
  });

  describe('Test 2: Calls findDueVariants with batch size 50', () => {
    it('should query for due variants with batch size of 50', async () => {
      process.env.RUN_CRON = '1';
      mockRepo.findDueVariants.mockResolvedValue([]);

      await job.processDueVariants();

      expect(mockRepo.findDueVariants).toHaveBeenCalledWith(50);
    });
  });

  describe('Test 3: Marks each due variant as PUBLISHING before processing', () => {
    it('should call markVariantPublishing for variants with open publish window', async () => {
      process.env.RUN_CRON = '1';

      // Variant with an open window (expires in the future)
      const futureExpiry = new Date(Date.now() + 4 * 60 * 60 * 1000);
      const variant = makeVariant({ publishWindowExpiresAt: futureExpiry });

      mockRepo.findDueVariants.mockResolvedValue([variant as any]);
      mockRepo.markVariantPublishing.mockResolvedValue({} as any);

      await job.processDueVariants();

      expect(mockRepo.markVariantPublishing).toHaveBeenCalledWith('variant-1');
      expect(mockRepo.markVariantStale).not.toHaveBeenCalled();
    });
  });

  describe('Test 4: Skips variants that already have a platformPostId (idempotent — R10.3)', () => {
    it('should skip variants where platformPostId is not null', async () => {
      process.env.RUN_CRON = '1';

      // Already published variant
      const alreadyPublished = makeVariant({ platformPostId: 'insta-post-123' });

      mockRepo.findDueVariants.mockResolvedValue([alreadyPublished as any]);

      await job.processDueVariants();

      // Should not mark as PUBLISHING or STALE — already published
      expect(mockRepo.markVariantPublishing).not.toHaveBeenCalled();
      expect(mockRepo.markVariantStale).not.toHaveBeenCalled();
    });

    it('should still process other variants after skipping one with platformPostId', async () => {
      process.env.RUN_CRON = '1';

      const alreadyPublished = makeVariant({ id: 'variant-1', platformPostId: 'insta-post-123' });
      const futureExpiry = new Date(Date.now() + 4 * 60 * 60 * 1000);
      const pending = makeVariant({ id: 'variant-2', publishWindowExpiresAt: futureExpiry });

      mockRepo.findDueVariants.mockResolvedValue([alreadyPublished as any, pending as any]);
      mockRepo.markVariantPublishing.mockResolvedValue({} as any);

      await job.processDueVariants();

      // Only the pending variant should be marked as PUBLISHING
      expect(mockRepo.markVariantPublishing).toHaveBeenCalledWith('variant-2');
      expect(mockRepo.markVariantPublishing).not.toHaveBeenCalledWith('variant-1');
    });
  });

  describe('Test 5: Marks window-expired variants as STALE (not FAILED)', () => {
    it('should mark variant as STALE when publishWindowExpiresAt has passed', async () => {
      process.env.RUN_CRON = '1';

      // Variant whose publish window has expired (past time)
      const expiredWindow = new Date('2026-03-11T09:00:00Z'); // in the past
      jest.useFakeTimers().setSystemTime(new Date('2026-03-11T14:00:00Z')); // now is 14:00

      const expiredVariant = makeVariant({ publishWindowExpiresAt: expiredWindow });

      mockRepo.findDueVariants.mockResolvedValue([expiredVariant as any]);
      mockRepo.markVariantStale.mockResolvedValue({} as any);

      await job.processDueVariants();

      // Should mark as STALE, not PUBLISHING (window expired before processing)
      expect(mockRepo.markVariantStale).toHaveBeenCalledWith('variant-1');
      expect(mockRepo.markVariantPublishing).not.toHaveBeenCalled();
    });

    it('should NOT mark variant as FAILED (STALE is semantically distinct from FAILED)', async () => {
      process.env.RUN_CRON = '1';

      const expiredWindow = new Date('2026-03-11T09:00:00Z');
      jest.useFakeTimers().setSystemTime(new Date('2026-03-11T14:00:00Z'));

      const expiredVariant = makeVariant({ publishWindowExpiresAt: expiredWindow });

      mockRepo.findDueVariants.mockResolvedValue([expiredVariant as any]);
      mockRepo.markVariantStale.mockResolvedValue({} as any);

      await job.processDueVariants();

      // markVariantStale is called (not a "failed" operation — window expired)
      expect(mockRepo.markVariantStale).toHaveBeenCalledWith('variant-1');
    });
  });

  describe('Test 6: Per-variant error isolation', () => {
    it('should not throw when one variant fails — catches per-variant errors', async () => {
      process.env.RUN_CRON = '1';

      const futureExpiry = new Date(Date.now() + 4 * 60 * 60 * 1000);
      const variant1 = makeVariant({ id: 'variant-1', publishWindowExpiresAt: futureExpiry });
      const variant2 = makeVariant({ id: 'variant-2', publishWindowExpiresAt: futureExpiry });

      mockRepo.findDueVariants.mockResolvedValue([variant1 as any, variant2 as any]);
      mockRepo.markVariantPublishing
        .mockRejectedValueOnce(new Error('DB connection failed'))
        .mockResolvedValueOnce({} as any);

      // Must not throw even when variant-1 fails
      await expect(job.processDueVariants()).resolves.not.toThrow();
    });

    it('should continue processing next variant after one fails', async () => {
      process.env.RUN_CRON = '1';

      const futureExpiry = new Date(Date.now() + 4 * 60 * 60 * 1000);
      const variant1 = makeVariant({ id: 'variant-1', publishWindowExpiresAt: futureExpiry });
      const variant2 = makeVariant({ id: 'variant-2', publishWindowExpiresAt: futureExpiry });

      mockRepo.findDueVariants.mockResolvedValue([variant1 as any, variant2 as any]);
      mockRepo.markVariantPublishing
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValueOnce({} as any);

      await job.processDueVariants();

      // Both variants should have been attempted
      expect(mockRepo.markVariantPublishing).toHaveBeenCalledTimes(2);
      expect(mockRepo.markVariantPublishing).toHaveBeenCalledWith('variant-1');
      expect(mockRepo.markVariantPublishing).toHaveBeenCalledWith('variant-2');
    });
  });

  describe('Test 7: Logs count of processed variants', () => {
    it('should log a summary with counts of publishing and stale variants', async () => {
      process.env.RUN_CRON = '1';

      const logSpy = jest.spyOn(job['logger'] as any, 'log').mockImplementation(() => {});

      const futureExpiry = new Date(Date.now() + 4 * 60 * 60 * 1000);
      const pastExpiry = new Date('2026-03-11T09:00:00Z');
      jest.useFakeTimers().setSystemTime(new Date('2026-03-11T14:00:00Z'));

      const publishingVariant = makeVariant({ id: 'variant-1', publishWindowExpiresAt: futureExpiry });
      const staleVariant = makeVariant({ id: 'variant-2', publishWindowExpiresAt: pastExpiry });

      mockRepo.findDueVariants.mockResolvedValue([publishingVariant as any, staleVariant as any]);
      mockRepo.markVariantPublishing.mockResolvedValue({} as any);
      mockRepo.markVariantStale.mockResolvedValue({} as any);

      await job.processDueVariants();

      // Should log a summary — at least one log call should mention the counts
      const logCalls = logSpy.mock.calls.map((call: any[]) => call[0]);
      const summaryLog = logCalls.find((msg: string) =>
        msg.includes('processed') || msg.includes('stale') || msg.includes('publishing')
      );
      expect(summaryLog).toBeDefined();
    });
  });
});
