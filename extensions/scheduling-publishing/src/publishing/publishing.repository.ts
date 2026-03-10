/**
 * PublishingRepository
 *
 * Database operations specific to the publishing engine:
 * - Finding variants in PUBLISHING status for the worker to process
 * - Updating variant publish results (success, failure, retry data)
 * - Querying all variants for a post to compute parent post status
 * - Updating ContentPost status based on variant outcomes
 *
 * Follows the same pattern as SchedulingRepository: injects `prisma: any`
 * to avoid circular deps. All queries are explicit to ensure clarity.
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class PublishingRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Find PostVariant records with status=PUBLISHING.
   *
   * These are the variants that the SchedulerTickJob has handed off for
   * platform API publishing. Ordered by publishAttempts ascending so
   * fresh attempts (0 prior failures) are preferred over already-retried variants.
   *
   * Includes post and post.brand relations for credential resolution.
   *
   * @param batchSize - Max number of variants to process per tick
   */
  async findPublishingVariants(batchSize: number): Promise<any[]> {
    return (this.prisma as any).postVariant.findMany({
      where: {
        status: 'PUBLISHING',
      },
      take: batchSize,
      orderBy: { publishAttempts: 'asc' },
      include: {
        post: {
          include: {
            brand: true,
          },
        },
      },
    });
  }

  /**
   * Update the publish result for a PostVariant.
   *
   * Used after every attempt (success or failure) to record the outcome.
   * The data object allows partial updates — only provided fields are changed.
   *
   * @param variantId - The PostVariant ID to update
   * @param data - Fields to update (status, platformPostId, platformUrl, attempts, etc.)
   */
  async updateVariantPublishResult(
    variantId: string,
    data: {
      status?: string;
      platformPostId?: string;
      platformUrl?: string;
      publishAttempts?: number;
      consecutiveFailures?: number;
      lastPublishError?: string | null;
      publishedAt?: Date | null;
    }
  ): Promise<any> {
    return (this.prisma as any).postVariant.update({
      where: { id: variantId },
      data,
    });
  }

  /**
   * Find all PostVariant records for a given ContentPost.
   * Used to determine if all variants have reached terminal status so the
   * parent ContentPost status can be updated accordingly.
   *
   * @param postId - The ContentPost ID
   */
  async findVariantsByPostId(postId: string): Promise<any[]> {
    return (this.prisma as any).postVariant.findMany({
      where: { postId },
    });
  }

  /**
   * Update the status of a ContentPost.
   *
   * Called when all variants for a post reach terminal status:
   * - All PUBLISHED -> ContentPost becomes PUBLISHED
   * - Any FAILED (all otherwise terminal) -> ContentPost becomes FAILED
   *
   * @param postId - The ContentPost ID to update
   * @param status - The new status (PUBLISHED or FAILED)
   */
  async updateContentPostStatus(postId: string, status: string): Promise<any> {
    return (this.prisma as any).contentPost.update({
      where: { id: postId },
      data: { status },
    });
  }
}
