# Phase 3: AI Service Layer - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Provider-agnostic AI service with cost tracking, ready to power content generation. Implements AIService interface (generateCaption, generateHashtags, adaptForPlatform, analyzeImage, scoreContent), three provider implementations (OpenAI, Anthropic, Ollama), provider router, per-company AI config, cost instrumentation, per-company weekly budget with circuit breaker, and BrandVoice injection into generation prompts.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation details are deferred to Claude's discretion. The following areas were analyzed, and Claude should choose the best approach for each based on the codebase patterns, extension zone architecture, and requirements R4.1-R4.7.

**Provider Abstraction Architecture:**
- Whether to wrap/extend existing `OpenaiService` (libraries/nestjs-libraries/src/openai/openai.service.ts) or build a clean abstraction in the extension zone
- Interface design for AIService: method signatures for generateCaption, generateHashtags, adaptForPlatform, analyzeImage, scoreContent
- How to handle the existing `AgentGraphService` (LangChain-based) — coexist alongside or eventually replace
- Whether to use direct SDK calls (OpenAI SDK, Anthropic SDK) vs LangChain abstraction for provider implementations
- Structured output handling per provider (OpenAI has zodResponseFormat, Anthropic has tool_use, Ollama varies)

**Provider Router & Selection:**
- Router strategy: task-type-based routing (e.g., vision tasks → OpenAI, text generation → cheapest available) vs simple per-company default
- Fallback behavior when primary provider is unavailable (retry same vs failover to different provider)
- Model selection granularity: per-task-type model preference vs single model per provider
- Whether provider configuration is per-company, per-brand, or per-company with brand-level overrides

**Cost Tracking & Budget:**
- Cost instrumentation schema: new table in extension zone vs extend existing models
- Token counting approach: use provider response metadata vs estimate from prompt length
- Budget enforcement granularity: weekly per-company budget (as specified in R4.6)
- Circuit breaker behavior: queue requests for next cycle vs reject with error vs degrade to cheaper model
- Cost estimation for providers that don't return token counts (Ollama)
- How to surface cost data to the operator (Phase 7 dashboard concern, but storage design matters now)

**Brand Voice Injection:**
- How BrandVoice config (tone, target audience, hashtags, blacklisted words, sample posts, language, free-form notes) maps to system prompt context
- Prompt template design: static template with variable interpolation vs dynamic prompt construction
- Whether brand voice is a system message, user message prefix, or structured context block
- How to handle multi-language brand voices (BrandVoice has language field)
- Prompt injection prevention: user input in `user` role only, BrandVoice in `system` role (per NF1.3)

**Ollama Integration:**
- Connection approach: HTTP API to local Ollama instance vs library wrapper
- Model availability detection: check which models are pulled vs require explicit configuration
- Feature parity expectations: Ollama may not support vision or structured output — how to handle gracefully
- Whether Ollama runs in Docker Compose or external to the stack

</decisions>

<specifics>
## Specific Ideas

No specific requirements from user — auto-mode. Key constraints from prior phases and project context:

- Extension zone architecture: custom code in `extensions/`, upstream files modified minimally (DIVERGENCE.md tracking)
- Company API scoping: explicit companyId parameter, not CLS magic — Phase 1 decision
- Solo operator: no multi-user complexity, one person manages everything
- Provider-agnostic is a core project principle (PROJECT.md)
- BrandVoice entity already exists with structured fields + free-form notes (Phase 1)
- NF1.3 requires AI prompt injection prevention: user input in `user` message role, never concatenated into system prompt
- NF4.4 requires AI logic behind AIService interface, not inline in handlers
- Existing OpenAI usage is hardcoded `gpt-4.1` with no abstraction — Phase 3 should not break existing Postiz AI features

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `OpenaiService` (libraries/nestjs-libraries/src/openai/openai.service.ts): Direct OpenAI SDK usage — generateImage, generatePosts, extractWebsiteText, separatePosts, generateSlidesFromText. Uses `gpt-4.1` and `dall-e-3`. No abstraction, no cost tracking.
- `AgentGraphService` (libraries/nestjs-libraries/src/agent/agent.graph.service.ts): LangChain-based agent with ChatOpenAI, DALL-E, Tavily search. Uses StateGraph for workflow. More complex than needed for Phase 3 scope.
- `BrandVoice` Prisma model: tone, targetAudience, preferredHashtags, blacklistedWords, samplePosts, language, notes — created in Phase 1
- `Company` entity: has timezone, defaultLanguage fields useful for AI context
- Extension zone packages: `extensions/company-context`, `extensions/multi-company`, `extensions/credential-management`, `extensions/seed`

### Established Patterns
- NestJS module registration in AppModule (extensions register their own modules)
- Controller -> Service -> Repository layering (no shortcuts)
- Prisma as ORM with PrismaRepository pattern
- Extension packages use `@social/*` path aliases via tsconfig.base.json
- Interface injection for cross-package deps (Phase 2 pattern: IRefreshIntegrationService)
- Environment variable guards (ENCRYPTION_KEY pattern from Phase 2, RUN_CRON pattern)
- OpenAI SDK `zodResponseFormat` for structured outputs (existing pattern)
- BullMQ for background job processing

### Integration Points
- BrandVoice entity: system prompt context source (extensions/multi-company manages Brand/BrandVoice)
- Company entity: per-company AI config will need to be stored here or in a new AIConfig entity
- AppModule: new AIServiceModule will register here
- Future Phase 5 (Content Generation Pipeline) will be the primary consumer of this service layer
- Existing OpenaiService: Phase 3 service coexists — upstream features continue using OpenaiService unchanged

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope (auto-mode)

</deferred>

---

*Phase: 03-ai-service-layer*
*Context gathered: 2026-03-10*
