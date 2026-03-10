# Phase 5: Content Generation Pipeline - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Operator uploads media + optional text brief → AI generates platform-adapted captions with brand voice → confidence-gated review queue. Covers R5.1-R5.7 (content generation) and R6.1-R6.5 (review queue & confidence gating). This is the first phase that connects AI service (Phase 3) + media library (Phase 4) into a user-facing content creation workflow.

</domain>

<decisions>
## Implementation Decisions

### Input Workflow
- Upload media from existing media library (Phase 4) OR upload new media inline — both paths supported
- Text brief is optional free-form text — AI uses it as additional context alongside image analysis
- Target platform selection: multi-select from connected platforms (Instagram, Facebook, LinkedIn, X)
- Content type selection: dropdown with options (product, brand story, educational, seasonal, offer, testimonial, behind-the-scenes) — influences prompt template
- Brand selection: operator picks which brand this content is for — determines BrandVoice injection
- Single generation flow produces PostVariants for all selected platforms at once

### AI Vision & Caption Generation
- AI vision (R5.2): use Phase 3 AIService.analyzeImage to understand uploaded media content
- Vision output feeds into caption generation as structured context (image description, detected objects, mood)
- Caption generation uses BrandVoice injection (already built in Phase 3 via BrandVoicePromptBuilder)
- Each platform gets an adapted caption via AIService.adaptForPlatform — different length, style, hashtag density
- Generation is async — operator sees a loading state, then results appear
- All generation calls go through Phase 3's AIProviderRouter (respects per-company provider config and budget)

### PostVariant Model
- New PostVariant entity: postId, platform, caption, hashtags, mediaVariantId, confidenceScore, status
- One PostVariant per target platform per generation
- PostVariant links to MediaVariant (platform-specific resized image from Phase 4)
- Post entity: companyId, brandId, mediaId, brief, contentType, status (DRAFT/PENDING_REVIEW/APPROVED/SCHEDULED)
- Media variant generation (Phase 4) triggered automatically when platforms are selected

### Confidence Scoring & Gating
- AIService.scoreContent (Phase 3) evaluates each generated caption — returns 0-1 float
- Per-company configurable threshold (stored in AIConfig, default 0.7)
- Below threshold → status = PENDING_REVIEW, routed to Review Queue
- Above threshold → status = APPROVED (or PENDING_REVIEW if company config requires all review)
- Per-company "require_all_review" boolean flag in AIConfig — overrides confidence gating

### Review Queue UI
- List view of pending posts: media thumbnail, AI-generated caption per platform, confidence score badge
- Color-coded confidence: red (<0.5), yellow (0.5-0.7), green (>0.7)
- Operator actions per post: Approve, Edit & Approve (inline edit), Reject, Regenerate
- Regenerate re-runs AI generation with same inputs — produces new captions
- Edit & Approve opens inline caption editor per platform variant
- Audit trail stored: generated_by (model), confidence_score, reviewed_by, review_action, review_timestamp

### Audit Trail
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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AIProviderRouter` (extensions/ai-service): routes AI calls to correct provider per company config
- `BrandVoicePromptBuilder` (extensions/ai-service): injects brand voice into generation prompts
- `AICostLogger` (extensions/ai-service): logs all AI call costs automatically
- `BudgetCircuitBreaker` (extensions/ai-service): enforces per-company weekly budget
- `CompanyMediaLibrary` (extensions/media-library): media grid, upload, company-scoped media
- `MediaProcessingService` (extensions/media-library): generates platform-specific variants
- `PlatformMediaValidator` (extensions/media-library): validates media against platform specs
- `CompanyMediaRepository` (extensions/media-library): company-scoped media queries
- `useCompanyMedia` hook (apps/frontend): SWR-based media fetching
- `useMediaUpload` hook (apps/frontend): upload with progress tracking
- Existing Postiz post creation flow: PostService, PostController — can study patterns but build new in extension zone

### Established Patterns
- Controller -> Service -> Repository layering (no shortcuts)
- Extension zone: all custom code in extensions/, @social/* path aliases
- SWR hooks: each in separate file per CLAUDE.md rules
- useFetch for API calls (libraries/helpers/src/utils/custom.fetch.tsx)
- Company scoping: explicit companyId parameter (not CLS)
- Controller resolves slug -> id before calling services
- NestJS module registration in AppModule
- Interface injection for cross-package deps

### Integration Points
- Phase 3 AI service: AIProviderRouter is the main entry point for all generation calls
- Phase 4 media library: MediaProcessingService.generateVariants for platform-specific media
- Phase 4 media library: CompanyMediaRepository for selecting existing media
- Existing Postiz post model: may need to extend or create parallel Post entity in extension zone
- Future Phase 6 (Scheduling & Publishing): will consume approved PostVariants

</code_context>

<specifics>
## Specific Ideas

No specific requirements from user — auto-mode. Key constraints:

- This is the core value proposition: "upload media + brief → AI generates everything"
- Solo operator: no approval workflows between users, just confidence gating
- Must feel fast: generation should complete within seconds, not minutes
- Content types influence prompt engineering, not UI structure
- Platform adaptation is about caption style, not just truncation — each platform has norms
- Review queue is the operator's daily workspace — needs to be efficient

</specifics>

<deferred>
## Deferred Ideas

- Content repurposing (blog to posts, review to testimonial) — future phase
- Evergreen post recycling — Phase 6 or later
- Batch generation (generate for multiple brands at once) — future enhancement
- A/B testing of caption variants — Milestone 2
- Content calendar integration (drag posts to schedule) — Phase 6 scope
- Multi-language generation from single brief — future enhancement (BrandVoice has language field ready)

</deferred>

---

*Phase: 05-content-generation-pipeline*
*Context gathered: 2026-03-10*
