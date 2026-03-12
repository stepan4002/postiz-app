/**
 * ContentIngestionCron
 *
 * Cron job that polls all enabled ContentSource records every 15 minutes
 * and fetches new items from each source using the appropriate fetcher.
 *
 * Design decisions:
 * - Guarded by RUN_CRON=true env var — only runs in worker/orchestrator context
 * - Per-source error isolation: one broken source never blocks others
 * - Uses ContentIngestionService.runFetcher() for type-based dispatch
 * - Uses ContentIngestionRepository.createItem() (upsert) to prevent duplicates
 * - Updates lastFetchedAt after each successful source fetch
 *
 * Failure handling:
 * - Errors are caught per source and logged as warnings
 * - The cron cycle always completes, even if multiple sources fail
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ContentIngestionRepository } from './content-ingestion.repository';
import { ContentIngestionService } from './content-ingestion.service';

@Injectable()
export class ContentIngestionCron {
  private readonly logger = new Logger(ContentIngestionCron.name);

  constructor(
    private readonly repository: ContentIngestionRepository,
    private readonly service: ContentIngestionService,
  ) {}

  /**
   * Main cron handler — runs every 15 minutes.
   *
   * Workflow:
   *   1. Guard: skip if RUN_CRON !== 'true'
   *   2. Fetch all enabled sources from the DB
   *   3. For each source, run the appropriate fetcher
   *   4. Upsert returned items into the DB
   *   5. Update lastFetchedAt for the source
   *
   * Each source is processed in a try/catch so a single failure does
   * not interrupt the batch.
   */
  @Cron('*/15 * * * *')
  async handleFetch(): Promise<void> {
    if (process.env.RUN_CRON !== 'true') {
      return;
    }

    this.logger.log('ContentIngestionCron: starting fetch cycle');

    let sources: any[];
    try {
      sources = await this.repository.findEnabledSources();
    } catch (err: any) {
      this.logger.error(
        `ContentIngestionCron: failed to load enabled sources: ${err?.message}`,
      );
      return;
    }

    this.logger.log(`ContentIngestionCron: processing ${sources.length} enabled source(s)`);

    for (const source of sources) {
      await this.processSource(source);
    }

    this.logger.log('ContentIngestionCron: fetch cycle complete');
  }

  /**
   * Process a single source: fetch items, upsert into DB, update lastFetchedAt.
   *
   * Catches all errors so one broken source never blocks the remaining batch.
   * Logs a warning per failure to aid debugging without spamming error logs.
   *
   * @param source - ContentSource record from the DB
   */
  private async processSource(source: {
    id: string;
    name: string;
    type: string;
    url?: string;
  }): Promise<void> {
    try {
      if (source.type === 'manual' || !source.url) {
        // Manual sources and sources without URLs are not polled by the cron.
        // Content for manual sources is added via the API directly.
        return;
      }

      this.logger.log(
        `ContentIngestionCron: fetching source '${source.name}' (${source.type}) — ${source.url}`,
      );

      const items = await this.service.runFetcher(source.type, source.url);

      if (items.length === 0) {
        this.logger.log(
          `ContentIngestionCron: source '${source.name}' returned 0 items — skipping upsert`,
        );
        // Still update lastFetchedAt even when no new items returned
        await this.repository.updateSourceLastFetched(source.id);
        return;
      }

      let savedCount = 0;
      for (const item of items) {
        try {
          await this.repository.createItem({
            sourceId: source.id,
            externalId: item.externalId,
            title: item.title,
            content: item.content,
            url: item.url,
            imageUrl: item.imageUrl,
          });
          savedCount++;
        } catch (itemErr: any) {
          // Log per-item failures but continue with remaining items
          this.logger.warn(
            `ContentIngestionCron: failed to save item '${item.externalId}' ` +
              `for source '${source.name}': ${itemErr?.message}`,
          );
        }
      }

      await this.repository.updateSourceLastFetched(source.id);

      this.logger.log(
        `ContentIngestionCron: source '${source.name}' — saved ${savedCount}/${items.length} item(s)`,
      );
    } catch (err: any) {
      // Per-source error isolation: warn and continue, never throw
      this.logger.warn(
        `ContentIngestionCron: error processing source '${source.name}' (${source.id}): ${err?.message}`,
      );
    }
  }
}
