import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AIConfigService, AIConfigData } from './ai-config.service';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

/**
 * Valid AI provider names supported by the system.
 */
const VALID_PROVIDERS = ['openai', 'anthropic', 'ollama'] as const;

/**
 * Request body for PUT /companies/:companySlug/ai-config
 */
interface UpdateAIConfigDto {
  defaultProvider?: string;
  preferredModels?: Record<string, string>;
  weeklyBudgetUsd?: number | null;
}

/**
 * AiConfigController
 *
 * Exposes GET and PUT endpoints for per-company AI configuration.
 * Follows the project's controller >> service pattern:
 *  - Controller resolves companySlug to companyId via PrismaService
 *  - AIConfigService works with IDs only
 *
 * Routes:
 *  GET  /companies/:companySlug/ai-config — returns per-company AI config with env-var defaults
 *  PUT  /companies/:companySlug/ai-config — updates per-company AI config
 */
@Controller('companies/:companySlug/ai-config')
export class AiConfigController {
  constructor(
    private readonly aiConfigService: AIConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Returns the current AI configuration for the given company.
   *
   * If no config exists in the DB, env-var defaults are returned
   * (AI_DEFAULT_PROVIDER, AI_WEEKLY_BUDGET_USD) per AIConfigService.findByCompany().
   *
   * @param companySlug - URL-friendly company identifier
   * @returns AIConfigData with defaultProvider, preferredModels, weeklyBudgetUsd
   * @throws NotFoundException if company slug doesn't resolve to a company
   */
  @Get()
  async getConfig(@Param('companySlug') companySlug: string): Promise<AIConfigData> {
    const company = await (this.prisma as any).company.findUnique({
      where: { slug: companySlug },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return this.aiConfigService.findByCompany(company.id);
  }

  /**
   * Updates the AI configuration for the given company.
   * Creates a new record if none exists (upsert).
   *
   * @param companySlug - URL-friendly company identifier
   * @param body - Partial config fields to update
   * @returns The updated AIConfigData
   * @throws NotFoundException if company slug doesn't resolve to a company
   * @throws BadRequestException if defaultProvider is not one of 'openai' | 'anthropic' | 'ollama'
   */
  @Put()
  async updateConfig(
    @Param('companySlug') companySlug: string,
    @Body() body: UpdateAIConfigDto,
  ): Promise<AIConfigData> {
    const company = await (this.prisma as any).company.findUnique({
      where: { slug: companySlug },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Validate defaultProvider if provided
    if (
      body.defaultProvider !== undefined &&
      !VALID_PROVIDERS.includes(body.defaultProvider as any)
    ) {
      throw new BadRequestException(
        `Invalid defaultProvider "${body.defaultProvider}". Must be one of: ${VALID_PROVIDERS.join(', ')}`,
      );
    }

    return this.aiConfigService.upsert(company.id, body);
  }
}
