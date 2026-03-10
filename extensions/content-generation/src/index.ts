// @social/content-generation barrel exports
// Phase 5 Plan 01: Type contracts, Zod schemas, prompt templates
// Phase 5 Plan 02: Content generation service and pipeline
// Phase 5 Plan 03: Review queue and approval workflow

// Type contracts: ContentType, ContentPostStatus, PostVariantStatus, ReviewAction
// DTOs: CreatePostDto, ReviewActionDto
// Zod schemas: ImageAnalysisSchema, PlatformCaptionSchema, ConfidenceScoreSchema
export * from './types/content.types';

// Prompt templates: CONTENT_TYPE_PROMPT_MODIFIERS, IMAGE_ANALYSIS_PROMPT
// Builders: buildCaptionSystemPrompt, buildScoreContentPrompt
export * from './prompts/prompt-templates';

// Platform norms: PLATFORM_CAPTION_NORMS
// Types: PlatformNorms
// Builders: buildPlatformAdaptationPrompt
export * from './prompts/platform-norms';

// Phase 5 Plan 02: Content generation pipeline
// Service: ContentPostService (generate, regenerateForPost)
export { ContentPostService } from './posts/content-post.service';

// Repository: ContentPostRepository (createPost, createVariants, findByCompany, findById, deleteVariantsByPostId)
export { ContentPostRepository } from './posts/content-post.repository';

// Confidence gating: applyConfidenceGating, determinePostStatus
export { applyConfidenceGating, determinePostStatus } from './posts/confidence-gating';
