import { Injectable } from '@nestjs/common';

/**
 * ReportService — Aggregates metrics for weekly/monthly periods
 * and generates AI-powered natural language summaries.
 */
@Injectable()
export class ReportService {
  constructor(private readonly prisma: any) {}

  /**
   * Generate a report for a company over a specific period
   */
  async generateReport(
    companyId: string,
    type: 'weekly' | 'monthly',
    periodStart: Date,
    periodEnd: Date,
  ) {
    // Aggregate post metrics for the period
    const posts = await this.prisma.contentPost.findMany({
      where: {
        companyId,
        status: 'PUBLISHED',
        publishedAt: { gte: periodStart, lte: periodEnd },
      },
      include: {
        variants: {
          include: { metrics: true },
        },
      },
    });

    const totalPosts = posts.length;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalImpressions = 0;
    const platformBreakdown: Record<string, { posts: number; engagement: number }> = {};

    for (const post of posts) {
      for (const variant of (post as any).variants || []) {
        const metrics = (variant as any).metrics;
        if (!metrics) continue;

        const likes = metrics.likes || 0;
        const comments = metrics.comments || 0;
        const shares = metrics.shares || 0;
        const impressions = metrics.impressions || 0;

        totalLikes += likes;
        totalComments += comments;
        totalShares += shares;
        totalImpressions += impressions;

        const platform = variant.platform || 'unknown';
        if (!platformBreakdown[platform]) {
          platformBreakdown[platform] = { posts: 0, engagement: 0 };
        }
        platformBreakdown[platform].posts += 1;
        platformBreakdown[platform].engagement += likes + comments + shares;
      }
    }

    // Find top performing posts
    const topPerformers = posts
      .map((post: any) => {
        const totalEngagement = (post.variants || []).reduce((sum: number, v: any) => {
          const m = v.metrics;
          return sum + (m?.likes || 0) + (m?.comments || 0) + (m?.shares || 0);
        }, 0);
        return { postId: post.id, title: post.title || post.id, engagement: totalEngagement };
      })
      .sort((a: any, b: any) => b.engagement - a.engagement)
      .slice(0, 5);

    const data = {
      totalPosts,
      totalLikes,
      totalComments,
      totalShares,
      totalImpressions,
      totalEngagement: totalLikes + totalComments + totalShares,
      platformBreakdown,
      topPerformers,
    };

    // Upsert report summary
    const existing = await this.prisma.reportSummary.findFirst({
      where: { companyId, type, periodStart },
    });

    if (existing) {
      return this.prisma.reportSummary.update({
        where: { id: existing.id },
        data: { data, periodEnd },
      });
    }

    return this.prisma.reportSummary.create({
      data: {
        companyId,
        type,
        periodStart,
        periodEnd,
        data,
      },
    });
  }

  /**
   * Get reports for a company
   */
  async getReports(companyId: string, type?: string, page: number = 1, perPage: number = 10) {
    const skip = (page - 1) * perPage;
    const where: any = { companyId };
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      this.prisma.reportSummary.findMany({
        where,
        orderBy: { periodStart: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.reportSummary.count({ where }),
    ]);

    return { items, total, page, perPage };
  }

  /**
   * Get a single report by ID
   */
  async getReport(reportId: string, companyId: string) {
    return this.prisma.reportSummary.findFirst({
      where: { id: reportId, companyId },
    });
  }
}
