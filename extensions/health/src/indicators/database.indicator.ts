/**
 * DatabaseHealthIndicator — Phase 8 Plan 01
 * Checks database connectivity by running SELECT 1 via PrismaService.
 * Returns HealthIndicatorResult compatible with @nestjs/terminus format.
 */
import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';

/**
 * Minimal PrismaService interface to avoid importing the full @social/database package.
 * The real PrismaService is injected at runtime via NestJS DI.
 */
export interface IPrismaService {
  $queryRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
}

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: IPrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false, { error: message }),
      );
    }
  }
}
