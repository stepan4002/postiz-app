// ============================================================================
// AnalyticsAdapterRegistry — Runtime lookup of platform analytics adapters
// Maps platform string keys to AnalyticsAdapter instances.
// Eagerly instantiates all 4 adapters in the constructor (same pattern as
// Phase 6 AdapterRegistry) for fast dispatch and predictable startup.
// ============================================================================

import { AnalyticsAdapter } from '../types/analytics.types';
import { InstagramAnalyticsAdapter } from './instagram.analytics.adapter';
import { FacebookAnalyticsAdapter } from './facebook.analytics.adapter';
import { LinkedInAnalyticsAdapter } from './linkedin.analytics.adapter';
import { XAnalyticsAdapter } from './x.analytics.adapter';

export class AnalyticsAdapterRegistry {
  private readonly adapters: Map<string, AnalyticsAdapter>;

  constructor() {
    this.adapters = new Map<string, AnalyticsAdapter>([
      ['instagram', new InstagramAnalyticsAdapter()],
      ['facebook', new FacebookAnalyticsAdapter()],
      ['linkedin', new LinkedInAnalyticsAdapter()],
      ['x', new XAnalyticsAdapter()],
    ]);
  }

  /**
   * Get the analytics adapter for a platform by name.
   *
   * @param platform Platform identifier (e.g., 'instagram', 'facebook', 'linkedin', 'x')
   * @returns The platform analytics adapter instance
   * @throws Error if no adapter is registered for the given platform
   */
  getAdapter(platform: string): AnalyticsAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new Error(
        `No analytics adapter for platform: ${platform}. Supported: ${this.getSupportedPlatforms().join(', ')}`,
      );
    }
    return adapter;
  }

  /**
   * Get the list of all platforms with registered analytics adapters.
   *
   * @returns Array of platform identifier strings
   */
  getSupportedPlatforms(): string[] {
    return Array.from(this.adapters.keys());
  }
}
