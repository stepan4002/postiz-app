# Phase 5: Content Generation Pipeline - Research

**Researched:** 2026-03-10
**Domain:** AI content generation pipeline, PostVariant data model, Review Queue UI
**Confidence:** HIGH (all findings derived from direct codebase inspection + established project patterns)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Input Workflow:**
- Upload media from existing media library (Phase 4) OR upload new media inline — both paths supported
- Text brief is optional free-form text — AI uses it as additional context alongside image analysis
- Target platform selection: multi-select from connected platforms (Instagram, Facebook, LinkedIn, X)
- Content type selection: dropdown with options (product, brand story, educational, seasonal, offer, testimonial, behind-the-scenes) — influences prompt template
- Brand selection: operator picks which brand this content is for — determines BrandVoice injection
- Single generation flow produces PostVariants for all selected platforms at once

**AI Vision & Caption Generation:**
- AI vision (R5.2): use Phase 3 AIService.analyzeImage to understand uploaded media content
- Vision output feeds into caption generation as structured context (image description, detected objects, mood)
- Caption generation uses BrandVoice injection (already built in Phase 3 via BrandVoicePromptBuilder)
- Each platform gets an adapted caption via AIService.adaptForPlatform — different length, style, hashtag density
- Generation is async — operator sees a loading state, then results appear
- All generation calls go through Phase 3's AIProviderRouter (respects per-company provider config and budget)

**PostVariant Model:**
- New PostVariant entity: postId, platform, caption, hashtags, mediaVariantId, confidenceScore, status
- One PostVariant per target platform per generation
- PostVariant links to MediaVariant (platform-specific resized image from Phase 4)
- Post entity: companyId, brandId, mediaId, brief, contentType, status (DRAFT/PENDING_REVIEW/APPROVED/SCHEDULED)
- Media variant generation (Phase 4) triggered automatically when platforms are selected

**Confidence Scoring & Gating:**
- AIService.scoreContent (Phase 3) evaluates each generated caption — returns 0-1 float
- Per-company configurable threshold (stored in AIConfig, default 0.7)
- Below threshold → status = PENDING_REVIEW, routed to Review Queue
- Above threshold → status = APPROVED (or PENDING_REVIEW if company config requires all review)
- Per-company "require_all_review" boolean flag in AIConfig — overrides confidence gating

**Review Queue UI:**
- List view of pending posts: media thumbnail, AI-generated caption per platform, confidence score badge
- Color-coded confidence: red (<0.5), yellow (0.5-0.7), green (>0.7)
- Operator actions per post: Approve, Edit & Approve (inline edit), Reject, Regenerate
- Regenerate re-runs AI generation with same inputs — produces new captions
- Edit & Approve opens inline caption editor per platform variant
- Audit trail stored: generated_by (model), confidence_score, reviewed_by, review_action, review_timestamp

**Audit Trail:**
- Every AI generation logged: model, provider, input tokens, output tokens, cost (already via Phase 3 AICostLogger)
- Review actions logged per PostVariant: reviewer (always the operator), action, timestamp, original vs edited caption
- Audit data stored in DB, surfaced in Phase 7 dashboard

### Claude's Discretion
- Exact prompt templates for each content type (product, brand story, etc.)
- Loading/progress UI during generation
- Review Queue sorting and filtering options
- Whether to show confidence score breakdown or just the number
- Inline editor component design for Edit & Approve flow
- How to handle generation failures (retry UI, error messages)
- Pagination strategy for Review Queue

### Deferred Ideas (OUT OF SCOPE)
- Content repurposing (blog to posts, review to testimonial) — future phase
- Evergreen post recycling — Phase 6 or later
- Batch generation (generate for multiple brands at once) — future enhancement
- A/B testing of caption variants — Milestone 2
- Content calendar integration (drag posts to schedule) — Phase 6 scope
- Multi-language generation from single brief — future enhancement (BrandVoice has language field ready)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| R5.1 | Input workflow: operator uploads image/video + optional text brief → AI generates captions | CreatePostDto + ContentGenerationService.generate() orchestrates the full pipeline |
| R5.2 | AI vision: analyze uploaded image/video to understand content for caption generation | AIProviderRouter.executeImageAnalysis() already built in Phase 3; needs ImageAnalysisSchema (Zod) |
| R5.3 | Caption generation with brand voice, tone, and hashtags per BrandVoice config | AIProviderRouter.execute() with brandId injects BrandVoicePromptBuilder automatically |
| R5.4 | Platform-specific caption adaptation (length, style, hashtag density per platform norms) | One AIProviderRouter.execute('adaptForPlatform') call per target platform |
| R5.5 | Generate PostVariants: one per target platform, each with adapted caption | PostVariant entity (new Prisma model) + PostVariantRepository.createMany() |
| R5.6 | Confidence scoring on every generation (0-1 scale) | AIProviderRouter.execute('scoreContent') per generated caption; result stored on PostVariant.confidenceScore |
| R5.7 | Content types supported: product, brand story, educational, seasonal, offer, testimonial, behind-the-scenes | CONTENT_TYPE_PROMPT_MODIFIERS map in content-generation.service.ts |
| R6.1 | Posts with confidence score below threshold (configurable per company, default 0.7) routed to Review Queue | AIConfig needs requireAllReview boolean field; ContentGenerationService applies gating logic |
| R6.2 | Posts above threshold auto-approved (configurable: can require all posts reviewed) | Post.status set to APPROVED vs PENDING_REVIEW based on threshold + requireAllReview flag |
| R6.3 | Review Queue UI: list of pending posts with AI-generated content, confidence score, source media | ReviewQueueList component + useReviewQueue SWR hook |
| R6.4 | Operator actions: approve, edit and approve, reject, regenerate | ReviewQueueController POST /review-queue/:postId/approve|reject|regenerate; PATCH /review-queue/:postId/variants/:variantId |
| R6.5 | Audit trail: generated_by, model_version, confidence_score, reviewed_by, review_outcome stored per post | PostVariantAudit model in Prisma; PostVariantRepository.createAuditEntry() |
</phase_requirements>

---

## Summary

Phase 5 connects the already-built AI Service Layer (Phase 3) and Media Library (Phase 4) into the project's core value proposition: upload media + brief, get platform-adapted captions with brand voice. All the heavy infrastructure is in place — this phase is about orchestrating the pipeline, defining the data model for Posts/PostVariants, and building the Review Queue UI.

The generation pipeline has a clear shape: image analysis → base caption generation → per-platform adaptation → confidence scoring → gating decision. Every AI call already flows through `AIProviderRouter` which handles budget enforcement, brand voice injection, provider selection, and cost logging automatically. The new `ContentGenerationService` in the extension zone is essentially a pipeline orchestrator that calls the router five times per post (once for vision, once for base caption, N times for platform adaptation, N times for scoring).

The data model requires two new Prisma models: `ContentPost` (the parent post with companyId, brandId, mediaId, brief, contentType, status) and `PostVariant` (one per platform with caption, hashtags, confidenceScore, status, and audit fields). The `AIConfig` model needs one new boolean field `requireAllReview`. The Review Queue is a filtered view of `ContentPost` records where status is `PENDING_REVIEW`, with their `PostVariant` relations loaded.

**Primary recommendation:** Build a new `@social/content-generation` extension package following the exact same pattern as `@social/ai-service` and `@social/media-library` — Controller -> Service -> Repository layering, useFactory DI wiring in module, exports consumed by Phase 6.

---

## Standard Stack

### Core (already available — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@social/ai-service` | local | AIProviderRouter, BrandVoicePromptBuilder | Phase 3 built infrastructure; all AI calls route through here |
| `@social/media-library` | local | CompanyMediaService, MediaProcessingService | Phase 4 built media pipeline; variant generation already async |
| `@nestjs/common` | ^10.0.2 | NestJS decorators, Injectable, Module | Established project pattern |
| `zod` | ^3.25.76 | Schema validation for AI structured outputs | All AI providers use zod schemas for output validation |
| `@gitroom/nestjs-libraries` | local | PrismaService, DatabaseModule | Global Prisma service available in AppModule |
| `swr` | project | SWR hooks for all data fetching | CLAUDE.md mandates SWR + useFetch |
| `@gitroom/helpers/utils/custom.fetch` | local | useFetch hook | CLAUDE.md mandates this for all API calls |
| `clsx` | project | Conditional className utilities | Used consistently in all Phase 4 components |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `uuid` (v4) | already in project | Generate postId/variantId pre-insert | Same pattern as Phase 4 mediaId pre-generation |
| `@nestjs/mapped-types` | already in project | DTO inheritance for partial updates | If needing PartialType in DTOs |

### No New Dependencies Required
The entire Phase 5 backend can be built using existing project dependencies. The frontend uses the same SWR + useFetch + Tailwind patterns already established.

**Installation:** No new packages required for this phase.

---

## Architecture Patterns

### Extension Package Structure

```
extensions/content-generation/
├── package.json                          # @social/content-generation
├── jest.config.ts
├── tsconfig.json
├── tsconfig.spec.json
├── src/
│   ├── index.ts                          # Barrel exports
│   ├── content-generation.module.ts      # NestJS module registration
│   ├── posts/
│   │   ├── content-post.repository.ts    # Prisma DB layer for ContentPost
│   │   ├── content-post.service.ts       # Generation pipeline orchestration
│   │   ├── content-post.controller.ts    # POST /companies/:slug/posts/generate
│   │   └── dtos/
│   │       ├── create-post.dto.ts        # Input: mediaId, brandId, brief, contentType, platforms
│   │       └── review-action.dto.ts      # Input: action, editedCaption
│   ├── variants/
│   │   ├── post-variant.repository.ts    # CRUD for PostVariant + audit
│   │   └── post-variant.service.ts       # Confidence gating logic
│   └── review/
│       ├── review-queue.controller.ts    # GET/POST /companies/:slug/review-queue
│       └── review-queue.service.ts       # Filter pending posts, execute actions
```

### Frontend Structure

```
apps/frontend/src/components/content-generation/
├── CreatePostForm.tsx                    # Main input workflow component
├── PlatformSelector.tsx                  # Multi-select for target platforms
├── MediaPicker.tsx                       # Pick from library OR upload inline
├── ContentTypeSelector.tsx               # Dropdown for content type
├── GenerationLoadingState.tsx            # Loading/progress during AI generation
├── GeneratedVariantsPreview.tsx          # Preview generated captions per platform
└── hooks/
    ├── use-generate-post.ts              # SWR mutation hook for POST /posts/generate
    └── use-brands.ts                     # SWR hook to fetch brand list for brand selector

apps/frontend/src/components/review-queue/
├── ReviewQueueList.tsx                   # List of pending posts
├── ReviewQueueItem.tsx                   # Single post card with variants + actions
├── ConfidenceBadge.tsx                   # Color-coded score display
├── InlineCaptionEditor.tsx               # Edit & Approve inline editor
└── hooks/
    ├── use-review-queue.ts               # SWR hook for GET /review-queue
    └── use-review-action.ts              # POST action hook (approve/reject/regenerate)
```

### Pattern 1: Generation Pipeline (ContentPostService)

**What:** Sequential AI calls for image analysis, caption generation, per-platform adaptation, and confidence scoring.
**When to use:** Called once per POST /companies/:slug/posts/generate request.

```typescript
// Source: extensions/content-generation/src/posts/content-post.service.ts
// Inferred from AIProviderRouter API in Phase 3 (ai-provider.router.ts)

async generate(
  companyId: string,
  dto: CreatePostDto,
): Promise<{ post: ContentPost; variants: PostVariant[] }> {
  // Step 1: Analyze image via vision model
  const imageAnalysis = await this.aiRouter.executeImageAnalysis(
    { companyId, brandId: dto.brandId, taskType: 'analyzeImage' },
    mediaPublicUrl,
    IMAGE_ANALYSIS_PROMPT,
    ImageAnalysisSchema,  // Zod: { description, objects, mood, suggestedTone }
  );

  // Step 2: Generate base caption with brand voice + content type modifier
  const basePrompt = this.buildCaptionPrompt(dto.contentType, imageAnalysis.output, dto.brief);
  const baseCaptionResult = await this.aiRouter.execute(
    { companyId, brandId: dto.brandId, taskType: 'generateCaption' },
    [{ role: 'system', content: basePrompt }, { role: 'user', content: 'Generate caption' }],
    BaseCaptionSchema,  // Zod: { caption, hashtags }
  );

  // Step 3: Per-platform adaptation + scoring (parallel via Promise.all)
  const variants = await Promise.all(
    dto.platforms.map(async (platform) => {
      const adapted = await this.aiRouter.execute(
        { companyId, brandId: dto.brandId, postId: post.id, taskType: 'adaptForPlatform' },
        [platformAdaptationMessages(platform, baseCaptionResult.output)],
        PlatformCaptionSchema,  // Zod: { caption, hashtags }
      );
      const scored = await this.aiRouter.execute(
        { companyId, brandId: dto.brandId, postId: post.id, taskType: 'scoreContent' },
        [scoreContentMessages(adapted.output.caption, platform)],
        ConfidenceScoreSchema,  // Zod: { score: number } (0-1)
      );
      return { platform, adapted, scored };
    })
  );

  // Step 4: Apply confidence gating + create PostVariant records
  // ...
}
```

### Pattern 2: Confidence Gating

**What:** After scoring, each PostVariant gets a status based on threshold comparison.
**When to use:** Applied to every variant after generation completes.

```typescript
// Source: Derived from CONTEXT.md decisions + AIConfig schema (schema.prisma:82-93)

private applyGating(
  score: number,
  threshold: number,        // from AIConfig (default 0.7)
  requireAllReview: boolean // from AIConfig (new field)
): 'APPROVED' | 'PENDING_REVIEW' {
  if (requireAllReview) return 'PENDING_REVIEW';
  return score >= threshold ? 'APPROVED' : 'PENDING_REVIEW';
}
```

### Pattern 3: SWR Hook Per Endpoint (CLAUDE.md Compliance)

**What:** One SWR hook per data source, in its own file.
**When to use:** Every data-fetching operation on the frontend.

```typescript
// Source: Established pattern from use-company-media.ts + useBrandConnections.ts

// hooks/use-review-queue.ts
export const useReviewQueue = (companySlug: string, page = 1) => {
  const fetch = useFetch();
  return useSWR<ReviewQueueResponse>(
    companySlug ? `review-queue-${companySlug}-p${page}` : null,
    async () => {
      const res = await fetch(`/companies/${companySlug}/review-queue?page=${page}`);
      return res.json();
    }
  );
};

// hooks/use-brands.ts  (separate hook per CLAUDE.md)
export const useBrands = (companySlug: string) => {
  const fetch = useFetch();
  return useSWR<Brand[]>(
    companySlug ? `brands-${companySlug}` : null,
    async () => {
      const res = await fetch(`/companies/${companySlug}/brands`);
      return res.json();
    }
  );
};
```

### Pattern 4: Prisma Model for ContentPost + PostVariant

**What:** Two new models added to the shared schema.prisma file, following Phase 4 extension block convention.
**When to use:** Phase 5 DB migration.

```prisma
// Source: schema.prisma extension pattern established in Phase 4 (lines 352-379)
// Location: libraries/nestjs-libraries/src/database/prisma/schema.prisma

// SOCIAL COMMAND CENTRE — Phase 5: Content Generation Pipeline
model ContentPost {
  id          String          @id @default(uuid())
  companyId   String
  brandId     String
  mediaId     String?
  brief       String?
  contentType String          // product|brand_story|educational|seasonal|offer|testimonial|behind_the_scenes
  status      String          @default("DRAFT") // DRAFT|PENDING_REVIEW|APPROVED|SCHEDULED
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  company     Company         @relation(fields: [companyId], references: [id], onDelete: Cascade)
  brand       Brand           @relation(fields: [brandId], references: [id])
  variants    PostVariant[]

  @@index([companyId, status])
  @@index([companyId, createdAt])
  @@index([brandId])
}

model PostVariant {
  id               String            @id @default(uuid())
  postId           String
  platform         String            // instagram|facebook|linkedin|x
  caption          String
  hashtags         String[]          @default([])
  mediaVariantId   String?           // FK to MediaVariant.id
  confidenceScore  Float
  status           String            // PENDING_REVIEW|APPROVED|REJECTED
  generatedBy      String            // model name (e.g., gpt-4o-mini)
  generatedAt      DateTime          @default(now())
  reviewedBy       String?           // operator identifier
  reviewAction     String?           // approve|edit_approve|reject|regenerate
  reviewedAt       DateTime?
  originalCaption  String?           // preserved when edited
  post             ContentPost       @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([postId])
  @@index([platform, status])
  @@index([confidenceScore])
}
// END Phase 5 Content Generation models
```

### Pattern 5: Controller -> Service -> Repository Layering

**What:** Three-layer NestJS backend following CLAUDE.md mandate.
**When to use:** Every backend operation in Phase 5.

```typescript
// Source: Established from Phase 2-4 code inspection
// Controller resolves companySlug -> companyId, delegates to service
@Post('generate')
async generate(
  @Param('companySlug') companySlug: string,
  @Body() dto: CreatePostDto,
  @Request() req: any,
) {
  const company = await this.prisma.company.findUnique({ where: { slug: companySlug } });
  return this.contentPostService.generate(company.id, dto);
}
```

### Anti-Patterns to Avoid

- **Inline AI calls in controllers:** All AI calls must go through `AIProviderRouter.execute()` or `executeImageAnalysis()` — never call provider SDKs directly in controllers or services
- **Blocking generation in request thread:** Do NOT make generation synchronous. Use async/await with Promise.all for parallel platform variants, but keep the total request time acceptable (target < 10s for 4 platforms)
- **Skipping AICostLogger:** Phase 3's `AIProviderRouter` auto-logs cost, but any custom AI calls not through the router will miss logging. Always use the router.
- **CLS for companyId:** The established pattern uses explicit companyId parameter in services (not CLS), per the "Company API scoping" decision in STATE.md
- **Multiple SWR calls in one hook:** CLAUDE.md strictly prohibits returning multiple SWR hooks from one function. Each endpoint gets its own hook file.
- **Concatenating user input into system prompt:** NF1.3 mandates user brief goes in `user` message role, never in system prompt concatenation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Brand voice injection | Custom prompt builder | `BrandVoicePromptBuilder.buildSystemPrompt()` (Phase 3) | Already handles all BrandVoice fields; AIProviderRouter auto-injects when brandId provided |
| AI provider selection | Custom provider routing | `AIProviderRouter.execute()` / `executeImageAnalysis()` (Phase 3) | Budget enforcement, fallback logic, cost logging all handled |
| Cost tracking | Custom cost log table | `AICostLogger` called by `AIProviderRouter` automatically | Non-blocking, append-only, already in DB; postId links variants back |
| Budget enforcement | Custom budget check | `BudgetCircuitBreaker` inside `AIProviderRouter` | Already throws `BudgetExceededError` before any AI call |
| Media URL resolution | Custom MinIO URL builder | `MINIO_PUBLIC_URL` env var prefix (established in Phase 4) | `resolveMediaUrl` pattern: if path starts with http, use as-is; else prepend MINIO_PUBLIC_URL |
| Platform image resizing | Custom sharp pipeline | `MediaProcessingService.generateVariants()` (Phase 4) | Already queued async via `CompanyMediaRepository.createProcessingJob()` |
| Structured AI output | Manual JSON parsing | Zod schemas passed to `IAIProvider.chat()` | All three providers validate output against schema; Zod v3 compatible via project pattern |

**Key insight:** Phase 5 is an orchestration layer over already-built infrastructure. The value is in prompt engineering and pipeline sequencing, not in building new infrastructure components.

---

## Common Pitfalls

### Pitfall 1: MediaVariant Not Yet Generated When Generation Runs
**What goes wrong:** Operator selects platforms, triggers generation. `MediaProcessingJob` runs async (30s cron). PostVariant tries to link `mediaVariantId` to a variant that doesn't exist yet.
**Why it happens:** Phase 4 variant generation is async-cron, not synchronous. The cron polls every 30 seconds — there's a window where the variant doesn't exist.
**How to avoid:** `mediaVariantId` on PostVariant should be nullable. Populate it lazily: after generation, call `findFirst` on MediaVariant to check if the platform variant exists; if not, leave `mediaVariantId` null and it gets backfilled when Phase 6 publishing triggers. Alternatively, call `generateVariants()` directly from the service for the selected platforms (bypassing the queue) if response time allows.
**Warning signs:** PostVariant created with null mediaVariantId — acceptable initially; Phase 6 must handle this.

### Pitfall 2: Promise.all for Platform Variants — One Failure Cancels All
**What goes wrong:** Using `Promise.all` for parallel platform adaptation. If the LinkedIn adaptation fails (e.g., provider timeout), all platforms fail.
**Why it happens:** `Promise.all` rejects immediately when any promise rejects.
**How to avoid:** Use `Promise.allSettled` instead. Collect fulfilled variants, log/skip rejected ones. Return partial results to operator with error badges on failed platforms.
**Warning signs:** All four platforms show error when only one AI call timed out.

### Pitfall 3: AIConfig.requireAllReview Field Missing
**What goes wrong:** The confidence gating logic reads `requireAllReview` from AIConfig, but this field doesn't exist in the schema yet.
**Why it happens:** Phase 3 built `AIConfig` (schema.prisma:82-93) without this field — it was in scope for Phase 5.
**How to avoid:** Add `requireAllReview Boolean @default(false)` to the `AIConfig` model in the schema migration for this phase. The `AIConfigService.findByCompany()` already returns the full model — it just needs this field added.
**Warning signs:** TypeScript errors in ContentGenerationService when accessing `config.requireAllReview`.

### Pitfall 4: Prompt Injection via User Brief
**What goes wrong:** The operator's free-form brief is concatenated into the system prompt. A crafted brief could override brand voice instructions or exfiltrate prompt contents.
**Why it happens:** Developers assume operator input is trusted.
**How to avoid:** Per NF1.3, user brief ALWAYS goes in the `user` message role, never in the `system` message. System message contains only task instructions + brand voice.
**Warning signs:** `messages.push({ role: 'system', content: dto.brief })` anywhere in code.

### Pitfall 5: Ollama Cannot Analyze Images
**What goes wrong:** Company config has Ollama as default provider. Image analysis call goes to Ollama, which doesn't support vision.
**Why it happens:** `AIProviderRouter.selectProvider()` selects by `defaultProvider` first, then falls back to first provider supporting the task type. `OllamaProvider.supportedTaskTypes` must NOT include `analyzeImage`.
**How to avoid:** Verify that `OllamaProvider.supportedTaskTypes` excludes `analyzeImage` (confirmed: Phase 3 design). The router will fall back to OpenAI or Anthropic for vision tasks. Document this behavior in code comments.
**Warning signs:** Vision errors on Ollama-first companies.

### Pitfall 6: AICostLog.postId Should Reference ContentPost, Not Upstream Post
**What goes wrong:** AICostLog has a `postId` String? field (schema.prisma:98) intended for linking costs to posts. The existing upstream Post model uses cuid(), but new ContentPost uses uuid(). If postId is set to ContentPost.id, it's orphaned (no FK relation).
**Why it happens:** AICostLog was designed with a nullable postId without a FK constraint — it's a soft reference (no `@relation`).
**How to avoid:** AICostLog.postId is already nullable with no FK constraint — setting it to ContentPost.id is safe and correct. This is by design (append-only log, company-scoped).
**Warning signs:** None — this is safe. But Phase 7 analytics must JOIN on ContentPost.id, not Post.id.

### Pitfall 7: Review Queue Pagination — POST/Redirect Pattern vs SWR Mutation
**What goes wrong:** Approve/Reject actions mutate the queue. If the review queue uses SWR with a cached key, the UI won't update after the action.
**Why it happens:** SWR caches by key; POST actions don't invalidate cache automatically.
**How to avoid:** After approve/reject/regenerate actions, call `mutate()` on the review queue SWR key. The `useReviewAction` hook must accept a `mutate` callback or the component must call it after action completion.
**Warning signs:** Approved post still appears in Review Queue after approval.

---

## Code Examples

Verified from direct codebase inspection:

### Calling AIProviderRouter.execute() for Caption Generation
```typescript
// Source: extensions/ai-service/src/router/ai-provider.router.ts (lines 100-143)
// Pattern for ContentGenerationService to generate a caption

const baseCaptionResult = await this.aiRouter.execute<{ caption: string; hashtags: string[] }>(
  {
    companyId,
    brandId: dto.brandId,
    postId: post.id,
    taskType: 'generateCaption',
  },
  [
    { role: 'system', content: systemPrompt },  // task instructions only
    { role: 'user', content: userMessage },      // brief + image description
  ],
  z.object({
    caption: z.string(),
    hashtags: z.array(z.string()),
  }),
);
// result.output.caption, result.output.hashtags, result.model (for generatedBy)
```

### Calling AIProviderRouter.executeImageAnalysis()
```typescript
// Source: extensions/ai-service/src/router/ai-provider.router.ts (lines 160-209)

const imageAnalysis = await this.aiRouter.executeImageAnalysis<{
  description: string;
  objects: string[];
  mood: string;
  suggestedTone: string;
}>(
  {
    companyId,
    brandId: dto.brandId,
    taskType: 'analyzeImage',
  },
  mediaPublicUrl,   // must be publicly accessible URL
  'Analyze this image for social media content creation. Return description, detected objects, mood, and suggested tone.',
  z.object({
    description: z.string(),
    objects: z.array(z.string()),
    mood: z.string(),
    suggestedTone: z.string(),
  }),
);
```

### Resolving MediaVariant URL for Image Analysis
```typescript
// Source: extensions/media-library/src/media/company-media.service.ts (line 76-77)
// Media path stored as MinIO key: {companyId}/{mediaId}/{originalname}
// Must be resolved to public URL before passing to vision model

function resolveMediaUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${process.env.MINIO_PUBLIC_URL}/${process.env.MINIO_BUCKET}/${path}`;
}
```

### SWR Hook Pattern (CLAUDE.md Compliant)
```typescript
// Source: apps/frontend/src/components/media/hooks/use-company-media.ts
// Must be followed exactly for all Phase 5 hooks

export const useReviewQueue = (companySlug: string, page = 1) => {
  const fetch = useFetch();
  return useSWR<ReviewQueueResponse>(
    companySlug ? `review-queue-${companySlug}-p${page}` : null,
    async () => {
      const res = await fetch(`/companies/${companySlug}/review-queue?page=${page}`);
      return res.json();
    }
  );
};
```

### useFactory DI Wiring Pattern for Module
```typescript
// Source: extensions/ai-service/src/ai-service.module.ts (lines 52-105)
// Pattern for ContentGenerationModule wiring

{
  provide: ContentPostService,
  useFactory: (
    repository: ContentPostRepository,
    aiRouter: AIProviderRouter,
    aiConfig: AIConfigService,
    prisma: PrismaService,
  ) => new ContentPostService(repository, aiRouter, aiConfig, prisma as any),
  inject: [ContentPostRepository, AIProviderRouter, AIConfigService, PrismaService],
},
```

### ConfidenceBadge Color Logic
```typescript
// Source: CONTEXT.md decisions (color-coded confidence: red <0.5, yellow 0.5-0.7, green >0.7)
// Consistent with BrandConnectPanel.tsx health dot color pattern

function confidenceBadgeClass(score: number): string {
  if (score >= 0.7) return 'bg-green-500 bg-opacity-10 text-green-500 border-green-500';
  if (score >= 0.5) return 'bg-amber-500 bg-opacity-10 text-amber-500 border-amber-500';
  return 'bg-red-500 bg-opacity-10 text-red-500 border-red-500';
}
```

### Platform Caption Norms Reference
```typescript
// Source: CONTEXT.md + platform_specs.ts knowledge
// Used in adaptForPlatform prompt template

const PLATFORM_CAPTION_NORMS = {
  instagram: {
    maxLength: 2200,  // chars
    optimalLength: 150,
    hashtagCount: '5-15',
    style: 'casual, story-driven, emoji-friendly',
  },
  facebook: {
    maxLength: 63206,
    optimalLength: 80,
    hashtagCount: '1-3',
    style: 'conversational, community-focused',
  },
  linkedin: {
    maxLength: 3000,
    optimalLength: 300,
    hashtagCount: '3-5',
    style: 'professional, insight-driven, no slang',
  },
  x: {
    maxLength: 280,
    optimalLength: 200,
    hashtagCount: '1-2',
    style: 'punchy, concise, trending hashtags',
  },
} as const;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential platform adaptation (one at a time) | Parallel via Promise.allSettled | Phase 5 design decision | 4x faster for 4-platform generation |
| Hard-coded confidence threshold | Per-company configurable in AIConfig | Phase 5 design | Operator can tune per client needs |
| Single monolithic post object | ContentPost + PostVariant split | Phase 5 design | Each platform variant independently reviewable and approvable |
| Variant generation blocked on upload | Async cron (MediaProcessingJob) | Phase 4 | Non-blocking; PostVariant.mediaVariantId nullable to handle race |

**Deprecated/outdated:**
- Using upstream Postiz `Post` model for content generation posts: The upstream `Post` model (schema.prisma:545) uses integrationId, group, cuid() — mismatched with extension zone design. Use new `ContentPost` model.
- CLS for companyId in services: Explicitly deprecated by STATE.md ("Company API scoping" decision). Services receive explicit companyId parameter.

---

## Open Questions

1. **MinIO public URL accessibility for vision model**
   - What we know: MINIO_PUBLIC_URL env var exists; media paths are stored as S3 keys
   - What's unclear: Is MINIO_PUBLIC_URL accessible from the AI provider (external network call) or only from Docker network? In production (VPS), it should be; in local dev, it may not be.
   - Recommendation: Document that MINIO_PUBLIC_URL must be externally accessible for vision to work. In dev, operator may need to use ngrok or provide a public test image URL. The ContentGenerationService should validate URL accessibility or provide a clear error message.

2. **requireAllReview field addition to AIConfig**
   - What we know: AIConfig model at schema.prisma:82-93 doesn't have this field yet
   - What's unclear: Whether `AIConfigService.findByCompany()` needs updating or if Prisma select will just omit the new field until migration runs
   - Recommendation: Add `requireAllReview Boolean @default(false)` to AIConfig in Phase 5 migration. AIConfigService returns the full model; update the `AIConfigData` interface to include the field.

3. **ContentPost.status vs PostVariant.status**
   - What we know: Both Post-level and Variant-level statuses are defined
   - What's unclear: When all PostVariants for a post are approved, does ContentPost.status auto-update to APPROVED?
   - Recommendation: ContentPost.status = APPROVED only when ALL variants are approved. Use a repository method that checks this after each variant approval action. Keep them in sync.

---

## Validation Architecture

> nyquist_validation is enabled in .planning/config.json.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29 with ts-jest |
| Config file | `extensions/content-generation/jest.config.ts` (Wave 0 gap) |
| Quick run command | `cd extensions/content-generation && pnpm test -- --testPathPattern=content-post.service` |
| Full suite command | `cd extensions/content-generation && pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R5.1 | generate() orchestrates vision + caption + adaptation + scoring | unit | `pnpm test -- content-post.service.spec.ts` | Wave 0 |
| R5.2 | executeImageAnalysis called with correct schema | unit (mock router) | `pnpm test -- content-post.service.spec.ts` | Wave 0 |
| R5.3 | BrandVoice injection verified via router brandId param | unit (mock router) | `pnpm test -- content-post.service.spec.ts` | Wave 0 |
| R5.4 | adaptForPlatform called once per platform | unit (mock router) | `pnpm test -- content-post.service.spec.ts` | Wave 0 |
| R5.5 | PostVariant created per platform with correct fields | unit | `pnpm test -- post-variant.repository.spec.ts` | Wave 0 |
| R5.6 | confidenceScore stored on each variant | unit | `pnpm test -- content-post.service.spec.ts` | Wave 0 |
| R5.7 | CONTENT_TYPE_PROMPT_MODIFIERS has all 7 types | unit | `pnpm test -- prompt-templates.spec.ts` | Wave 0 |
| R6.1 | score < threshold + !requireAllReview → PENDING_REVIEW | unit | `pnpm test -- confidence-gating.spec.ts` | Wave 0 |
| R6.2 | score >= threshold + !requireAllReview → APPROVED | unit | `pnpm test -- confidence-gating.spec.ts` | Wave 0 |
| R6.2 | requireAllReview=true → always PENDING_REVIEW | unit | `pnpm test -- confidence-gating.spec.ts` | Wave 0 |
| R6.3 | ReviewQueueService.findPending returns PENDING_REVIEW posts | unit | `pnpm test -- review-queue.service.spec.ts` | Wave 0 |
| R6.4 | approve action sets variant status APPROVED + updates post status | unit | `pnpm test -- review-queue.service.spec.ts` | Wave 0 |
| R6.4 | reject action sets variant status REJECTED | unit | `pnpm test -- review-queue.service.spec.ts` | Wave 0 |
| R6.4 | regenerate re-calls generation pipeline | unit (mock service) | `pnpm test -- review-queue.service.spec.ts` | Wave 0 |
| R6.5 | reviewedBy, reviewAction, reviewedAt set on variant after action | unit | `pnpm test -- review-queue.service.spec.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd extensions/content-generation && pnpm test -- --testPathPattern=<task-specific-file>`
- **Per wave merge:** `cd extensions/content-generation && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `extensions/content-generation/jest.config.ts` — Jest config matching ai-service pattern
- [ ] `extensions/content-generation/tsconfig.json` — TypeScript config
- [ ] `extensions/content-generation/tsconfig.spec.json` — Test TypeScript config
- [ ] `extensions/content-generation/package.json` — @social/content-generation package
- [ ] `extensions/content-generation/src/__tests__/content-post.service.spec.ts` — core pipeline tests
- [ ] `extensions/content-generation/src/__tests__/post-variant.repository.spec.ts` — variant DB tests
- [ ] `extensions/content-generation/src/__tests__/confidence-gating.spec.ts` — gating logic tests
- [ ] `extensions/content-generation/src/__tests__/review-queue.service.spec.ts` — review action tests
- [ ] `extensions/content-generation/src/__tests__/prompt-templates.spec.ts` — content type coverage

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `extensions/ai-service/src/router/ai-provider.router.ts` — AIProviderRouter API, execute/executeImageAnalysis signatures
- `extensions/ai-service/src/interface/ai-service.interface.ts` — IAIProvider, AICallContext, AITaskType interfaces
- `extensions/ai-service/src/brand-voice/brand-voice-prompt.builder.ts` — BrandVoicePromptBuilder.buildSystemPrompt pattern
- `extensions/ai-service/src/ai-service.module.ts` — useFactory DI wiring pattern
- `extensions/media-library/src/media/company-media.repository.ts` — Repository pattern, companyId scoping
- `extensions/media-library/src/processing/media-processing.service.ts` — Async variant generation
- `extensions/media-library/src/processing/platform-specs.ts` — Platform dimensions and specs
- `extensions/media-library/src/media-library.module.ts` — Module registration pattern
- `libraries/nestjs-libraries/src/database/prisma/schema.prisma` — Existing models, extension block convention
- `apps/frontend/src/components/media/hooks/use-company-media.ts` — SWR hook pattern
- `apps/frontend/src/components/credential-health/useBrandConnections.ts` — SWR hook with mutate pattern
- `apps/frontend/src/components/media/company-media-library.tsx` — Page component composition pattern
- `apps/frontend/src/components/credential-health/BrandConnectPanel.tsx` — Color-coded status display pattern
- `apps/backend/src/app.module.ts` — AppModule extension registration pattern
- `.planning/phases/05-content-generation-pipeline/05-CONTEXT.md` — Locked decisions
- `.planning/STATE.md` — All key decisions from previous phases

### Secondary (MEDIUM confidence)
- Platform caption norms (Instagram 2200 chars, LinkedIn 3000, X 280, Facebook 63206) — industry standard knowledge, no official source checked; functional guidance for prompt templates

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in package.json files
- Architecture patterns: HIGH — derived directly from Phase 3/4 code with identical patterns
- Pitfalls: HIGH — derived from actual existing code constraints (async variant gap, Promise.all rejection, schema gaps)
- Prompt templates: MEDIUM — platform norms are well-known but prompt effectiveness is empirical

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable patterns; only prompt quality would change faster)
