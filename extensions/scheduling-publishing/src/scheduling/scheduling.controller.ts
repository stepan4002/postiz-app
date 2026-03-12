/**
 * SchedulingController
 *
 * REST API for post scheduling, calendar, and retry operations.
 * Routes are company-scoped: /companies/:companySlug/...
 *
 * Controller resolves companySlug to companyId before calling services.
 * Services work with IDs only (per project convention).
 *
 * Endpoints:
 * - POST   /companies/:companySlug/posts/:postId/schedule      Schedule a post at specific time
 * - POST   /companies/:companySlug/posts/:postId/auto-slot     Auto-find best available slot
 * - DELETE /companies/:companySlug/posts/:postId/schedule      Cancel scheduling (revert to APPROVED)
 * - GET    /companies/:companySlug/calendar?from=ISO&to=ISO    Calendar view of scheduled posts
 * - POST   /companies/:companySlug/posts/:postId/retry         Retry failed/stale post
 */

import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ScheduleResolverService } from './schedule-resolver.service';
import { SchedulingRepository } from './scheduling.repository';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

@Controller('companies/:companySlug')
export class SchedulingController {
  constructor(
    private readonly scheduleResolverService: ScheduleResolverService,
    private readonly schedulingRepository: SchedulingRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Resolve a company slug to a company ID.
   * Throws NotFoundException if not found.
   */
  private async resolveCompanyId(companySlug: string): Promise<string> {
    const company = await (this.prisma as any).company.findUnique({
      where: { slug: companySlug },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException(`Company '${companySlug}' not found`);
    }
    return company.id;
  }

  /**
   * POST /companies/:companySlug/posts/:postId/schedule
   *
   * Schedule a ContentPost for a specific time.
   * Body: { scheduledAt: ISO string, timezone?: string }
   *
   * @returns Updated ContentPost record
   */
  @Post('posts/:postId/schedule')
  async schedulePost(
    @Param('companySlug') companySlug: string,
    @Param('postId') postId: string,
    @Body() body: { scheduledAt: string; timezone?: string },
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    // Verify post belongs to this company
    const post = await (this.prisma as any).contentPost.findFirst({
      where: { id: postId, companyId },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException(`Post '${postId}' not found for company '${companySlug}'`);
    }

    if (!body.scheduledAt) {
      throw new BadRequestException('scheduledAt is required');
    }

    const scheduledAt = new Date(body.scheduledAt);
    if (isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('scheduledAt must be a valid ISO date string');
    }

    return this.scheduleResolverService.schedulePost(
      postId,
      scheduledAt,
      body.timezone,
    );
  }

  /**
   * POST /companies/:companySlug/posts/:postId/auto-slot
   *
   * Automatically find the next available posting slot for the company
   * and schedule the post there.
   * Body: { timezone?: string }
   *
   * @returns Updated ContentPost with assigned scheduledAt
   */
  @Post('posts/:postId/auto-slot')
  async autoSlot(
    @Param('companySlug') companySlug: string,
    @Param('postId') postId: string,
    @Body() body: { timezone?: string },
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    const post = await (this.prisma as any).contentPost.findFirst({
      where: { id: postId, companyId },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException(`Post '${postId}' not found for company '${companySlug}'`);
    }

    return this.scheduleResolverService.autoSlot(postId, body?.timezone);
  }

  /**
   * DELETE /companies/:companySlug/posts/:postId/schedule
   *
   * Cancel scheduling for a post — reverts to APPROVED status.
   * Clears scheduledAt and publishWindowExpiresAt on all SCHEDULED variants.
   *
   * @returns Updated ContentPost with APPROVED status
   */
  @Delete('posts/:postId/schedule')
  async cancelSchedule(
    @Param('companySlug') companySlug: string,
    @Param('postId') postId: string,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    const post = await (this.prisma as any).contentPost.findFirst({
      where: { id: postId, companyId },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException(`Post '${postId}' not found for company '${companySlug}'`);
    }

    return this.scheduleResolverService.cancelSchedule(postId);
  }

  /**
   * GET /companies/:companySlug/calendar?from=ISO&to=ISO
   *
   * Returns scheduled posts for the company in the given date range.
   * Used by the calendar UI to display upcoming posts.
   *
   * @param from ISO date string for range start (required)
   * @param to ISO date string for range end (required)
   * @returns Array of scheduled ContentPost records with variant info
   */
  @Get('calendar')
  async getCalendar(
    @Param('companySlug') companySlug: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    if (!from || !to) {
      throw new BadRequestException('from and to query parameters are required');
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('from and to must be valid ISO date strings');
    }

    return this.schedulingRepository.findScheduledPostsForCompany(
      companyId,
      fromDate,
      toDate,
    );
  }

  /**
   * POST /companies/:companySlug/posts/:postId/retry
   *
   * Retry a FAILED or STALE post by resetting variants to SCHEDULED status.
   * Sets scheduledAt to now and recalculates publishWindowExpiresAt.
   *
   * @returns Updated ContentPost with SCHEDULED status
   */
  @Post('posts/:postId/retry')
  async retryPost(
    @Param('companySlug') companySlug: string,
    @Param('postId') postId: string,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    const post = await (this.prisma as any).contentPost.findFirst({
      where: { id: postId, companyId },
      include: { variants: true },
    });

    if (!post) {
      throw new NotFoundException(`Post '${postId}' not found for company '${companySlug}'`);
    }

    const retryableStatuses = ['FAILED', 'STALE'];
    if (!retryableStatuses.includes(post.status)) {
      throw new BadRequestException(
        `Post cannot be retried from status '${post.status}'. ` +
        `Only FAILED and STALE posts can be retried.`
      );
    }

    // Reset to SCHEDULED with new publish window (4 hours from now)
    const now = new Date();
    const publishWindowExpiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    // Reset all FAILED/STALE variants to SCHEDULED
    const variants = (post.variants ?? []) as any[];
    for (const variant of variants) {
      if (retryableStatuses.includes(variant.status)) {
        await (this.prisma as any).postVariant.update({
          where: { id: variant.id },
          data: {
            status: 'SCHEDULED',
            scheduledAt: now,
            publishWindowExpiresAt,
            publishAttempts: 0,
            consecutiveFailures: 0,
            lastPublishError: null,
            platformPostId: null,
            platformUrl: null,
            publishedAt: null,
          },
        });
      }
    }

    // Update parent ContentPost to SCHEDULED
    const updatedPost = await (this.prisma as any).contentPost.update({
      where: { id: postId },
      data: {
        status: 'SCHEDULED',
        scheduledAt: now,
      },
    });

    return updatedPost;
  }
}
