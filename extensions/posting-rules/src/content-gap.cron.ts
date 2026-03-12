/**
 * ContentGapCron
 *
 * Daily cron job that detects content gaps for all companies that have
 * at least one enabled posting rule.
 *
 * Schedule: runs once per day at midnight UTC (cron: '0 0 * * *').
 *
 * Guard: only executes when process.env.RUN_CRON === 'true'.
 * This prevents the cron from firing in the main web API process — it should
 * only run in the orchestrator or dedicated worker process. This pattern
 * matches SchedulerTickJob, PublishingWorkerJob, and MediaProcessingJob.
 *
 * Current behaviour: logs gaps to console.
 * Extension point: the `handleGap` method is isolated so future work can
 * send notifications (email, Slack, in-app) without changing the core loop.
 *
 * Error isolation: failures for one company never block processing of
 * subsequent companies.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ContentGapService } from './content-gap.service';

/** Number of days ahead to check for gaps during daily cron run */
const CRON_LOOKAHEAD_DAYS = 7;

@Injectable()
export class ContentGapCron {
  private readonly logger = new Logger(ContentGapCron.name);

  constructor(private readonly contentGapService: ContentGapService) {}

  /**
   * Daily gap detection cron.
   *
   * Runs at midnight UTC every day. Enumerates all companies that have
   * enabled posting rules and detects gaps for the next 7 days for each.
   *
   * Guard: exits immediately if RUN_CRON !== 'true' to avoid running
   * in the web API process (same pattern as SchedulerTickJob).
   */
  @Cron('0 0 * * *')
  async handleDailyGapDetection(): Promise<void> {
    if (process.env.RUN_CRON !== 'true') {
      return;
    }

    this.logger.log('ContentGapCron: starting daily gap detection run');

    // Access the repository through the gap service's reference.
    // We cast through any to reach findCompaniesWithEnabledRules which is
    // not exposed on ContentGapService (it lives in the repository).
    const repo = (this.contentGapService as any).repo;

    let companyIds: string[] = [];
    try {
      companyIds = await repo.findCompaniesWithEnabledRules();
    } catch (err: any) {
      this.logger.error(
        `ContentGapCron: failed to load company list: ${err?.message ?? String(err)}`,
      );
      return;
    }

    this.logger.log(
      `ContentGapCron: processing ${companyIds.length} company(ies) with enabled rules`,
    );

    let totalGaps = 0;
    let processedCompanies = 0;
    let failedCompanies = 0;

    for (const companyId of companyIds) {
      try {
        const gaps = await this.contentGapService.detectGaps(
          companyId,
          CRON_LOOKAHEAD_DAYS,
        );

        totalGaps += gaps.length;
        processedCompanies++;

        if (gaps.length > 0) {
          this.logger.warn(
            `ContentGapCron: company ${companyId} has ${gaps.length} gap(s) in the next ${CRON_LOOKAHEAD_DAYS} days`,
          );

          // Log each gap for observability
          for (const gap of gaps) {
            this.handleGap(companyId, gap);
          }
        } else {
          this.logger.log(
            `ContentGapCron: company ${companyId} — no gaps detected`,
          );
        }
      } catch (err: any) {
        failedCompanies++;
        this.logger.error(
          `ContentGapCron: failed to process company ${companyId}: ${err?.message ?? String(err)}`,
        );
        // Error isolation: continue to next company
      }
    }

    this.logger.log(
      `ContentGapCron: run complete — ` +
      `${processedCompanies} companies processed, ` +
      `${failedCompanies} failed, ` +
      `${totalGaps} total gap(s) detected`,
    );
  }

  /**
   * Handle a single detected gap.
   *
   * Currently logs the gap details to the console.
   * This method is the extension point for future notification integrations
   * (email, Slack, in-app alerts) — replace or augment this logic without
   * touching the main cron loop.
   *
   * @param companyId - The company the gap belongs to
   * @param gap - The detected content gap descriptor
   */
  private handleGap(
    companyId: string,
    gap: {
      date: string;
      platformId: string;
      ruleId: string;
      ruleName: string;
      expectedCount: number;
      actualCount: number;
      gap: number;
    },
  ): void {
    this.logger.warn(
      `ContentGap | company=${companyId} ` +
      `date=${gap.date} ` +
      `platform=${gap.platformId} ` +
      `rule="${gap.ruleName}" (${gap.ruleId}) ` +
      `expected=${gap.expectedCount} ` +
      `actual=${gap.actualCount} ` +
      `gap=${gap.gap}`,
    );
  }
}
