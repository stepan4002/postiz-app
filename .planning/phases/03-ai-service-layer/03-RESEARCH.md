# Phase 3: AI Service Layer - Research

**Researched:** 2026-03-10
**Domain:** NestJS AI provider abstraction, cost tracking, circuit breakers, prompt engineering
**Confidence:** HIGH (verified against codebase, official docs, and current SDK versions)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All implementation details are deferred to Claude's discretion. There are no user-locked decisions for this phase.

### Claude's Discretion

All of the following areas are fully at Claude's discretion:

**Provider Abstraction Architecture:**
- Whether to wrap/extend existing `OpenaiService` or build a clean abstraction in the extension zone
- Interface design for AIService: method signatures for generateCaption, generateHashtags, adaptForPlatform, analyzeImage, scoreContent
- How to handle the existing `AgentGraphService` (LangChain-based) — coexist alongside or eventually replace
- Whether to use direct SDK calls (OpenAI SDK, Anthropic SDK) vs LangChain abstraction for provider implementations
- Structured output handling per provider

**Provider Router & Selection:**
- Router strategy: task-type-based routing vs simple per-company default
- Fallback behavior when primary provider is unavailable
- Model selection granularity
- Whether provider configuration is per-company, per-brand, or per-company with brand-level overrides

**Cost Tracking & Budget:**
- Cost instrumentation schema: new table vs extend existing models
- Token counting approach: provider response metadata vs estimate
- Budget enforcement granularity: weekly per-company budget (R4.6 specified)
- Circuit breaker behavior: queue for next cycle vs reject vs degrade to cheaper model
- Cost estimation for providers that don't return token counts (Ollama)

**Brand Voice Injection:**
- How BrandVoice config maps to system prompt context
- Prompt template design
- Whether brand voice is system message, user message prefix, or structured context block
- Multi-language handling
- Prompt injection prevention (NF1.3: user input in `user` role only)

**Ollama Integration:**
- Connection approach: HTTP API vs library wrapper
- Model availability detection
- Feature parity expectations
- Whether Ollama runs in Docker Compose or external

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| R4.1 | Provider-agnostic AIService interface (generateCaption, generateHashtags, adaptForPlatform, analyzeImage, scoreContent) | AIService abstract interface pattern; TypeScript interface with discriminated union for provider responses |
| R4.2 | Provider implementations: OpenAI (GPT-4o, GPT-4o-mini), Anthropic (Claude Sonnet, Haiku), Local (Ollama) | OpenAI SDK v6 zodResponseFormat; Anthropic SDK 0.78.0 zodOutputFormat; Ollama HTTP REST /api/chat with format field |
| R4.3 | Provider router: select provider per task type and cost policy | Simple router service with task-type-to-provider mapping; per-company config stored in AIConfig Prisma model |
| R4.4 | Per-company AI configuration: default provider, model preferences, budget limits | New AIConfig Prisma model with companyId FK; exposed via extension-zone CRUD |
| R4.5 | Cost instrumentation on every AI call: model, input tokens, output tokens, estimated cost, post ID, company ID — stored in DB | New AICostLog Prisma model; provider response usage metadata (OpenAI/Anthropic return token counts natively); Ollama requires estimation |
| R4.6 | Per-company weekly token budget with circuit breaker (queue for next cycle when exceeded) | WeeklyBudget check before each call; DB query aggregating AICostLog; circuit breaker uses simple throw/queue pattern without external library |
| R4.7 | Brand voice injection: BrandVoice config injected as system context into every generation call for that company/brand | BrandVoice already has all fields in Phase 1 schema; system prompt template with variable slots; user input stays in `user` role (NF1.3) |
| NF4.4 | AI logic behind AIService interface, not inline in handlers | Extension zone package `@social/ai-service`; all providers implement single interface; no direct SDK calls in controllers |

</phase_requirements>

---

## Summary

Phase 3 builds a provider-agnostic AI service layer as a new NestJS extension package `extensions/ai-service`. The package follows the established extension zone pattern (seen in `@social/credential-management` and `@social/multi-company`): a NestJS module with services, Prisma models for cost logging and per-company AI config, and a clean TypeScript interface that Phase 5 (Content Generation) will consume.

**Architecture decision:** Build a clean abstraction in the extension zone rather than wrap the existing `OpenaiService`. The existing `OpenaiService` in `libraries/nestjs-libraries/src/openai/openai.service.ts` uses hardcoded `gpt-4.1` with no abstraction, no cost tracking, and module-level client instantiation. Phase 3 must coexist with it — the upstream Postiz AI features (GeneratorAgent, OpenaiService) continue unchanged. The new `AIService` is a separate injection token used only by Phase 5+ features.

**Provider SDK choices:** Use direct SDK calls (OpenAI SDK v6, Anthropic SDK 0.78.0, Ollama HTTP REST) rather than LangChain abstraction. LangChain adds version coupling risk and the existing `AgentGraphService` using it is an upstream Postiz concern. Direct SDKs give clean access to usage metadata needed for cost tracking.

**Primary recommendation:** Create `extensions/ai-service` NestJS package with `AIService` interface, three provider implementations, `AIProviderRouter`, `AICostLogger`, `BudgetCircuitBreaker`, and `BrandVoicePromptBuilder`. Register `AIServiceModule` in `AppModule` after `MultiCompanyModule`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | `^6.2.0` (already in package.json) | OpenAI GPT-4o/GPT-4o-mini API calls | Already installed; has zodResponseFormat helper; usage object in responses |
| `@anthropic-ai/sdk` | `^0.78.0` (NOT YET in package.json — must add) | Anthropic Claude Sonnet/Haiku calls | Official SDK; zodOutputFormat helper; messages.parse() returns usage |
| `zod` | `^3.25.76` (already in package.json) | Structured output schemas for all providers | Already installed; zodResponseFormat (OpenAI) and zodOutputFormat (Anthropic) both use it |
| `@nestjs/common` | `^10.0.2` | NestJS DI, Injectable, Module | Already in all extension packages |
| `@prisma/client` | `6.5.0` (already in package.json) | AICostLog and AIConfig Prisma models | Already installed; PrismaService injected in all extensions |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node-fetch` / native `fetch` | Node 18+ built-in | Ollama HTTP REST calls | Ollama has no official TS SDK; HTTP to `localhost:11434` is idiomatic |
| `dayjs` | `^1.11.x` (already in credential-management) | Weekly budget date window calculation | Already used in credential-management for date arithmetic |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct SDK calls | LangChain `@langchain/openai` + `@langchain/anthropic` | LangChain already in project but adds wrapper overhead, hides usage metadata, couples to LangChain versioning |
| Native fetch for Ollama | `ollama` npm package | ollama npm package is thin wrapper over same HTTP API; adds dep without benefit |
| Custom circuit breaker | `opossum` library | opossum circuit breaker is service-failure based, not budget-based; simpler to implement budget check inline |
| New `AIConfig` Prisma model | Company.settings JSON field | Dedicated model is queryable, indexable, type-safe |

**Installation (new dependency only):**
```bash
pnpm add @anthropic-ai/sdk
```

---

## Architecture Patterns

### Recommended Project Structure

```
extensions/ai-service/
├── package.json                      # @social/ai-service, depends on openai + @anthropic-ai/sdk
├── tsconfig.json                     # extends ../../tsconfig.base.json
├── tsconfig.spec.json                # for jest tests
├── jest.config.ts                    # same pattern as credential-management
├── src/
│   ├── index.ts                      # barrel export
│   ├── ai-service.module.ts          # NestJS module, registers in AppModule
│   ├── interface/
│   │   └── ai-service.interface.ts   # IAIService interface + input/output types
│   ├── providers/
│   │   ├── openai.provider.ts        # OpenAIProvider implements IAIProvider
│   │   ├── anthropic.provider.ts     # AnthropicProvider implements IAIProvider
│   │   └── ollama.provider.ts        # OllamaProvider implements IAIProvider
│   ├── router/
│   │   └── ai-provider.router.ts     # AIProviderRouter — task type + company config → provider
│   ├── cost/
│   │   ├── ai-cost-logger.service.ts # logs every call to AICostLog table
│   │   └── budget-circuit-breaker.service.ts  # weekly budget check
│   ├── brand-voice/
│   │   └── brand-voice-prompt.builder.ts  # BrandVoice → system prompt string
│   ├── config/
│   │   └── ai-config.service.ts      # per-company AIConfig CRUD
│   └── __tests__/
│       ├── brand-voice-prompt.builder.spec.ts
│       ├── budget-circuit-breaker.spec.ts
│       └── ai-provider.router.spec.ts
```

### Pattern 1: IAIProvider Interface (Provider Abstraction)

**What:** Each provider implements a single interface. The router selects which provider to use. All callers depend only on the interface.

**When to use:** Always — NF4.4 requires AI logic behind interface, not inline in handlers.

**Example:**
```typescript
// extensions/ai-service/src/interface/ai-service.interface.ts

export type AITaskType =
  | 'generateCaption'
  | 'generateHashtags'
  | 'adaptForPlatform'
  | 'analyzeImage'
  | 'scoreContent';

export interface AICallContext {
  companyId: string;
  brandId?: string;
  postId?: string;
  taskType: AITaskType;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface AICallResult<T> {
  output: T;
  usage: AIUsage;
  model: string;
  provider: string;
}

export interface IAIProvider {
  readonly providerName: string;
  readonly supportedTaskTypes: AITaskType[];
  chat<T>(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    schema: z.ZodType<T>,
    model: string
  ): Promise<AICallResult<T>>;
  analyzeImage<T>(
    imageUrl: string,
    prompt: string,
    schema: z.ZodType<T>,
    model: string
  ): Promise<AICallResult<T>>;
}
```

### Pattern 2: OpenAI Provider (zodResponseFormat)

**What:** Direct OpenAI SDK v6 calls using the existing `zodResponseFormat` pattern already proven in `OpenaiService`.

**When to use:** GPT-4o for vision (analyzeImage), GPT-4o-mini for cheaper text generation tasks.

**Example:**
```typescript
// Source: libraries/nestjs-libraries/src/openai/openai.service.ts (existing pattern)
// Source: https://github.com/openai/openai-node/blob/master/helpers.md
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

async chat<T>(messages, schema: z.ZodType<T>, model: string): Promise<AICallResult<T>> {
  const completion = await this.client.chat.completions.parse({
    model,
    messages,
    response_format: zodResponseFormat(schema, 'output'),
  });
  const usage = completion.usage!;
  return {
    output: completion.choices[0].message.parsed as T,
    model,
    provider: 'openai',
    usage: {
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      estimatedCostUsd: this.calculateCost(model, usage.prompt_tokens, usage.completion_tokens),
    },
  };
}
```

### Pattern 3: Anthropic Provider (zodOutputFormat — new API)

**What:** Anthropic SDK 0.78.0 uses `messages.parse()` + `zodOutputFormat()` from `@anthropic-ai/sdk/helpers/zod`. The beta header (`structured-outputs-2025-11-13`) is no longer required.

**When to use:** Claude Sonnet for complex generation, Haiku for cheap/fast tasks.

**Example:**
```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

async chat<T>(messages, schema: z.ZodType<T>, model: string): Promise<AICallResult<T>> {
  const response = await this.client.messages.parse({
    model,
    max_tokens: 1024,
    messages: messages.filter(m => m.role !== 'system'),
    system: messages.find(m => m.role === 'system')?.content,
    output_config: { format: zodOutputFormat(schema) },
  });
  return {
    output: response.parsed_output as T,
    model,
    provider: 'anthropic',
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      estimatedCostUsd: this.calculateCost(model, response.usage.input_tokens, response.usage.output_tokens),
    },
  };
}
```

### Pattern 4: Ollama Provider (HTTP REST)

**What:** Ollama exposes `POST http://localhost:11434/api/chat` with a `format` parameter for JSON schema enforcement. No npm package needed — native fetch.

**When to use:** Local/offline generation; when OLLAMA_ENABLED=true and OLLAMA_BASE_URL is configured.

**Feature limitations:** Ollama does NOT support vision on all models (vision requires llava-based models). Ollama does NOT return token counts in the standard way — token estimation must be used.

**Example:**
```typescript
// Source: https://docs.ollama.com/capabilities/structured-outputs
const response = await fetch(`${this.baseUrl}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model,
    messages,
    stream: false,
    format: zodSchemaToJsonSchema(schema), // use zod-to-json-schema package
  }),
});
const data = await response.json();
// data.message.content is the JSON string; parse and validate with schema
const output = schema.parse(JSON.parse(data.message.content));
// Ollama returns eval_count (output tokens) and prompt_eval_count (input tokens)
// in the response root (not nested under usage)
```

### Pattern 5: BrandVoice System Prompt Injection

**What:** BrandVoice fields are serialized into the `system` message role. User input (brief, hashtag requests) remains in `user` role only. This prevents prompt injection (NF1.3).

**When to use:** Every generation call where a brandId is supplied.

**Example:**
```typescript
// extensions/ai-service/src/brand-voice/brand-voice-prompt.builder.ts
buildSystemPrompt(brandVoice: BrandVoice | null, baseInstruction: string): string {
  if (!brandVoice) return baseInstruction;

  const parts = [baseInstruction];

  if (brandVoice.tone.length > 0) {
    parts.push(`Brand voice tone: ${brandVoice.tone.join(', ')}.`);
  }
  if (brandVoice.targetAudience) {
    parts.push(`Target audience: ${brandVoice.targetAudience}.`);
  }
  if (brandVoice.blacklistedWords.length > 0) {
    parts.push(`NEVER use these words: ${brandVoice.blacklistedWords.join(', ')}.`);
  }
  if (brandVoice.preferredHashtags.length > 0) {
    parts.push(`Preferred hashtags (use when relevant): ${brandVoice.preferredHashtags.join(' ')}.`);
  }
  if (brandVoice.language && brandVoice.language !== 'en') {
    parts.push(`Respond in language: ${brandVoice.language}.`);
  }
  if (brandVoice.samplePosts.length > 0) {
    parts.push(`Sample posts in our style:\n${brandVoice.samplePosts.slice(0, 3).join('\n---\n')}`);
  }
  if (brandVoice.notes) {
    parts.push(`Additional brand guidelines: ${brandVoice.notes}`);
  }

  return parts.join('\n\n');
}
```

### Pattern 6: Budget Circuit Breaker

**What:** Before every AI call, check the company's weekly token spend against their configured budget. If exceeded, throw `BudgetExceededError` (Phase 5 catches and queues for next weekly cycle).

**When to use:** Every call routed through `AIProviderRouter`.

**Example:**
```typescript
// extensions/ai-service/src/cost/budget-circuit-breaker.service.ts
async checkBudget(companyId: string): Promise<void> {
  const config = await this.aiConfigService.findByCompany(companyId);
  if (!config?.weeklyBudgetUsd) return; // no budget set = unlimited

  const weekStart = dayjs().startOf('week').toDate();
  const spent = await this.prisma.aICostLog.aggregate({
    where: { companyId, createdAt: { gte: weekStart } },
    _sum: { estimatedCostUsd: true },
  });

  const spentAmount = spent._sum.estimatedCostUsd ?? 0;
  if (spentAmount >= config.weeklyBudgetUsd) {
    throw new BudgetExceededError(
      `Weekly AI budget of $${config.weeklyBudgetUsd} exceeded for company ${companyId}. ` +
      `Spent: $${spentAmount.toFixed(4)}. Resets next week.`
    );
  }
}
```

### Pattern 7: AIConfig and AICostLog Prisma Models

**What:** Two new Prisma models added to `schema.prisma` in the SOCIAL COMMAND CENTRE section.

**Example:**
```prisma
// Add to schema.prisma after BrandVoice model

model AIConfig {
  id                 String   @id @default(uuid())
  companyId          String   @unique
  defaultProvider    String   @default("openai")  // "openai" | "anthropic" | "ollama"
  preferredModels    Json     @default("{}")       // { "generateCaption": "gpt-4o-mini", "analyzeImage": "gpt-4o" }
  weeklyBudgetUsd    Float?                        // null = unlimited
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  company            Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
}

model AICostLog {
  id               String   @id @default(uuid())
  companyId        String
  postId           String?
  provider         String                          // "openai" | "anthropic" | "ollama"
  model            String
  taskType         String
  inputTokens      Int
  outputTokens     Int
  estimatedCostUsd Float
  createdAt        DateTime @default(now())
  company          Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId, createdAt])
  @@index([companyId, taskType])
}
```

### Anti-Patterns to Avoid

- **Calling AI providers directly in controllers or handlers:** All AI calls go through `AIService`/`AIProviderRouter`. No direct OpenAI/Anthropic SDK usage in controllers (NF4.4).
- **Concatenating user input into system prompts:** User-provided text (captions briefs, hashtag requests) MUST go in the `user` role message. BrandVoice context is the ONLY content in `system` role (NF1.3).
- **Using the existing `OpenaiService` for new Phase 3+ features:** The upstream `OpenaiService` is for Postiz's own features. Extending it would create drift and coupling.
- **Module-level provider client instantiation:** Do not create `new OpenAI()` at module scope like the upstream `OpenaiService` does. Instantiate in the provider class constructor so environment variables are read at runtime (and can be tested with mocks).
- **Checking Ollama model availability at startup:** Ollama models are pulled dynamically. Don't fail at startup if a model isn't pulled — fail gracefully at call time with a clear error.
- **Storing cost in tokens only:** Store estimatedCostUsd as a Float in addition to raw token counts. Token counts alone require knowing the pricing table at query time.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured output JSON parsing with type safety | Custom JSON parser + type casts | `zodResponseFormat` (OpenAI) / `zodOutputFormat` (Anthropic) / Zod parse (Ollama) | Handles refusals, parsing errors, partial completions; already used in codebase |
| JSON Schema from Zod for Ollama | Manual JSON Schema objects | `zod-to-json-schema` npm package (or Zod's `.json()` if available in v3.25+) | Maintains single source of truth in Zod schema |
| Weekly budget date window | Custom date arithmetic | `dayjs().startOf('week')` | dayjs already used in credential-management |
| Provider cost tables | Hardcoded if/else | Constant map `MODEL_COSTS: Record<string, {input: number, output: number}>` | Maintainable, easy to update when OpenAI/Anthropic change pricing |
| NestJS interface injection | Re-implementing upstream services | useFactory provider pattern (established in Phase 2) | Clean testability; avoids circular imports |

**Key insight:** The hardest part of AI cost tracking is not the math — it's ensuring every call path is instrumented. Build the logging into the router layer, not individual providers, so no call can bypass it.

---

## Common Pitfalls

### Pitfall 1: Anthropic's system Prompt Handling

**What goes wrong:** Anthropic's API places the `system` message outside the `messages` array as a top-level parameter. If you pass it inside `messages` like OpenAI, you get a validation error.

**Why it happens:** OpenAI and Anthropic have different message schemas. OpenAI accepts `{role: 'system', content: '...'}` in the messages array. Anthropic requires `system: '...'` at the top level.

**How to avoid:** In `AnthropicProvider.chat()`, extract system messages from the messages array and pass them as the top-level `system` parameter:
```typescript
const systemMsg = messages.find(m => m.role === 'system')?.content;
const userMessages = messages.filter(m => m.role !== 'system');
await client.messages.parse({ system: systemMsg, messages: userMessages, ... });
```

**Warning signs:** `400 Bad Request` with message about `messages[0].role` being `system`.

### Pitfall 2: Ollama Token Count Location

**What goes wrong:** Ollama returns token counts in non-standard fields: `prompt_eval_count` (input) and `eval_count` (output) in the response root, not in a `usage` object.

**Why it happens:** Ollama predates the OpenAI API standard and has its own response schema.

**How to avoid:** Access `data.prompt_eval_count` and `data.eval_count` directly from the Ollama response root. These may be 0 if the model doesn't report them — fall back to a character-based estimate (input_chars/4 as token estimate).

**Warning signs:** Cost logs showing 0 tokens for Ollama calls.

### Pitfall 3: Ollama Vision Capability Mismatch

**What goes wrong:** Sending `analyzeImage` to an Ollama model that doesn't support vision causes the model to hallucinate or return garbage.

**Why it happens:** Vision support in Ollama requires multimodal models (e.g., `llava`, `llava-phi3`). Standard text models cannot process images.

**How to avoid:** `OllamaProvider.supportedTaskTypes` should NOT include `analyzeImage` unless the configured model is explicitly a vision model. Add an `ollamaVisionModel` field to `AIConfig` separate from `defaultOllamaModel`. Default Ollama to no vision support.

**Warning signs:** Ollama returns text that doesn't reference actual image content.

### Pitfall 4: Budget Window Timezone Mismatch

**What goes wrong:** "Weekly" budget calculated in UTC doesn't align with the operator's week concept.

**Why it happens:** `dayjs().startOf('week')` uses server timezone (UTC by default).

**How to avoid:** Use `dayjs().tz(company.timezone).startOf('week')` when the company's timezone is known. Require `dayjs/plugin/timezone` and `dayjs/plugin/utc`. For simplicity in this phase, document that weekly budget resets Sunday midnight UTC and let the operator configure accordingly.

**Warning signs:** Budget resets at unexpected times for non-UTC operators.

### Pitfall 5: OpenAI SDK v6 Import Path Change

**What goes wrong:** `zodResponseFormat` import breaks with newer SDK versions.

**Why it happens:** The import path has been `openai/helpers/zod` — verify the codebase already uses this pattern.

**How to avoid:** Mirror the existing import from `libraries/nestjs-libraries/src/openai/openai.service.ts`:
```typescript
import { zodResponseFormat } from 'openai/helpers/zod';
```
This is already proven working in the codebase.

### Pitfall 6: Module-Level OpenAI/Anthropic Client Instantiation

**What goes wrong:** Creating `new OpenAI()` at module scope (like upstream `OpenaiService` does) means it reads `process.env.OPENAI_API_KEY` at import time, before environment is fully loaded.

**Why it happens:** The upstream `OpenaiService` was written before test isolation mattered.

**How to avoid:** Create clients in provider class constructors (or with `onModuleInit`), so they're created during NestJS bootstrap when all env vars are available. This also enables unit testing by setting env vars in `beforeAll`.

### Pitfall 7: Upstream OpenaiService Interference

**What goes wrong:** Both the new `AIService` and the existing `OpenaiService` use `OPENAI_API_KEY`. No conflict there, but if Phase 3 accidentally modifies `OpenaiService`, the upstream Postiz AI feature generator breaks.

**Why it happens:** Temptation to "DRY up" common OpenAI logic.

**How to avoid:** The new AIService extension package must NEVER import from `@gitroom/nestjs-libraries/openai`. They are independent. If shared OpenAI client config is needed, create it in the extension package independently.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Cost Table Constants
```typescript
// extensions/ai-service/src/cost/model-costs.ts
// Source: https://openai.com/api/pricing/ and https://platform.claude.com/docs/en/about-claude/pricing
// Prices as of 2026-03-10 in USD per 1M tokens

export const MODEL_COSTS: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  // OpenAI
  'gpt-4o': { inputPer1M: 5.0, outputPer1M: 20.0 },
  'gpt-4o-mini': { inputPer1M: 0.60, outputPer1M: 2.40 },
  // Anthropic
  'claude-sonnet-4-5': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-haiku-4-5': { inputPer1M: 1.0, outputPer1M: 5.0 },
  // Ollama — local, no cost (track tokens for visibility only)
  'ollama': { inputPer1M: 0, outputPer1M: 0 },
};

export function calculateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  // Normalize: any ollama model key falls back to 'ollama'
  const key = MODEL_COSTS[model] ? model : model.startsWith('ollama/') ? 'ollama' : model;
  const costs = MODEL_COSTS[key] ?? { inputPer1M: 0, outputPer1M: 0 };
  return (inputTokens / 1_000_000) * costs.inputPer1M
       + (outputTokens / 1_000_000) * costs.outputPer1M;
}
```

### Extension Package Setup (follows credential-management pattern)
```json
// extensions/ai-service/package.json
{
  "name": "@social/ai-service",
  "version": "1.0.0",
  "description": "Provider-agnostic AI service with cost tracking for Social Command Centre",
  "main": "src/index.ts",
  "license": "AGPL-3.0",
  "private": true,
  "dependencies": {
    "@nestjs/common": "^10.0.2",
    "@nestjs/core": "^10.0.2",
    "@anthropic-ai/sdk": "^0.78.0",
    "dayjs": "^1.11.10",
    "reflect-metadata": "^0.1.13",
    "zod": "^3.25.76"
  },
  "scripts": {
    "test": "jest --config jest.config.ts"
  }
}
```

Note: `openai` is not listed in the extension's own `package.json` because it is hoisted from the root `package.json` (workspace root dep). Same for `zod`. Only `@anthropic-ai/sdk` must be added to root `package.json` via `pnpm add @anthropic-ai/sdk`.

### tsconfig.base.json Path Alias Addition
```json
// Add to tsconfig.base.json paths section:
"@social/ai-service": ["extensions/ai-service/src/index.ts"]
```

### AppModule Registration
```typescript
// apps/backend/src/app.module.ts — add after CredentialManagementModule import
import { AIServiceModule } from '@social/ai-service';
// ...
// SOCIAL COMMAND CENTRE — Phase 3: AI Service Layer
AIServiceModule,
```

### AICostLogger Service (logging after every call)
```typescript
// extensions/ai-service/src/cost/ai-cost-logger.service.ts
@Injectable()
export class AICostLogger {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    companyId: string;
    postId?: string;
    provider: string;
    model: string;
    taskType: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  }): Promise<void> {
    await (this.prisma as any).aICostLog.create({ data: params });
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Anthropic beta header `structured-outputs-2025-11-13` | `output_config.format` with `zodOutputFormat()`, no header required | Nov 2025 → GA early 2026 | Clean: just use `client.messages.parse()` |
| LangChain abstraction for multi-provider | Direct provider SDKs with interface layer | Community shift 2024-2025 | Better access to usage metadata, fewer version conflicts |
| `format: "json"` for Ollama (JSON mode) | `format: <json_schema>` (schema enforcement) | Ollama 0.5.x | More reliable output structure |
| Module-level client instantiation | Constructor-injected client (DI-safe) | Best practice 2024+ | Testable without process.env hacks |

**Deprecated/outdated:**
- Anthropic beta header: no longer required (use `output_config.format` directly)
- `openai.chat.completions.create()` without structured output: use `.parse()` with `zodResponseFormat` for typed responses

---

## Open Questions

1. **Ollama Vision Support Configuration**
   - What we know: Standard Ollama text models cannot process images; vision requires llava-based models
   - What's unclear: Whether the operator will pull a vision-capable Ollama model or just use Ollama for text
   - Recommendation: Default `OLLAMA_VISION_MODEL` env var to empty string; if unset, `OllamaProvider.supportedTaskTypes` excludes `analyzeImage`. Router falls back to OpenAI for image tasks.

2. **zod-to-json-schema for Ollama format parameter**
   - What we know: Ollama requires a raw JSON Schema object in `format` field; Zod can't directly produce this in all versions
   - What's unclear: Whether `zod` v3.25+ has a built-in `.toJSONSchema()` method or if `zod-to-json-schema` package is needed
   - Recommendation: Add `zod-to-json-schema` as a dependency in `extensions/ai-service/package.json` for explicit JSON Schema generation from Zod objects. This is a small, well-maintained package.

3. **AIConfig CRUD API Exposure**
   - What we know: AIConfig is per-company; operator needs to set default provider, model preferences, weekly budget
   - What's unclear: Whether a full REST CRUD controller is needed in Phase 3 or if env-var defaults suffice for now (Phase 7 will have full dashboard)
   - Recommendation: Implement `AIConfigService` with DB storage plus env-var defaults (`AI_DEFAULT_PROVIDER`, `AI_WEEKLY_BUDGET_USD`). Expose minimal GET/PUT endpoint at `/api/companies/:companySlug/ai-config`. Phase 7 can build a richer UI.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest |
| Config file | `extensions/ai-service/jest.config.ts` (Wave 0) |
| Quick run command | `pnpm --filter @social/ai-service test` |
| Full suite command | `pnpm --filter @social/ai-service test -- --coverage` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R4.1 | AIService interface — all 5 methods callable, return typed results | unit | `pnpm --filter @social/ai-service test -- ai-service.interface` | Wave 0 |
| R4.2 | OpenAI provider structured output (mocked SDK) | unit | `pnpm --filter @social/ai-service test -- openai.provider` | Wave 0 |
| R4.2 | Anthropic provider structured output (mocked SDK) | unit | `pnpm --filter @social/ai-service test -- anthropic.provider` | Wave 0 |
| R4.2 | Ollama provider HTTP REST (mocked fetch) | unit | `pnpm --filter @social/ai-service test -- ollama.provider` | Wave 0 |
| R4.3 | Router selects correct provider for task type | unit | `pnpm --filter @social/ai-service test -- ai-provider.router` | Wave 0 |
| R4.5 | AICostLogger writes to DB after every call | unit (mocked Prisma) | `pnpm --filter @social/ai-service test -- ai-cost-logger` | Wave 0 |
| R4.6 | BudgetCircuitBreaker throws when budget exceeded | unit (mocked Prisma) | `pnpm --filter @social/ai-service test -- budget-circuit-breaker` | Wave 0 |
| R4.7 | BrandVoicePromptBuilder produces correct system prompt structure | unit | `pnpm --filter @social/ai-service test -- brand-voice-prompt.builder` | Wave 0 |
| NF1.3 | No user input in system messages | unit (inspect messages array) | covered by provider unit tests | Wave 0 |
| NF4.4 | AIService interface is the only public API surface | integration (no direct SDK imports in consumers) | manual review | manual-only |

### Sampling Rate

- **Per task commit:** `pnpm --filter @social/ai-service test`
- **Per wave merge:** `pnpm --filter @social/ai-service test -- --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `extensions/ai-service/jest.config.ts` — jest config (copy from credential-management)
- [ ] `extensions/ai-service/tsconfig.spec.json` — spec tsconfig (copy from credential-management)
- [ ] `extensions/ai-service/src/__tests__/brand-voice-prompt.builder.spec.ts` — covers R4.7
- [ ] `extensions/ai-service/src/__tests__/budget-circuit-breaker.spec.ts` — covers R4.6
- [ ] `extensions/ai-service/src/__tests__/ai-provider.router.spec.ts` — covers R4.3
- [ ] `extensions/ai-service/src/__tests__/openai.provider.spec.ts` — covers R4.2 (OpenAI)
- [ ] `extensions/ai-service/src/__tests__/anthropic.provider.spec.ts` — covers R4.2 (Anthropic)
- [ ] `extensions/ai-service/src/__tests__/ollama.provider.spec.ts` — covers R4.2 (Ollama)
- [ ] Root `pnpm add @anthropic-ai/sdk` — new dependency not yet installed

---

## Sources

### Primary (HIGH confidence)

- Existing codebase: `libraries/nestjs-libraries/src/openai/openai.service.ts` — confirmed OpenAI SDK v6 + zodResponseFormat usage pattern
- Existing codebase: `extensions/credential-management/` — confirmed extension zone package structure, NestJS module pattern, useFactory DI, Jest config
- Existing codebase: `libraries/nestjs-libraries/src/database/prisma/schema.prisma` — confirmed BrandVoice model fields, Company/Brand relationships
- Existing codebase: `apps/backend/src/app.module.ts` — confirmed AppModule import pattern for extension packages
- Existing codebase: `tsconfig.base.json` — confirmed path alias pattern for `@social/*`
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs — Anthropic structured outputs current API (no beta header needed, `output_config.format`)
- https://docs.ollama.com/capabilities/structured-outputs — Ollama `format` parameter JSON Schema support

### Secondary (MEDIUM confidence)

- https://openai.com/api/pricing/ — GPT-4o: $5/$20 per 1M input/output tokens; GPT-4o-mini: $0.60/$2.40
- https://platform.claude.com/docs/en/about-claude/pricing — Claude Sonnet 4.5: $3/$15; Claude Haiku 4.5: $1/$5 per 1M tokens
- https://github.com/openai/openai-node/blob/master/helpers.md — zodResponseFormat import path `openai/helpers/zod`
- @anthropic-ai/sdk version 0.78.0 on npm as of 2026-03-10 (WebSearch confirmed)

### Tertiary (LOW confidence — flag for validation)

- Ollama `prompt_eval_count` / `eval_count` field names — verify against actual Ollama response at implementation time; field names may differ by Ollama version

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified against existing package.json; only @anthropic-ai/sdk is new
- Architecture: HIGH — extension zone pattern verified against two prior phases; provider interface pattern is industry standard
- Provider APIs: HIGH (OpenAI, Anthropic) / MEDIUM (Ollama token field names)
- Pitfalls: HIGH — derived from existing codebase patterns and verified API docs
- Cost tables: MEDIUM — prices verified from official pages as of 2026-03-10; prices change without notice

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (30 days for stable; cost tables may change sooner — re-verify before hardcoding)
