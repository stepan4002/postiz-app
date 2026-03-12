import { Injectable } from '@nestjs/common';

/**
 * ContentIngestionRepository
 *
 * Data access layer for ContentSource and SourceItem Prisma models.
 * All queries are company-scoped for data isolation.
 *
 * Uses (prisma as any) pattern for PrismaService injection — consistent
 * with Phase 3–8 patterns in this codebase.
 */
@Injectable()
export class ContentIngestionRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Find all ContentSource records for a company.
   *
   * Includes a count of associated SourceItem records for display
   * in the source list view.
   *
   * @param companyId - Company scope for data isolation
   * @returns Array of ContentSource records with _count.items included
   */
  async findSourcesByCompany(companyId: string): Promise<any[]> {
    return this.prisma.contentSource.findMany({
      where: { companyId },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find all enabled ContentSource records across all companies.
   *
   * Used by the cron job to determine which sources to poll on each tick.
   * Only returns sources where enabled=true.
   *
   * @returns Array of all enabled ContentSource records
   */
  async findEnabledSources(): Promise<any[]> {
    return this.prisma.contentSource.findMany({
      where: { enabled: true },
      orderBy: { lastFetchedAt: 'asc' },
    });
  }

  /**
   * Find a single ContentSource by its ID, with item count.
   *
   * @param id - ContentSource ID
   * @returns ContentSource record with _count.items, or null if not found
   */
  async findSourceById(id: string): Promise<any | null> {
    return this.prisma.contentSource.findUnique({
      where: { id },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
  }

  /**
   * Create a new ContentSource record.
   *
   * @param data - Source fields: companyId, name, type, url?, config?, enabled
   * @returns The created ContentSource record
   */
  async createSource(data: {
    companyId: string;
    name: string;
    type: string;
    url?: string;
    config?: Record<string, any>;
    enabled?: boolean;
  }): Promise<any> {
    return this.prisma.contentSource.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        type: data.type,
        url: data.url ?? null,
        config: data.config ?? {},
        enabled: data.enabled ?? true,
      },
    });
  }

  /**
   * Update a ContentSource record by ID.
   *
   * Only updates fields that are explicitly provided.
   *
   * @param id - ContentSource ID
   * @param data - Partial update data
   * @returns The updated ContentSource record
   */
  async updateSource(
    id: string,
    data: Partial<{
      name: string;
      type: string;
      url: string;
      config: Record<string, any>;
      enabled: boolean;
    }>,
  ): Promise<any> {
    return this.prisma.contentSource.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a ContentSource record by ID.
   *
   * Cascades to associated SourceItem records (enforced at DB level via
   * onDelete: Cascade in Prisma schema).
   *
   * @param id - ContentSource ID
   * @returns The deleted ContentSource record
   */
  async deleteSource(id: string): Promise<any> {
    return this.prisma.contentSource.delete({
      where: { id },
    });
  }

  /**
   * Find SourceItem records for a source, with optional status filter and pagination.
   *
   * Returns items ordered newest-first to surface recently fetched content.
   *
   * @param sourceId - ContentSource ID to scope items to
   * @param status - Optional status filter ('pending', 'used', 'dismissed')
   * @param page - Page number (1-based, default 1)
   * @param limit - Page size (default 20)
   * @returns Paginated items with total count
   */
  async findItemsBySource(
    sourceId: string,
    status?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ items: any[]; total: number }> {
    const where: any = { sourceId };
    if (status) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      this.prisma.sourceItem.findMany({
        where,
        orderBy: { fetchedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sourceItem.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Create (or upsert) a SourceItem record.
   *
   * Uses upsert keyed on (sourceId, externalId) to prevent duplicates
   * across repeated fetches. On conflict, updates content fields only —
   * preserves status changes made by operators.
   *
   * @param data - Item fields: sourceId, externalId, title, content, url, imageUrl?
   * @returns The created or updated SourceItem record
   */
  async createItem(data: {
    sourceId: string;
    externalId: string;
    title: string;
    content: string;
    url: string;
    imageUrl?: string;
  }): Promise<any> {
    return this.prisma.sourceItem.upsert({
      where: {
        sourceId_externalId: {
          sourceId: data.sourceId,
          externalId: data.externalId,
        },
      },
      create: {
        sourceId: data.sourceId,
        externalId: data.externalId,
        title: data.title,
        content: data.content,
        url: data.url,
        imageUrl: data.imageUrl ?? null,
        status: 'pending',
        fetchedAt: new Date(),
      },
      update: {
        title: data.title,
        content: data.content,
        url: data.url,
        imageUrl: data.imageUrl ?? null,
        fetchedAt: new Date(),
      },
    });
  }

  /**
   * Update a SourceItem's status field.
   *
   * Called by service layer to mark items as 'used' or 'dismissed'.
   *
   * @param id - SourceItem ID
   * @param status - New status: 'pending' | 'used' | 'dismissed'
   * @returns The updated SourceItem record
   */
  async updateItemStatus(id: string, status: string): Promise<any> {
    return this.prisma.sourceItem.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Update the lastFetchedAt timestamp for a ContentSource.
   *
   * Called at the end of each successful fetch cycle to track recency.
   *
   * @param id - ContentSource ID
   * @returns The updated ContentSource record
   */
  async updateSourceLastFetched(id: string): Promise<any> {
    return this.prisma.contentSource.update({
      where: { id },
      data: { lastFetchedAt: new Date() },
    });
  }
}
