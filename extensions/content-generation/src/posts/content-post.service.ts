import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ContentPostRepository } from './content-post.repository';
import { applyConfidenceGating, determinePostStatus } from './confidence-gating';
import {
  ImageAnalysisSchema,
  PlatformCaptionSchema,
  ConfidenceScoreSchema,
} from '../types/content.types';
import { buildCaptionSystemPrompt, buildScoreContentPrompt, IMAGE_ANALYSIS_PROMPT } from '../prompts/prompt-templates';
import { buildPlatformAdaptationPrompt } from '../prompts/platform-norms';
import type { CreatePostDto } from '../types/content.types';

/**
 * ContentPostService
 *
 * Orchestrates the full AI generation pipeline:
 *   1. Create ContentPost record (DRAFT)
 *   2. Trigger media variant generation (fire-and-forget, if mediaId provided)
 *   3. Image analysis (if mediaId provided)
 *   4. Base caption generation (with brand voice injection via AIProviderRouter)
 *   5. Load AIConfig for gating parameters
 *   6. Per-platform adaptation + scoring (parallel via Promise.allSettled)
 *   7. Collect fulfilled results
 *   8. Create PostVariant records
 *   9. Update ContentPost status based on variant statuses
 *
 * Every AI call flows through AIProviderRouter, which handles:
 *   - Budget enforcement (BudgetExceededError propagated up)
 *   - Brand voice injection via BrandVoice DB lookup
 *   - Provider selection and model selection
 *   - Cost logging
 */
@Injectable()
export class ContentPostService {
  constructor(
    private readonly repository: ContentPostRepository,
    private readonly aiRouter: any, // AIProviderRouter
    private readonly aiConfigService: any, // AIConfigService
    private readonly mediaProcessingService: any, // MediaProcessingService
    private readonly prisma: any, // PrismaService for media lookup
  ) {}

  /**
   * Resolves a media file path to a publicly accessible URL.
   *
   * Pattern established in Phase 4 (MediaGrid component).
   *
   * @param path - S3 key or full HTTP URL
   * @returns Publicly accessible URL
   */
  private resolveMediaUrl(path: string): string {
    if (path.startsWith('http')) {
      return path;
    }
    const minioPublicUrl = process.env.MINIO_PUBLIC_URL || '';
    const minioBucket = process.env.MINIO_BUCKET || '';
    return `${minioPublicUrl}/${minioBucket}/${path}`;
  }

  /**
   * Generate a ContentPost with AI-generated variants for all target platforms.
   *
   * @param companyId - Company scope for data isolation and AI config lookup
   * @param dto - CreatePostDto with brandId, mediaId?, brief?, contentType, platforms
   * @returns Created ContentPost and PostVariant records
   * @throws BudgetExceededError if weekly budget is exceeded (propagated from AIProviderRouter)
   */
  async generate(
    companyId: string,
    dto: CreatePostDto,
  ): Promise<{ post: any; variants: any[] }> {
    // Step 1: Create ContentPost record with status='DRAFT'
    const postId = uuidv4();
    const post = await this.repository.createPost({
      id: postId,
      companyId,
      brandId: dto.brandId,
      mediaId: dto.mediaId,
      brief: dto.brief,
      contentType: dto.contentType,
      status: 'DRAFT',
    });

    // Step 2: Trigger media variant generation (fire-and-forget if mediaId provided)
    // Runs async in background — generates platform-specific resized images.
    // Does NOT await: caption generation starts immediately without waiting.
    // mediaVariantId links to PostVariant are set by Phase 6 when variants complete.
    if (dto.mediaId) {
      this.mediaProcessingService.generateVariants(dto.mediaId, dto.platforms).catch((err: Error) => {
        console.warn(`[ContentPostService] Media variant generation failed for ${dto.mediaId}: ${err?.message}`);
      });
    }

    // Step 3: Image analysis (if mediaId provided)
    let imageAnalysis: any = null;
    if (dto.mediaId) {
      const media = await (this.prisma as any).companyMedia.findUnique({
        where: { id: dto.mediaId },
      });

      if (media?.path) {
        const resolvedUrl = this.resolveMediaUrl(media.path);
        try {
          const imageAnalysisResult = await this.aiRouter.executeImageAnalysis(
            {
              companyId,
              brandId: dto.brandId,
              postId: post.id,
              taskType: 'analyzeImage',
            },
            resolvedUrl,
            IMAGE_ANALYSIS_PROMPT,
            ImageAnalysisSchema,
          );
          imageAnalysis = imageAnalysisResult.output;
        } catch (err: any) {
          // Image analysis failure is non-fatal — continue without visual context
          console.warn(`[ContentPostService] Image analysis failed for post ${post.id}: ${err?.message}`);
        }
      }
    }

    // Step 4: Generate base caption
    // CRITICAL: user brief goes in the USER message (NF1.3 prompt injection prevention)
    // System prompt contains ONLY: content type modifier + image analysis context
    const systemPrompt = buildCaptionSystemPrompt(dto.contentType, imageAnalysis ?? undefined);
    const userMessage = dto.brief || 'Generate a social media caption for this content.';

    const baseCaptionResult = await this.aiRouter.execute(
      {
        companyId,
        brandId: dto.brandId,
        postId: post.id,
        taskType: 'generateCaption',
      },
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      PlatformCaptionSchema,
    );

    // Step 5: Load AIConfig for gating (threshold + requireAllReview)
    const aiConfig = await this.aiConfigService.findByCompany(companyId);
    const threshold = (aiConfig as any).confidenceThreshold ?? 0.7;
    const requireAllReview = (aiConfig as any).requireAllReview ?? false;

    // Step 6: Per-platform adaptation + scoring (parallel via Promise.allSettled)
    // Promise.allSettled ensures partial failures don't block successful platforms.
    const platformResults = await Promise.allSettled(
      dto.platforms.map(async (platform) => {
        // Adapt caption for platform norms
        const adapted = await this.aiRouter.execute(
          {
            companyId,
            brandId: dto.brandId,
            postId: post.id,
            taskType: 'adaptForPlatform',
          },
          [
            {
              role: 'system',
              content: buildPlatformAdaptationPrompt(
                platform,
                baseCaptionResult.output.caption,
                baseCaptionResult.output.hashtags,
              ),
            },
            { role: 'user', content: 'Adapt the caption for this platform.' },
          ],
          PlatformCaptionSchema,
        );

        // Score the adapted caption for this platform
        const scored = await this.aiRouter.execute(
          {
            companyId,
            brandId: dto.brandId,
            postId: post.id,
            taskType: 'scoreContent',
          },
          [
            {
              role: 'system',
              content: buildScoreContentPrompt(adapted.output.caption, platform),
            },
            { role: 'user', content: 'Score this caption.' },
          ],
          ConfidenceScoreSchema,
        );

        // Apply confidence gating to determine variant status
        const variantStatus = applyConfidenceGating(
          scored.output.score,
          threshold,
          requireAllReview,
        );

        return {
          platform,
          caption: adapted.output.caption,
          hashtags: adapted.output.hashtags,
          confidenceScore: scored.output.score,
          status: variantStatus,
          generatedBy: adapted.model,
        };
      }),
    );

    // Step 7: Collect fulfilled results, log rejected platforms
    const fulfilledVariants = platformResults
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    const rejectedPlatforms = platformResults.filter((r) => r.status === 'rejected');
    if (rejectedPlatforms.length > 0) {
      console.warn(
        `[ContentPostService] ${rejectedPlatforms.length} platform(s) failed generation for post ${post.id}`,
      );
    }

    // If ALL platforms failed, the caption generation itself likely failed (BudgetExceededError)
    // The error will have propagated from Step 4. If we reach here, at least some platforms failed.
    // Re-throw budget errors to surface them to the caller.
    if (fulfilledVariants.length === 0 && rejectedPlatforms.length > 0) {
      const firstRejected = rejectedPlatforms[0] as PromiseRejectedResult;
      throw firstRejected.reason;
    }

    // Step 8: Create PostVariant records
    const variants = await this.repository.createVariants(post.id, fulfilledVariants);

    // Step 9: Update ContentPost status based on variant statuses
    const postStatus = determinePostStatus(fulfilledVariants.map((v) => v.status));
    await this.repository.updatePostStatus(post.id, postStatus);

    return { post: { ...post, status: postStatus }, variants };
  }

  /**
   * Regenerate variants for an existing ContentPost.
   *
   * Reuses the existing ContentPost record — does NOT create a new one.
   * Deletes all existing variants first, then runs Steps 2-9 of the generation pipeline.
   *
   * Used by the review queue when a user requests "regenerate" action.
   *
   * @param existingPost - The ContentPost to regenerate variants for
   * @param dto - CreatePostDto with updated platforms/brief/etc.
   * @returns Updated ContentPost and newly generated PostVariant records
   */
  async regenerateForPost(
    existingPost: any,
    dto: CreatePostDto,
  ): Promise<{ post: any; variants: any[] }> {
    // Clear existing variants — regeneration starts fresh
    await this.repository.deleteVariantsByPostId(existingPost.id);

    // Run Steps 2-9 of the pipeline using existing post identity
    // We temporarily create a proxy object so the pipeline uses existingPost.id as postId
    const pipelinePost = existingPost;

    // Step 2: Trigger media variant generation (fire-and-forget if mediaId provided)
    if (dto.mediaId) {
      this.mediaProcessingService.generateVariants(dto.mediaId, dto.platforms).catch((err: Error) => {
        console.warn(`[ContentPostService] Media variant regeneration failed for ${dto.mediaId}: ${err?.message}`);
      });
    }

    // Step 3: Image analysis (if mediaId provided)
    let imageAnalysis: any = null;
    if (dto.mediaId) {
      const media = await (this.prisma as any).companyMedia.findUnique({
        where: { id: dto.mediaId },
      });

      if (media?.path) {
        const resolvedUrl = this.resolveMediaUrl(media.path);
        try {
          const imageAnalysisResult = await this.aiRouter.executeImageAnalysis(
            {
              companyId: existingPost.companyId,
              brandId: dto.brandId,
              postId: pipelinePost.id,
              taskType: 'analyzeImage',
            },
            resolvedUrl,
            IMAGE_ANALYSIS_PROMPT,
            ImageAnalysisSchema,
          );
          imageAnalysis = imageAnalysisResult.output;
        } catch (err: any) {
          console.warn(`[ContentPostService] Image analysis failed during regeneration: ${err?.message}`);
        }
      }
    }

    // Step 4: Generate base caption
    const systemPrompt = buildCaptionSystemPrompt(dto.contentType, imageAnalysis ?? undefined);
    const userMessage = dto.brief || 'Generate a social media caption for this content.';

    const baseCaptionResult = await this.aiRouter.execute(
      {
        companyId: existingPost.companyId,
        brandId: dto.brandId,
        postId: pipelinePost.id,
        taskType: 'generateCaption',
      },
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      PlatformCaptionSchema,
    );

    // Step 5: Load AIConfig for gating
    const aiConfig = await this.aiConfigService.findByCompany(existingPost.companyId);
    const threshold = (aiConfig as any).confidenceThreshold ?? 0.7;
    const requireAllReview = (aiConfig as any).requireAllReview ?? false;

    // Step 6: Per-platform adaptation + scoring (parallel)
    const platformResults = await Promise.allSettled(
      dto.platforms.map(async (platform) => {
        const adapted = await this.aiRouter.execute(
          {
            companyId: existingPost.companyId,
            brandId: dto.brandId,
            postId: pipelinePost.id,
            taskType: 'adaptForPlatform',
          },
          [
            {
              role: 'system',
              content: buildPlatformAdaptationPrompt(
                platform,
                baseCaptionResult.output.caption,
                baseCaptionResult.output.hashtags,
              ),
            },
            { role: 'user', content: 'Adapt the caption for this platform.' },
          ],
          PlatformCaptionSchema,
        );

        const scored = await this.aiRouter.execute(
          {
            companyId: existingPost.companyId,
            brandId: dto.brandId,
            postId: pipelinePost.id,
            taskType: 'scoreContent',
          },
          [
            {
              role: 'system',
              content: buildScoreContentPrompt(adapted.output.caption, platform),
            },
            { role: 'user', content: 'Score this caption.' },
          ],
          ConfidenceScoreSchema,
        );

        const variantStatus = applyConfidenceGating(scored.output.score, threshold, requireAllReview);

        return {
          platform,
          caption: adapted.output.caption,
          hashtags: adapted.output.hashtags,
          confidenceScore: scored.output.score,
          status: variantStatus,
          generatedBy: adapted.model,
        };
      }),
    );

    // Step 7: Collect fulfilled results
    const fulfilledVariants = platformResults
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    if (fulfilledVariants.length === 0 && platformResults.length > 0) {
      const firstRejected = platformResults.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      throw firstRejected.reason;
    }

    // Step 8: Create PostVariant records
    const variants = await this.repository.createVariants(pipelinePost.id, fulfilledVariants);

    // Step 9: Update ContentPost status
    const postStatus = determinePostStatus(fulfilledVariants.map((v) => v.status));
    await this.repository.updatePostStatus(pipelinePost.id, postStatus);

    return { post: { ...pipelinePost, status: postStatus }, variants };
  }
}
