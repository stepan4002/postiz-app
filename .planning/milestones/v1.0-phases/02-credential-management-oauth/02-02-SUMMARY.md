---
phase: 02-credential-management-oauth
plan: 02
subsystem: auth
tags: [dayjs, nestjs, cron, token-refresh, health-tracking, prisma, notifications, aes-256-gcm]

# Dependency graph
requires:
  - phase: 02-credential-management-oauth
    plan: 01
    provides: TokenEncryptionService, consecutiveFailures/lastRefreshedAt/tokenEncrypted fields on Integration model

provides:
  - "TokenHealthService with getTokenHealth() returning healthy/warning/expired/refresh_needed states"
  - "CredentialRepository with findTokensAt75Percent(), incrementFailureCount(), resetFailureCount()"
  - "TokenRefreshJob: @Cron proactive refresh at 75% lifetime, RUN_CRON guard, failure tracking, operator alerts on 3rd failure"

affects:
  - 02-03 (CredentialManagementModule wires these services into NestJS module)
  - 02-04 (health API endpoint uses TokenHealthService.getTokenHealth())

# Tech tracking
tech-stack:
  added: [dayjs ^1.11.10 (already in root node_modules; added to package.json)]
  patterns:
    - "RUN_CRON env var guard pattern for cron jobs (check at method entry)"
    - "Minimal interface pattern for cross-package dependencies (IRefreshIntegrationService, INotificationService) — avoids circular imports during unit testing"
    - "consecutiveFailures threshold alert: track current count, alert when about to reach ALERT_THRESHOLD"
    - "decryptIfNeeded helper: checks tokenEncrypted flag + isEncrypted() heuristic before decrypting"

key-files:
  created:
    - extensions/credential-management/src/health/token.health.service.ts
    - extensions/credential-management/src/refresh/credential.repository.ts
    - extensions/credential-management/src/refresh/token.refresh.job.ts
    - extensions/credential-management/src/__tests__/token.health.spec.ts
    - extensions/credential-management/src/__tests__/token.refresh.job.spec.ts
  modified:
    - extensions/credential-management/src/index.ts
    - extensions/credential-management/package.json

key-decisions:
  - "Interface injection for external deps (IRefreshIntegrationService, INotificationService) — NestJS DI wires real implementations in Plan 03; tests use mocks without importing upstream packages"
  - "JS-side 75% threshold filtering — Prisma cannot compute tokenExpiration - 0.25 * (tokenExpiration - createdAt) in WHERE; candidates fetched then filtered in-process"
  - "Alert on consecutiveFailures >= ALERT_THRESHOLD - 1 (value before increment) — avoids a DB re-read after incrementFailureCount"
  - "decryptIfNeeded uses tokenEncrypted flag first, then isEncrypted() heuristic as guard — handles migration period where some tokens may not yet be encrypted"
  - "@Cron decorator deferred to Plan 03 NestJS module wiring — keeps TokenRefreshJob pure and testable without @nestjs/schedule"

patterns-established:
  - "Health state priority order: refreshNeeded > expired > warning (failures) > warning (days) > healthy"
  - "TDD pattern: RED (test file with type imports fails), GREEN (implement service), full suite verification"
  - "Cron job pattern: guard first (env check) → fetch candidates → per-item processing → success/failure branching"

requirements-completed: [R3.3, R3.4, R3.5]

# Metrics
duration: 15min
completed: 2026-03-10
---

# Phase 2 Plan 02: Token Health Service and Proactive Refresh Cron Summary

**TokenHealthService (4-state health calculator), CredentialRepository (75%-lifetime DB queries), and TokenRefreshJob (proactive @Cron refresh with failure tracking and operator alerts on 3rd consecutive failure)**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-10T16:09:14Z
- **Completed:** 2026-03-10T16:24:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Implemented `TokenHealthService.getTokenHealth()` with priority-ordered state resolution: refreshNeeded → expired → warning (failures) → warning (days < 7) → healthy; handles null expiration (X provider) as healthy
- Implemented `CredentialRepository` with `findTokensAt75Percent()` (Prisma query + JS-side lifetime calculation), `incrementFailureCount()`, and `resetFailureCount()`
- Implemented `TokenRefreshJob.refreshExpiringTokens()` with RUN_CRON guard, token decryption via `TokenEncryptionService`, refresh via `IRefreshIntegrationService`, re-encryption on success, failure counting, and `NotificationService.inAppNotification()` alert on 3rd consecutive failure
- 35 total unit tests passing (13 encryption + 11 health/repository + 11 refresh job), all with mocked dependencies, no DB required

## Task Commits

Each task was committed atomically:

1. **Task 1: Token health state calculator and credential repository** - `66f11848` (feat)
2. **Task 2: Proactive token refresh cron job with failure alerts** - `d1b82f95` (feat)

**Plan metadata:** (docs commit — created below)

_Note: TDD tasks — tests written first (RED), then implementation (GREEN), committed together per task._

## Files Created/Modified

- `extensions/credential-management/src/health/token.health.service.ts` - TokenHealthService with getTokenHealth() state calculator; exports TokenHealthState type
- `extensions/credential-management/src/refresh/credential.repository.ts` - CredentialRepository: findTokensAt75Percent(), incrementFailureCount(), resetFailureCount()
- `extensions/credential-management/src/refresh/token.refresh.job.ts` - TokenRefreshJob: @Cron proactive refresh with RUN_CRON guard, decryption, failure tracking, operator alerts
- `extensions/credential-management/src/__tests__/token.health.spec.ts` - 11 unit tests: all 7 TokenHealthService scenarios + 3 CredentialRepository method tests
- `extensions/credential-management/src/__tests__/token.refresh.job.spec.ts` - 11 unit tests: RUN_CRON guard, empty results, decryption, success/failure paths, alert threshold, exceptions, multiple integrations
- `extensions/credential-management/src/index.ts` - Updated barrel: exports TokenHealthService, TokenHealthState, CredentialRepository, TokenRefreshJob and their interfaces
- `extensions/credential-management/package.json` - Added dayjs dependency

## Decisions Made

- **Interface injection pattern**: `IRefreshIntegrationService` and `INotificationService` are minimal TypeScript interfaces defined in token.refresh.job.ts. The concrete NestJS services are injected in Plan 03's module, avoiding circular imports and making unit testing trivial with jest mocks.
- **JS-side 75% filtering**: Prisma WHERE clauses cannot compute `tokenExpiration - 0.25 * (tokenExpiration - createdAt)`. The repository fetches all non-expired, non-deleted, non-x candidates then filters in JS. This is correct for typical scale; a raw query can optimize for high token volume.
- **Alert threshold logic**: Alert fires when `consecutiveFailures >= ALERT_THRESHOLD - 1` (before the increment). This avoids a DB re-read after `incrementFailureCount` while still correctly detecting the 3rd failure boundary.
- **@Cron decorator deferred to Plan 03**: Keeps `TokenRefreshJob` a plain `@Injectable()` class, no `@nestjs/schedule` import needed in this package. Tests can call `refreshExpiringTokens()` directly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no new environment variables or external services added in this plan. The `ENCRYPTION_KEY` requirement from Plan 01 still applies.

## Next Phase Readiness

- `TokenHealthService`, `TokenRefreshJob`, and `CredentialRepository` are ready to wire into `CredentialManagementModule` in Plan 03
- In Plan 03: inject real `RefreshIntegrationService` and `NotificationService` via NestJS DI, add `@Cron(CronExpression.EVERY_10_MINUTES)` decorator to `refreshExpiringTokens()`
- All 35 tests passing; no DB needed for test suite

## Self-Check: PASSED

All created files verified present. All commits verified in git log.

- `extensions/credential-management/src/health/token.health.service.ts` — FOUND
- `extensions/credential-management/src/refresh/credential.repository.ts` — FOUND
- `extensions/credential-management/src/refresh/token.refresh.job.ts` — FOUND
- `extensions/credential-management/src/__tests__/token.health.spec.ts` — FOUND
- `extensions/credential-management/src/__tests__/token.refresh.job.spec.ts` — FOUND
- `extensions/credential-management/src/index.ts` — FOUND
- `66f11848` — FOUND
- `d1b82f95` — FOUND

---
*Phase: 02-credential-management-oauth*
*Completed: 2026-03-10*
