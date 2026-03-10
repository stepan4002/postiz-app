import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';

/**
 * TokenHealthState represents the current health of an OAuth token.
 *
 * - 'healthy': Token has >7 days remaining and no consecutive failures
 * - 'warning': Token has <7 days remaining OR has any consecutive failures
 * - 'expired': Token expiration date is in the past
 * - 'refresh_needed': The refreshNeeded flag is explicitly set
 */
export type TokenHealthState = 'healthy' | 'warning' | 'expired' | 'refresh_needed';

/**
 * Minimal integration shape needed for health calculation.
 * Compatible with the full Prisma Integration model.
 */
export interface IntegrationHealthInput {
  tokenExpiration: Date | null;
  refreshNeeded: boolean;
  consecutiveFailures: number;
}

/**
 * TokenHealthService
 *
 * Calculates the health state of an OAuth integration token.
 * Pure business logic — no DB access. Called by health endpoints (Plan 04)
 * and the refresh job (Plan 02) to determine token status.
 *
 * Priority order:
 *   1. refreshNeeded=true → 'refresh_needed' (explicit flag wins)
 *   2. tokenExpiration < now → 'expired'
 *   3. tokenExpiration < now+7days OR consecutiveFailures >= 1 → 'warning'
 *   4. null tokenExpiration → 'healthy' (non-expiring token, e.g. X provider)
 *   5. Otherwise → 'healthy'
 */
@Injectable()
export class TokenHealthService {
  private static readonly WARNING_THRESHOLD_DAYS = 7;

  getTokenHealth(integration: IntegrationHealthInput): TokenHealthState {
    const { tokenExpiration, refreshNeeded, consecutiveFailures } = integration;

    // Priority 1: Explicit refresh flag
    if (refreshNeeded) {
      return 'refresh_needed';
    }

    // Priority 2: Already expired
    if (tokenExpiration !== null && dayjs(tokenExpiration).isBefore(dayjs())) {
      return 'expired';
    }

    // Priority 3: Any consecutive failures → warning regardless of expiration
    if (consecutiveFailures >= 1) {
      return 'warning';
    }

    // Priority 3b: Less than 7 days remaining → warning
    if (
      tokenExpiration !== null &&
      dayjs(tokenExpiration).isBefore(dayjs().add(TokenHealthService.WARNING_THRESHOLD_DAYS, 'day'))
    ) {
      return 'warning';
    }

    // Priority 4: Null expiration (non-expiring like X provider) → healthy
    // Priority 5: Healthy
    return 'healthy';
  }
}
