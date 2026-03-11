---
phase: 03-ai-service-layer
plan: "02"
subsystem: ai-service
tags: [ai-providers, openai, anthropic, ollama, tdd, structured-output]
dependency_graph:
  requires: ["03-01"]
  provides: ["OpenAIProvider", "AnthropicProvider", "OllamaProvider"]
  affects: ["03-04"]
tech_stack:
  added: ["openai SDK", "@anthropic-ai/sdk", "zod-to-json-schema", "native fetch"]
  patterns: ["zodResponseFormat (OpenAI structured output)", "custom zodOutputFormat v3-compatible (Anthropic)", "JSON Schema format (Ollama)", "TDD red-green", "constructor-injected SDK clients"]
key_files:
  created:
    - extensions/ai-service/src/providers/openai.provider.ts
    - extensions/ai-service/src/providers/anthropic.provider.ts
    - extensions/ai-service/src/providers/ollama.provider.ts
    - extensions/ai-service/src/__tests__/openai.provider.spec.ts
    - extensions/ai-service/src/__tests__/anthropic.provider.spec.ts
    - extensions/ai-service/src/__tests__/ollama.provider.spec.ts
  modified:
    - extensions/ai-service/src/index.ts
decisions:
  - "Zod v3 incompatibility with Anthropic SDK zodOutputFormat: built custom output format helper using zodToJsonSchema from zod-to-json-schema (SDK's zodOutputFormat calls z.toJSONSchema which is Zod v4 only)"
  - "OllamaProvider uses native fetch (no SDK): Ollama doesn't have a maintained npm SDK; fetch keeps the provider lightweight"
  - "Ollama vision separate from main model: OLLAMA_VISION_MODEL is independent from default model — vision models like llava are specialized"
metrics:
  duration: 20min
  completed_date: "2026-03-10"
  tasks_completed: 2
  files_created: 6
  files_modified: 1
  tests_added: 36
  total_tests: 93
---

# Phase 3 Plan 02: AI Provider Implementations Summary

**One-liner:** Three AI providers (OpenAI GPT-4o, Anthropic Claude, Ollama local) implementing IAIProvider with direct SDK calls, typed structured output, token usage tracking, and cost calculation.

## What Was Built

Three provider classes that implement the `IAIProvider` interface from Plan 01:

- **OpenAIProvider** (`openai.provider.ts`): Uses `client.chat.completions.parse` with `zodResponseFormat` for structured JSON output. Maps `prompt_tokens`/`completion_tokens` to `inputTokens`/`outputTokens`. Supports all 5 task types including `analyzeImage` via multimodal `image_url` content parts.

- **AnthropicProvider** (`anthropic.provider.ts`): Uses `client.messages.parse` with a custom Zod v3-compatible output format (built via `zod-to-json-schema`). Extracts system messages from the conversation array to the top-level `system` param (required by Anthropic API). Maps `input_tokens`/`output_tokens`. Supports image analysis via `{ type: 'image', source: { type: 'url', url } }` content blocks.

- **OllamaProvider** (`ollama.provider.ts`): Uses native `fetch` to POST to `/api/chat`. Converts Zod schema to JSON Schema via `zodToJsonSchema` for structured output. Reads `prompt_eval_count`/`eval_count` for token counts with character-based fallback estimation. Vision support gated behind `OLLAMA_VISION_MODEL` env var; throws descriptive error when unconfigured.

All three providers:
- Instantiate SDK clients in the constructor (not at module level) for testability
- Return `AICallResult<T>` with `inputTokens`, `outputTokens`, `estimatedCostUsd` via `calculateCostUsd`
- Are exported from the `@social/ai-service` barrel (`index.ts`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Anthropic SDK zodOutputFormat incompatible with Zod v3**

- **Found during:** Task 1 GREEN phase — tests failing with `TypeError: z.toJSONSchema is not a function`
- **Issue:** The `@anthropic-ai/sdk` `zodOutputFormat` helper internally calls `z.toJSONSchema()` which is a Zod v4-only API. The project uses Zod v3.25.76.
- **Fix:** Replaced `zodOutputFormat` import from `@anthropic-ai/sdk/helpers/zod` with a local `buildZodOutputFormat` helper that uses `zodToJsonSchema` from the `zod-to-json-schema` package (already installed in root `node_modules`). The helper builds an identical format object with `type: 'json_schema'`, converted schema, and a `parse` function using `schema.safeParse`.
- **Files modified:** `extensions/ai-service/src/providers/anthropic.provider.ts`
- **Commit:** 9efaff62

## Test Coverage

| Test File | Tests | Status |
|-----------|-------|--------|
| openai.provider.spec.ts | 10 | PASS |
| anthropic.provider.spec.ts | 11 | PASS |
| ollama.provider.spec.ts | 15 | PASS |
| (prior tests) | 57 | PASS |
| **Total** | **93** | **ALL PASS** |

## Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| Custom zodOutputFormat for Anthropic | SDK version requires Zod v4; project uses v3 — built compatible version with zod-to-json-schema |
| Native fetch for Ollama | No maintained npm SDK; fetch keeps it lightweight and testable via jest.spyOn |
| OLLAMA_VISION_MODEL separate from default model | Vision models (llava, bakllava) are specialized and separate from text models |
| No throw in constructor for missing API keys | Allow lazy failure when actually called — provider might not be selected by router |

## Self-Check

- [x] `extensions/ai-service/src/providers/openai.provider.ts` - exists (min_lines: 60, actual: 108)
- [x] `extensions/ai-service/src/providers/anthropic.provider.ts` - exists (min_lines: 60, actual: 139)
- [x] `extensions/ai-service/src/providers/ollama.provider.ts` - exists (min_lines: 50, actual: 186)
- [x] All 3 providers export from `index.ts` barrel
- [x] Commits exist: 9efaff62 (Task 1), 5154a7fe (Task 2)
- [x] 93 tests passing
- [x] No imports from `@gitroom/nestjs-libraries/openai`
