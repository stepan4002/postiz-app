/**
 * PostingRulesRepository
 *
 * Prisma DB layer for posting rules and related scheduling data.
 * All queries are scoped by companyId — no cross-company data leakage.
 *
 * Follows the project pattern: injects `prisma: any` to avoid circular
 * dependencies with the generated Prisma client type.
 *
 * Posting rules are stored in the `PostingRule` model and define:
 * - which platform to post to
 * - which accounts are targeted
 * - how frequently to post per day (frequency)
 * - which time slots are preferred ({ hour, minute } pairs)
 * - optional content type and hashtag restrictions
 */
import { Injectable } from '@nestjs/common';

export interface PostingRuleCreateData {
  companyId: string;
  name: string;
  platformId: string;
  accountIds: string[];
  frequency: number;
  timeSlots: { hour: number; minute: number }[];
  contentTypes: string[];
  hashtags: string[];
}

export interface PostingRuleUpdateData {
  name?: string;
  platformId?: string;
  accountIds?: string[];
  frequency?: number;
  timeSlots?: { hour: number; minute: number }[];
  contentTypes?: string[];
  hashtags?: string[];
  enabled?: boolean;
}

@Injectable()
export class PostingRulesRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Find all posting rules for a company, ordered by creation date (newest first).
   * Returns both enabled and disabled rules.
   */
  findByCompany(companyId: string): Promise<any[]> {
    return this.prisma.postingRule.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find only enabled posting rules for a company.
   * Used by SlotFinderService and ContentGapService to process active rules only.
   */
  findEnabledByCompany(companyId: string): Promise<any[]> {
    return this.prisma.postingRule.findMany({
      where: { companyId, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find a single posting rule by its ID.
   * Returns null if not found.
   */
  findById(id: string): Promise<any | null> {
    return this.prisma.postingRule.findUnique({
      where: { id },
    });
  }

  /**
   * Create a new posting rule for a company.
   * Sets enabled=true by default so the rule is immediately active.
   */
  create(data: PostingRuleCreateData): Promise<any> {
    return this.prisma.postingRule.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        platformId: data.platformId,
        accountIds: data.accountIds,
        frequency: data.frequency,
        timeSlots: data.timeSlots,
        contentTypes: data.contentTypes,
        hashtags: data.hashtags,
        enabled: true,
      },
    });
  }

  /**
   * Update an existing posting rule by ID.
   * Only provided fields are updated (partial update).
   */
  update(id: string, data: PostingRuleUpdateData): Promise<any> {
    return this.prisma.postingRule.update({
      where: { id },
      data,
    });
  }

  /**
   * Hard-delete a posting rule by ID.
   * No soft-delete — rules have no dependent child records in this model.
   */
  delete(id: string): Promise<any> {
    return this.prisma.postingRule.delete({
      where: { id },
    });
  }

  /**
   * Find ContentPost records for a company within a date range.
   * Includes posts with status SCHEDULED or PUBLISHED.
   *
   * Used by SlotFinderService to detect which slots are already occupied,
   * and by ContentGapService to count actual posts vs expected frequency.
   *
   * Selects: id, scheduledAt, platformId, status — minimal projection for performance.
   */
  findScheduledPostsInRange(
    companyId: string,
    from: Date,
    to: Date,
  ): Promise<any[]> {
    return this.prisma.contentPost.findMany({
      where: {
        companyId,
        status: { in: ['SCHEDULED', 'PUBLISHED'] },
        scheduledAt: {
          gte: from,
          lte: to,
        },
      },
      select: {
        id: true,
        scheduledAt: true,
        platformId: true,
        status: true,
      },
    });
  }

  /**
   * Get the timezone configured for a company.
   * Defaults to 'UTC' if the company record has no timezone set.
   */
  async findCompanyTimezone(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    return company?.timezone ?? 'UTC';
  }

  /**
   * Find all distinct companyIds that have at least one enabled posting rule.
   * Used by ContentGapCron to enumerate companies for gap detection.
   */
  async findCompaniesWithEnabledRules(): Promise<string[]> {
    const rules = await this.prisma.postingRule.findMany({
      where: { enabled: true },
      select: { companyId: true },
      distinct: ['companyId'],
    });
    return rules.map((r: any) => r.companyId);
  }
}
