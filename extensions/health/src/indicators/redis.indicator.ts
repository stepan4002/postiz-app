/**
 * RedisHealthIndicator — Phase 8 Plan 01
 * Checks Redis connectivity by running PING and verifying PONG response.
 * Uses ioredis (already installed in the monorepo).
 */
import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private redis: Redis;

  constructor() {
    super();
    // Create Redis client from REDIS_URL env var (same pattern used throughout project)
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      // Don't retry on startup — health checks should fail fast
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redis.ping();
      const isUp = pong === 'PONG';
      if (!isUp) {
        throw new Error(`Unexpected ping response: ${pong}`);
      }
      return this.getStatus(key, true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { error: message }),
      );
    }
  }
}
