---
phase: 08-production-hardening-deployment
plan: "01"
subsystem: health-checks-logging
tags: [nestjs, terminus, health-check, pino, structured-logging, production]
dependency_graph:
  requires:
    - extensions/health depends on @nestjs/terminus (installed in monorepo root)
    - HealthModule.DatabaseHealthIndicator requires PrismaService from @gitroom/nestjs-libraries
    - HealthModule.RedisHealthIndicator requires ioredis (already installed)
    - HealthModule.MinioHealthIndicator requires @aws-sdk/client-s3 (already installed)
    - apps/backend/app.module.ts requires @social/health (HealthModule) and nestjs-pino (LoggerModule)
  provides:
    - GET /health/live — instant 200 liveness check for Traefik routing
    - GET /health/ready — composite readiness check (DB + Redis + MinIO) for traffic gating
    - Structured JSON logging via nestjs-pino in backend and orchestrator
  affects:
    - apps/backend startup: bufferLogs + useLogger(PinoLogger) intercepts all log output
    - apps/orchestrator startup: bufferLogs + useLogger(Logger) intercepts all worker logs
tech_stack:
  added:
    - "@nestjs/terminus ^10.x — NestJS health check module"
    - "nestjs-pino ^4.x — pino-based NestJS logger replacement"
    - "pino-http — pino HTTP middleware (required by nestjs-pino)"
    - "pino-pretty (dev) — readable log output during development"
  patterns:
    - "HealthIndicator extension pattern (database, redis, minio indicators)"
    - "IPrismaService local interface avoids circular imports (same pattern as Phase 7 ITokenEncryptionService)"
    - "forcePathStyle: true for S3Client/MinIO (same as extensions/media-library)"
    - "bufferLogs: true + useLogger early in bootstrap (from nestjs-pino Pitfall 3 avoidance)"
key_files:
  created:
    - extensions/health/package.json
    - extensions/health/tsconfig.json
    - extensions/health/tsconfig.spec.json
    - extensions/health/jest.config.ts
    - extensions/health/src/index.ts
    - extensions/health/src/health.module.ts
    - extensions/health/src/health.controller.ts
    - extensions/health/src/indicators/database.indicator.ts
    - extensions/health/src/indicators/redis.indicator.ts
    - extensions/health/src/indicators/minio.indicator.ts
    - extensions/health/src/__tests__/health.controller.spec.ts
  modified:
    - apps/backend/src/app.module.ts — added HealthModule + LoggerModule.forRoot()
    - apps/backend/src/main.ts — added bufferLogs + app.useLogger(PinoLogger)
    - apps/orchestrator/src/app.module.ts — added LoggerModule.forRoot() for worker JSON logging
    - apps/orchestrator/src/main.ts — added bufferLogs + app.useLogger(Logger)
    - tsconfig.base.json — added @social/health and @social/health/* path mappings
    - package.json — added @nestjs/terminus, nestjs-pino, pino-http, pino-pretty
    - pnpm-lock.yaml — updated lock file
decisions:
  - id: IPrismaService-local-interface
    summary: "IPrismaService local interface in database.indicator.ts avoids importing @gitroom/nestjs-libraries into health extension — same isolation pattern as Phase 7 ITokenEncryptionService"
  - id: pino-logger-early-registration
    summary: "bufferLogs: true + app.useLogger() called before startMcp() and any other setup to ensure ALL log output is captured (avoids Pitfall 3 from research notes)"
  - id: orchestrator-pino-logging
    summary: "LoggerModule.forRoot() added to orchestrator AppModule — Temporal workers run via NestJS DI, so pino intercepting NestJS Logger covers all worker log output"
  - id: redis-indicator-lazy-connect
    summary: "RedisHealthIndicator uses lazyConnect: true + maxRetriesPerRequest: 1 to fail fast on health checks without blocking app startup"
metrics:
  duration: 8min
  completed_date: "2026-03-11"
  tasks_completed: 2
  files_modified: 7
  files_created: 11
---

# Phase 8 Plan 01: Health Check Endpoints & Structured Logging Summary

**One-liner:** NestJS TerminusModule health extension with DB/Redis/MinIO indicators plus nestjs-pino JSON logging in backend and orchestrator

## What Was Built

### Task 1: Health Check Extension Package (@social/health)

Created `extensions/health/` as a new pnpm workspace package following the established extension pattern:

- **`DatabaseHealthIndicator`** — runs `this.prisma.$queryRaw\`SELECT 1\`` to verify PostgreSQL connectivity. Uses a local `IPrismaService` interface to avoid circular imports (same isolation pattern used by Phase 7's `ITokenEncryptionService`).

- **`RedisHealthIndicator`** — creates an ioredis `Redis` client from `REDIS_URL` env var, runs `ping()`, validates `PONG` response. Configured with `lazyConnect: true` and `maxRetriesPerRequest: 1` to fail fast without blocking startup.

- **`MinioHealthIndicator`** — creates an `S3Client` with `forcePathStyle: true` (required for MinIO), runs `HeadBucketCommand` against `MINIO_BUCKET`. Follows the same S3 client pattern as `extensions/media-library`.

- **`HealthController`** — `GET /health/live` returns instant `{ status: 'ok', timestamp }` (Traefik process check). `GET /health/ready` delegates to `HealthCheckService.check()` with all 3 indicators, returning @nestjs/terminus composite JSON format. Returns 503 with error details when any dependency is down.

- **`HealthModule`** — wires `TerminusModule`, all 3 indicators, and `PrismaService` via `useFactory` pattern.

- **Unit tests (4 passing):** mock all 3 indicators, test liveness returns `{ status: 'ok', timestamp }`, test readiness returns composite status, test 503 on `HealthCheckError`, test all 3 indicator functions are called.

### Task 2: AppModule + main.ts Integration

- **tsconfig.base.json** — added `@social/health` and `@social/health/*` path mappings so the extension is resolvable by the TypeScript compiler.

- **`apps/backend/src/app.module.ts`** — added `HealthModule` (health endpoints) and `LoggerModule.forRoot()` (nestjs-pino with pino-pretty in dev, raw JSON in production).

- **`apps/backend/src/main.ts`** — added `bufferLogs: true` in `NestFactory.create()` and `app.useLogger(app.get(PinoLogger))` before `startMcp()` and all other setup. This ensures ALL log output is structured JSON in production (NF5.4).

- **`apps/orchestrator/src/app.module.ts`** — added `LoggerModule.forRoot()` for structured JSON logging from Temporal worker processes.

- **`apps/orchestrator/src/main.ts`** — added `bufferLogs: true` and `app.useLogger(app.get(Logger))` for worker JSON logging coverage.

## Verification Results

- Health unit tests: **4/4 PASSING**
- Backend TypeScript compilation: **clean** (no new errors introduced)
- Pre-existing errors in library files (TS7008/TS7010/TS7018) are unchanged and ignored by jest config

## Deviations from Plan

None — plan executed exactly as written.

The one minor adaptation: `HealthModule.providers` uses a `useFactory` pattern to inject `PrismaService` into `DatabaseHealthIndicator` (which takes `IPrismaService` interface, not the concrete class) — this is consistent with the Phase 2/3 factory provider pattern throughout the codebase.

## Self-Check: PASSED

All created files confirmed present on disk. Both task commits (7fafa11e, 210d00cf) confirmed in git log.
