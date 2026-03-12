/**
 * StubInboxAdapter
 *
 * Safe no-op placeholder adapter used as the default when no platform-specific
 * adapter is registered for an integration.
 *
 * Design decisions:
 * - canFetch() always returns false — this adapter is never selected by the cron loop
 * - fetchItems() returns an empty array — safe to call but yields nothing
 * - This prevents the cron from crashing when integrations exist for platforms
 *   that don't yet have a concrete inbox adapter implementation
 *
 * When to replace:
 * - Create a concrete adapter (e.g. InstagramInboxAdapter) in this directory
 * - Register it in InboxAdapterRegistry (when implemented) keyed by platform name
 * - The stub will naturally be bypassed once real adapters return canFetch() = true
 *
 * This pattern follows the "safe default" principle — the system degrades gracefully
 * rather than erroring when an adapter is not yet available.
 */

import { BaseInboxAdapter, InboxFetchResult } from './base.adapter';

export class StubInboxAdapter extends BaseInboxAdapter {
  /**
   * Platform identifier.
   * The stub uses 'stub' as its platform — it is never matched to a real integration.
   */
  platform = 'stub';

  /**
   * Always returns false.
   *
   * The cron loop checks canFetch() before calling fetchItems(). By returning false,
   * this adapter ensures it is never selected for any integration, making it a
   * completely inert no-op that cannot interfere with real data flows.
   */
  canFetch(_integration: any): boolean {
    return false;
  }

  /**
   * Returns an empty array.
   *
   * Even though canFetch() prevents this from being called in normal operation,
   * the implementation is safe to call directly (e.g. in tests) and will always
   * return a zero-item result without making any network requests.
   */
  async fetchItems(_integration: any, _since?: Date): Promise<InboxFetchResult[]> {
    return [];
  }
}
