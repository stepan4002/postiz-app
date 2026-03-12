/**
 * InboxController
 *
 * Company-scoped REST API for inbox monitoring.
 * Route prefix: /companies/:companySlug/inbox
 *
 * Controller responsibilities:
 * - Resolve companySlug to companyId (slug resolution pattern — see media-library)
 * - Parse and validate query parameters
 * - Delegate all business logic to InboxService
 * - Return appropriate HTTP status codes
 *
 * Controller does NOT:
 * - Contain business logic
 * - Access the database directly (except for slug resolution)
 * - Perform authorization checks beyond slug resolution (InboxService handles ownership)
 *
 * Endpoints:
 *   GET  /companies/:companySlug/inbox                  — list inbox items (paginated, filterable)
 *   GET  /companies/:companySlug/inbox/unread-count     — get unread badge count
 *   PUT  /companies/:companySlug/inbox/:id/read         — mark item as read
 *   PUT  /companies/:companySlug/inbox/:id/archive      — mark item as archived
 *   POST /companies/:companySlug/inbox/:id/ai-reply     — generate AI reply suggestion
 *   POST /companies/:companySlug/inbox/:id/reply        — save a reply text against the item
 *
 * Note on route ordering:
 * NestJS matches routes in registration order. 'unread-count' is declared before
 * ':id' routes to prevent 'unread-count' from being interpreted as an ID parameter.
 */

import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { InboxService } from './inbox.service';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

@Controller('companies/:companySlug/inbox')
export class InboxController {
  private readonly logger = new Logger(InboxController.name);

  constructor(
    private readonly inboxService: InboxService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------------------------------------------------------------------------
  // GET /companies/:companySlug/inbox
  // ---------------------------------------------------------------------------

  /**
   * List inbox items for the company with optional filters and pagination.
   *
   * Query parameters:
   * - platform: filter by platform (e.g. 'instagram', 'facebook')
   * - status:   filter by status ('unread' | 'read' | 'archived')
   * - type:     filter by type ('comment' | 'dm' | 'mention' | 'review')
   * - page:     page number (1-based, default: 1)
   * - limit:    items per page (default: 20, max: 100)
   *
   * @returns PaginatedInboxResult { items, total, page, totalPages }
   */
  @Get()
  async listInbox(
    @Param('companySlug') companySlug: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 20;

    const filters: { platform?: string; status?: string; type?: string } = {};
    if (platform) filters.platform = platform;
    if (status) filters.status = status;
    if (type) filters.type = type;

    this.logger.log(
      `listInbox: companySlug=${companySlug} companyId=${companyId} filters=${JSON.stringify(filters)} page=${page} limit=${limit}`,
    );

    return this.inboxService.getInbox(companyId, filters, page, limit);
  }

  // ---------------------------------------------------------------------------
  // GET /companies/:companySlug/inbox/unread-count
  // ---------------------------------------------------------------------------

  /**
   * Return the count of unread inbox items for the company.
   *
   * Used by the sidebar navigation to render the unread badge.
   * This route must be declared before '/:id' routes to prevent
   * 'unread-count' from being captured as an ID parameter.
   *
   * @returns { count: number }
   */
  @Get('unread-count')
  async getUnreadCount(@Param('companySlug') companySlug: string) {
    const companyId = await this.resolveCompanyId(companySlug);

    this.logger.log(`getUnreadCount: companySlug=${companySlug} companyId=${companyId}`);

    return this.inboxService.getUnreadCount(companyId);
  }

  // ---------------------------------------------------------------------------
  // PUT /companies/:companySlug/inbox/:id/read
  // ---------------------------------------------------------------------------

  /**
   * Mark a single inbox item as read.
   *
   * Idempotent: marking an already-read item as read is a no-op.
   * Returns the updated item record.
   *
   * @param id - InboxItem database ID
   */
  @Put(':id/read')
  async markAsRead(
    @Param('companySlug') companySlug: string,
    @Param('id') id: string,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    this.logger.log(`markAsRead: companySlug=${companySlug} itemId=${id}`);

    return this.inboxService.markAsRead(id, companyId);
  }

  // ---------------------------------------------------------------------------
  // PUT /companies/:companySlug/inbox/:id/archive
  // ---------------------------------------------------------------------------

  /**
   * Mark a single inbox item as archived.
   *
   * Archived items are hidden from the default inbox view (which shows unread/read).
   * Returns the updated item record.
   *
   * @param id - InboxItem database ID
   */
  @Put(':id/archive')
  async markAsArchived(
    @Param('companySlug') companySlug: string,
    @Param('id') id: string,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    this.logger.log(`markAsArchived: companySlug=${companySlug} itemId=${id}`);

    return this.inboxService.markAsArchived(id, companyId);
  }

  // ---------------------------------------------------------------------------
  // POST /companies/:companySlug/inbox/:id/ai-reply
  // ---------------------------------------------------------------------------

  /**
   * Generate an AI-powered reply suggestion for an inbox item.
   *
   * No request body required.
   *
   * Side effect: updates the item's sentiment field in the database.
   *
   * @returns { suggestion: string, sentiment: string }
   */
  @Post(':id/ai-reply')
  async generateAIReply(
    @Param('companySlug') companySlug: string,
    @Param('id') id: string,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    this.logger.log(`generateAIReply: companySlug=${companySlug} itemId=${id}`);

    return this.inboxService.generateAIReply(id, companyId);
  }

  // ---------------------------------------------------------------------------
  // POST /companies/:companySlug/inbox/:id/reply
  // ---------------------------------------------------------------------------

  /**
   * Save a reply text against an inbox item.
   *
   * Request body: { replyText: string }
   *
   * Stores the reply text in the database and marks the item as read.
   * Does NOT send the reply to the platform API (that is handled by
   * platform-specific adapters when implemented).
   *
   * @returns The updated inbox item record
   */
  @Post(':id/reply')
  async saveReply(
    @Param('companySlug') companySlug: string,
    @Param('id') id: string,
    @Body('replyText') replyText: string,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    if (!replyText || replyText.trim().length === 0) {
      throw new NotFoundException('replyText body field is required and must not be empty');
    }

    this.logger.log(
      `saveReply: companySlug=${companySlug} itemId=${id} replyLength=${replyText.length}`,
    );

    return this.inboxService.saveReply(id, companyId, replyText);
  }

  // ---------------------------------------------------------------------------
  // Private: slug resolution
  // ---------------------------------------------------------------------------

  /**
   * Resolve a company slug to its database ID.
   *
   * Follows the controller slug resolution pattern established across all
   * other extension controllers (media-library, scheduling-publishing, etc.).
   *
   * Controllers resolve slugs; services receive IDs only.
   *
   * @param companySlug - URL-friendly company identifier
   * @throws NotFoundException if no company exists with this slug
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
