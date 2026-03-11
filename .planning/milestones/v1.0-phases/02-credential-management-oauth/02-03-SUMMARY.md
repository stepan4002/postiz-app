---
phase: 02-credential-management-oauth
plan: 03
subsystem: auth
tags: [credential-service, oauth, redis, nestjs-module, brand-linking, aes-256-gcm, social-account, prisma]

# Dependency graph
requires:
  - phase: 02-credential-management-oauth
    plan: 01
    provides: TokenEncryptionService, tokenEncrypted field on Integration
  - phase: 02-credential-management-oauth
    plan: 02
    provides: TokenHealthService, CredentialRepository, TokenRefreshJob

provides:
  - "CredentialService with encrypt-on-write / decrypt-on-read wrapping Integration tokens"
  - "OAuthBrandController with POST /api/credentials/oauth/start and /api/credentials/oauth/callback"
  - "CredentialManagementModule registering all services + controllers, imported in AppModule"
  - "@social/credential-management path alias in tsconfig.base.json"

affects:
  - apps/backend (AppModule now imports CredentialManagementModule)
  - 02-04 (TokenHealthController already existed; module now wires it)

# Tech tracking
tech-stack:
  added: ["@nestjs/schedule ^4.0.0 added to credential-management package.json"]
  patterns:
    - "Redis brand:{state} key for OAuth brand context — 600s TTL, set in start, retrieved+deleted in callback"
    - "PrismaService direct injection in controllers — cast to any for custom Brand/SocialAccount models"
    - "Interface-based factory providers in NestJS module — useFactory pattern for services with interface constructors"
    - "Meta parent-child token handling via rootInternalId — parent Integration encrypted alongside child page token"

key-files:
  created:
    - extensions/credential-management/src/credential/credential.service.ts
    - extensions/credential-management/src/oauth/oauth.brand.controller.ts
    - extensions/credential-management/src/credential-management.module.ts
  modified:
    - extensions/credential-management/src/index.ts
    - extensions/credential-management/src/refresh/token.refresh.job.ts
    - extensions/credential-management/package.json
    - apps/backend/src/app.module.ts
    - tsconfig.base.json
    - DIVERGENCE.md

key-decisions:
  - "CredentialService uses ICredentialPrismaService interface — testable without DB, PrismaService injected via module factory"
  - "OAuthBrandController uses PrismaService directly — brand/socialAccount accessed via (prisma as any) for custom models"
  - "@Cron decorator added to TokenRefreshJob.refreshExpiringTokens() here in Plan 03 as planned in Plan 02 summary"
  - "ScheduleModule.forRoot() registered in CredentialManagementModule — not in AppModule to keep scheduling encapsulated"
  - "saveCredential() called from callback endpoint — upstream IntegrationService.createOrUpdateIntegration() saves token first, then we encrypt-in-place"
  - "tsconfig.base.json path alias added — enables import { CredentialManagementModule } from '@social/credential-management' in AppModule"

requirements-completed: [R3.1, R3.6]

# Metrics
duration: 25min
completed: 2026-03-10
---

# Phase 2 Plan 03: CredentialService, OAuthBrandController, CredentialManagementModule Summary

**CredentialService (AES-256-GCM encrypt-on-write/decrypt-on-read), OAuthBrandController (brand-scoped OAuth with Redis state), and CredentialManagementModule wiring all Phase 2 services into AppModule**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-10T16:28:00Z
- **Completed:** 2026-03-10T16:53:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Implemented `CredentialService` with encrypt-on-write via `TokenEncryptionService.encrypt()`, backward-compatible decrypt-on-read (returns plaintext when `tokenEncrypted=false`), null-safe `decryptRefreshToken()`, and `encryptExistingToken()` for one-time legacy migration
- Implemented `OAuthBrandController` with POST `/api/credentials/oauth/start` (stores `brand:{state}` in Redis with 600s TTL alongside standard upstream `login:{state}` and `organization:{state}`) and POST `/api/credentials/oauth/callback` (retrieves brandId, encrypts tokens, upserts SocialAccount, handles Meta parent-child via rootInternalId)
- Created `CredentialManagementModule` importing `ScheduleModule.forRoot()`, wiring all services via factory providers (resolving interface-typed constructors), registering both `OAuthBrandController` and `TokenHealthController`
- Added `@Cron(CronExpression.EVERY_10_MINUTES)` decorator to `TokenRefreshJob.refreshExpiringTokens()` as planned in Plan 02 deferral note
- Registered `CredentialManagementModule` in `AppModule` after `MultiCompanyModule`
- Added `@social/credential-management` TypeScript path alias to `tsconfig.base.json`
- Updated `DIVERGENCE.md` with `app.module.ts` and `tsconfig.base.json` Phase 2 modifications

## Task Commits

1. **Task 1: CredentialService with encrypt-on-write and decrypt-on-read** — `17f21f24` (feat)
2. **Task 2: OAuthBrandController, CredentialManagementModule, AppModule registration** — `0a66b07b` (feat)

## Files Created/Modified

- `extensions/credential-management/src/credential/credential.service.ts` — CredentialService: saveCredential(), decryptToken(), decryptRefreshToken(), encryptExistingToken()
- `extensions/credential-management/src/oauth/oauth.brand.controller.ts` — OAuthBrandController: brand-scoped OAuth start + callback endpoints with Redis brand context
- `extensions/credential-management/src/credential-management.module.ts` — CredentialManagementModule with ScheduleModule, all service factory providers, both controllers
- `extensions/credential-management/src/index.ts` — Updated barrel: CredentialService, OAuthBrandController, TokenHealthController, CredentialManagementModule exports
- `extensions/credential-management/src/refresh/token.refresh.job.ts` — Added @Cron(EVERY_10_MINUTES) decorator to refreshExpiringTokens()
- `extensions/credential-management/package.json` — Added @nestjs/schedule ^4.0.0 dependency
- `apps/backend/src/app.module.ts` — Added CredentialManagementModule import and registration
- `tsconfig.base.json` — Added @social/credential-management path alias
- `DIVERGENCE.md` — Documented app.module.ts and tsconfig.base.json Phase 2 changes

## Decisions Made

- **Factory providers for interface constructors**: `CredentialRepository`, `CredentialService`, and `TokenRefreshJob` all use interface-typed constructor parameters (for testability without DB). The NestJS module wires real implementations via `useFactory` provider pattern. This avoids re-writing the services with class-typed constructors.
- **PrismaService direct in OAuthBrandController**: Controllers have the full PrismaService injected; custom Brand/SocialAccount models are accessed via `(this.prisma as any)` since they're not in the generated Prisma types until migration is applied.
- **@Cron deferred from Plan 02**: Plan 02 kept TokenRefreshJob free of `@nestjs/schedule` imports to keep unit tests simple. Plan 03 adds the decorator and the package dependency together with the module wiring.
- **ScheduleModule in CredentialManagementModule, not AppModule**: Keeps scheduling logic encapsulated within the credential management feature module, consistent with the extension zone pattern.
- **saveCredential() called in callback, not start**: The upstream `IntegrationService.createOrUpdateIntegration()` is responsible for initial token persistence. Our callback encrypts the already-stored token in-place. This avoids intercepting the upstream flow.
- **SocialAccount upsert by brandId+platform**: The `@@unique([brandId, platform])` constraint allows upsert. Each brand has at most one integration per platform, which is the correct model (one LinkedIn account per brand).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] @Cron decorator added to TokenRefreshJob**
- **Found during:** Task 2 (wiring module)
- **Issue:** Plan 02 explicitly deferred the `@Cron` decorator to Plan 03. Without it, the cron job would never run even with `ScheduleModule.forRoot()` registered.
- **Fix:** Added `@Cron(CronExpression.EVERY_10_MINUTES)` to `refreshExpiringTokens()` and imported `Cron, CronExpression` from `@nestjs/schedule`
- **Files modified:** `extensions/credential-management/src/refresh/token.refresh.job.ts`
- **Commit:** `0a66b07b`

**2. [Rule 2 - Missing Critical Functionality] @social/credential-management path alias**
- **Found during:** Task 2 (AppModule import fails without it)
- **Issue:** AppModule's `import { CredentialManagementModule } from '@social/credential-management'` requires a TypeScript path alias, consistent with the @social/* pattern used for multi-company and company-context
- **Fix:** Added alias to `tsconfig.base.json` and documented in `DIVERGENCE.md`
- **Files modified:** `tsconfig.base.json`, `DIVERGENCE.md`
- **Commit:** `0a66b07b`

**3. [Info - TokenHealthController already existed] Plan 04 pre-created TokenHealthController**
- **Status:** Not a deviation — handled transparently
- **Observation:** `token.health.controller.ts` was committed at `a7396d5d` as part of Plan 04 work done before Plan 03 was executed. The full implementation was already present.
- **Action:** Used the existing implementation; no changes needed to the controller file itself.

## Issues Encountered

- Pre-existing upstream TypeScript error in `libraries/nestjs-libraries/src/emails/empty.provider.ts` (`Member 'validateEnvKeys' implicitly has an 'any[]' type`). This is out of scope — not caused by our changes and existed before Plan 03 work.

## User Setup Required

None — all services use existing environment variables (`ENCRYPTION_KEY`, `REDIS_URL`, `DATABASE_URL`). No new env vars needed.

**Pending database operations (when Docker is running):**
```bash
pnpm run prisma:migrate  # Apply the Integration token health fields migration
```

**Then the OAuth brand flow is ready:**
- POST `/api/credentials/oauth/start` — returns OAuth URL + state for brand-scoped connect
- POST `/api/credentials/oauth/callback` — encrypts tokens + links SocialAccount after upstream callback

## Next Phase Readiness

- All Phase 2 services are wired: encryption, health, refresh cron, OAuth brand context
- `TokenHealthController` (GET `/api/credentials/health`) is registered in the module — Plan 04 can focus on enhancements
- `CredentialManagementModule` is in `AppModule` — Phase 3 can import `CredentialService` and `TokenEncryptionService` for AI service credential management

## Self-Check: PASSED

All created files verified present. Both commits verified in git log.

- `extensions/credential-management/src/credential/credential.service.ts` — FOUND
- `extensions/credential-management/src/oauth/oauth.brand.controller.ts` — FOUND
- `extensions/credential-management/src/credential-management.module.ts` — FOUND
- `17f21f24` — FOUND
- `0a66b07b` — FOUND

---
*Phase: 02-credential-management-oauth*
*Completed: 2026-03-10*
