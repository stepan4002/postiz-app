/**
 * MediaProcessingJob
 *
 * @Cron job that polls the MediaProcessingJob table every 30 seconds for
 * pending variant generation requests and processes them asynchronously.
 *
 * This ensures media processing never blocks web requests — variants are
 * generated in the background on a polling cadence.
 *
 * Status transitions:
 *   pending -> processing -> completed
 *   pending -> processing -> failed (with error message)
 *
 * Job is guarded by RUN_CRON env var — only runs in the orchestrator/worker
 * context, not in the web API server context.
 *
 * TODO: Migrate to Temporal activity in Phase 6
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MediaProcessingService } from './media-processing.service';

@Injectable()
export class MediaProcessingJob {
  private readonly logger = new Logger('MediaProcessingJob');

  constructor(
    private readonly mediaProcessingService: MediaProcessingService,
    private readonly prisma: any
  ) {}

  /**
   * Main cron method. Runs every 30 seconds.
   *
   * Polls for up to 5 pending MediaProcessingJob records (oldest first),
   * processes each one, and updates status accordingly.
   *
   * Errors are caught per-job — one failure never blocks subsequent jobs.
   */
  @Cron('*/30 * * * * *')
  async processPendingJobs(): Promise<void> {
    // Guard: only run in contexts where RUN_CRON is set (orchestrator/worker)
    if (!process.env.RUN_CRON) {
      return;
    }

    const pendingJobs = await this.prisma.mediaProcessingJob.findMany({
      where: { status: 'pending' },
      take: 5,
      orderBy: { createdAt: 'asc' },
    });

    this.logger.log(`MediaProcessingJob: found ${pendingJobs.length} pending job(s)`);

    for (const job of pendingJobs) {
      await this.processJob(job);
    }
  }

  /**
   * Process a single MediaProcessingJob record.
   *
   * Marks as 'processing' first (atomic lease), calls variant generation,
   * then marks as 'completed' or 'failed' based on outcome.
   * Never throws — catches per-job to allow the batch loop to continue.
   */
  private async processJob(job: { id: string; mediaId: string; platforms: string[] }): Promise<void> {
    try {
      // Mark as processing before calling service (prevents duplicate processing)
      await this.prisma.mediaProcessingJob.update({
        where: { id: job.id },
        data: { status: 'processing' },
      });

      await this.mediaProcessingService.generateVariants(job.mediaId, job.platforms);

      await this.prisma.mediaProcessingJob.update({
        where: { id: job.id },
        data: { status: 'completed' },
      });

      this.logger.log(`MediaProcessingJob: completed job ${job.id} for media ${job.mediaId}`);
    } catch (err: any) {
      const errorMessage = err?.message ?? String(err);
      this.logger.error(
        `MediaProcessingJob: job ${job.id} failed for media ${job.mediaId}: ${errorMessage}`
      );

      try {
        await this.prisma.mediaProcessingJob.update({
          where: { id: job.id },
          data: { status: 'failed', error: errorMessage },
        });
      } catch (updateErr: any) {
        // If even the failure update fails, just log — don't throw
        this.logger.error(
          `MediaProcessingJob: failed to update job ${job.id} status to failed: ${updateErr?.message}`
        );
      }
    }
  }
}
