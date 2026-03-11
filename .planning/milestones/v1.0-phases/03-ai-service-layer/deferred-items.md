# Deferred Items - Phase 03 AI Service Layer

## Pre-existing Issues (Out of Scope for 03-03)

### AnthropicProvider test failures - `z.toJSONSchema is not a function`

- **Discovered during:** Plan 03-03 full test run
- **File:** `extensions/ai-service/src/__tests__/anthropic.provider.spec.ts`
- **Root cause:** The `@anthropic-ai/sdk` `zodOutputFormat` helper calls `z.toJSONSchema()` which is a method that doesn't exist in the installed version of zod. This is a version compatibility issue between `@anthropic-ai/sdk` and `zod`.
- **Impact:** 9 tests fail in anthropic.provider.spec.ts
- **Scope:** Pre-existing before Plan 03-03; introduced by Plan 02 provider implementation
- **Resolution:** Address in Plan 02 completion or a fix plan. May require upgrading zod to a version that includes `toJSONSchema()`, or switching to `zodTextFormat` (if available) or manual JSON schema conversion.
