/**
 * PublishingWorkerJob
 *
 * Cron job that runs every 30 seconds to process PostVariants in PUBLISHING status.
 *
 * For each PUBLISHING variant:
 * 1. Check backoff: if last attempt is too recent (based on exponential backoff), skip
 * 2. Call PublishingService.publishVariant() to attempt the platform API call
 * 3. On success: update variant to PUBLISHED with platform IDs and publishedAt
 * 4. On retryable failure (< 3 attempts): stay PUBLISHING, increment attempt counters
 * 5. On retryable failure (>= 3 attempts): mark FAILED (max retries exceeded)
 * 6. On permanent failure: mark FAILED immediately (no retry)
 * 7. After all variants processed: update parent ContentPost status if all variants terminal
 *
 * Retry policy (R10.4, NF2.1):
 * - Max 3 attempts per variant
 * - Exponential backoff with jitter: base * 2^(attempt-1) + random(0, base*0.5)
 * - Base delays: attempt 1 = 60s, attempt 2 = 300s (5min), attempt 3 = 900s (15min)
 *
 * Per-variant error isolation: one variant failure never blocks others.
 *
 * Pattern: Follows SchedulerTickJob (@Cron, RUN_CRON guard, per-item isolation)
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PublishingRepository } from './publishing.repository';
import { PublishingService } from './publishing.service';
import { PublishAttemptLogger } from './publish-attempt-logger';

/** Maximum number of publish attempts per variant (R10.4) */
const MAX_ATTEMPTS = 3;

/** Batch size: process up to 50 PUBLISHING variants per tick */
const BATCH_SIZE = 50;

/**
 * Base delays in seconds for exponential backoff.
 * Index = attempt number (1-based): [0] unused, [1] = 60s, [2] = 300s, [3] = 900s
 *
 * After attempt N fails, next attempt must wait at least BASE_DELAYS[N] seconds.
 */
const BASE_DELAYS_SECONDS = [0, 60, 300, 900];

/**
 * Terminal variant statuses — a post's parent status can only be
 * computed once all variants reach one of these states.
 */
const TERMINAL_STATUSES = ['PUBLISHED', 'FAILED', 'STALE'];

@Injectable()
export class PublishingWorkerJob {
  readonly logger = new Logger('PublishingWorkerJob');

  constructor(
    private readonly publishingRepo: PublishingRepository,
    private readonly publishingService: PublishingService,
    private readonly attemptLogger: PublishAttemptLogger,
    private readonly prisma: any,
  ) {}

  /**
   * Main cron method. Runs every 30 seconds.
   *
   * Polls for PUBLISHING variants and processes each one.
   * Guards: Only runs when RUN_CRON env var is set.
   */
  @Cron('*/30 * * * * *')
  async processPublishingVariants(): Promise<void> {
    // Guard: only run in orchestrator/worker contexts where RUN_CRON is set
    if (!process.env.RUN_CRON) {
      return;
    }

    const variants = await this.publishingRepo.findPublishingVariants(BATCH_SIZE);

    if (variants.length === 0) {
      return;
    }

    this.logger.log(`PublishingWorkerJob: found ${variants.length} PUBLISHING variant(s)`);

    // Track which postIds we processed so we can update parent status after
    const processedPostIds = new Set<string>();

    for (const variant of variants) {
      await this.processVariant(variant);
      processedPostIds.add(variant.postId);
    }

    // After all variants: update parent ContentPost status for affected posts
    for (const postId of processedPostIds) {
      await this.updateParentPostStatus(postId);
    }
  }

  /**
   * Process a single PUBLISHING variant.
   *
   * Decision tree:
   * 1. If in backoff window (last attempt too recent) → skip
   * 2. Call publishingService.publishVariant()
   * 3. On success → mark PUBLISHED
   * 4. On retryable failure with attempts < MAX_ATTEMPTS → increment, stay PUBLISHING
   * 5. On retryable failure with attempts >= MAX_ATTEMPTS → mark FAILED
   * 6. On permanent failure → mark FAILED immediately
   *
   * Catches all errors (error isolation — one variant failure never blocks others).
   */
  private async processVariant(variant: any): Promise<void> {
    try {
      // Check backoff: if within backoff window, skip this tick
      const inBackoff = await this.isInBackoffWindow(variant);
      if (inBackoff) {
        this.logger.debug(
          `PublishingWorkerJob: variant ${variant.id} in backoff window — skipping`
        );
        return;
      }

      this.logger.log(
        `PublishingWorkerJob: publishing variant ${variant.id} (platform: ${variant.platform}, attempt: ${variant.publishAttempts + 1})`
      );

      const result = await this.publishingService.publishVariant(variant);
      const newAttemptCount = (variant.publishAttempts ?? 0) + 1;

      // Log every attempt (R10.6: every publish attempt must be logged)
      await this.attemptLogger.logAttempt({
        variantId: variant.id,
        attemptNumber: newAttemptCount,
        timestamp: new Date(),
        success: result.success,
        error: result.error,
        errorType: result.errorType,
      });

      if (result.success) {
        // Success: mark PUBLISHED with platform IDs and timestamp
        await this.publishingRepo.updateVariantPublishResult(variant.id, {
          status: 'PUBLISHED',
          platformPostId: result.platformPostId,
          platformUrl: result.platformUrl,
          publishedAt: new Date(),
          publishAttempts: newAttemptCount,
          consecutiveFailures: 0,
          lastPublishError: null,
        });

        this.logger.log(
          `PublishingWorkerJob: variant ${variant.id} published successfully (platformPostId: ${result.platformPostId})`
        );
      } else {
        // Failure path
        const shouldMarkFailed = !result.retryable || newAttemptCount >= MAX_ATTEMPTS;

        if (shouldMarkFailed) {
          // Mark FAILED — either permanent error or max retries exceeded
          await this.publishingRepo.updateVariantPublishResult(variant.id, {
            status: 'FAILED',
            publishAttempts: newAttemptCount,
            consecutiveFailures: (variant.consecutiveFailures ?? 0) + 1,
            lastPublishError: result.error ?? 'Unknown publish error',
          });

          const reason = !result.retryable
            ? `permanent error: ${result.error}`
            : `max attempts (${MAX_ATTEMPTS}) exceeded: ${result.error}`;

          this.logger.warn(
            `PublishingWorkerJob: variant ${variant.id} marked FAILED — ${reason}`
          );
        } else {
          // Retryable failure with attempts remaining — stay PUBLISHING for next tick
          await this.publishingRepo.updateVariantPublishResult(variant.id, {
            status: 'PUBLISHING',
            publishAttempts: newAttemptCount,
            consecutiveFailures: (variant.consecutiveFailures ?? 0) + 1,
            lastPublishError: result.error ?? 'Unknown publish error',
          });

          const backoffSeconds = this.calculateBackoffSeconds(newAttemptCount);
          this.logger.warn(
            `PublishingWorkerJob: variant ${variant.id} attempt ${newAttemptCount} failed (${result.errorType}) — ` +
            `will retry in ~${backoffSeconds}s`
          );
        }
      }
    } catch (err: any) {
      // Unexpected error — catch to preserve per-variant isolation
      const errorMessage = err?.message ?? String(err);
      this.logger.error(
        `PublishingWorkerJob: unexpected error processing variant ${variant.id}: ${errorMessage}`
      );
      // Do NOT rethrow — one variant failure must not block others
    }
  }

  /**
   * Check if a variant is within its exponential backoff window.
   *
   * Backoff formula: base * 2^(attempt-1) + random(0, base * 0.5)
   * Base delays: 60s, 300s (5min), 900s (15min)
   *
   * Returns true if the variant should be skipped this tick (still cooling off).
   *
   * @param variant - The variant to check
   */
  private async isInBackoffWindow(variant: any): Promise<boolean> {
    const attempts = variant.publishAttempts ?? 0;

    // No prior attempts — no backoff needed
    if (attempts === 0) {
      return false;
    }

    // Get the timestamp of the most recent attempt
    let lastAttempts: any[];
    try {
      lastAttempts = await this.attemptLogger.getAttemptsForVariant(variant.id);
    } catch {
      // If we can't read attempts, don't block — allow processing
      return false;
    }

    if (!lastAttempts || lastAttempts.length === 0) {
      return false;
    }

    const lastAttempt = lastAttempts[0]; // ordered by timestamp desc
    const lastAttemptTime = new Date(lastAttempt.timestamp).getTime();
    const now = Date.now();
    const elapsedSeconds = (now - lastAttemptTime) / 1000;

    // Calculate required backoff for this attempt number
    const requiredBackoffSeconds = this.calculateBackoffSeconds(attempts);

    return elapsedSeconds < requiredBackoffSeconds;
  }

  /**
   * Calculate exponential backoff with jitter in seconds.
   *
   * Formula: base * 2^(attemptNumber-1) + random(0, base * 0.5)
   * Where base is looked up from BASE_DELAYS_SECONDS.
   *
   * Results:
   * - After attempt 1: ~60-90s backoff
   * - After attempt 2: ~300-450s backoff (5-7.5min)
   * - After attempt 3+: ~900-1350s backoff (15-22.5min)
   *
   * @param attemptNumber - The attempt number that just failed (1-based)
   */
  private calculateBackoffSeconds(attemptNumber: number): number {
    const clampedAttempt = Math.min(attemptNumber, BASE_DELAYS_SECONDS.length - 1);
    const base = BASE_DELAYS_SECONDS[clampedAttempt] ?? 900;
    const jitter = Math.random() * base * 0.5;
    return base + jitter;
  }

  /**
   * Update the parent ContentPost status if all its variants have reached terminal state.
   *
   * Terminal states: PUBLISHED, FAILED, STALE
   *
   * - All PUBLISHED -> ContentPost = PUBLISHED
   * - All terminal but any FAILED or STALE -> ContentPost = FAILED
   * - Any non-terminal (SCHEDULED, PUBLISHING, APPROVED, DRAFT) -> no change
   *
   * @param postId - The ContentPost ID to check and potentially update
   */
  private async updateParentPostStatus(postId: string): Promise<void> {
    try {
      const variants = await this.publishingRepo.findVariantsByPostId(postId);

      if (!variants || variants.length === 0) {
        return;
      }

      // Check if all variants are in terminal states
      const allTerminal = variants.every((v: any) => TERMINAL_STATUSES.includes(v.status));

      if (!allTerminal) {
        // Some variants still in progress — don't update parent yet
        return;
      }

      // All terminal: determine parent status
      const anyFailed = variants.some(
        (v: any) => v.status === 'FAILED' || v.status === 'STALE'
      );
      const newPostStatus = anyFailed ? 'FAILED' : 'PUBLISHED';

      await this.publishingRepo.updateContentPostStatus(postId, newPostStatus);

      this.logger.log(
        `PublishingWorkerJob: ContentPost ${postId} marked ${newPostStatus} (all ${variants.length} variants terminal)`
      );
    } catch (err: any) {
      this.logger.error(
        `PublishingWorkerJob: failed to update ContentPost ${postId} status: ${err?.message ?? String(err)}`
      );
    }
  }
}
