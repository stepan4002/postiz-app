// ============================================================================
// AdapterRegistry — Runtime lookup of platform adapters
// Maps platform string keys to PlatformAdapter instances.
// Allows publishing workers to resolve the correct adapter by platform name
// without coupling to specific adapter implementations.
//
// NF4.3: Central registry keeps platform logic in adapter implementations.
// ============================================================================

import { PlatformAdapter } from '../types/publishing.types';
import { InstagramAdapter } from './instagram.adapter';
import { FacebookAdapter } from './facebook.adapter';
import { LinkedInAdapter } from './linkedin.adapter';
import { XAdapter } from './x.adapter';

export class AdapterRegistry {
  private readonly adapters: Record<string, PlatformAdapter>;

  constructor() {
    this.adapters = {
      instagram: new InstagramAdapter(),
      facebook: new FacebookAdapter(),
      linkedin: new LinkedInAdapter(),
      x: new XAdapter(),
    };
  }

  /**
   * Get the adapter for a platform by name.
   *
   * @param platform Platform identifier (e.g., 'instagram', 'facebook', 'linkedin', 'x')
   * @returns The platform adapter instance
   * @throws Error if no adapter is registered for the given platform
   */
  getAdapter(platform: string): PlatformAdapter {
    const adapter = this.adapters[platform];
    if (!adapter) {
      throw new Error(`No adapter for platform: ${platform}`);
    }
    return adapter;
  }

  /**
   * Get the list of all registered platform keys.
   *
   * @returns Array of platform identifier strings
   */
  getSupportedPlatforms(): string[] {
    return Object.keys(this.adapters);
  }
}
