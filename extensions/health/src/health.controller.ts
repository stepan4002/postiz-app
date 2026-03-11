/**
 * HealthController — Phase 8 Plan 01
 * Provides two health check endpoints:
 * - GET /health/live  — instant liveness check (process is up)
 * - GET /health/ready — readiness check (DB, Redis, MinIO all available)
 */
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthCheckResult } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './indicators/database.indicator';
import { RedisHealthIndicator } from './indicators/redis.indicator';
import { MinioHealthIndicator } from './indicators/minio.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly minio: MinioHealthIndicator,
  ) {}

  /**
   * GET /health/live
   * Used by Traefik for process-level health check.
   * Always returns 200 as long as the process is running.
   */
  @Get('live')
  liveness(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * GET /health/ready
   * Used by Traefik before routing traffic to the backend.
   * Returns @nestjs/terminus composite JSON with database, redis, minio status.
   * Returns 503 with error details if any dependency is down.
   */
  @Get('ready')
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
      () => this.minio.isHealthy('minio'),
    ]);
  }
}
