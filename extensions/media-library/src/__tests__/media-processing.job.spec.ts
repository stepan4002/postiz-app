/**
 * MediaProcessingJob unit tests.
 *
 * Tests cron job behaviors:
 * - RUN_CRON guard
 * - Pending job polling
 * - Status transitions: pending -> processing -> completed/failed
 * - Per-job error isolation (no propagation)
 * - Continues to next job after error
 *
 * Mocks: PrismaService (mediaProcessingJob), MediaProcessingService
 */

import { MediaProcessingJob } from '../processing/media-processing.job';
import { MediaProcessingService } from '../processing/media-processing.service';

describe('MediaProcessingJob', () => {
  let job: MediaProcessingJob;
  let mockPrisma: any;
  let mockProcessingService: jest.Mocked<Partial<MediaProcessingService>>;

  const mockJob1 = {
    id: 'job-1',
    mediaId: 'media-1',
    platforms: ['facebook', 'linkedin'],
    status: 'pending',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockJob2 = {
    id: 'job-2',
    mediaId: 'media-2',
    platforms: ['instagram'],
    status: 'pending',
    createdAt: new Date('2026-01-01T00:01:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Ensure RUN_CRON is not set between tests
    delete process.env.RUN_CRON;

    mockPrisma = {
      mediaProcessingJob: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    mockProcessingService = {
      generateVariants: jest.fn(),
    };

    job = new MediaProcessingJob(
      mockProcessingService as any,
      mockPrisma
    );
  });

  afterEach(() => {
    delete process.env.RUN_CRON;
  });

  describe('processPendingJobs', () => {
    describe('RUN_CRON guard', () => {
      it('should skip execution when RUN_CRON env var is not set', async () => {
        // RUN_CRON is not set (cleared in beforeEach)
        await job.processPendingJobs();

        expect(mockPrisma.mediaProcessingJob.findMany).not.toHaveBeenCalled();
        expect(mockProcessingService.generateVariants).not.toHaveBeenCalled();
      });

      it('should execute when RUN_CRON is set', async () => {
        process.env.RUN_CRON = '1';
        mockPrisma.mediaProcessingJob.findMany.mockResolvedValue([]);

        await job.processPendingJobs();

        expect(mockPrisma.mediaProcessingJob.findMany).toHaveBeenCalled();
      });
    });

    describe('pending job polling', () => {
      beforeEach(() => {
        process.env.RUN_CRON = '1';
        mockPrisma.mediaProcessingJob.update.mockResolvedValue({});
        (mockProcessingService.generateVariants as jest.Mock).mockResolvedValue(undefined);
      });

      it('should poll DB for up to 5 pending jobs in ascending createdAt order', async () => {
        mockPrisma.mediaProcessingJob.findMany.mockResolvedValue([]);

        await job.processPendingJobs();

        expect(mockPrisma.mediaProcessingJob.findMany).toHaveBeenCalledWith({
          where: { status: 'pending' },
          take: 5,
          orderBy: { createdAt: 'asc' },
        });
      });

      it('should process all pending jobs in the batch', async () => {
        mockPrisma.mediaProcessingJob.findMany.mockResolvedValue([mockJob1, mockJob2]);

        await job.processPendingJobs();

        expect(mockProcessingService.generateVariants).toHaveBeenCalledTimes(2);
        expect(mockProcessingService.generateVariants).toHaveBeenCalledWith('media-1', ['facebook', 'linkedin']);
        expect(mockProcessingService.generateVariants).toHaveBeenCalledWith('media-2', ['instagram']);
      });
    });

    describe('status transitions', () => {
      beforeEach(() => {
        process.env.RUN_CRON = '1';
        mockPrisma.mediaProcessingJob.update.mockResolvedValue({});
        (mockProcessingService.generateVariants as jest.Mock).mockResolvedValue(undefined);
      });

      it('should mark job as processing before calling service', async () => {
        const callOrder: string[] = [];

        mockPrisma.mediaProcessingJob.update.mockImplementation((args: any) => {
          callOrder.push(`update:${args.data.status}`);
          return Promise.resolve({});
        });

        (mockProcessingService.generateVariants as jest.Mock).mockImplementation(() => {
          callOrder.push('generateVariants');
          return Promise.resolve();
        });

        mockPrisma.mediaProcessingJob.findMany.mockResolvedValue([mockJob1]);

        await job.processPendingJobs();

        // processing update must happen BEFORE generateVariants
        const processingIdx = callOrder.indexOf('update:processing');
        const generateIdx = callOrder.indexOf('generateVariants');
        expect(processingIdx).toBeLessThan(generateIdx);
      });

      it('should mark job as completed after successful variant generation', async () => {
        mockPrisma.mediaProcessingJob.findMany.mockResolvedValue([mockJob1]);

        await job.processPendingJobs();

        expect(mockPrisma.mediaProcessingJob.update).toHaveBeenCalledWith({
          where: { id: 'job-1' },
          data: { status: 'processing' },
        });
        expect(mockPrisma.mediaProcessingJob.update).toHaveBeenCalledWith({
          where: { id: 'job-1' },
          data: { status: 'completed' },
        });
      });

      it('should mark job as failed with error message on exception', async () => {
        const error = new Error('Sharp processing failed: corrupt input');
        (mockProcessingService.generateVariants as jest.Mock).mockRejectedValue(error);
        mockPrisma.mediaProcessingJob.findMany.mockResolvedValue([mockJob1]);

        await job.processPendingJobs();

        expect(mockPrisma.mediaProcessingJob.update).toHaveBeenCalledWith({
          where: { id: 'job-1' },
          data: { status: 'failed', error: error.message },
        });
      });
    });

    describe('error isolation', () => {
      beforeEach(() => {
        process.env.RUN_CRON = '1';
        mockPrisma.mediaProcessingJob.update.mockResolvedValue({});
      });

      it('should not throw when a job fails — catches errors per-job', async () => {
        const error = new Error('MinIO connection refused');
        (mockProcessingService.generateVariants as jest.Mock).mockRejectedValue(error);
        mockPrisma.mediaProcessingJob.findMany.mockResolvedValue([mockJob1]);

        // Must not throw
        await expect(job.processPendingJobs()).resolves.not.toThrow();
      });

      it('should continue processing next job when first job fails', async () => {
        // Job 1 fails, job 2 succeeds
        (mockProcessingService.generateVariants as jest.Mock)
          .mockRejectedValueOnce(new Error('Job 1 failed'))
          .mockResolvedValueOnce(undefined);

        mockPrisma.mediaProcessingJob.findMany.mockResolvedValue([mockJob1, mockJob2]);

        await job.processPendingJobs();

        // Both jobs should have been attempted
        expect(mockProcessingService.generateVariants).toHaveBeenCalledTimes(2);

        // Job 1 should be failed
        expect(mockPrisma.mediaProcessingJob.update).toHaveBeenCalledWith({
          where: { id: 'job-1' },
          data: { status: 'failed', error: 'Job 1 failed' },
        });

        // Job 2 should be completed
        expect(mockPrisma.mediaProcessingJob.update).toHaveBeenCalledWith({
          where: { id: 'job-2' },
          data: { status: 'completed' },
        });
      });
    });
  });
});
