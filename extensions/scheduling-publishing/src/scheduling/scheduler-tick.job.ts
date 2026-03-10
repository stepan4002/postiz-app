/**
 * SchedulerTickJob
 *
 * Cron job that runs every minute to discover PostVariant records that are
 * due for publishing and transitions them from SCHEDULED to PUBLISHING status.
 *
 * Responsibilities:
 * 1. Find all SCHEDULED variants with scheduledAt <= now (due for publishing)
 * 2. For each due variant:
 *    a. Skip if platformPostId is not null (already published — idempotency R10.3)
 *    b. If publishWindowExpiresAt has passed — mark as STALE (window expired)
 *    c. Otherwise — mark as PUBLISHING (handoff to PublishingWorkerJob)
 *
 * STALE vs FAILED distinction (per user decision in CONTEXT.md):
 * - STALE = publish window expired before any publish attempt (scheduler couldn't pick it up)
 * - FAILED = platform API returned an error during an active PUBLISHING attempt
 * Both appear in the dashboard but with different messages and resolution paths.
 *
 * Note: This job does NOT call platform APIs directly.
 * It only transitions SCHEDULED -> PUBLISHING or SCHEDULED -> STALE.
 * The actual publishing is handled by PublishingWorkerJob (Plan 04) which
 * polls for PUBLISHING status variants and calls platform adapters.
 *
 * Pattern: Follows MediaProcessingJob (@Cron, RUN_CRON guard, per-item error isolation)
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SchedulingRepository } from './scheduling.repository';

/** Batch size: process up to 50 due variants per tick to avoid overwhelming platform APIs */
const BATCH_SIZE = 50;

@Injectable()
export class SchedulerTickJob {
  readonly logger = new Logger('SchedulerTickJob');

  constructor(private readonly repository: SchedulingRepository) {}

  /**
   * Main cron method. Runs every minute.
   *
   * Finds due PostVariant records (SCHEDULED + scheduledAt <= now) in batches
   * of 50 and transitions each one to PUBLISHING or STALE.
   *
   * Guards:
   * - Only runs when RUN_CRON env var is set (prevents execution in web API context)
   * - Skips variants with platformPostId set (idempotency — already processed)
   *
   * Errors are caught per-variant — one failure never blocks subsequent variants.
   */
  @Cron('*/1 * * * *')
  async processDueVariants(): Promise<void> {
    // Guard: only run in orchestrator/worker contexts where RUN_CRON is set
    if (!process.env.RUN_CRON) {
      return;
    }

    const dueVariants = await this.repository.findDueVariants(BATCH_SIZE);

    this.logger.log(`SchedulerTickJob: found ${dueVariants.length} due variant(s)`);

    let publishingCount = 0;
    let staleCount = 0;
    let skippedCount = 0;

    const now = new Date();

    for (const variant of dueVariants) {
      await this.processDueVariant(variant, now, (action) => {
        if (action === 'publishing') publishingCount++;
        else if (action === 'stale') staleCount++;
        else if (action === 'skipped') skippedCount++;
      });
    }

    // Log summary of the tick
    this.logger.log(
      `SchedulerTickJob: processed ${dueVariants.length} variants — ` +
      `${publishingCount} marked publishing, ${staleCount} stale, ${skippedCount} already published`
    );
  }

  /**
   * Process a single due variant.
   *
   * Decision tree:
   * 1. platformPostId is set -> skip (idempotent: already published)
   * 2. publishWindowExpiresAt < now -> mark STALE (window expired)
   * 3. Otherwise -> mark PUBLISHING (ready for platform adapter)
   *
   * Never throws — catches errors and logs them to allow batch to continue.
   */
  private async processDueVariant(
    variant: any,
    now: Date,
    countFn: (action: 'publishing' | 'stale' | 'skipped') => void
  ): Promise<void> {
    try {
      // R10.3 Idempotency check: skip if already published externally
      if (variant.platformPostId != null) {
        this.logger.log(
          `SchedulerTickJob: skipping variant ${variant.id} — already has platformPostId ${variant.platformPostId}`
        );
        countFn('skipped');
        return;
      }

      // Check publish window: if expired, transition to STALE
      if (variant.publishWindowExpiresAt && variant.publishWindowExpiresAt < now) {
        await this.repository.markVariantStale(variant.id);
        this.logger.log(
          `SchedulerTickJob: variant ${variant.id} window expired at ${variant.publishWindowExpiresAt.toISOString()} — marked STALE`
        );
        countFn('stale');
        return;
      }

      // Window is still open — transition to PUBLISHING
      await this.repository.markVariantPublishing(variant.id);
      this.logger.log(
        `SchedulerTickJob: variant ${variant.id} marked PUBLISHING (scheduledAt: ${variant.scheduledAt?.toISOString()})`
      );
      countFn('publishing');
    } catch (err: any) {
      const errorMessage = err?.message ?? String(err);
      this.logger.error(
        `SchedulerTickJob: failed to process variant ${variant.id}: ${errorMessage}`
      );
      // Do NOT rethrow — error isolation: one variant failure must not block others
    }
  }
}
