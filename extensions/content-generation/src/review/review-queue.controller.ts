import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ReviewQueueService } from './review-queue.service';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

/**
 * ReviewQueueController
 *
 * REST endpoints for the operator review workflow.
 * Routes are scoped under /companies/:companySlug/review-queue.
 *
 * Slug resolution: resolves companySlug to companyId via Prisma, then
 * validates post ownership before delegating to ReviewQueueService.
 *
 * Endpoints:
 *   GET   /companies/:companySlug/review-queue                             — list pending review posts
 *   POST  /companies/:companySlug/review-queue/:postId/approve             — approve all variants
 *   POST  /companies/:companySlug/review-queue/:postId/reject              — reject all variants
 *   POST  /companies/:companySlug/review-queue/:postId/regenerate          — re-run AI pipeline
 *   PATCH /companies/:companySlug/review-queue/:postId/variants/:variantId — edit single variant caption
 */
@Controller('companies/:companySlug/review-queue')
export class ReviewQueueController {
  constructor(
    private readonly reviewQueueService: ReviewQueueService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Resolve companySlug to company record.
   * Throws NotFoundException if company doesn't exist.
   */
  private async resolveCompany(companySlug: string): Promise<any> {
    const company = await (this.prisma as any).company.findUnique({
      where: { slug: companySlug },
    });
    if (!company) {
      throw new NotFoundException(`Company '${companySlug}' not found`);
    }
    return company;
  }

  /**
   * List all PENDING_REVIEW posts for a company.
   *
   * GET /companies/:companySlug/review-queue?page=1
   *
   * @param companySlug - URL-safe company identifier
   * @param page - Page number (1-based, default 1)
   * @returns Paginated list of PENDING_REVIEW ContentPost records with variants
   */
  @Get()
  async listPending(
    @Param('companySlug') companySlug: string,
    @Query('page') page?: string,
  ): Promise<{ posts: any[]; total: number; page: number; totalPages: number }> {
    const company = await this.resolveCompany(companySlug);
    return this.reviewQueueService.findPending(
      company.id,
      parseInt(page ?? '1', 10) || 1,
    );
  }

  /**
   * Approve a post: set all variants to APPROVED and mark post APPROVED.
   *
   * POST /companies/:companySlug/review-queue/:postId/approve
   *
   * Audit trail: reviewedBy='operator', reviewAction='approve', reviewedAt stored.
   *
   * @param companySlug - URL-safe company identifier (validates ownership)
   * @param postId - ContentPost ID
   * @returns Updated ContentPost with approved variants
   */
  @Post(':postId/approve')
  async approve(
    @Param('companySlug') companySlug: string,
    @Param('postId') postId: string,
  ): Promise<any> {
    await this.resolveCompany(companySlug);
    return this.reviewQueueService.approve(postId);
  }

  /**
   * Reject a post: set all variants to REJECTED and return post to DRAFT.
   *
   * POST /companies/:companySlug/review-queue/:postId/reject
   *
   * Audit trail: reviewedBy='operator', reviewAction='reject', reviewedAt stored.
   *
   * @param companySlug - URL-safe company identifier (validates ownership)
   * @param postId - ContentPost ID
   * @returns Updated ContentPost with rejected variants
   */
  @Post(':postId/reject')
  async reject(
    @Param('companySlug') companySlug: string,
    @Param('postId') postId: string,
  ): Promise<any> {
    await this.resolveCompany(companySlug);
    return this.reviewQueueService.reject(postId);
  }

  /**
   * Regenerate: re-run the AI pipeline for an existing post.
   *
   * POST /companies/:companySlug/review-queue/:postId/regenerate
   *
   * Uses regenerateForPost — reuses the existing ContentPost record.
   *
   * @param companySlug - URL-safe company identifier (validates ownership)
   * @param postId - ContentPost ID
   * @returns Updated ContentPost with newly generated variants
   */
  @Post(':postId/regenerate')
  async regenerate(
    @Param('companySlug') companySlug: string,
    @Param('postId') postId: string,
  ): Promise<{ post: any; variants: any[] }> {
    await this.resolveCompany(companySlug);
    return this.reviewQueueService.regenerate(postId);
  }

  /**
   * Edit a single variant's caption and approve it.
   *
   * PATCH /companies/:companySlug/review-queue/:postId/variants/:variantId
   *
   * Stores originalCaption before overwriting.
   * Sets reviewAction='edit_approve', status='APPROVED'.
   * If all siblings become APPROVED, parent post is also set to APPROVED.
   *
   * @param variantId - PostVariant ID to edit
   * @param body - Request body with editedCaption string
   * @returns Updated PostVariant record
   */
  @Patch(':postId/variants/:variantId')
  async editVariant(
    @Param('variantId') variantId: string,
    @Body() body: { editedCaption: string },
  ): Promise<any> {
    return this.reviewQueueService.editVariant(variantId, body.editedCaption);
  }
}
