import { Injectable } from '@nestjs/common';

/**
 * Parameters for logging an AI call cost entry.
 */
export interface AICostLogParams {
  companyId: string;
  postId?: string;
  provider: string;
  model: string;
  taskType: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

/**
 * Minimal Prisma interface for AICostLogger.
 * Avoids tight coupling to the full PrismaClient.
 */
export interface IAICostLogPrismaService {
  aICostLog: {
    create(args: object): Promise<any>;
  };
}

/**
 * AICostLogger
 *
 * Writes every AI call to the AICostLog table for cost tracking and analytics.
 *
 * Design: Non-blocking — if the DB write fails, a warning is logged but
 * the exception is swallowed. This ensures cost logging never interrupts
 * the actual AI call flow. The AICostLog is append-only (no updatedAt field).
 *
 * Every AI provider call should call log() after receiving a response,
 * passing the usage data from AICallResult.usage.
 */
@Injectable()
export class AICostLogger {
  constructor(private readonly prisma: IAICostLogPrismaService) {}

  /**
   * Logs an AI cost entry to the AICostLog table.
   *
   * This method never throws — failures are caught and logged as warnings
   * so that cost logging never blocks or fails the AI call.
   *
   * @param params - All required cost log fields including optional postId
   */
  async log(params: AICostLogParams): Promise<void> {
    try {
      await (this.prisma as any).aICostLog.create({
        data: {
          companyId: params.companyId,
          postId: params.postId ?? null,
          provider: params.provider,
          model: params.model,
          taskType: params.taskType,
          inputTokens: params.inputTokens,
          outputTokens: params.outputTokens,
          estimatedCostUsd: params.estimatedCostUsd,
        },
      });
    } catch (error: any) {
      console.warn('Failed to log AI cost:', error.message);
    }
  }
}
