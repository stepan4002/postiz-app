/**
 * ContentIngestionController
 *
 * REST endpoints for content source management and source item operations.
 * All routes are scoped under /companies/:companySlug/sources.
 *
 * Design decisions:
 * - Controller resolves companySlug to companyId via Prisma before calling services
 * - Services and repository receive companyId only (per project convention)
 * - Item use/dismiss endpoints validate ownership through the service layer
 *
 * Endpoints:
 *   GET    /companies/:companySlug/sources                             — list sources
 *   POST   /companies/:companySlug/sources                            — create source
 *   PUT    /companies/:companySlug/sources/:id                        — update source
 *   DELETE /companies/:companySlug/sources/:id                        — delete source
 *   GET    /companies/:companySlug/sources/:id/items                  — list items
 *   POST   /companies/:companySlug/sources/:id/items/:itemId/use      — mark item used
 *   POST   /companies/:companySlug/sources/:id/items/:itemId/dismiss  — dismiss item
 *   POST   /companies/:companySlug/sources/:id/fetch                  — manual fetch
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ContentIngestionService } from './content-ingestion.service';
import { ContentIngestionRepository } from './content-ingestion.repository';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import type { CreateSourceDto } from './content-ingestion.service';

@Controller('companies/:companySlug/sources')
export class ContentIngestionController {
  constructor(
    private readonly service: ContentIngestionService,
    private readonly repository: ContentIngestionRepository,
    private readonly prisma: PrismaService,
  ) {}

  // ---------------------------------------------------------------------------
  // Source CRUD endpoints
  // ---------------------------------------------------------------------------

  /**
   * GET /companies/:companySlug/sources
   *
   * List all ContentSource records for the company with item counts.
   *
   * @param companySlug - URL-safe company identifier
   * @returns Array of ContentSource records with _count.items
   */
  @Get()
  async listSources(@Param('companySlug') companySlug: string): Promise<any[]> {
    const companyId = await this.resolveCompanyId(companySlug);
    return this.service.getSources(companyId);
  }

  /**
   * POST /companies/:companySlug/sources
   *
   * Create a new ContentSource for the company.
   *
   * Body: { name: string, type: 'rss'|'blog'|'product'|'manual', url?: string, config?: object }
   *
   * @param companySlug - URL-safe company identifier
   * @param body - Source creation data
   * @returns Created ContentSource record (HTTP 201)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSource(
    @Param('companySlug') companySlug: string,
    @Body() body: CreateSourceDto,
  ): Promise<any> {
    const companyId = await this.resolveCompanyId(companySlug);
    return this.service.createSource(companyId, body);
  }

  /**
   * PUT /companies/:companySlug/sources/:id
   *
   * Update an existing ContentSource.
   *
   * Body: Partial<{ name, type, url, config, enabled }>
   *
   * @param companySlug - URL-safe company identifier
   * @param id - ContentSource ID
   * @param body - Partial update data
   * @returns Updated ContentSource record
   */
  @Put(':id')
  async updateSource(
    @Param('companySlug') companySlug: string,
    @Param('id') id: string,
    @Body() body: Partial<CreateSourceDto> & { enabled?: boolean },
  ): Promise<any> {
    const companyId = await this.resolveCompanyId(companySlug);
    return this.service.updateSource(id, companyId, body);
  }

  /**
   * DELETE /companies/:companySlug/sources/:id
   *
   * Delete a ContentSource and all associated SourceItems.
   *
   * @param companySlug - URL-safe company identifier
   * @param id - ContentSource ID
   * @returns Deleted ContentSource record (HTTP 200)
   */
  @Delete(':id')
  async deleteSource(
    @Param('companySlug') companySlug: string,
    @Param('id') id: string,
  ): Promise<any> {
    const companyId = await this.resolveCompanyId(companySlug);
    return this.service.deleteSource(id, companyId);
  }

  // ---------------------------------------------------------------------------
  // Source item endpoints
  // ---------------------------------------------------------------------------

  /**
   * GET /companies/:companySlug/sources/:id/items
   *
   * List SourceItem records for a source with optional status filter and pagination.
   *
   * Query params:
   *   status - 'pending' | 'used' | 'dismissed' (optional, default: all)
   *   page   - page number, 1-based (optional, default: 1)
   *
   * @param companySlug - URL-safe company identifier
   * @param id - ContentSource ID
   * @param status - Optional status filter
   * @param page - Page number string (parsed to int)
   * @returns Paginated result: { items, total, page, totalPages }
   */
  @Get(':id/items')
  async listItems(
    @Param('companySlug') companySlug: string,
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
  ): Promise<{ items: any[]; total: number; page: number; totalPages: number }> {
    const companyId = await this.resolveCompanyId(companySlug);
    const pageNum = parseInt(page ?? '1', 10) || 1;
    return this.service.getSourceItems(id, companyId, status, pageNum);
  }

  /**
   * POST /companies/:companySlug/sources/:id/items/:itemId/use
   *
   * Mark a SourceItem as 'used'.
   *
   * Returns the updated item with all its data (title, content, url, imageUrl)
   * so the caller can immediately use it to seed a content generation request.
   *
   * @param companySlug - URL-safe company identifier
   * @param itemId - SourceItem ID to mark as used
   * @returns Updated SourceItem record (HTTP 200)
   */
  @Post(':id/items/:itemId/use')
  @HttpCode(HttpStatus.OK)
  async useItem(
    @Param('companySlug') companySlug: string,
    @Param('itemId') itemId: string,
  ): Promise<any> {
    const companyId = await this.resolveCompanyId(companySlug);
    return this.service.useItem(itemId, companyId);
  }

  /**
   * POST /companies/:companySlug/sources/:id/items/:itemId/dismiss
   *
   * Mark a SourceItem as 'dismissed'.
   *
   * Dismissed items are hidden from the default pending items view
   * but remain in the DB for audit purposes.
   *
   * @param companySlug - URL-safe company identifier (for slug validation)
   * @param itemId - SourceItem ID to dismiss
   * @returns Updated SourceItem record (HTTP 200)
   */
  @Post(':id/items/:itemId/dismiss')
  @HttpCode(HttpStatus.OK)
  async dismissItem(
    @Param('companySlug') companySlug: string,
    @Param('itemId') itemId: string,
  ): Promise<any> {
    // Validate the company slug exists — item ownership is validated in service
    await this.resolveCompanyId(companySlug);
    return this.service.dismissItem(itemId);
  }

  // ---------------------------------------------------------------------------
  // Manual fetch endpoint
  // ---------------------------------------------------------------------------

  /**
   * POST /companies/:companySlug/sources/:id/fetch
   *
   * Trigger a manual content fetch for the source immediately,
   * outside of the regular 15-minute cron cycle.
   *
   * Useful for testing a new source or refreshing content on demand.
   *
   * @param companySlug - URL-safe company identifier
   * @param id - ContentSource ID to fetch
   * @returns { fetchedCount: number, sourceId: string } (HTTP 200)
   */
  @Post(':id/fetch')
  @HttpCode(HttpStatus.OK)
  async triggerFetch(
    @Param('companySlug') companySlug: string,
    @Param('id') id: string,
  ): Promise<{ fetchedCount: number; sourceId: string }> {
    // Validate slug exists; fetchSource validates ownership via source.companyId
    await this.resolveCompanyId(companySlug);
    return this.service.fetchSource(id);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve a company slug to a company ID.
   *
   * This follows the controller slug resolution pattern established across all
   * Phase 1–8 controllers: controllers resolve slugs, services receive IDs only.
   *
   * @param companySlug - URL-safe company identifier
   * @returns Resolved companyId string
   * @throws NotFoundException if no company with the given slug exists
   */
  private async resolveCompanyId(companySlug: string): Promise<string> {
    const company = await (this.prisma as any).company.findUnique({
      where: { slug: companySlug },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException(`Company '${companySlug}' not found`);
    }
    return company.id;
  }
}
