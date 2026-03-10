import { Injectable } from '@nestjs/common';
import type { ContentPostStatus, PostVariantStatus } from '../types/content.types';

/**
 * ContentPostRepository
 *
 * Data access layer for ContentPost and PostVariant Prisma models.
 * All queries are company-scoped for data isolation.
 *
 * Uses (prisma as any) pattern for PrismaService injection — consistent
 * with Phase 3 and Phase 4 patterns in this codebase.
 */
@Injectable()
export class ContentPostRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Create a new ContentPost record.
   *
   * @param data - Post fields including companyId, brandId, contentType, status
   * @returns The created ContentPost record
   */
  async createPost(data: {
    id?: string;
    companyId: string;
    brandId: string;
    mediaId?: string;
    brief?: string;
    contentType: string;
    status: ContentPostStatus;
  }): Promise<any> {
    return this.prisma.contentPost.create({ data });
  }

  /**
   * Create PostVariant records for a ContentPost.
   *
   * Uses createMany for efficiency, then findMany to return typed records
   * (createMany does not return created records in Prisma).
   *
   * @param postId - The parent ContentPost ID
   * @param variants - Array of variant data objects to create
   * @returns Array of created PostVariant records
   */
  async createVariants(
    postId: string,
    variants: Array<{
      platform: string;
      caption: string;
      hashtags: string[];
      mediaVariantId?: string;
      confidenceScore: number;
      status: PostVariantStatus;
      generatedBy: string;
    }>,
  ): Promise<any[]> {
    await this.prisma.postVariant.createMany({
      data: variants.map((v) => ({ ...v, postId })),
    });

    return this.prisma.postVariant.findMany({
      where: { postId },
    });
  }

  /**
   * Find all ContentPosts for a company with optional status filtering and pagination.
   *
   * @param companyId - Company scope for data isolation
   * @param status - Optional status filter (e.g., 'PENDING_REVIEW')
   * @param page - Page number (1-based, default 1)
   * @param limit - Page size (default 20)
   * @returns Paginated list of ContentPost records with PostVariant relations included
   */
  async findByCompany(
    companyId: string,
    status?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ posts: any[]; total: number }> {
    const where: any = { companyId };
    if (status) {
      where.status = status;
    }

    const [posts, total] = await Promise.all([
      this.prisma.contentPost.findMany({
        where,
        include: { variants: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contentPost.count({ where }),
    ]);

    return { posts, total };
  }

  /**
   * Find a single ContentPost by ID with all variants included.
   *
   * @param id - ContentPost ID
   * @returns ContentPost record with PostVariant relations, or null if not found
   */
  async findById(id: string): Promise<any | null> {
    return this.prisma.contentPost.findUnique({
      where: { id },
      include: { variants: true },
    });
  }

  /**
   * Update a ContentPost's status field.
   *
   * Called after all variants are scored and gated to set the parent post status.
   *
   * @param id - ContentPost ID
   * @param status - New status to apply
   * @returns The updated ContentPost record
   */
  async updatePostStatus(id: string, status: ContentPostStatus): Promise<any> {
    return this.prisma.contentPost.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Update a single PostVariant's fields.
   *
   * Used by the review queue to apply approve/reject/edit actions.
   *
   * @param id - PostVariant ID
   * @param data - Partial update data (caption, status, etc.)
   * @returns The updated PostVariant record
   */
  async updateVariant(id: string, data: Partial<{ caption: string; hashtags: string[]; status: PostVariantStatus; [key: string]: any }>): Promise<any> {
    return this.prisma.postVariant.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete all PostVariant records for a ContentPost.
   *
   * Called by regenerateForPost() to clear old variants before re-generation.
   * Uses deleteMany for atomic bulk deletion.
   *
   * @param postId - The parent ContentPost ID
   */
  async deleteVariantsByPostId(postId: string): Promise<void> {
    await this.prisma.postVariant.deleteMany({
      where: { postId },
    });
  }
}
