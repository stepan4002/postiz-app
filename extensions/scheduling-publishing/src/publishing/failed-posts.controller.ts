/**
 * FailedPostsController
 *
 * REST API for surfacing failed and stale posts to the dashboard (R10.7).
 * Routes are company-scoped: /companies/:companySlug/failed-posts
 *
 * Endpoints:
 * - GET /companies/:companySlug/failed-posts?platform=&page=&limit=
 *     Returns paginated list of FAILED and STALE variants with post info
 * - GET /companies/:companySlug/failed-posts/:variantId/attempts
 *     Returns all publish attempt records for a variant, ordered newest first
 */

import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';

@Controller('companies/:companySlug/failed-posts')
export class FailedPostsController {
  constructor(private readonly prisma: any) {}

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
   * GET /companies/:companySlug/failed-posts?platform=&page=&limit=
   *
   * Returns paginated list of FAILED and STALE PostVariants for the company.
   * Includes parent ContentPost data and most recent publish attempt.
   *
   * R10.7: Failed posts must be surfaced via API endpoint for dashboard.
   *
   * @param platform Optional platform filter (e.g., 'instagram', 'facebook')
   * @param page Page number (1-based, default 1)
   * @param limit Items per page (default 20, max 100)
   */
  @Get()
  async getFailedPosts(
    @Param('companySlug') companySlug: string,
    @Query('platform') platform?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {
      status: { in: ['FAILED', 'STALE'] },
      post: {
        companyId,
      },
    };

    if (platform) {
      where.platform = platform;
    }

    // Count total for pagination
    const total = await (this.prisma as any).postVariant.count({ where });

    // Fetch paginated results
    const variants = await (this.prisma as any).postVariant.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { updatedAt: 'desc' },
      include: {
        post: {
          select: {
            id: true,
            status: true,
            scheduledAt: true,
            companyId: true,
          },
        },
        publishAttempts: {
          orderBy: { timestamp: 'desc' },
          take: 1,  // Most recent attempt for quick reference
        },
      },
    });

    return {
      data: variants,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * GET /companies/:companySlug/failed-posts/:variantId/attempts
   *
   * Returns all publish attempt records for a specific PostVariant.
   * Ordered by timestamp descending (newest first).
   *
   * Used for debugging: operators can see the full history of
   * what was attempted, when, and what the platform returned.
   *
   * @param variantId The PostVariant ID to query attempts for
   */
  @Get(':variantId/attempts')
  async getVariantAttempts(
    @Param('companySlug') companySlug: string,
    @Param('variantId') variantId: string,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    // Verify the variant belongs to this company
    const variant = await (this.prisma as any).postVariant.findFirst({
      where: {
        id: variantId,
        post: { companyId },
      },
      select: { id: true, platform: true, status: true },
    });

    if (!variant) {
      throw new NotFoundException(
        `Variant '${variantId}' not found for company '${companySlug}'`
      );
    }

    const attempts = await (this.prisma as any).publishAttempt.findMany({
      where: { variantId },
      orderBy: { timestamp: 'desc' },
    });

    return {
      variant,
      attempts,
    };
  }
}
