import { Injectable } from '@nestjs/common';

/**
 * AI configuration data for a company.
 * Contains provider preference, model overrides, and budget settings.
 */
export interface AIConfigData {
  defaultProvider: string;
  preferredModels: Record<string, string>;
  weeklyBudgetUsd: number | null;
}

/**
 * Minimal Prisma interface for AIConfigService.
 * Avoids tight coupling to the full PrismaClient while keeping tests simple.
 */
export interface IAIConfigPrismaService {
  aIConfig: {
    findUnique(args: object): Promise<any | null>;
    upsert(args: object): Promise<any>;
  };
}

/**
 * AIConfigService
 *
 * Provides per-company AI configuration with env-var defaults as fallback.
 * Companies that have never configured AI settings get sensible defaults
 * from environment variables (or hardcoded defaults if env vars are also unset).
 *
 * Design: One config record per company (@unique on companyId).
 * - findByCompany(): DB first, then env-var fallback
 * - upsert(): create or update company config
 * - getPreferredModel(): sync helper to extract model override for a task type
 */
@Injectable()
export class AIConfigService {
  constructor(private readonly prisma: IAIConfigPrismaService) {}

  /**
   * Retrieves AI configuration for a company.
   *
   * Priority:
   *   1. DB record (if exists)
   *   2. Env-var defaults (AI_DEFAULT_PROVIDER, AI_WEEKLY_BUDGET_USD)
   *   3. Hardcoded defaults ('openai', null budget = unlimited)
   *
   * @param companyId - The company to look up config for
   * @returns AIConfigData with all fields populated
   */
  async findByCompany(companyId: string): Promise<AIConfigData> {
    const record = await (this.prisma as any).aIConfig.findUnique({
      where: { companyId },
    });

    if (record) {
      return {
        defaultProvider: record.defaultProvider,
        preferredModels:
          typeof record.preferredModels === 'string'
            ? JSON.parse(record.preferredModels)
            : (record.preferredModels ?? {}),
        weeklyBudgetUsd: record.weeklyBudgetUsd ?? null,
      };
    }

    // Env-var fallback
    const weeklyBudget = process.env.AI_WEEKLY_BUDGET_USD
      ? parseFloat(process.env.AI_WEEKLY_BUDGET_USD)
      : null;

    return {
      defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'openai',
      preferredModels: {},
      weeklyBudgetUsd: weeklyBudget,
    };
  }

  /**
   * Creates or updates the AI configuration for a company.
   *
   * @param companyId - The company to configure
   * @param data - Partial AIConfigData fields to set
   * @returns The updated AIConfigData
   */
  async upsert(companyId: string, data: Partial<AIConfigData>): Promise<AIConfigData> {
    const record = await (this.prisma as any).aIConfig.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });

    return {
      defaultProvider: record.defaultProvider,
      preferredModels:
        typeof record.preferredModels === 'string'
          ? JSON.parse(record.preferredModels)
          : (record.preferredModels ?? {}),
      weeklyBudgetUsd: record.weeklyBudgetUsd ?? null,
    };
  }

  /**
   * Returns the preferred model override for a given task type,
   * or null if no override is configured.
   *
   * @param config - AIConfigData (from findByCompany)
   * @param taskType - The AI task type to look up
   * @returns Model identifier string, or null
   */
  getPreferredModel(config: AIConfigData, taskType: string): string | null {
    return config.preferredModels[taskType] ?? null;
  }
}
