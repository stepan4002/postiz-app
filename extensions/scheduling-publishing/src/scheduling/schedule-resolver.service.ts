/**
 * ScheduleResolverService
 *
 * Service responsible for assigning publish times to approved posts:
 *
 * 1. schedulePost() — schedule an approved post at an explicit date/time,
 *    with full timezone conversion (input timezone -> UTC storage).
 *
 * 2. autoSlot() — find the next available preferred posting window for the
 *    company and schedule there (skipping occupied windows).
 *
 * 3. cancelSchedule() — revert a scheduled post back to APPROVED status,
 *    clearing all scheduling fields.
 *
 * State transitions enforced:
 * - schedulePost: post must be APPROVED (or SCHEDULED for reschedule)
 * - cancelSchedule: post must be SCHEDULED
 * - Variants with APPROVED status are moved to SCHEDULED
 * - Variants with SCHEDULED status stay SCHEDULED (reschedule updates time)
 *
 * Timezone handling:
 * - All times stored in UTC in the database
 * - Incoming scheduledAt is interpreted in the provided timezone (or company TZ)
 * - dayjs with UTC + timezone plugins used for conversion
 */

import { Injectable } from '@nestjs/common';
import { SchedulingRepository } from './scheduling.repository';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dayjs = require('dayjs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const utcPlugin = require('dayjs/plugin/utc');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const timezonePlugin = require('dayjs/plugin/timezone');

// Extend dayjs with UTC and timezone plugins once at module load time
dayjs.extend(utcPlugin);
dayjs.extend(timezonePlugin);

/** Minimum lead time for auto-slot: at least 1 hour from now */
const MIN_LEAD_TIME_HOURS = 1;

/** Default publish window: 4 hours (R10.8) */
const DEFAULT_WINDOW_HOURS = 4;

@Injectable()
export class ScheduleResolverService {
  constructor(private readonly repository: SchedulingRepository) {}

  /**
   * Schedule a post for a specific time.
   *
   * @param postId - The ContentPost ID to schedule
   * @param scheduledAt - The desired publish time (interpreted in `timezone`)
   * @param tz - IANA timezone (e.g. 'America/New_York'). If omitted, looks up company timezone.
   * @param windowHours - Publish window length in hours (default 4)
   * @returns The updated ContentPost record
   */
  async schedulePost(
    postId: string,
    scheduledAt: Date,
    tz?: string,
    windowHours: number = DEFAULT_WINDOW_HOURS
  ): Promise<any> {
    // 1. Load post with variants
    const post = await this.repository.findPostWithVariants(postId);
    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }

    // 2. Assert valid source status (APPROVED for initial schedule, SCHEDULED for reschedule)
    const validSourceStatuses = ['APPROVED', 'SCHEDULED'];
    if (!validSourceStatuses.includes(post.status)) {
      throw new Error(
        `Cannot schedule post with status ${post.status}. ` +
        `Post must be APPROVED or SCHEDULED to be scheduled.`
      );
    }

    // 3. Resolve timezone: use provided tz, or look up company timezone
    const resolvedTz = tz ?? await this.repository.findCompanyTimezone(post.companyId);

    // 4. Convert scheduledAt from company timezone to UTC
    // The incoming scheduledAt is treated as a "wall clock time" in the given timezone.
    // We extract the date/time components and re-interpret them in the resolved timezone.
    //
    // Special case: if timezone is 'UTC', the scheduledAt is already UTC — use it directly.
    // This is the case when autoSlot() computes a UTC slot time and calls schedulePost with 'UTC'.
    let scheduledAtUtc: Date;
    if (resolvedTz === 'UTC') {
      scheduledAtUtc = scheduledAt;
    } else {
      // Extract local time components and re-interpret in the target timezone
      // getFullYear/getMonth/etc. return local system time, but since the incoming Date
      // represents "9:00 AM local wall clock" (regardless of system TZ), we use UTC getters
      // which give us the numeric values the caller intended when constructing the Date.
      const localDateStr = [
        scheduledAt.getUTCFullYear(),
        String(scheduledAt.getUTCMonth() + 1).padStart(2, '0'),
        String(scheduledAt.getUTCDate()).padStart(2, '0'),
      ].join('-') + 'T' + [
        String(scheduledAt.getUTCHours()).padStart(2, '0'),
        String(scheduledAt.getUTCMinutes()).padStart(2, '0'),
        String(scheduledAt.getUTCSeconds()).padStart(2, '0'),
      ].join(':');
      scheduledAtUtc = dayjs.tz(localDateStr, resolvedTz).utc().toDate();
    }

    // 5. Calculate publish window expiry
    const publishWindowExpiresAt = new Date(scheduledAtUtc.getTime() + windowHours * 60 * 60 * 1000);

    // 6. Update each variant to SCHEDULED
    const variants = post.variants as any[];
    for (const variant of variants) {
      // Update variants that are APPROVED or SCHEDULED (handles reschedule)
      if (variant.status === 'APPROVED' || variant.status === 'SCHEDULED') {
        await this.repository.updateVariantSchedule(variant.id, {
          status: 'SCHEDULED',
          scheduledAt: scheduledAtUtc,
          publishWindowExpiresAt,
        });
      }
    }

    // 7. Update parent ContentPost to SCHEDULED
    const updatedPost = await this.repository.updatePostSchedule(postId, {
      status: 'SCHEDULED',
      scheduledAt: scheduledAtUtc,
    });

    return updatedPost;
  }

  /**
   * Automatically schedule a post in the next available preferred posting window.
   *
   * Preferred windows are fetched from the company's posting schedule.
   * Defaults to 9am, 12pm, 5pm in company's local timezone.
   *
   * Algorithm:
   * 1. Get company timezone and preferred posting hours
   * 2. Starting from today, find slots that are >= (now + MIN_LEAD_TIME_HOURS)
   * 3. Skip slots that already have a post scheduled
   * 4. Schedule in the first available slot
   *
   * @param postId - The ContentPost ID to auto-slot
   * @param tz - Override timezone (defaults to company timezone)
   */
  async autoSlot(postId: string, tz?: string): Promise<any> {
    const post = await this.repository.findPostWithVariants(postId);
    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }

    if (post.status !== 'APPROVED') {
      throw new Error(
        `Cannot auto-slot post with status ${post.status}. Post must be APPROVED.`
      );
    }

    // Get company timezone and preferred posting hours
    const resolvedTz = tz ?? await this.repository.findCompanyTimezone(post.companyId);
    const postingHours = await this.repository.findCompanyPostingTimes(post.companyId);

    // Minimum publish time: now + MIN_LEAD_TIME_HOURS
    const now = new Date();
    const minPublishTime = new Date(now.getTime() + MIN_LEAD_TIME_HOURS * 60 * 60 * 1000);

    // Try to find an available slot starting from today, then tomorrow, etc.
    const MAX_DAYS_AHEAD = 14; // Give up after 2 weeks
    for (let dayOffset = 0; dayOffset < MAX_DAYS_AHEAD; dayOffset++) {
      // Get today's date in company timezone
      const candidateDay = dayjs(now).tz(resolvedTz).add(dayOffset, 'day');

      for (const hour of postingHours.sort((a: number, b: number) => a - b)) {
        // Construct slot time: candidateDay at posting hour, in company timezone
        const slotLocal = candidateDay
          .hour(hour)
          .minute(0)
          .second(0)
          .millisecond(0);

        // Convert to UTC for comparison
        const slotUtc = slotLocal.utc().toDate();

        // Skip slots that are too soon
        if (slotUtc < minPublishTime) {
          continue;
        }

        // Check if this slot is already occupied (within ±30 min window)
        const slotFrom = new Date(slotUtc.getTime() - 30 * 60 * 1000);
        const slotTo = new Date(slotUtc.getTime() + 30 * 60 * 1000);
        const existingPosts = await this.repository.findScheduledPostsForCompany(
          post.companyId,
          slotFrom,
          slotTo
        );

        if (existingPosts.length === 0) {
          // Slot is available — schedule here
          return this.schedulePost(postId, slotUtc, 'UTC'); // already in UTC
        }
      }
    }

    throw new Error(
      `Could not find an available posting slot in the next ${MAX_DAYS_AHEAD} days. ` +
      `All preferred windows are occupied.`
    );
  }

  /**
   * Cancel scheduling for a post — revert to APPROVED status.
   *
   * Clears scheduledAt and publishWindowExpiresAt on all SCHEDULED variants.
   * Reverts parent ContentPost to APPROVED with null scheduledAt.
   *
   * @param postId - The ContentPost ID to unschedule
   */
  async cancelSchedule(postId: string): Promise<any> {
    const post = await this.repository.findPostWithVariants(postId);
    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }

    if (post.status !== 'SCHEDULED') {
      throw new Error(
        `Cannot cancel scheduling of a post with status ${post.status}. ` +
        `Post must be SCHEDULED to cancel scheduling.`
      );
    }

    // Revert all SCHEDULED variants to APPROVED, clear scheduling fields
    const variants = post.variants as any[];
    for (const variant of variants) {
      if (variant.status === 'SCHEDULED') {
        await this.repository.updateVariantSchedule(variant.id, {
          status: 'APPROVED',
          scheduledAt: null,
          publishWindowExpiresAt: null,
        });
      }
    }

    // Revert parent ContentPost to APPROVED
    const updatedPost = await this.repository.updatePostSchedule(postId, {
      status: 'APPROVED',
      scheduledAt: null,
    });

    return updatedPost;
  }
}
