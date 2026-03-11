---
phase: 05-content-generation-pipeline
plan: 01
subsystem: api
tags: [prisma, zod, nestjs, content-generation, prompt-engineering]

# Dependency graph
requires:
  - phase: 03-ai-service-layer
    provides: AITaskType, AICallContext, AICallResult interfaces used as downstream targets
  - phase: 04-media-library-processing
    provides: Media/MediaVariant models that ContentPost.mediaId references

provides:
  - "@social/content-generation package scaffolded with tsconfig, jest, barrel exports"
  - "ContentPost Prisma model with company/brand/media relations and DRAFT/PENDING_REVIEW/APPROVED/SCHEDULED status lifecycle"
  - "PostVariant Prisma model with platform, caption, hashtags, confidenceScore, review workflow fields"
  - "AIConfig extended with requireAllReview and confidenceThreshold fields"
  - "ContentType union type covering 7 content types (product, brand_story, educational, seasonal, offer, testimonial, behind_the_scenes)"
  - "Zod schemas: ImageAnalysisSchema, PlatformCaptionSchema, ConfidenceScoreSchema for AI response validation"
  - "CONTENT_TYPE_PROMPT_MODIFIERS — prompt modifier text for all 7 content types"
  - "PLATFORM_CAPTION_NORMS — maxLength, optimalLength, hashtagCount, style for instagram, facebook, linkedin, x"
  - "buildCaptionSystemPrompt — system prompt builder with content type modifier and optional image analysis"
  - "buildPlatformAdaptationPrompt — platform-specific adaptation prompt with norms"
  - "buildScoreContentPrompt — 0-1 confidence scoring prompt"
  - "Migration SQL 20260310000005 for ContentPost, PostVariant tables and AIConfig ALTER"

affects:
  - 05-02-content-generation-service
  - 05-03-review-queue
  - 06-scheduling-publishing-engine

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ContentType as TypeScript union (not enum) — tree-shakeable, no runtime overhead"
    - "Zod schemas for AI response validation — parse at boundary, fail loudly on unexpected shapes"
    - "Brief in USER message only (not system prompt) — NF1.3 prompt injection prevention"
    - "Platform norms as plain objects — injectable without NestJS, easily testable"

key-files:
  created:
    - extensions/content-generation/package.json
    - extensions/content-generation/tsconfig.json
    - extensions/content-generation/tsconfig.spec.json
    - extensions/content-generation/jest.config.ts
    - extensions/content-generation/src/index.ts
    - extensions/content-generation/src/types/content.types.ts
    - extensions/content-generation/src/prompts/prompt-templates.ts
    - extensions/content-generation/src/prompts/platform-norms.ts
    - extensions/content-generation/src/__tests__/prompt-templates.spec.ts
    - libraries/nestjs-libraries/src/database/prisma/migrations/20260310000005_content_generation_pipeline/migration.sql
  modified:
    - tsconfig.base.json
    - libraries/nestjs-libraries/src/database/prisma/schema.prisma

key-decisions:
  - "ContentType as TypeScript union type (not Prisma enum) — stored as string in DB, avoids Prisma enum migration friction"
  - "Brief in USER message only — system prompt contains content type modifier and image context only; prevents brief injection into system instructions"
  - "PLATFORM_CAPTION_NORMS as plain record — no NestJS dependency, injectable anywhere, easily testable without mocks"
  - "PostVariant.hashtags as String[] (Postgres array) — avoids JSON parsing overhead, native array operations in queries"
  - "AIConfig requireAllReview + confidenceThreshold — enables per-company auto-approval vs manual review policies"

patterns-established:
  - "TDD RED-GREEN pattern: failing tests committed first (cde32814), then implementation (3b11bdfa)"
  - "Zod parse-at-boundary: all AI response shapes validated via schema before use in services"

requirements-completed: [R5.5, R5.7, R6.5]

# Metrics
duration: 25min
completed: 2026-03-10
---

# Phase 5 Plan 1: Content Generation Scaffold Summary

**@social/content-generation extension with ContentPost/PostVariant Prisma models, 7-content-type prompt modifiers, 4-platform norms, and Zod schemas for AI response validation**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-10T21:10:00Z
- **Completed:** 2026-03-10T21:35:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Scaffolded `@social/content-generation` extension package with proper tsconfig, jest config, and barrel exports
- Added `ContentPost` and `PostVariant` Prisma models with full field spec, relations, and compound indexes; extended `AIConfig` with `requireAllReview` and `confidenceThreshold`
- Defined all 7 content type prompt modifiers, 4 platform norms (instagram/facebook/linkedin/x), and 3 Zod schemas for AI response validation; 24 tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold extension package, Prisma models, and path alias** - `6e35bf08` (feat)
2. **Task 2 RED: Failing tests** - `cde32814` (test)
3. **Task 2 GREEN: Type contracts, Zod schemas, prompt templates** - `3b11bdfa` (feat)

_Note: TDD tasks have multiple commits (test RED → feat GREEN)_

## Files Created/Modified

- `extensions/content-generation/package.json` - Package definition for @social/content-generation
- `extensions/content-generation/tsconfig.json` - TypeScript config extending tsconfig.base.json
- `extensions/content-generation/tsconfig.spec.json` - TypeScript config for Jest tests
- `extensions/content-generation/jest.config.ts` - Jest configuration with moduleNameMapper
- `extensions/content-generation/src/index.ts` - Barrel exports for all public types
- `extensions/content-generation/src/types/content.types.ts` - ContentType union, status enums, DTOs, Zod schemas
- `extensions/content-generation/src/prompts/prompt-templates.ts` - CONTENT_TYPE_PROMPT_MODIFIERS, buildCaptionSystemPrompt, buildScoreContentPrompt
- `extensions/content-generation/src/prompts/platform-norms.ts` - PLATFORM_CAPTION_NORMS, buildPlatformAdaptationPrompt
- `extensions/content-generation/src/__tests__/prompt-templates.spec.ts` - 24 tests covering all schemas and builders
- `libraries/nestjs-libraries/src/database/prisma/schema.prisma` - ContentPost, PostVariant models; AIConfig extended
- `libraries/nestjs-libraries/src/database/prisma/migrations/20260310000005_content_generation_pipeline/migration.sql` - SQL migration
- `tsconfig.base.json` - Added @social/content-generation path alias

## Decisions Made

- **ContentType as union type** — TypeScript union `'product' | 'brand_story' | ...` instead of Prisma enum. Stored as string in DB. Avoids Prisma enum migration friction and allows easy extension.
- **Brief in USER message only** — NF1.3 prompt injection prevention. System prompt contains only content type modifier and image analysis context; user brief goes in the user message.
- **PLATFORM_CAPTION_NORMS as plain record** — No NestJS dependency means it's injectable anywhere and testable without mocks. Plan 02 services import directly.
- **PostVariant.hashtags as String[]** — PostgreSQL native array. Avoids JSON serialization overhead and enables native array operations in Prisma queries.
- **AIConfig requireAllReview + confidenceThreshold** — Per-company policy for auto-approval vs manual review. Default 0.7 threshold means variants with score >= 0.7 can be auto-approved if requireAllReview is false.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `@social/content-generation` package ready for Plan 02 (content generation service) to import types
- `ContentPost` and `PostVariant` models available for Plan 02 repository layer
- Prompt templates and platform norms ready for use in AI call orchestration
- Migration SQL ready to apply with `pnpm run prisma:migrate` when Docker is running

## Self-Check: PASSED

All files verified to exist. All commits verified in git log.

---
*Phase: 05-content-generation-pipeline*
*Completed: 2026-03-10*
