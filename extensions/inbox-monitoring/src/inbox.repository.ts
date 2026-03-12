/**
 * InboxRepository
 *
 * Prisma data layer for all inbox monitoring queries.
 * All queries are strictly scoped by companyId — Company A never sees Company B data.
 *
 * Table: InboxItem (mapped via Prisma model inboxItem)
 *
 * Deduplication strategy:
 * - create() uses upsert keyed on (platform, externalId) composite unique
 * - This guarantees idempotent ingestion: running the cron twice won't duplicate items
 *
 * Pagination pattern:
 * - Follows the same (page, limit, skip) pattern as CompanyMediaRepository
 * - Returns { items, total, page, totalPages } for consistent API responses
 *
 * Status lifecycle:
 *   unread -> read -> archived
 *
 * Sentiment values (set by AI analysis, not by user):
 *   positive | neutral | negative | mixed
 */

import { Injectable } from '@nestjs/common';

export interface CreateInboxItemData {
  companyId: string;
  platform: string;
  externalId: string;
  type: 'comment' | 'dm' | 'mention' | 'review';
  authorName?: string;
  authorAvatar?: string;
  content: string;
  postId?: string;
  parentId?: string;
  receivedAt: Date;
}

export interface InboxFilters {
  platform?: string;
  status?: string;
  type?: string;
}

export interface PaginatedInboxResult {
  items: any[];
  total: number;
  page: number;
  totalPages: number;
}

@Injectable()
export class InboxRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Return a paginated list of inbox items for a company.
   *
   * Supports optional filters for platform, status, and type.
   * Results are ordered by receivedAt descending (newest first).
   *
   * ISOLATION CONTRACT: companyId filter ensures Company A never sees Company B data.
   *
   * @param companyId - The company to fetch inbox items for
   * @param filters - Optional filters: platform, status, type
   * @param page - 1-based page number (default: 1)
   * @param limit - Items per page (default: 20)
   */
  async findByCompany(
    companyId: string,
    filters: InboxFilters = {},
    page = 1,
    limit = 20,
  ): Promise<PaginatedInboxResult> {
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (filters.platform) {
      where.platform = filters.platform;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.type) {
      where.type = filters.type;
    }

    const [items, total] = await Promise.all([
      this.prisma.inboxItem.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.inboxItem.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a single inbox item by its database ID.
   * Returns null if not found.
   *
   * @param id - Database primary key of the InboxItem
   */
  findById(id: string): Promise<any> {
    return this.prisma.inboxItem.findUnique({
      where: { id },
    });
  }

  /**
   * Count unread inbox items for a company.
   *
   * Used by the unread badge/counter in the UI.
   * Only counts items with status = 'unread'.
   *
   * @param companyId - The company to count unread items for
   */
  countUnread(companyId: string): Promise<number> {
    return this.prisma.inboxItem.count({
      where: { companyId, status: 'unread' },
    });
  }

  /**
   * Create or update an inbox item.
   *
   * Uses upsert keyed on the unique composite (platform, externalId) to guarantee
   * idempotent ingestion. If the item already exists, the content and receivedAt
   * are updated (in case the platform edits the original message).
   *
   * New items are created with status = 'unread' and sentiment = null.
   *
   * @param data - Normalized inbox item data from an adapter
   */
  create(data: CreateInboxItemData): Promise<any> {
    return this.prisma.inboxItem.upsert({
      where: {
        platform_externalId: {
          platform: data.platform,
          externalId: data.externalId,
        },
      },
      update: {
        // Update content in case the platform edited the original message
        content: data.content,
        authorName: data.authorName ?? null,
        authorAvatar: data.authorAvatar ?? null,
        receivedAt: data.receivedAt,
      },
      create: {
        companyId: data.companyId,
        platform: data.platform,
        externalId: data.externalId,
        type: data.type,
        authorName: data.authorName ?? null,
        authorAvatar: data.authorAvatar ?? null,
        content: data.content,
        postId: data.postId ?? null,
        parentId: data.parentId ?? null,
        receivedAt: data.receivedAt,
        status: 'unread',
        sentiment: null,
        repliedWith: null,
      },
    });
  }

  /**
   * Update the status of an inbox item.
   *
   * Valid transitions:
   *   unread -> read (user opens the item)
   *   read   -> archived (user archives the item)
   *   unread -> archived (user archives without reading)
   *
   * @param id - Database primary key of the InboxItem
   * @param status - New status value ('unread' | 'read' | 'archived')
   */
  updateStatus(id: string, status: string): Promise<any> {
    return this.prisma.inboxItem.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Store the reply text that was sent in response to this inbox item.
   *
   * Called after the user submits a reply via the UI.
   * Sets repliedWith to the reply text and marks the item as 'read'
   * (since replying implicitly means the item was seen).
   *
   * @param id - Database primary key of the InboxItem
   * @param repliedWith - The reply text that was sent
   */
  updateReply(id: string, repliedWith: string): Promise<any> {
    return this.prisma.inboxItem.update({
      where: { id },
      data: {
        repliedWith,
        status: 'read',
      },
    });
  }

  /**
   * Update the AI-analyzed sentiment label for an inbox item.
   *
   * Called after InboxService.generateAIReply() completes sentiment analysis.
   * Sentiment is stored separately from the reply to support display in the UI
   * even when no reply has been sent yet.
   *
   * @param id - Database primary key of the InboxItem
   * @param sentiment - Sentiment classification ('positive' | 'neutral' | 'negative' | 'mixed')
   */
  updateSentiment(id: string, sentiment: string): Promise<any> {
    return this.prisma.inboxItem.update({
      where: { id },
      data: { sentiment },
    });
  }

  /**
   * Find an inbox item by platform + externalId composite key.
   *
   * Used by the cron job to check whether an item already exists before
   * deciding to create it. Prefer create() (which uses upsert) for ingestion —
   * use this method only when you need to read the existing record.
   *
   * @param platform - Platform identifier (e.g. 'instagram', 'facebook')
   * @param externalId - Platform-assigned unique ID for the item
   */
  findByExternalId(platform: string, externalId: string): Promise<any> {
    return this.prisma.inboxItem.findUnique({
      where: {
        platform_externalId: {
          platform,
          externalId,
        },
      },
    });
  }
}
