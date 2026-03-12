/**
 * SlotFinderService
 *
 * Calculates available posting slots based on active posting rules and
 * existing scheduled/published posts.
 *
 * Algorithm:
 * 1. Load all enabled posting rules for the company
 * 2. Load all scheduled/published posts in the lookahead window
 * 3. For each rule, for each day in the range, for each rule time slot:
 *    - Check whether an existing post occupies that platform + day + hour + minute
 *    - A slot is "occupied" if there is any scheduled/published post for that
 *      platform within a ±15-minute buffer around the slot time
 *    - If no post occupies the slot, it is "available"
 * 4. Return the list of available slots sorted chronologically
 *
 * Slot conflict resolution:
 * A slot is considered occupied if any existing post for the same platformId
 * falls within a 15-minute window centered on the slot time.
 * This prevents back-to-back posts that are technically "different minutes"
 * from overlapping in the publishing pipeline.
 */
import { Injectable } from '@nestjs/common';
import { PostingRulesRepository } from './posting-rules.repository';

export interface AvailableSlot {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  hour: number;
  minute: number;
  /** Full ISO datetime string for the slot */
  scheduledAt: string;
  platformId: string;
  ruleId: string;
  ruleName: string;
}

/** Buffer in minutes around each slot to consider it occupied */
const SLOT_BUFFER_MINUTES = 15;

@Injectable()
export class SlotFinderService {
  constructor(private readonly repo: PostingRulesRepository) {}

  /**
   * Find available posting slots for a company over the next N days.
   *
   * Returns an array of available slots sorted by scheduledAt ascending.
   * Each slot represents a rule time slot that has no existing scheduled
   * or published post within the buffer window for that platform.
   *
   * @param companyId - Company to calculate slots for
   * @param daysAhead - Number of days to look ahead (default 7, max 90)
   * @returns Array of available slot descriptors sorted by scheduledAt
   */
  async findAvailableSlots(
    companyId: string,
    daysAhead: number = 7,
  ): Promise<AvailableSlot[]> {
    // Clamp daysAhead to a safe maximum to prevent runaway queries
    const days = Math.min(Math.max(1, daysAhead), 90);

    const [rules, timezone] = await Promise.all([
      this.repo.findEnabledByCompany(companyId),
      this.repo.findCompanyTimezone(companyId),
    ]);

    if (rules.length === 0) {
      return [];
    }

    // Build the date range: today through today + daysAhead
    const now = new Date();
    const from = this.startOfDay(now);
    const to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);

    // Load all existing scheduled/published posts in the range
    const existingPosts = await this.repo.findScheduledPostsInRange(companyId, from, to);

    // Build an occupancy index keyed by `platformId::dayKey` for fast lookup
    // Value: array of slot times in minutes-since-midnight
    const occupancyIndex = this.buildOccupancyIndex(existingPosts);

    const availableSlots: AvailableSlot[] = [];

    for (const rule of rules) {
      const timeSlots: { hour: number; minute: number }[] =
        this.parseTimeSlots(rule.timeSlots);

      for (let dayOffset = 0; dayOffset < days; dayOffset++) {
        const dayDate = new Date(from.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const dayKey = this.formatDate(dayDate);

        for (const slot of timeSlots) {
          const slotMinutes = slot.hour * 60 + slot.minute;
          const platformKey = `${rule.platformId}::${dayKey}`;
          const occupiedMinutes = occupancyIndex.get(platformKey) ?? [];

          // Check if any existing post falls within the buffer window
          const isOccupied = occupiedMinutes.some(
            (existingMinutes) =>
              Math.abs(existingMinutes - slotMinutes) <= SLOT_BUFFER_MINUTES,
          );

          if (!isOccupied) {
            const slotDate = new Date(dayDate);
            slotDate.setUTCHours(slot.hour, slot.minute, 0, 0);

            availableSlots.push({
              date: dayKey,
              hour: slot.hour,
              minute: slot.minute,
              scheduledAt: slotDate.toISOString(),
              platformId: rule.platformId,
              ruleId: rule.id,
              ruleName: rule.name,
            });
          }
        }
      }
    }

    // Sort chronologically then by platformId for deterministic ordering
    availableSlots.sort((a, b) => {
      const timeCompare = a.scheduledAt.localeCompare(b.scheduledAt);
      if (timeCompare !== 0) return timeCompare;
      return a.platformId.localeCompare(b.platformId);
    });

    return availableSlots;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Build a map from `platformId::YYYY-MM-DD` to array of minutes-since-midnight
   * for all existing posts in the date range.
   *
   * Enables O(1) lookup per platform+day instead of scanning all posts per slot.
   */
  private buildOccupancyIndex(posts: any[]): Map<string, number[]> {
    const index = new Map<string, number[]>();

    for (const post of posts) {
      if (!post.scheduledAt || !post.platformId) continue;

      const scheduledAt = new Date(post.scheduledAt);
      const dayKey = this.formatDate(scheduledAt);
      const minutesSinceMidnight =
        scheduledAt.getUTCHours() * 60 + scheduledAt.getUTCMinutes();
      const mapKey = `${post.platformId}::${dayKey}`;

      const existing = index.get(mapKey);
      if (existing) {
        existing.push(minutesSinceMidnight);
      } else {
        index.set(mapKey, [minutesSinceMidnight]);
      }
    }

    return index;
  }

  /**
   * Parse timeSlots from a posting rule.
   * Handles both JSON-parsed arrays and raw Prisma JSON fields.
   */
  private parseTimeSlots(
    rawSlots: any,
  ): { hour: number; minute: number }[] {
    if (!rawSlots) return [];
    if (Array.isArray(rawSlots)) return rawSlots;
    // Prisma may return JSON as a string in some configurations
    if (typeof rawSlots === 'string') {
      try {
        return JSON.parse(rawSlots);
      } catch {
        return [];
      }
    }
    return [];
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
