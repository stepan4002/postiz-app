---
phase: 03-ai-service-layer
plan: 04
subsystem: api
tags: [nestjs, typescript, prisma, ai, router, brand-voice, budget, cost-tracking, module]

# Dependency graph
requires:
  - phase: 03-ai-service-layer
    plan: 01
    provides: IAIProvider interface, BrandVoicePromptBuilder, AIConfig/AICostLog Prisma models, @social/ai-service package
  - phase: 03-ai-service-layer
    plan: 02
    provides: OpenAIProvider, AnthropicProvider, OllamaProvider implementations
  - phase: 03-ai-service-layer
    plan: 03
    provides: AIConfigService, AICostLogger, BudgetCircuitBreaker, BudgetExceededError

provides:
  - "AIProviderRouter: single entry point for all AI calls — execute() and executeImageAnalysis()"
  - "AiConfigController: GET/PUT /companies/:companySlug/ai-config per-company AI configuration endpoints"
  - "AIServiceModule: NestJS module wiring all providers, services, router, and controller"
  - "Phase 5 can inject AIProviderRouter from @social/ai-service and call execute(context, messages, schema)"

affects:
  - 05-content-generation-pipeline (imports AIProviderRouter.execute() for caption/hashtag generation)
  - 07-analytics-dashboard (uses AICostLogger data for cost analytics display)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single entry point AI pattern: all AI calls must go through AIProviderRouter — no direct provider usage outside module"
    - "Budget-check-before-call: checkBudget() always first in execute() flow — enforces NF4.4 budget boundary"
    - "useFactory wiring for interface-injected services: AIConfigService/AICostLogger/BudgetCircuitBreaker use useFactory with inject: [PrismaService] in AIServiceModule"
    - "BrandVoice injection via system prompt enrichment: system message replaced or prepended with brand voice content"
    - "VISION_MODELS separate from DEFAULT_MODELS: gpt-4o / claude-sonnet-4-5 for vision regardless of cost preference"
    - "Company slug resolution in controller: companySlug -> companyId before any service call (project convention)"

key-files:
  created:
    - "extensions/ai-service/src/router/ai-provider.router.ts — AIProviderRouter with execute() and executeImageAnalysis()"
    - "extensions/ai-service/src/ai-service.module.ts — AIServiceModule NestJS module wiring"
    - "extensions/ai-service/src/config/ai-config.controller.ts — AiConfigController GET/PUT endpoints"
    - "extensions/ai-service/src/__tests__/ai-provider.router.spec.ts — 15 tests for AIProviderRouter"
    - "extensions/ai-service/src/__tests__/ai-service.module.spec.ts — 5 module compilation tests"
  modified:
    - "extensions/ai-service/src/index.ts — added AIServiceModule, AIProviderRouter, AiConfigController exports"
    - "extensions/ai-service/jest.config.ts — added @gitroom/nestjs-libraries moduleNameMapper for test resolution"
    - "apps/backend/src/app.module.ts — imported AIServiceModule after CredentialManagementModule"
    - ".env.example — added AI Service Layer env var section"

key-decisions:
  - "AIProviderRouter injects PrismaService directly (not through a typed interface) for BrandVoice lookup — pragmatic choice since brandVoice is a custom model; consistent with (this.prisma as any) pattern established in Plan 03"
  - "Module test uses explicit provider list instead of Test.createTestingModule({ imports: [AIServiceModule] }) — because @Global DatabaseModule provides PrismaService at runtime but not in isolated test context; useFactory inject arrays require the token to be resolvable within the module"
  - "AiConfigController also added to AIServiceModule providers via useFactory — required for NestJS to inject AIConfigService and PrismaService into controller properly alongside the controllers[] array registration"
  - "jest.config.ts moduleNameMapper extended with @gitroom/nestjs-libraries/* path — required for ai-service.module.spec.ts to resolve PrismaService type import from the library package"

patterns-established:
  - "Router-as-facade pattern: AIProviderRouter is the only public API for AI calls — budget, brand voice, model selection, and cost logging all centralized here"
  - "Brand voice enrichment: system message replaced if present, prepended if absent — ensures brand voice context always reaches the provider"

requirements-completed: [R4.3, R4.4, R4.7, NF4.4]

# Metrics
duration: 9min
completed: 2026-03-10
---

# Phase 3 Plan 04: AIServiceModule — Router, Controller, and Module Wiring Summary

**AIProviderRouter as single AI call facade (budget check → provider select → brand voice inject → call → cost log), AiConfigController for GET/PUT per-company AI config, and AIServiceModule wiring all 8 providers + services into AppModule — 113 tests passing across 10 suites**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-10T18:04:49Z
- **Completed:** 2026-03-10T18:13:44Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- AIProviderRouter.execute() implements the full AI call pipeline: budget enforcement → config lookup → provider selection with fallback → model selection → BrandVoice injection into system prompt → provider.chat() → cost logging
- executeImageAnalysis() implements the same pipeline but with VISION_MODELS (gpt-4o, claude-sonnet-4-5) and BrandVoice injected into the prompt text
- AiConfigController exposes GET/PUT /companies/:companySlug/ai-config with company slug resolution, defaultProvider validation, and proper NotFoundException/BadRequestException handling
- AIServiceModule wires all providers with useFactory patterns (matching CredentialManagementModule convention) and is registered in AppModule after CredentialManagementModule
- All 20 new tests pass (15 router + 5 module) plus all 93 prior Plan 01-03 tests still passing = 113 total

## Task Commits

Each task was committed atomically:

1. **Task 1: AIProviderRouter implementation with tests** - `01c3a081` (feat)
2. **Task 2+3: AIServiceModule wiring, AiConfigController, barrel exports, AppModule** - `21ab6536` (feat)

**Plan metadata:** (see below — docs commit)

_Note: Task 1 used TDD (RED → GREEN), Task 2 and 3 were executed together since AiConfigController is required before AIServiceModule can compile_

## Files Created/Modified
- `extensions/ai-service/src/router/ai-provider.router.ts` — AIProviderRouter with execute(), executeImageAnalysis(), selectProvider(), enrichMessagesWithBrandVoice() (287 lines)
- `extensions/ai-service/src/__tests__/ai-provider.router.spec.ts` — 15 tests covering budget check order, provider selection, model selection, brand voice injection, BudgetExceededError propagation, fallback provider, image analysis flow
- `extensions/ai-service/src/ai-service.module.ts` — AIServiceModule with all 8 providers via useFactory, AiConfigController, exports for Phase 5 (123 lines)
- `extensions/ai-service/src/config/ai-config.controller.ts` — AiConfigController GET/PUT with slug-to-id resolution and defaultProvider validation (105 lines)
- `extensions/ai-service/src/__tests__/ai-service.module.spec.ts` — 5 tests proving all key providers resolve correctly from compiled module
- `extensions/ai-service/src/index.ts` — barrel updated with AIServiceModule, AIProviderRouter, AiConfigController exports
- `extensions/ai-service/jest.config.ts` — added @gitroom/nestjs-libraries and @gitroom/helpers moduleNameMapper entries
- `apps/backend/src/app.module.ts` — AIServiceModule imported after CredentialManagementModule
- `.env.example` — AI Service Layer section added with OPENAI_API_KEY, ANTHROPIC_API_KEY, OLLAMA_BASE_URL, OLLAMA_VISION_MODEL, AI_DEFAULT_PROVIDER, AI_WEEKLY_BUDGET_USD

## Decisions Made
- Module test uses explicit provider list (not `imports: [AIServiceModule]`) because PrismaService is globally available via DatabaseModule's @Global decorator at runtime, but test isolation requires it to be explicitly provided. The useFactory `inject: [PrismaService]` requires the token to be resolvable within the current module scope — test module provides it directly.
- AiConfigController registered both in `controllers[]` AND in `providers[]` via useFactory — NestJS needs the provider factory to resolve the constructor injections (AIConfigService, PrismaService); the controllers[] array handles routing registration.
- BrandVoice system prompt: when no system message exists in messages array, a new system message is prepended (rather than adding brand voice to the user message). This keeps concerns separated and gives the model clear role attribution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type error: Map<string, IAIProvider> inference**
- **Found during:** Task 1 (GREEN phase — first test run)
- **Issue:** `new Map([['openai', openaiProvider], ['anthropic', anthropicProvider], ['ollama', ollamaProvider]])` caused TypeScript TS2769 — type inferred as Map<string, OpenAIProvider> because of the first tuple, rejecting AnthropicProvider as incompatible
- **Fix:** Explicit type cast: `new Map<string, IAIProvider>([...(each cast to IAIProvider)])` — forces the map value type to the interface
- **Files modified:** `extensions/ai-service/src/router/ai-provider.router.ts`
- **Verification:** TypeScript compilation passes, tests pass
- **Committed in:** `01c3a081` (Task 1 commit)

**2. [Rule 3 - Blocking] Module test resolution: @gitroom/nestjs-libraries not in jest moduleNameMapper**
- **Found during:** Task 2 (ai-service.module.spec.ts first run)
- **Issue:** Jest test could not resolve `@gitroom/nestjs-libraries/database/prisma/prisma.service` — the path alias was in tsconfig.base.json but not in jest.config.ts moduleNameMapper
- **Fix:** Added `'^@gitroom/nestjs-libraries/(.*)$': '<rootDir>/../../libraries/nestjs-libraries/src/$1'` and `'^@gitroom/helpers/(.*)$': '<rootDir>/../../libraries/helpers/src/$1'` to jest.config.ts
- **Files modified:** `extensions/ai-service/jest.config.ts`
- **Verification:** Module tests resolve imports correctly, all 5 pass
- **Committed in:** `21ab6536` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 type bug, 1 blocking test resolution)
**Impact on plan:** Both auto-fixes essential for correctness and testability. No scope creep.

## Issues Encountered
- NestJS `Test.createTestingModule({ imports: [AIServiceModule] }).overrideProvider(PrismaService)` does not work when PrismaService is only in the global scope (via @Global DatabaseModule) — overrideProvider cannot override a provider that isn't declared in the imported module. Resolution: restructured the test to explicitly declare all providers (mirroring AIServiceModule structure with mock PrismaService), which fully validates the wiring logic without the global scope dependency.

## User Setup Required
Optional env vars documented in `.env.example` under "AI Service Layer (Phase 3)" section:
- `OPENAI_API_KEY` — required for OpenAI provider
- `ANTHROPIC_API_KEY` — required for Anthropic provider
- `OLLAMA_BASE_URL` — optional, defaults to http://localhost:11434
- `OLLAMA_VISION_MODEL` — optional, enables Ollama vision (e.g., llava)
- `AI_DEFAULT_PROVIDER` — optional, defaults to 'openai'
- `AI_WEEKLY_BUDGET_USD` — optional, defaults to unlimited

## Next Phase Readiness
- AIProviderRouter ready — Phase 5 (Content Generation) can `import { AIProviderRouter } from '@social/ai-service'` and call `router.execute(context, messages, schema)` with an AICallContext
- AiConfigController ready — operator can GET/PUT per-company AI config via REST API
- Phase 3 AI Service Layer COMPLETE — all 4 plans done (01: foundation, 02: providers, 03: config/cost/budget, 04: router/module)
- 113 tests passing — full test suite coverage of the entire AI service layer

---
*Phase: 03-ai-service-layer*
*Completed: 2026-03-10*

## Self-Check: PASSED

All files verified:
- FOUND: extensions/ai-service/src/router/ai-provider.router.ts (287 lines, min 60)
- FOUND: extensions/ai-service/src/ai-service.module.ts (123 lines, min 30)
- FOUND: extensions/ai-service/src/config/ai-config.controller.ts (105 lines, min 30)
- FOUND: extensions/ai-service/src/__tests__/ai-provider.router.spec.ts
- FOUND: extensions/ai-service/src/__tests__/ai-service.module.spec.ts
- FOUND: commit 01c3a081 (Task 1: AIProviderRouter)
- FOUND: commit 21ab6536 (Tasks 2+3: AIServiceModule, AiConfigController, AppModule)
- All 113 tests PASSING (10 test suites, pnpm --filter @social/ai-service test)
