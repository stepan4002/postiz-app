// @social/health barrel exports
// Phase 8 Plan 01: Health check endpoints for production monitoring

// Controller: HealthController — GET /health/live and GET /health/ready
export * from './health.controller';

// Indicators: DatabaseHealthIndicator, RedisHealthIndicator, MinioHealthIndicator
export * from './indicators/database.indicator';
export * from './indicators/redis.indicator';
export * from './indicators/minio.indicator';

// Module: HealthModule — NestJS module for registration in AppModule
export * from './health.module';
