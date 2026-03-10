---
phase: 03-ai-service-layer
plan: 01
subsystem: api
tags: [nestjs, typescript, prisma, openai, anthropic, ollama, zod, brand-voice, ai]

# Dependency graph
requires:
  - phase: 01-fork-and-foundation
    provides: Company/Brand/BrandVoice Prisma models, monorepo structure, extension workspace
  - phase: 02-credential-management-oauth
    provides: extension package pattern (credential-management), tsconfig conventions

provides:
  - "@social/ai-service extension package with IAIProvider interface and all shared AI types"
  - "AITaskType discriminated union (generateCaption, generateHashtags, adaptForPlatform, analyzeImage, scoreContent)"
  - "AICallResult<T>, AICallContext, AIUsage, AIMessage typed interfaces"
  - "MODEL_COSTS constants and calculateCostUsd function for gpt-4o, gpt-4o-mini, claude-sonnet-4-5, claude-haiku-4-5, ollama"
  - "BrandVoicePromptBuilder injectable service with full brand voice integration"
  - "AIConfig and AICostLog Prisma models with Company FK and migration SQL"
  - "@anthropic-ai/sdk and zod-to-json-schema installed at root"

affects:
  - 03-02 (OpenAI, Anthropic, Ollama providers implement IAIProvider)
  - 03-03 (cost service uses AICostLog model and calculateCostUsd)
  - 03-04 (module wiring, AIServiceModule uses BrandVoicePromptBuilder)
  - 05-content-generation-pipeline (uses brand voice prompt builder and providers)

# Tech tracking
tech-stack:
  added:
    - "@anthropic-ai/sdk ^0.78.0 (root dependency — Anthropic Claude API client)"
    - "zod-to-json-schema ^3.25.1 (root dependency — Ollama structured output via JSON schema)"
    - "zod ^3.25.76 (ai-service dependency — provider interface schema typing)"
  patterns:
    - "Provider-agnostic IAIProvider interface: chat<T>() + analyzeImage<T>() with Zod schema validation"
    - "BrandVoiceInput local interface (not importing Prisma types into extension package)"
    - "Graceful cost fallback: unknown models return 0 cost, ollama/* prefix match returns 0"
    - "System prompt composition: base instruction + brand voice sections joined with double newlines"
    - "Extension package structure: package.json + tsconfig.json + tsconfig.spec.json + jest.config.ts"

key-files:
  created:
    - "extensions/ai-service/package.json — @social/ai-service package definition"
    - "extensions/ai-service/tsconfig.json — TypeScript config extending tsconfig.base.json"
    - "extensions/ai-service/tsconfig.spec.json — Test TypeScript config with jest types"
    - "extensions/ai-service/jest.config.ts — Jest config with ts-jest and moduleNameMapper"
    - "extensions/ai-service/src/index.ts — Barrel exports for all public API"
    - "extensions/ai-service/src/interface/ai-service.interface.ts — IAIProvider, AICallResult<T>, AICallContext, AIUsage, AITaskType, AIMessage"
    - "extensions/ai-service/src/cost/model-costs.ts — MODEL_COSTS constants and calculateCostUsd function"
    - "extensions/ai-service/src/brand-voice/brand-voice-prompt.builder.ts — BrandVoicePromptBuilder injectable service"
    - "extensions/ai-service/src/__tests__/brand-voice-prompt.builder.spec.ts — 18 tests for prompt builder"
    - "extensions/ai-service/src/__tests__/model-costs.spec.ts — 11 tests for cost calculation"
    - "libraries/nestjs-libraries/src/database/prisma/migrations/20260310000003_ai_service_layer/migration.sql — AIConfig + AICostLog tables"
  modified:
    - "tsconfig.base.json — Added @social/ai-service path alias"
    - "libraries/nestjs-libraries/src/database/prisma/schema.prisma — Added AIConfig, AICostLog models and Company relation arrays"
    - "package.json — Added @anthropic-ai/sdk and zod-to-json-schema dependencies"

key-decisions:
  - "BrandVoiceInput local interface avoids importing Prisma-generated types into extension package — keeps the package self-contained and testable without DB"
  - "ollama/* prefix matching in calculateCostUsd covers all local Ollama model variants without enumerating them"
  - "English language directive omitted from system prompt (default) — only non-English languages get explicit instruction"
  - "Sample posts limited to 3 in system prompt to avoid token bloat"
  - "AIConfig uses @unique on companyId (one config per company); AICostLog is append-only (no updatedAt)"

patterns-established:
  - "Provider interface pattern: IAIProvider.chat<T>(messages, zodSchema, model) returns AICallResult<T> — all providers must implement this"
  - "Prompt building pattern: [base instruction] + [optional sections joined with \\n\\n] — no section appended if value is empty/null"
  - "Cost calculation pattern: (tokens / 1_000_000) * ratePerMillion — zero for unknown or local models"

requirements-completed: [R4.1, R4.5, R4.7, NF4.4]

# Metrics
duration: 25min
completed: 2026-03-10
---

# Phase 3 Plan 01: AI Service Layer Foundation Summary

**Provider-agnostic IAIProvider interface with typed AICallResult<T>, BrandVoicePromptBuilder building system prompts from brand voice data, MODEL_COSTS constants with calculateCostUsd, and AIConfig/AICostLog Prisma models — 29 tests passing**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-10T17:30:00Z
- **Completed:** 2026-03-10T17:55:00Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Scaffolded @social/ai-service extension package following credential-management pattern (package.json, tsconfig.json, tsconfig.spec.json, jest.config.ts)
- Defined IAIProvider interface with typed chat<T>() and analyzeImage<T>() methods using Zod schema validation, plus all shared types (AITaskType, AIMessage, AICallContext, AIUsage, AICallResult<T>)
- Implemented MODEL_COSTS constants for 5 model families and calculateCostUsd with ollama/* prefix fallback (returns 0 for local models)
- Built BrandVoicePromptBuilder injectable service that layers brand voice guidelines (tone, audience, hashtags, blacklisted words, language, sample posts, notes) onto base instructions
- Added AIConfig and AICostLog Prisma models with Company FK relations and migration SQL; Prisma client regenerated successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold extension package, Prisma models, interface contracts, and cost constants** - `6ba39eb2` (feat)
2. **Task 2: BrandVoice prompt builder with unit tests** - `8b475e8f` (feat)

**Plan metadata:** (see below — docs commit)

## Files Created/Modified
- `extensions/ai-service/package.json` — @social/ai-service package definition (name, deps, scripts)
- `extensions/ai-service/tsconfig.json` — Extends tsconfig.base.json, excludes spec files
- `extensions/ai-service/tsconfig.spec.json` — Test TypeScript config with jest types
- `extensions/ai-service/jest.config.ts` — Jest with ts-jest, displayName: ai-service, moduleNameMapper
- `extensions/ai-service/src/index.ts` — Barrel exports for all public types
- `extensions/ai-service/src/interface/ai-service.interface.ts` — IAIProvider, AICallResult<T>, AICallContext, AIUsage, AITaskType, AIMessage
- `extensions/ai-service/src/cost/model-costs.ts` — MODEL_COSTS and calculateCostUsd
- `extensions/ai-service/src/brand-voice/brand-voice-prompt.builder.ts` — BrandVoicePromptBuilder + BrandVoiceInput type
- `extensions/ai-service/src/__tests__/brand-voice-prompt.builder.spec.ts` — 18 tests
- `extensions/ai-service/src/__tests__/model-costs.spec.ts` — 11 tests
- `libraries/nestjs-libraries/src/database/prisma/migrations/20260310000003_ai_service_layer/migration.sql` — DDL for AIConfig and AICostLog
- `tsconfig.base.json` — Added @social/ai-service path alias
- `libraries/nestjs-libraries/src/database/prisma/schema.prisma` — AIConfig, AICostLog models + Company relation arrays (aiConfig, aiCostLogs)
- `package.json` — @anthropic-ai/sdk, zod-to-json-schema added
- `pnpm-lock.yaml` — Updated lockfile

## Decisions Made
- BrandVoiceInput local interface avoids importing Prisma-generated types into extension package — keeps the package self-contained and testable without DB
- ollama/* prefix matching in calculateCostUsd covers all local Ollama model variants without enumerating them
- English language directive omitted from system prompt (default) — only non-English languages get explicit instruction
- Sample posts limited to 3 in system prompt to avoid token bloat
- AIConfig uses @unique on companyId (one config per company); AICostLog is append-only (no updatedAt)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Migration will be applied when Docker DB is running via `pnpm run prisma:migrate`.

## Next Phase Readiness
- IAIProvider interface contract defined — Plan 02 can implement OpenAI, Anthropic, and Ollama providers
- MODEL_COSTS and calculateCostUsd ready — Plan 03 cost service can use them directly
- BrandVoicePromptBuilder ready — Plans 02-04 can inject it via NestJS DI
- AIConfig/AICostLog Prisma models ready — Plans 03-04 can use them for cost tracking
- @anthropic-ai/sdk and zod-to-json-schema installed — Plan 02 providers have their deps ready

---
*Phase: 03-ai-service-layer*
*Completed: 2026-03-10*

## Self-Check: PASSED

All files verified:
- FOUND: extensions/ai-service/src/interface/ai-service.interface.ts
- FOUND: extensions/ai-service/src/cost/model-costs.ts
- FOUND: extensions/ai-service/src/brand-voice/brand-voice-prompt.builder.ts
- FOUND: @social/ai-service path alias in tsconfig.base.json
- FOUND: AIConfig model in schema.prisma
- FOUND: AICostLog model in schema.prisma
- FOUND: migration SQL at 20260310000003_ai_service_layer/migration.sql
- FOUND: @anthropic-ai/sdk in root package.json
- All 29 tests PASSING (2 test suites)
