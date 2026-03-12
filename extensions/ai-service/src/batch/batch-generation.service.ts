import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AIProviderRouter } from '../router/ai-provider.router';

/**
 * BatchGenerationService — Generates posts for multiple brand x platform combinations.
 */
@Injectable()
export class BatchGenerationService {
  constructor(
    private readonly aiRouter: AIProviderRouter,
    private readonly prisma: any,
  ) {}

  /**
   * Generate posts for multiple brands across multiple platforms.
   */
  async batchGenerate(params: BatchGenerateParams): Promise<BatchGenerateResult[]> {
    const results: BatchGenerateResult[] = [];

    for (const brandId of params.brandIds) {
      for (const platform of params.platforms) {
        try {
          const result = await this.generateForBrandPlatform(
            params.companyId,
            brandId,
            platform,
            params.topic,
            params.contentType,
            params.count || 1,
          );
          results.push(...result);
        } catch (err) {
          results.push({
            brandId,
            platform,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    }

    return results;
  }

  private async generateForBrandPlatform(
    companyId: string,
    brandId: string,
    platform: string,
    topic?: string,
    contentType?: string,
    count: number = 1,
  ): Promise<BatchGenerateResult[]> {
    const platformLimits: Record<string, number> = {
      x: 280,
      twitter: 280,
      instagram: 2200,
      facebook: 63206,
      linkedin: 3000,
      tiktok: 2200,
      youtube: 5000,
    };

    const charLimit = platformLimits[platform.toLowerCase()] || 2000;
    const topicInstruction = topic
      ? `The topic is: ${topic}.`
      : 'Choose an engaging topic relevant to the brand.';
    const typeInstruction = contentType ? `Content type: ${contentType}.` : '';

    const schema = z.object({
      posts: z.array(
        z.object({
          content: z.string(),
          hashtags: z.array(z.string()).optional(),
          suggestedMediaType: z.enum(['image', 'video', 'carousel', 'none']).optional(),
        }),
      ),
    });

    const result = await this.aiRouter.execute(
      {
        companyId,
        brandId,
        taskType: 'generateCaption',
      },
      [
        {
          role: 'system',
          content: `You are a social media content creator. Generate ${count} unique post(s) for ${platform}. Each post must be under ${charLimit} characters. ${topicInstruction} ${typeInstruction} Make each post engaging and platform-appropriate.`,
        },
        {
          role: 'user',
          content: `Generate ${count} social media post(s) for ${platform}.`,
        },
      ],
      schema,
    );

    return result.output.posts.map((post) => ({
      brandId,
      platform,
      success: true,
      content: post.content,
      hashtags: post.hashtags,
      suggestedMediaType: post.suggestedMediaType,
    }));
  }
}

export interface BatchGenerateParams {
  companyId: string;
  brandIds: string[];
  platforms: string[];
  topic?: string;
  contentType?: string;
  count?: number;
}

export interface BatchGenerateResult {
  brandId: string;
  platform: string;
  success: boolean;
  content?: string;
  hashtags?: string[];
  suggestedMediaType?: string;
  error?: string;
}
