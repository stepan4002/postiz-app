// ============================================================================
// AnalyticsService
// Orchestrates metrics fetching and storage for a single PostVariant.
//
// processVariant():
//   1. Decrypts access token via TokenEncryptionService
//   2. Dispatches to platform adapter via AnalyticsAdapterRegistry
//   3. Persists result via AnalyticsRepository.upsertMetrics
//
// getVariantAnalytics / getPostAnalytics: read-side for the REST API.
// ============================================================================

import { Injectable, Logger } from '@nestjs/common';
import { DueIngestionItem } from '../types/analytics.types';
import { AnalyticsAdapterRegistry } from '../adapters/analytics.adapter.registry';
import { AnalyticsRepository } from './analytics.repository';

/**
 * Minimal interface for the TokenEncryptionService dependency.
 * Avoids importing the full @social/credential-management package here;
 * the actual service is injected at module wiring time.
 */
export interface ITokenEncryptionService {
  decrypt(hexData: string): string;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly analyticsRepo: AnalyticsRepository,
    private readonly tokenEncryption: ITokenEncryptionService,
    private readonly adapterRegistry: AnalyticsAdapterRegistry,
  ) {}

  /**
   * Process a single ingestion item:
   * 1. Decrypt access token
   * 2. Fetch metrics from platform adapter
   * 3. Upsert into PostMetrics (idempotent)
   *
   * @param item - DueIngestionItem from AnalyticsRepository.findDueForIngestion
   * @throws On adapter or database errors (caller should catch and isolate)
   */
  async processVariant(item: DueIngestionItem): Promise<void> {
    const decryptedToken = this.tokenEncryption.decrypt(item.accessToken);

    const adapter = this.adapterRegistry.getAdapter(item.platform);
    const metrics = await adapter.fetchPostMetrics(
      item.platformPostId,
      decryptedToken,
      item.platformAccountId,
    );

    await this.analyticsRepo.upsertMetrics(
      item.variantId,
      item.snapshotType,
      metrics,
      item.postId,
      item.companyId,
      item.platform,
    );

    this.logger.debug(
      `Ingested ${item.snapshotType} metrics for variant ${item.variantId} (${item.platform})`,
    );
  }

  /**
   * Get all metrics snapshots for a PostVariant (per-variant analytics view).
   *
   * @param variantId - The PostVariant ID
   * @returns Ordered snapshots: 1h -> 24h -> 7d
   */
  async getVariantAnalytics(variantId: string): Promise<any[]> {
    return this.analyticsRepo.findByVariantId(variantId);
  }

  /**
   * Get all metrics for all variants of a ContentPost (per-post analytics view).
   *
   * @param postId - The ContentPost ID
   * @returns All PostMetrics rows for the post, ordered by variantId then snapshotType
   */
  async getPostAnalytics(postId: string): Promise<any[]> {
    return this.analyticsRepo.findByPostId(postId);
  }
}
