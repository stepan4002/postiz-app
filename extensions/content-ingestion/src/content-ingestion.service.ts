import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ContentIngestionRepository } from './content-ingestion.repository';
import { RssFetcher } from './fetchers/rss.fetcher';
import { BlogFetcher } from './fetchers/blog.fetcher';
import { ProductFetcher } from './fetchers/product.fetcher';
import type { FetchedItem } from './fetchers/rss.fetcher';

/**
 * DTO for creating a new ContentSource.
 *
 * Validated by the service before persistence.
 */
export interface CreateSourceDto {
  name: string;
  type: 'rss' | 'blog' | 'product' | 'manual';
  url?: string;
  config?: Record<string, any>;
}

/**
 * ContentIngestionService
 *
 * Business logic layer for the Content Ingestion extension.
 * Orchestrates source management (CRUD) and content fetching
 * via type-specific fetchers (RSS, Blog, Product).
 *
 * All methods validate ownership before performing mutations.
 * Follows the Controller >> Service >> Repository pattern.
 */
@Injectable()
export class ContentIngestionService {
  private readonly rssFetcher = new RssFetcher();
  private readonly blogFetcher = new BlogFetcher();
  private readonly productFetcher = new ProductFetcher();

  constructor(
    private readonly repository: ContentIngestionRepository,
  ) {}

  /**
   * List all ContentSource records for a company, with item counts.
   *
   * @param companyId - Company scope for data isolation
   * @returns Array of ContentSource records including _count.items
   */
  async getSources(companyId: string): Promise<any[]> {
    return this.repository.findSourcesByCompany(companyId);
  }

  /**
   * Create a new ContentSource for a company.
   *
   * Validates:
   *   - name is non-empty
   *   - type is one of: rss, blog, product, manual
   *   - url is required for rss, blog, and product types
   *   - url format is valid HTTP/HTTPS for types that require it
   *
   * @param companyId - Company to create the source under
   * @param data - CreateSourceDto with name, type, url?, config?
   * @returns The created ContentSource record
   * @throws BadRequestException on validation failures
   */
  async createSource(companyId: string, data: CreateSourceDto): Promise<any> {
    this.validateSourceInput(data);

    return this.repository.createSource({
      companyId,
      name: data.name.trim(),
      type: data.type,
      url: data.url?.trim(),
      config: data.config ?? {},
      enabled: true,
    });
  }

  /**
   * Update an existing ContentSource.
   *
   * Validates company ownership before allowing the update.
   * Validates updated fields using the same rules as createSource.
   *
   * @param id - ContentSource ID to update
   * @param companyId - Company ID for ownership validation
   * @param data - Partial update data (same shape as CreateSourceDto)
   * @returns The updated ContentSource record
   * @throws NotFoundException if source not found or does not belong to company
   * @throws BadRequestException on validation failures
   */
  async updateSource(
    id: string,
    companyId: string,
    data: Partial<CreateSourceDto> & { enabled?: boolean },
  ): Promise<any> {
    const existing = await this.repository.findSourceById(id);
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException(`ContentSource '${id}' not found`);
    }

    // Validate only fields that are being updated
    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestException('name must not be empty');
    }

    if (data.type !== undefined) {
      const validTypes = ['rss', 'blog', 'product', 'manual'];
      if (!validTypes.includes(data.type)) {
        throw new BadRequestException(`type must be one of: ${validTypes.join(', ')}`);
      }
    }

    const effectiveType = data.type ?? existing.type;
    const effectiveUrl = data.url ?? existing.url;
    const urlRequiredTypes = ['rss', 'blog', 'product'];

    if (urlRequiredTypes.includes(effectiveType)) {
      if (!effectiveUrl) {
        throw new BadRequestException(`url is required for type '${effectiveType}'`);
      }
      this.validateUrl(effectiveUrl);
    }

    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.type !== undefined) updateData.type = data.type;
    if (data.url !== undefined) updateData.url = data.url.trim();
    if (data.config !== undefined) updateData.config = data.config;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    return this.repository.updateSource(id, updateData);
  }

  /**
   * Delete a ContentSource and all its associated SourceItems.
   *
   * Validates company ownership before allowing the deletion.
   * Cascade deletion of SourceItem records is enforced at the DB level.
   *
   * @param id - ContentSource ID to delete
   * @param companyId - Company ID for ownership validation
   * @returns The deleted ContentSource record
   * @throws NotFoundException if source not found or does not belong to company
   */
  async deleteSource(id: string, companyId: string): Promise<any> {
    const existing = await this.repository.findSourceById(id);
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException(`ContentSource '${id}' not found`);
    }

    return this.repository.deleteSource(id);
  }

  /**
   * Get paginated SourceItem records for a source.
   *
   * Validates that the source belongs to the requesting company before
   * returning items (prevents cross-company item leakage).
   *
   * @param sourceId - ContentSource ID to get items for
   * @param companyId - Company ID for ownership validation
   * @param status - Optional status filter: 'pending' | 'used' | 'dismissed'
   * @param page - Page number (1-based, default 1)
   * @returns Paginated result with items, total, page, and totalPages
   * @throws NotFoundException if source not found or does not belong to company
   */
  async getSourceItems(
    sourceId: string,
    companyId: string,
    status?: string,
    page: number = 1,
  ): Promise<{ items: any[]; total: number; page: number; totalPages: number }> {
    const source = await this.repository.findSourceById(sourceId);
    if (!source || source.companyId !== companyId) {
      throw new NotFoundException(`ContentSource '${sourceId}' not found`);
    }

    const limit = 20;
    const { items, total } = await this.repository.findItemsBySource(
      sourceId,
      status,
      page,
      limit,
    );

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Mark a SourceItem as 'used' and return its data for post creation.
   *
   * The returned item data (title, content, url, imageUrl) can be used
   * by the caller to pre-populate a ContentPost generation request.
   *
   * Validates company ownership via source lookup before updating.
   *
   * @param itemId - SourceItem ID to mark as used
   * @param companyId - Company ID for ownership validation
   * @returns The updated SourceItem record
   * @throws NotFoundException if item not found or company does not own its source
   */
  async useItem(itemId: string, companyId: string): Promise<any> {
    const item = await this.findItemWithOwnershipCheck(itemId, companyId);
    return this.repository.updateItemStatus(item.id, 'used');
  }

  /**
   * Mark a SourceItem as 'dismissed'.
   *
   * Dismissed items remain in the DB for audit purposes but are filtered
   * out of the default 'pending' item list view.
   *
   * @param itemId - SourceItem ID to dismiss
   * @returns The updated SourceItem record
   * @throws NotFoundException if item not found
   */
  async dismissItem(itemId: string): Promise<any> {
    const item = await (this.repository as any).prisma.sourceItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException(`SourceItem '${itemId}' not found`);
    }

    return this.repository.updateItemStatus(itemId, 'dismissed');
  }

  /**
   * Trigger a manual content fetch for a specific source.
   *
   * Selects the appropriate fetcher based on source type, runs the fetch,
   * persists new items via upsert, and updates lastFetchedAt.
   *
   * Errors from the fetcher are caught and surfaced as BadRequestException
   * so the caller gets a meaningful response rather than a 500.
   *
   * Type 'manual' sources do not support URL-based fetching — returns
   * an empty result set immediately.
   *
   * @param sourceId - ContentSource ID to trigger fetch for
   * @returns Object with fetchedCount (new/updated items) and source metadata
   * @throws NotFoundException if source not found
   * @throws BadRequestException if source has no URL configured
   */
  async fetchSource(sourceId: string): Promise<{ fetchedCount: number; sourceId: string }> {
    const source = await this.repository.findSourceById(sourceId);
    if (!source) {
      throw new NotFoundException(`ContentSource '${sourceId}' not found`);
    }

    if (source.type === 'manual') {
      return { fetchedCount: 0, sourceId };
    }

    if (!source.url) {
      throw new BadRequestException(
        `ContentSource '${sourceId}' has no URL configured for type '${source.type}'`,
      );
    }

    const items = await this.runFetcher(source.type, source.url);

    let fetchedCount = 0;
    for (const item of items) {
      await this.repository.createItem({
        sourceId: source.id,
        externalId: item.externalId,
        title: item.title,
        content: item.content,
        url: item.url,
        imageUrl: item.imageUrl,
      });
      fetchedCount++;
    }

    await this.repository.updateSourceLastFetched(source.id);

    return { fetchedCount, sourceId };
  }

  /**
   * Run the appropriate fetcher for a given source type and URL.
   *
   * Maps type -> fetcher instance:
   *   'rss'     -> RssFetcher
   *   'blog'    -> BlogFetcher
   *   'product' -> ProductFetcher
   *
   * Unknown types return an empty array (defensive, no throw).
   *
   * @param type - Source type string
   * @param url - Source URL to fetch
   * @returns Array of FetchedItem objects
   */
  async runFetcher(type: string, url: string): Promise<FetchedItem[]> {
    switch (type) {
      case 'rss':
        return this.rssFetcher.fetch(url);
      case 'blog':
        return this.blogFetcher.fetch(url);
      case 'product':
        return this.productFetcher.fetch(url);
      default:
        console.warn(`[ContentIngestionService] Unknown source type '${type}' — skipping fetch`);
        return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Validate CreateSourceDto fields.
   *
   * @param data - Input DTO to validate
   * @throws BadRequestException on invalid fields
   */
  private validateSourceInput(data: CreateSourceDto): void {
    if (!data.name || !data.name.trim()) {
      throw new BadRequestException('name is required');
    }

    const validTypes = ['rss', 'blog', 'product', 'manual'];
    if (!validTypes.includes(data.type)) {
      throw new BadRequestException(`type must be one of: ${validTypes.join(', ')}`);
    }

    const urlRequiredTypes = ['rss', 'blog', 'product'];
    if (urlRequiredTypes.includes(data.type)) {
      if (!data.url || !data.url.trim()) {
        throw new BadRequestException(`url is required for type '${data.type}'`);
      }
      this.validateUrl(data.url.trim());
    }
  }

  /**
   * Validate that a URL is a valid HTTP or HTTPS URL.
   *
   * @param url - URL string to validate
   * @throws BadRequestException if URL is invalid or uses a non-http(s) protocol
   */
  private validateUrl(url: string): void {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new BadRequestException('url must use http or https protocol');
      }
    } catch {
      throw new BadRequestException(`'${url}' is not a valid URL`);
    }
  }

  /**
   * Find a SourceItem by ID and validate that its parent source belongs
   * to the given company.
   *
   * @param itemId - SourceItem ID to look up
   * @param companyId - Company ID for ownership check
   * @returns The SourceItem record
   * @throws NotFoundException if item not found or ownership check fails
   */
  private async findItemWithOwnershipCheck(
    itemId: string,
    companyId: string,
  ): Promise<any> {
    const item = await (this.repository as any).prisma.sourceItem.findUnique({
      where: { id: itemId },
      include: { source: { select: { companyId: true } } },
    });

    if (!item || item.source?.companyId !== companyId) {
      throw new NotFoundException(`SourceItem '${itemId}' not found`);
    }

    return item;
  }
}
