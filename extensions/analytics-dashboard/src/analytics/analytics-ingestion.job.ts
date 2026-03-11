// ============================================================================
// AnalyticsIngestionJob
// @Cron background job that polls for due metrics snapshots every 5 minutes.
//
// Key design decisions:
// - RUN_CRON guard: only runs when RUN_CRON env var is set (prevent double-running)
// - Per-item error isolation: one variant failure never blocks others
// - BATCH_SIZE=20: conservative batch to avoid API rate limits
// - Logs success/failure counts for observability
// ============================================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './analytics.repository';

@Injectable()
export class AnalyticsIngestionJob {
  private readonly logger = new Logger(AnalyticsIngestionJob.name);
  private static readonly BATCH_SIZE = 20;

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly analyticsRepo: AnalyticsRepository,
  ) {}

  /**
   * Ingest pending metrics snapshots on a 5-minute schedule.
   *
   * Execution flow:
   * 1. Guard: skip if RUN_CRON not set (prevents running in frontend/dev processes)
   * 2. Query due variants from the database (PUBLISHED, snapshot window elapsed)
   * 3. Process each variant independently — catch errors per-item for isolation
   * 4. Log batch summary for observability
   *
   * R11.1: Pulls metrics at T+1h, T+24h, T+7d post-publish via @Cron
   * R11.5: Fully decoupled from PublishingWorkerJob — separate background job
   * NF3.2: No live platform API calls in the controller request path
   */
  @Cron('*/5 * * * *')
  async ingestPendingMetrics(): Promise<void> {
    if (!process.env.RUN_CRON) return; // Critical guard — prevents double-execution

    const due = await this.analyticsRepo.findDueForIngestion(
      AnalyticsIngestionJob.BATCH_SIZE,
    );

    if (due.length === 0) {
      this.logger.debug('Analytics ingestion tick: no variants due for metrics fetch');
      return;
    }

    let successCount = 0;

    for (const item of due) {
      try {
        await this.analyticsService.processVariant(item);
        successCount++;
      } catch (err) {
        // Per-item error isolation: log and continue to next variant
        this.logger.error(
          `Failed to ingest ${item.snapshotType} metrics for variant ${item.variantId} (${item.platform}): ${(err as Error)?.message ?? String(err)}`,
        );
      }
    }

    this.logger.log(
      `Analytics ingestion complete: ${successCount}/${due.length} variants ingested`,
    );
  }
}
