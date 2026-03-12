import { Injectable } from '@nestjs/common';

/**
 * EvergreenService — Identifies top-performing posts marked as evergreen
 * and recycles them into empty schedule slots.
 */
@Injectable()
export class EvergreenService {
  constructor(private readonly prisma: any) {}

  /**
   * Find posts eligible for recycling: evergreen=true, last used > minAgeDays ago
   */
  async findRecyclablePosts(
    companyId: string,
    minAgeDays: number = 30,
    limit: number = 20,
  ) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - minAgeDays);

    return this.prisma.contentPost.findMany({
      where: {
        companyId,
        isEvergreen: true,
        OR: [
          { evergreenLastUsed: null },
          { evergreenLastUsed: { lt: cutoff } },
        ],
        status: 'PUBLISHED',
      },
      include: {
        variants: {
          include: {
            metrics: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Mark a post as evergreen or remove the evergreen flag
   */
  async toggleEvergreen(postId: string, companyId: string, isEvergreen: boolean) {
    return this.prisma.contentPost.update({
      where: { id: postId, companyId },
      data: { isEvergreen },
    });
  }

  /**
   * Mark a post as recently recycled (update evergreenLastUsed)
   */
  async markRecycled(postId: string) {
    return this.prisma.contentPost.update({
      where: { id: postId },
      data: { evergreenLastUsed: new Date() },
    });
  }

  /**
   * Get evergreen posts for a company with their performance scores
   */
  async getEvergreenPosts(companyId: string, page: number = 1, perPage: number = 20) {
    const skip = (page - 1) * perPage;

    const [items, total] = await Promise.all([
      this.prisma.contentPost.findMany({
        where: { companyId, isEvergreen: true },
        include: {
          variants: {
            include: { metrics: true },
          },
        },
        orderBy: { evergreenLastUsed: 'asc' },
        skip,
        take: perPage,
      }),
      this.prisma.contentPost.count({
        where: { companyId, isEvergreen: true },
      }),
    ]);

    return { items, total, page, perPage };
  }
}
