/**
 * PublishAttemptLogger
 *
 * Logs every publish attempt to the PublishAttempt table.
 * This provides the full audit trail required by R10.6.
 *
 * IMPORTANT: logAttempt MUST NEVER THROW.
 * Attempt logging is a side-effect of publishing — it must not block the
 * main publishing flow. Follows the same pattern as Phase 3 AICostLogger.
 *
 * If the DB write fails, we console.warn and move on.
 */

import { Injectable } from '@nestjs/common';
import { PublishAttemptRecord } from '../types/publishing.types';

@Injectable()
export class PublishAttemptLogger {
  constructor(private readonly prisma: any) {}

  /**
   * Log a single publish attempt to the PublishAttempt table.
   *
   * R10.6: Every publish attempt must be logged with timestamp, response, error.
   * This method NEVER throws — catches all DB errors and warns (non-blocking).
   *
   * @param record - The attempt record to persist
   */
  async logAttempt(record: PublishAttemptRecord): Promise<void> {
    try {
      await (this.prisma as any).publishAttempt.create({
        data: {
          variantId: record.variantId,
          attemptNumber: record.attemptNumber,
          timestamp: record.timestamp,
          success: record.success,
          responseCode: record.responseCode ?? null,
          responseBody: record.responseBody ?? null,
          error: record.error ?? null,
          errorType: record.errorType ?? null,
        },
      });
    } catch (err: any) {
      // Non-blocking: warn but do not rethrow — publishing must continue
      console.warn(
        `[PublishAttemptLogger] Failed to log attempt for variant ${record.variantId}: ${err?.message ?? String(err)}`
      );
    }
  }

  /**
   * Retrieve all publish attempts for a variant, ordered by timestamp descending.
   * Used by the failed-posts controller to display attempt history.
   *
   * @param variantId - The PostVariant ID to query attempts for
   * @returns Array of PublishAttempt records, newest first
   */
  async getAttemptsForVariant(variantId: string): Promise<any[]> {
    return (this.prisma as any).publishAttempt.findMany({
      where: { variantId },
      orderBy: { timestamp: 'desc' },
    });
  }
}
