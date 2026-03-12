/**
 * BaseInboxAdapter
 *
 * Abstract base class for all inbox monitoring platform adapters.
 * Each platform (Instagram, Facebook, LinkedIn, X, etc.) will implement
 * a concrete subclass that knows how to fetch comments, DMs, mentions,
 * and reviews from that platform's API.
 *
 * Design decisions:
 * - Adapters are stateless — all state lives in the DB via InboxRepository
 * - canFetch() is checked before fetchItems() to allow graceful degradation
 *   when credentials are missing or incomplete
 * - fetchItems() accepts a `since` date for incremental fetching (dedup support)
 * - Concrete adapters should handle their own retry/backoff on rate limits
 * - All adapter errors should be caught by InboxCron and logged — never crash the cron
 */

/**
 * Normalized result shape returned by all inbox adapters.
 * Maps platform-specific response formats to a common structure
 * stored in the InboxItem table.
 */
export interface InboxFetchResult {
  /** Platform-assigned unique ID for this item — used for deduplication */
  externalId: string;

  /** Semantic classification of the item type */
  type: 'comment' | 'dm' | 'mention' | 'review';

  /** Display name of the sender/author */
  authorName?: string;

  /** Avatar URL of the sender/author */
  authorAvatar?: string;

  /** Text content of the message/comment/review */
  content: string;

  /** Platform post ID this comment/mention belongs to (null for DMs) */
  postId?: string;

  /** Parent comment ID for threaded replies (null for top-level) */
  parentId?: string;

  /** When the item was created on the platform */
  receivedAt: Date;
}

/**
 * Abstract base class all platform inbox adapters must extend.
 *
 * Usage pattern in InboxCron:
 * ```
 * for (const integration of integrations) {
 *   const adapter = registry.find(a => a.canFetch(integration));
 *   if (!adapter) continue;
 *   const items = await adapter.fetchItems(integration, since);
 *   // persist items via InboxRepository.create()
 * }
 * ```
 */
export abstract class BaseInboxAdapter {
  /** Platform identifier — must match the platform field in integrations */
  abstract platform: string;

  /**
   * Determine whether this adapter can fetch data for the given integration.
   *
   * Implementations should check that:
   * - The integration's provider matches this adapter's platform
   * - Required credentials (token, accountId, etc.) are present and non-empty
   *
   * Returns false if any required credential is missing — the cron will skip
   * this integration rather than attempting a fetch that will fail.
   *
   * @param integration - Integration record from the database (provider, token, internalId, etc.)
   * @returns true if this adapter can fetch for the integration
   */
  abstract canFetch(integration: any): boolean;

  /**
   * Fetch new inbox items from the platform for the given integration.
   *
   * Implementations must:
   * - Use the `since` date to limit results (incremental fetch)
   * - Normalize platform-specific fields into InboxFetchResult shape
   * - Handle pagination if the platform requires it
   * - Not throw on partial failures — return what was fetched successfully
   *
   * @param integration - Integration record with credentials
   * @param since - Fetch items created after this date (for incremental sync)
   * @returns Array of normalized inbox items ready for persistence
   */
  abstract fetchItems(integration: any, since?: Date): Promise<InboxFetchResult[]>;
}
