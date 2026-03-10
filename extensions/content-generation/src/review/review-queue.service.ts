import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentPostRepository } from '../posts/content-post.repository';
import { ContentPostService } from '../posts/content-post.service';
import type { CreatePostDto } from '../types/content.types';

/**
 * ReviewQueueService
 *
 * Implements the review workflow for ContentPost and PostVariant records:
 *   - findPending: lists posts awaiting operator review
 *   - approve: approves all variants and marks post APPROVED
 *   - reject: rejects all variants and returns post to DRAFT
 *   - regenerate: re-runs AI pipeline for an existing post via regenerateForPost
 *   - editVariant: edits a single variant caption and approves it
 *
 * All review actions store an audit trail:
 *   reviewedBy, reviewAction, reviewedAt, originalCaption (for edits)
 *
 * Follows Controller >> Service >> Repository pattern (Phase 5 Plan 03).
 */
@Injectable()
export class ReviewQueueService {
  constructor(
    private readonly repository: ContentPostRepository,
    private readonly contentPostService: ContentPostService,
    private readonly prisma: any,
  ) {}

  /**
   * Find all ContentPosts with status PENDING_REVIEW for a company.
   *
   * @param companyId - Company scope for data isolation
   * @param page - Page number (1-based, default 1)
   * @param limit - Page size (default 20)
   * @returns Paginated list of PENDING_REVIEW posts with variants included
   */
  async findPending(
    companyId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ posts: any[]; total: number; page: number; totalPages: number }> {
    const { posts, total } = await this.repository.findByCompany(
      companyId,
      'PENDING_REVIEW',
      page,
      limit,
    );

    return {
      posts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Approve a post: set all variant statuses to APPROVED, mark post APPROVED.
   *
   * Audit trail: reviewedBy, reviewAction='approve', reviewedAt on each variant.
   *
   * @param postId - ContentPost ID
   * @param reviewedBy - Operator identifier (default 'operator')
   * @returns Updated ContentPost record (fetched again after updates)
   */
  async approve(postId: string, reviewedBy: string = 'operator'): Promise<any> {
    const post = await this.repository.findById(postId);
    if (!post) {
      throw new NotFoundException(`ContentPost ${postId} not found`);
    }

    // Update all variants to APPROVED with audit trail
    const reviewedAt = new Date();
    for (const variant of post.variants) {
      await this.repository.updateVariant(variant.id, {
        status: 'APPROVED',
        reviewedBy,
        reviewAction: 'approve',
        reviewedAt,
      });
    }

    // Update post status to APPROVED
    await this.repository.updatePostStatus(postId, 'APPROVED');

    // Return the updated post
    return this.repository.findById(postId);
  }

  /**
   * Reject a post: set all variant statuses to REJECTED, return post to DRAFT.
   *
   * Audit trail: reviewedBy, reviewAction='reject', reviewedAt on each variant.
   * Post goes back to DRAFT for potential re-generation.
   *
   * @param postId - ContentPost ID
   * @param reviewedBy - Operator identifier (default 'operator')
   * @returns Updated ContentPost record
   */
  async reject(postId: string, reviewedBy: string = 'operator'): Promise<any> {
    const post = await this.repository.findById(postId);
    if (!post) {
      throw new NotFoundException(`ContentPost ${postId} not found`);
    }

    // Update all variants to REJECTED with audit trail
    const reviewedAt = new Date();
    for (const variant of post.variants) {
      await this.repository.updateVariant(variant.id, {
        status: 'REJECTED',
        reviewedBy,
        reviewAction: 'reject',
        reviewedAt,
      });
    }

    // Return post to DRAFT (rejected — ready for re-generation)
    await this.repository.updatePostStatus(postId, 'DRAFT');

    return this.repository.findById(postId);
  }

  /**
   * Regenerate variants for an existing post by re-running the AI pipeline.
   *
   * Uses ContentPostService.regenerateForPost() which reuses the existing
   * ContentPost record (does NOT create a new one).
   *
   * Extracts the original inputs (brandId, mediaId, brief, contentType, platforms)
   * from the existing post/variants and builds a CreatePostDto to pass through.
   *
   * @param postId - ContentPost ID to regenerate
   * @returns Updated ContentPost and newly generated PostVariant records
   */
  async regenerate(postId: string): Promise<{ post: any; variants: any[] }> {
    const existingPost = await this.repository.findById(postId);
    if (!existingPost) {
      throw new NotFoundException(`ContentPost ${postId} not found`);
    }

    // Extract original inputs from the existing post and variants
    const dto: CreatePostDto = {
      brandId: existingPost.brandId,
      mediaId: existingPost.mediaId,
      brief: existingPost.brief,
      contentType: existingPost.contentType,
      platforms: existingPost.variants.map((v: any) => v.platform),
    };

    // Use regenerateForPost — reuses existing post record, does NOT call generate()
    return this.contentPostService.regenerateForPost(existingPost, dto);
  }

  /**
   * Edit a single variant's caption and approve it.
   *
   * Stores the original caption in originalCaption before overwriting.
   * Sets reviewAction='edit_approve', status='APPROVED'.
   * If all sibling variants are now APPROVED, updates the parent post to APPROVED.
   *
   * @param variantId - PostVariant ID to edit
   * @param editedCaption - New caption text
   * @param reviewedBy - Operator identifier (default 'operator')
   * @returns Updated PostVariant record
   */
  async editVariant(
    variantId: string,
    editedCaption: string,
    reviewedBy: string = 'operator',
  ): Promise<any> {
    const variant = await (this.prisma as any).postVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant) {
      throw new NotFoundException(`PostVariant ${variantId} not found`);
    }

    // Store current caption as originalCaption before overwriting
    const originalCaption = variant.caption;

    // Update variant: new caption, set APPROVED, audit trail
    const updatedVariant = await (this.prisma as any).postVariant.update({
      where: { id: variantId },
      data: {
        caption: editedCaption,
        originalCaption,
        status: 'APPROVED',
        reviewAction: 'edit_approve',
        reviewedBy,
        reviewedAt: new Date(),
      },
    });

    // Check if all siblings (same postId) are now APPROVED
    const siblings = await (this.prisma as any).postVariant.findMany({
      where: { postId: variant.postId },
    });

    const allApproved = siblings.every((s: any) => s.status === 'APPROVED');
    if (allApproved) {
      await this.repository.updatePostStatus(variant.postId, 'APPROVED');
    }

    return updatedVariant;
  }
}
