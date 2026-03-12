/**
 * InboxCron
 *
 * Scheduled job that polls platform integrations for new inbox items
 * (comments, DMs, mentions, reviews) every 10 minutes.
 *
 * Architecture:
 * - Uses @nestjs/schedule's @Cron decorator
 * - Guarded by RUN_CRON env var — only executes in orchestrator/worker contexts
 * - Iterates over all active company integrations via Prisma
 * - For each integration, finds a registered adapter that can handle it
 * - Fetches new items since the last successful run
 * - Persists normalized items via InboxRepository (upsert — idempotent)
 *
 * Current state:
 * - No platform adapters are registered yet (StubInboxAdapter.canFetch() = false)
 * - The cron tick logs its execution to confirm it is running correctly
 * - Real platform adapters (Instagram, Facebook, etc.) will be registered in
 *   an AdapterRegistry once the corresponding platform APIs are integrated
 *
 * Error handling:
 * - Errors are caught per-integration — one failure never blocks others
 * - The entire cron job is wrapped in a try/catch so a top-level failure
 *   cannot crash the process
 *
 * Pattern:
 * - Follows SchedulerTickJob and MediaProcessingJob patterns established in
 *   scheduling-publishing and media-library extensions
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InboxRepository } from './inbox.repository';
import { BaseInboxAdapter } from './adapters/base.adapter';
import { StubInboxAdapter } from './adapters/stub.adapter';

/** How far back to look for new items on the first fetch (fallback when no items exist yet) */
const DEFAULT_LOOKBACK_HOURS = 24;

@Injectable()
export class InboxCron {
  private readonly logger = new Logger('InboxCron');

  /**
   * Registered platform adapters.
   * Currently contains only the StubInboxAdapter — add real adapters here
   * as platform integrations are built out.
   */
  private readonly adapters: BaseInboxAdapter[] = [
    new StubInboxAdapter(),
  ];

  constructor(
    private readonly inboxRepository: InboxRepository,
    private readonly prisma: any,
  ) {}

  /**
   * Main cron handler. Runs every 10 minutes.
   *
   * Responsibilities:
   * 1. Check RUN_CRON guard — exit early if not in a worker context
   * 2. Query all active integrations from the database
   * 3. For each integration, find a registered adapter via canFetch()
   * 4. Fetch items since the last known item's receivedAt (or DEFAULT_LOOKBACK_HOURS)
   * 5. Persist new/updated items via InboxRepository.create() (upsert)
   *
   * Currently, with only the StubInboxAdapter registered (canFetch = false),
   * step 3 will always skip — no actual fetching occurs. This is the intended
   * safe-default behavior until real adapters are wired in.
   */
  @Cron('*/10 * * * *')
  async handleInboxFetch(): Promise<void> {
    // Guard: only run in orchestrator/worker contexts where RUN_CRON=true is set
    if (process.env.RUN_CRON !== 'true') {
      return;
    }

    this.logger.log('[InboxCron] Inbox monitoring cron tick — adapters not yet configured');

    try {
      await this.runFetchCycle();
    } catch (err: any) {
      // Top-level guard: prevent any uncaught error from crashing the process
      this.logger.error(
        `[InboxCron] Unexpected error in fetch cycle: ${err?.message ?? String(err)}`,
      );
    }
  }

  /**
   * Execute one full fetch cycle across all active integrations.
   *
   * Queries all integration records from the database, then for each one
   * attempts to find a matching adapter and fetch new inbox items.
   *
   * Each integration is processed independently — errors are isolated
   * so one failed integration never blocks the rest.
   */
  private async runFetchCycle(): Promise<void> {
    // Fetch all integrations that have active tokens
    // The query is intentionally broad — adapter.canFetch() provides the filter
    let integrations: any[] = [];

    try {
      integrations = await (this.prisma as any).integration.findMany({
        where: {
          token: { not: null },
        },
        select: {
          id: true,
          name: true,
          providerIdentifier: true,
          token: true,
          internalId: true,
          organizationId: true,
        },
      });
    } catch (err: any) {
      // If the integration table doesn't exist yet (schema not migrated), log and exit
      this.logger.warn(
        `[InboxCron] Could not query integrations (schema may not be ready): ${err?.message ?? String(err)}`,
      );
      return;
    }

    this.logger.log(
      `[InboxCron] Found ${integrations.length} integration(s) to check`,
    );

    let fetchedTotal = 0;
    let skippedTotal = 0;

    for (const integration of integrations) {
      const result = await this.processIntegration(integration);
      fetchedTotal += result.fetched;
      skippedTotal += result.skipped ? 1 : 0;
    }

    this.logger.log(
      `[InboxCron] Cycle complete — ${fetchedTotal} item(s) fetched, ${skippedTotal} integration(s) skipped (no adapter)`,
    );
  }

  /**
   * Process a single integration: find its adapter, fetch items, persist them.
   *
   * Returns a summary of what happened for logging purposes.
   *
   * @param integration - Integration record from the database
   */
  private async processIntegration(
    integration: any,
  ): Promise<{ fetched: number; skipped: boolean }> {
    // Find the first adapter that declares it can handle this integration
    const adapter = this.adapters.find((a) => a.canFetch(integration));

    if (!adapter) {
      // No registered adapter for this platform — expected until real adapters are added
      this.logger.debug(
        `[InboxCron] No adapter for integration ${integration.id} (provider: ${integration.providerIdentifier ?? 'unknown'}) — skipping`,
      );
      return { fetched: 0, skipped: true };
    }

    try {
      // Determine since date: use the most recent known item's receivedAt,
      // or fall back to DEFAULT_LOOKBACK_HOURS ago for the first ever fetch
      const since = await this.getSinceDate(integration);

      const items = await adapter.fetchItems(integration, since);

      this.logger.log(
        `[InboxCron] Adapter '${adapter.platform}' fetched ${items.length} item(s) for integration ${integration.id}`,
      );

      // Persist items via upsert — idempotent, safe to re-run
      let persistedCount = 0;
      for (const item of items) {
        try {
          // Resolve companyId from organizationId for this integration
          const companyId = await this.resolveCompanyId(integration.organizationId);
          if (!companyId) {
            this.logger.warn(
              `[InboxCron] Could not resolve companyId for integration ${integration.id} — skipping item ${item.externalId}`,
            );
            continue;
          }

          await this.inboxRepository.create({
            companyId,
            platform: adapter.platform,
            externalId: item.externalId,
            type: item.type,
            authorName: item.authorName,
            authorAvatar: item.authorAvatar,
            content: item.content,
            postId: item.postId,
            parentId: item.parentId,
            receivedAt: item.receivedAt,
          });

          persistedCount++;
        } catch (itemErr: any) {
          // Per-item error isolation
          this.logger.error(
            `[InboxCron] Failed to persist item ${item.externalId}: ${itemErr?.message ?? String(itemErr)}`,
          );
        }
      }

      this.logger.log(
        `[InboxCron] Persisted ${persistedCount}/${items.length} item(s) for integration ${integration.id}`,
      );

      return { fetched: persistedCount, skipped: false };
    } catch (err: any) {
      // Per-integration error isolation — never rethrow
      this.logger.error(
        `[InboxCron] Failed to process integration ${integration.id}: ${err?.message ?? String(err)}`,
      );
      return { fetched: 0, skipped: false };
    }
  }

  /**
   * Determine the lower bound for incremental fetching.
   *
   * Queries the most recent inboxItem for this integration's platform to find
   * the last successfully ingested item's receivedAt. Uses this as the `since`
   * date to avoid re-fetching already-ingested items.
   *
   * Falls back to DEFAULT_LOOKBACK_HOURS ago if no items exist yet.
   *
   * @param integration - Integration record (used to scope the lookup by platform)
   */
  private async getSinceDate(integration: any): Promise<Date> {
    const fallback = new Date(
      Date.now() - DEFAULT_LOOKBACK_HOURS * 60 * 60 * 1000,
    );

    try {
      const mostRecent = await (this.prisma as any).inboxItem.findFirst({
        where: { platform: integration.providerIdentifier },
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true },
      });

      return mostRecent?.receivedAt ?? fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Resolve an organizationId to a companyId.
   *
   * Integrations are associated with organizations, but InboxItems are scoped
   * to companies (the Postiz data model uses Company as the primary tenant unit
   * within an Organization). This helper finds the primary company for an org.
   *
   * Returns null if no company is found — callers should skip the item.
   *
   * @param organizationId - Organization ID from the integration record
   */
  private async resolveCompanyId(organizationId: string): Promise<string | null> {
    if (!organizationId) return null;

    try {
      const company = await (this.prisma as any).company.findFirst({
        where: { organizations: { some: { id: organizationId } } },
        select: { id: true },
      });
      return company?.id ?? null;
    } catch {
      return null;
    }
  }
}
