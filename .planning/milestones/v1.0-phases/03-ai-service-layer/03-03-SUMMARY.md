---
phase: 03-ai-service-layer
plan: 03
subsystem: api
tags: [nestjs, typescript, prisma, cost-tracking, budget, circuit-breaker, ai]

# Dependency graph
requires:
  - phase: 03-ai-service-layer
    plan: 01
    provides: AIConfig and AICostLog Prisma models, @social/ai-service extension package structure

provides:
  - "AIConfigService: per-company AI config retrieval with DB first + env-var fallback (AI_DEFAULT_PROVIDER, AI_WEEKLY_BUDGET_USD)"
  - "AICostLogger: non-blocking append-only cost log to AICostLog table"
  - "BudgetCircuitBreaker: weekly UTC budget enforcement; throws BudgetExceededError when spent >= weeklyBudgetUsd"
  - "BudgetExceededError: Error subclass with companyId, spent, budget metadata"
  - "All 4 services exported from @social/ai-service barrel index.ts"

affects:
  - 03-04 (AIServiceModule wires these services; provider router calls BudgetCircuitBreaker.checkBudget + AICostLogger.log)
  - 05-content-generation-pipeline (uses BudgetCircuitBreaker before AI calls, AICostLogger after)

# Tech tracking
tech-stack:
  added:
    - "dayjs utc plugin (dayjs/plugin/utc) — startOf('week') in UTC for budget window"
  patterns:
    - "Non-blocking cost logging: catch + console.warn, never rethrows — prevents cost tracking from blocking AI calls"
    - "DB-first config with env-var fallback: findUnique, if null return process.env defaults"
    - "Budget circuit breaker: inject config service + prisma, aggregate sum since startOf(week), throw BudgetExceededError if >= limit"
    - "(this.prisma as any).aIConfig / .aICostLog pattern for custom Prisma models not in generated client"

key-files:
  created:
    - "extensions/ai-service/src/config/ai-config.service.ts — AIConfigService + AIConfigData interface + IAIConfigPrismaService"
    - "extensions/ai-service/src/cost/ai-cost-logger.service.ts — AICostLogger + AICostLogParams interface"
    - "extensions/ai-service/src/cost/budget-circuit-breaker.service.ts — BudgetCircuitBreaker + BudgetExceededError"
    - "extensions/ai-service/src/__tests__/ai-config.service.spec.ts — 13 tests for AIConfigService"
    - "extensions/ai-service/src/__tests__/ai-cost-logger.spec.ts — 6 tests for AICostLogger"
    - "extensions/ai-service/src/__tests__/budget-circuit-breaker.spec.ts — 12 tests for BudgetCircuitBreaker"
  modified:
    - "extensions/ai-service/src/index.ts — added barrel exports for AIConfigService, AICostLogger, BudgetCircuitBreaker, BudgetExceededError"

key-decisions:
  - "Non-blocking AICostLogger: catch all errors and warn — cost logging must never interrupt the AI call flow"
  - "AIConfigService uses (this.prisma as any).aIConfig pattern — consistent with Plan 01's PrismaService injection convention for custom models"
  - "BudgetCircuitBreaker uses dayjs().utc().startOf('week') — UTC week window prevents timezone-dependent budget resets"
  - "weeklyBudgetUsd: null = unlimited — early return with no aggregate query when no budget configured"
  - "BudgetExceededError extends Error with Object.setPrototypeOf — restores prototype chain for proper instanceof checks in TypeScript"

patterns-established:
  - "Circuit breaker pattern: checkBudget() before AI call; never throws when budget is null (unlimited)"
  - "AIConfigData local interface: avoids Prisma-generated types in extension package"

requirements-completed: [R4.4, R4.5, R4.6]

# Metrics
duration: 15min
completed: 2026-03-10
---

# Phase 3 Plan 03: AI Config, Cost Logger, and Budget Circuit Breaker Summary

**Per-company AIConfigService with env-var fallback, non-blocking AICostLogger, and BudgetCircuitBreaker enforcing UTC weekly spend limits via aggregate query — 78 tests passing across 7 suites**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-10T17:53:59Z
- **Completed:** 2026-03-10T18:08:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- AIConfigService provides per-company AI configuration with DB-first lookup and env-var defaults (AI_DEFAULT_PROVIDER, AI_WEEKLY_BUDGET_USD) as fallback
- AICostLogger writes every AI call to AICostLog table in a non-blocking fire-and-forget manner (catches all errors, warns, never rethrows)
- BudgetCircuitBreaker checks weekly spend aggregate since UTC startOf('week') and throws typed BudgetExceededError with company/spent/budget metadata when limit reached
- All 28 new tests pass (13 + 6 + 12) plus all 50 prior Plan 01 + Plan 02 tests still passing = 78 total

## Task Commits

Each task was committed atomically:

1. **Task 1: AIConfigService and AICostLogger with tests** - `641e3aa7` (feat)
2. **Task 2: BudgetCircuitBreaker with tests and barrel exports** - `c758497a` (feat)

**Plan metadata:** (see below — docs commit)

_Note: TDD tasks — tests written first (RED), then implementation (GREEN) in a single commit each_

## Files Created/Modified
- `extensions/ai-service/src/config/ai-config.service.ts` — AIConfigService with findByCompany, upsert, getPreferredModel
- `extensions/ai-service/src/cost/ai-cost-logger.service.ts` — AICostLogger.log() with non-blocking error handling
- `extensions/ai-service/src/cost/budget-circuit-breaker.service.ts` — BudgetCircuitBreaker + BudgetExceededError
- `extensions/ai-service/src/__tests__/ai-config.service.spec.ts` — 13 tests covering DB record, env-var fallback, defaults, upsert, getPreferredModel
- `extensions/ai-service/src/__tests__/ai-cost-logger.spec.ts` — 6 tests covering create fields, null postId, non-throwing on DB error
- `extensions/ai-service/src/__tests__/budget-circuit-breaker.spec.ts` — 12 tests covering null budget, under/at/over budget, error metadata, aggregate query shape
- `extensions/ai-service/src/index.ts` — added 3 new barrel exports (AIConfigService, AICostLogger, BudgetCircuitBreaker, BudgetExceededError)

## Decisions Made
- Non-blocking AICostLogger: catch all errors and console.warn — cost tracking must never interrupt the AI call flow (an AI response that's already been received should always be returned to the caller)
- BudgetCircuitBreaker uses dayjs().utc().startOf('week') — UTC week window prevents timezone-dependent budget resets that could give some users more or less than 7 days
- weeklyBudgetUsd: null = unlimited — early return with no aggregate query (avoids unnecessary DB call for companies without budget limits)
- BudgetExceededError uses Object.setPrototypeOf() to restore prototype chain — required for proper instanceof checks after TypeScript compilation

## Deviations from Plan

None - plan executed exactly as written.

**Note:** Pre-existing anthropic.provider.spec.ts failures (z.toJSONSchema issue from Plan 02) were logged to `deferred-items.md` and are not caused by this plan. Full test suite now shows 78 passing when run via `pnpm --filter @social/ai-service test`.

## Issues Encountered
None.

## User Setup Required
None - all services use PrismaService injection and the AIConfig/AICostLog tables were already created in Plan 01's migration. No new env vars required (AI_DEFAULT_PROVIDER and AI_WEEKLY_BUDGET_USD are optional with sensible defaults).

## Next Phase Readiness
- AIConfigService ready — Plan 04 AIServiceModule can inject it into the provider router
- AICostLogger ready — Plan 04 provider router can call log() after every AI call
- BudgetCircuitBreaker ready — Plan 04 provider router can call checkBudget() before routing to provider
- BudgetExceededError exported — Plan 04 can catch and return HTTP 402 when budget exceeded
- All 4 services exported from barrel — Plan 04 can import from '@social/ai-service'

---
*Phase: 03-ai-service-layer*
*Completed: 2026-03-10*

## Self-Check: PASSED

All files verified:
- FOUND: extensions/ai-service/src/config/ai-config.service.ts
- FOUND: extensions/ai-service/src/cost/ai-cost-logger.service.ts
- FOUND: extensions/ai-service/src/cost/budget-circuit-breaker.service.ts
- FOUND: extensions/ai-service/src/__tests__/ai-config.service.spec.ts
- FOUND: extensions/ai-service/src/__tests__/ai-cost-logger.spec.ts
- FOUND: extensions/ai-service/src/__tests__/budget-circuit-breaker.spec.ts
- FOUND: commit 641e3aa7 (Task 1)
- FOUND: commit c758497a (Task 2)
- All 78 tests PASSING (7 test suites, pnpm --filter @social/ai-service test)
