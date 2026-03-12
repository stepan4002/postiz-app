/**
 * PostingRulesController
 *
 * REST API for managing company posting rules, detecting content gaps,
 * and finding available posting slots.
 *
 * Route prefix: /companies/:companySlug/posting-rules
 *
 * All routes resolve companySlug to companyId before delegating to services.
 * Services receive IDs only — this is the established project convention.
 *
 * Endpoints:
 *   GET    /companies/:companySlug/posting-rules                        — list all rules
 *   POST   /companies/:companySlug/posting-rules                        — create a rule
 *   PUT    /companies/:companySlug/posting-rules/:id                    — update a rule
 *   DELETE /companies/:companySlug/posting-rules/:id                    — delete a rule
 *   PATCH  /companies/:companySlug/posting-rules/:id/toggle             — enable/disable a rule
 *   GET    /companies/:companySlug/posting-rules/gaps                   — get content gaps
 *   GET    /companies/:companySlug/posting-rules/available-slots        — get available slots
 *
 * Note on route ordering: NestJS matches routes in declaration order.
 * The static routes `gaps` and `available-slots` must be declared BEFORE
 * the parameterised `:id` route to avoid being swallowed by the param handler.
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { PostingRulesService, CreatePostingRuleDto, UpdatePostingRuleDto } from './posting-rules.service';
import { SlotFinderService } from './slot-finder.service';
import { ContentGapService } from './content-gap.service';

@Controller('companies/:companySlug/posting-rules')
export class PostingRulesController {
  private readonly logger = new Logger(PostingRulesController.name);

  constructor(
    private readonly postingRulesService: PostingRulesService,
    private readonly slotFinderService: SlotFinderService,
    private readonly contentGapService: ContentGapService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------------------------------------------------------------------------
  // Static sub-routes — MUST be declared before :id param routes
  // ---------------------------------------------------------------------------

  /**
   * GET /companies/:companySlug/posting-rules/gaps
   *
   * Detect content gaps for the next N days.
   * Query params:
   *   - daysAhead: number of days to look ahead (optional, default 7, max 90)
   *
   * @returns Array of gap descriptors sorted by date ascending
   */
  @Get('gaps')
  async getContentGaps(
    @Param('companySlug') companySlug: string,
    @Query('daysAhead') daysAheadRaw?: string,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    const daysAhead = this.parsePositiveInt(daysAheadRaw, 7, 'daysAhead');

    this.logger.log(
      `getContentGaps: company=${companySlug} daysAhead=${daysAhead}`,
    );

    const gaps = await this.contentGapService.detectGaps(companyId, daysAhead);

    return {
      companySlug,
      daysAhead,
      gapCount: gaps.length,
      gaps,
    };
  }

  /**
   * GET /companies/:companySlug/posting-rules/available-slots
   *
   * Find available posting slots based on active rules and existing posts.
   * Query params:
   *   - daysAhead: number of days to look ahead (optional, default 7, max 90)
   *
   * @returns Array of available slot descriptors sorted by scheduledAt ascending
   */
  @Get('available-slots')
  async getAvailableSlots(
    @Param('companySlug') companySlug: string,
    @Query('daysAhead') daysAheadRaw?: string,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    const daysAhead = this.parsePositiveInt(daysAheadRaw, 7, 'daysAhead');

    this.logger.log(
      `getAvailableSlots: company=${companySlug} daysAhead=${daysAhead}`,
    );

    const slots = await this.slotFinderService.findAvailableSlots(companyId, daysAhead);

    return {
      companySlug,
      daysAhead,
      slotCount: slots.length,
      slots,
    };
  }

  // ---------------------------------------------------------------------------
  // Collection routes
  // ---------------------------------------------------------------------------

  /**
   * GET /companies/:companySlug/posting-rules
   *
   * List all posting rules for the company (enabled and disabled).
   *
   * @returns Array of PostingRule records
   */
  @Get()
  async listRules(@Param('companySlug') companySlug: string) {
    const companyId = await this.resolveCompanyId(companySlug);

    this.logger.log(`listRules: company=${companySlug}`);

    const rules = await this.postingRulesService.getRules(companyId);

    return {
      companySlug,
      count: rules.length,
      rules,
    };
  }

  /**
   * POST /companies/:companySlug/posting-rules
   *
   * Create a new posting rule for the company.
   * New rules are enabled by default.
   *
   * Body: CreatePostingRuleDto
   *   - name: string (required)
   *   - platformId: string (required)
   *   - accountIds?: string[]
   *   - frequency: number (required, 1-24)
   *   - timeSlots: { hour: number; minute: number }[] (required, non-empty)
   *   - contentTypes?: string[]
   *   - hashtags?: string[]
   *
   * @returns Created PostingRule record (HTTP 201)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRule(
    @Param('companySlug') companySlug: string,
    @Body() body: CreatePostingRuleDto,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    this.logger.log(
      `createRule: company=${companySlug} name="${body.name}" platform=${body.platformId}`,
    );

    return this.postingRulesService.createRule(companyId, body);
  }

  // ---------------------------------------------------------------------------
  // Item routes (:id)
  // ---------------------------------------------------------------------------

  /**
   * PUT /companies/:companySlug/posting-rules/:id
   *
   * Update an existing posting rule. All fields are optional —
   * only provided fields are updated (partial update semantics).
   *
   * Body: UpdatePostingRuleDto (all fields optional)
   *
   * @returns Updated PostingRule record
   */
  @Put(':id')
  async updateRule(
    @Param('companySlug') companySlug: string,
    @Param('id') id: string,
    @Body() body: UpdatePostingRuleDto,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    this.logger.log(`updateRule: company=${companySlug} id=${id}`);

    return this.postingRulesService.updateRule(id, companyId, body);
  }

  /**
   * DELETE /companies/:companySlug/posting-rules/:id
   *
   * Delete a posting rule. This is a hard delete — the rule is removed
   * permanently and cannot be recovered.
   *
   * @returns { deleted: true, id: string } (HTTP 200)
   */
  @Delete(':id')
  async deleteRule(
    @Param('companySlug') companySlug: string,
    @Param('id') id: string,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    this.logger.log(`deleteRule: company=${companySlug} id=${id}`);

    return this.postingRulesService.deleteRule(id, companyId);
  }

  /**
   * PATCH /companies/:companySlug/posting-rules/:id/toggle
   *
   * Enable or disable a posting rule without modifying other fields.
   * Body: { enabled: boolean }
   *
   * @returns Updated PostingRule record
   */
  @Patch(':id/toggle')
  async toggleRule(
    @Param('companySlug') companySlug: string,
    @Param('id') id: string,
    @Body('enabled') enabled: boolean,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);

    if (typeof enabled !== 'boolean') {
      throw new BadRequestException(
        'Request body must include "enabled" as a boolean value',
      );
    }

    this.logger.log(
      `toggleRule: company=${companySlug} id=${id} enabled=${enabled}`,
    );

    return this.postingRulesService.toggleRule(id, companyId, enabled);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve a company slug to a company ID.
   *
   * This follows the controller slug resolution pattern established in Phase 1:
   * controllers resolve slugs, services work with IDs only.
   *
   * @throws NotFoundException if no company exists with the given slug
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

  /**
   * Parse an optional query parameter as a positive integer.
   *
   * Returns defaultValue if the parameter is absent or empty.
   *
   * @throws BadRequestException if the value is present but not a valid positive integer
   */
  private parsePositiveInt(
    raw: string | undefined,
    defaultValue: number,
    paramName: string,
  ): number {
    if (raw === undefined || raw === '') {
      return defaultValue;
    }
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < 1) {
      throw new BadRequestException(
        `${paramName} must be a positive integer, got "${raw}"`,
      );
    }
    return parsed;
  }
}
