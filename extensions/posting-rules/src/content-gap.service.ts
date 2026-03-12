/**
 * ContentGapService
 *
 * Detects "content gaps": days where a company's actual post count
 * for a given platform falls below the expected frequency defined in its
 * posting rules.
 *
 * Gap detection algorithm:
 * 1. Load all enabled posting rules for the company
 * 2. Load all scheduled/published posts in the lookahead window
 * 3. For each rule, for each day in the range:
 *    a. Count existing posts for the rule's platformId on that day
 *    b. Compare against rule.frequency (expected daily post count)
 *    c. If actual < expected, record a gap with the deficit count
 * 4. Return all detected gaps sorted by date ascending
 *
 * Gap records are informational — they do not automatically create posts.
 * They are surfaced to users in the dashboard and consumed by ContentGapCron
 * for logging and future notification hooks.
 */
import { Injectable } from '@nestjs/common';
import { PostingRulesRepository } from './posting-rules.repository';

export interface ContentGap {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  platformId: string;
  ruleId: string;
  ruleName: string;
  /** Number of posts expected per rule.frequency */
  expectedCount: number;
  /** Number of SCHEDULED or PUBLISHED posts found on this day */
  actualCount: number;
  /** Deficit: expectedCount - actualCount (always > 0 for a gap) */
  gap: number;
}

/** Default lookahead window when daysAhead is not specified */
const DEFAULT_DAYS_AHEAD = 7;

@Injectable()
export class ContentGapService {
  constructor(private readonly repo: PostingRulesRepository) {}

  /**
   * Detect content gaps for a company over the next N days.
   *
   * Returns gaps sorted by date ascending, then by platformId for
   * deterministic ordering when multiple rules share the same platform.
   *
   * Only enabled rules are considered. Rules with no time slots are skipped
   * since they cannot generate expected counts without a schedule definition.
   *
   * @param companyId - Company to detect gaps for
   * @param daysAhead - Number of days to look ahead (default 7, max 90)
   * @returns Array of detected content gaps
   */
  async detectGaps(
    companyId: string,
    daysAhead: number = DEFAULT_DAYS_AHEAD,
  ): Promise<ContentGap[]> {
    // Clamp to safe range: at least 1 day, at most 90 days
    const days = Math.min(Math.max(1, daysAhead), 90);

    const rules = await this.repo.findEnabledByCompany(companyId);
    if (rules.length === 0) {
      return [];
    }

    // Build date range: start of today through today + daysAhead
    const now = new Date();
    const from = this.startOfDay(now);
    const to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);

    // Load all existing scheduled/published posts in the range
    const existingPosts = await this.repo.findScheduledPostsInRange(companyId, from, to);

    // Build a count index keyed by `platformId::YYYY-MM-DD` -> count
    const postCountIndex = this.buildPostCountIndex(existingPosts);

    const gaps: ContentGap[] = [];

    for (const rule of rules) {
      // A rule with frequency 0 or missing is misconfigured — skip it
      const expectedCount: number = typeof rule.frequency === 'number' && rule.frequency > 0
        ? rule.frequency
        : 0;

      if (expectedCount === 0) continue;

      for (let dayOffset = 0; dayOffset < days; dayOffset++) {
        const dayDate = new Date(from.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const dayKey = this.formatDate(dayDate);
        const indexKey = `${rule.platformId}::${dayKey}`;

        const actualCount = postCountIndex.get(indexKey) ?? 0;

        if (actualCount < expectedCount) {
          gaps.push({
            date: dayKey,
            platformId: rule.platformId,
            ruleId: rule.id,
            ruleName: rule.name,
            expectedCount,
            actualCount,
            gap: expectedCount - actualCount,
          });
        }
      }
    }

    // Sort by date ascending, then platformId for deterministic output
    gaps.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.platformId.localeCompare(b.platformId);
    });

    return gaps;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Build a count map from `platformId::YYYY-MM-DD` to number of posts.
   *
   * Enables O(1) lookup per rule+day instead of filtering all posts per iteration.
   */
  private buildPostCountIndex(posts: any[]): Map<string, number> {
    const index = new Map<string, number>();

    for (const post of posts) {
      if (!post.scheduledAt || !post.platformId) continue;

      const scheduledAt = new Date(post.scheduledAt);
      const dayKey = this.formatDate(scheduledAt);
      const mapKey = `${post.platformId}::${dayKey}`;

      index.set(mapKey, (index.get(mapKey) ?? 0) + 1);
    }

    return index;
  }

  /**
   * Return the start of a UTC day (00:00:00.000 UTC) for the given date.
   */
  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Format a Date as YYYY-MM-DD using UTC components.
   */
  private formatDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
