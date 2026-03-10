import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { AIConfigService } from '../config/ai-config.service';

dayjs.extend(utc);

/**
 * Minimal Prisma interface for BudgetCircuitBreaker.
 * Only requires the aggregate query on AICostLog.
 */
export interface IBudgetCircuitBreakerPrismaService {
  aICostLog: {
    aggregate(args: object): Promise<any>;
  };
}

/**
 * BudgetExceededError
 *
 * Thrown by BudgetCircuitBreaker when a company's weekly AI spend
 * has reached or exceeded their configured budget limit.
 *
 * Contains structured metadata for logging and user-facing messages.
 */
export class BudgetExceededError extends Error {
  readonly companyId: string;
  readonly spent: number;
  readonly budget: number;

  constructor(companyId: string, spent: number, budget: number) {
    super(
      `Weekly AI budget exceeded for company ${companyId}: spent $${spent.toFixed(2)} of $${budget.toFixed(2)} limit`
    );
    this.name = 'BudgetExceededError';
    this.companyId = companyId;
    this.spent = spent;
    this.budget = budget;

    // Restore prototype chain (required for proper instanceof checks in TypeScript)
    Object.setPrototypeOf(this, BudgetExceededError.prototype);
  }
}

/**
 * BudgetCircuitBreaker
 *
 * Enforces weekly AI spending budgets per company.
 *
 * Before making an AI call, the caller should invoke checkBudget(companyId).
 * If the company has a budget configured and has already spent >= their limit
 * for the current UTC week, BudgetExceededError is thrown.
 *
 * If no budget is configured (weeklyBudgetUsd: null), calls are always allowed.
 *
 * Weekly window: starts at UTC startOf('week') (Sunday 00:00:00 UTC).
 */
@Injectable()
export class BudgetCircuitBreaker {
  constructor(
    private readonly prisma: IBudgetCircuitBreakerPrismaService,
    private readonly aiConfigService: AIConfigService
  ) {}

  /**
   * Checks whether the company has budget remaining for AI calls this week.
   *
   * @param companyId - The company to check budget for
   * @throws BudgetExceededError if the weekly budget has been reached or exceeded
   */
  async checkBudget(companyId: string): Promise<void> {
    const config = await this.aiConfigService.findByCompany(companyId);

    // null budget = unlimited — no check needed
    if (!config.weeklyBudgetUsd) {
      return;
    }

    const weekStart = dayjs().utc().startOf('week').toDate();

    const result = await (this.prisma as any).aICostLog.aggregate({
      where: {
        companyId,
        createdAt: { gte: weekStart },
      },
      _sum: { estimatedCostUsd: true },
    });

    const spentAmount = result._sum.estimatedCostUsd ?? 0;

    if (spentAmount >= config.weeklyBudgetUsd) {
      throw new BudgetExceededError(companyId, spentAmount, config.weeklyBudgetUsd);
    }
  }
}
