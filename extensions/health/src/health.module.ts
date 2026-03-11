/**
 * HealthModule — Phase 8 Plan 01
 * NestJS module wiring for health check endpoints.
 * Import this module in AppModule to register /health/live and /health/ready.
 */
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './indicators/database.indicator';
import { RedisHealthIndicator } from './indicators/redis.indicator';
import { MinioHealthIndicator } from './indicators/minio.indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    PrismaService,
    {
      provide: DatabaseHealthIndicator,
      useFactory: (prisma: PrismaService) => new DatabaseHealthIndicator(prisma),
      inject: [PrismaService],
    },
    RedisHealthIndicator,
    MinioHealthIndicator,
  ],
})
export class HealthModule {}
