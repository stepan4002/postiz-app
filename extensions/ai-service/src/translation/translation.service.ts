import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AIProviderRouter } from '../router/ai-provider.router';

/**
 * TranslationService — Translates post content using AI while maintaining tone.
 */
@Injectable()
export class TranslationService {
  constructor(
    private readonly aiRouter: AIProviderRouter,
    private readonly prisma: any,
  ) {}

  /**
   * Translate content to a target language, maintaining tone and cultural context.
   */
  async translate(params: TranslateParams): Promise<TranslateResult> {
    const schema = z.object({
      translatedContent: z.string(),
      translatedHashtags: z.array(z.string()).optional(),
      detectedSourceLanguage: z.string().optional(),
    });

    const result = await this.aiRouter.execute(
      {
        companyId: params.companyId,
        brandId: params.brandId,
        taskType: 'generateCaption',
      },
      [
        {
          role: 'system',
          content: `You are a professional translator specializing in social media content. Translate the following content to ${params.targetLanguage}. Maintain the tone, style, and intent. Adapt cultural references if needed. If hashtags are provided, translate or localize them appropriately.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            content: params.content,
            hashtags: params.hashtags,
            targetLanguage: params.targetLanguage,
            platform: params.platform,
          }),
        },
      ],
      schema,
    );

    return {
      translatedContent: result.output.translatedContent,
      translatedHashtags: result.output.translatedHashtags,
      detectedSourceLanguage: result.output.detectedSourceLanguage,
      targetLanguage: params.targetLanguage,
    };
  }

  /**
   * Detect the language of a given text.
   */
  async detectLanguage(companyId: string, text: string): Promise<string> {
    const schema = z.object({
      language: z.string(),
      confidence: z.number(),
    });

    const result = await this.aiRouter.execute(
      { companyId, taskType: 'generateCaption' },
      [
        {
          role: 'system',
          content:
            'Detect the language of the following text. Return the ISO 639-1 language code and confidence score.',
        },
        { role: 'user', content: text },
      ],
      schema,
    );

    return result.output.language;
  }
}

export interface TranslateParams {
  companyId: string;
  brandId?: string;
  content: string;
  targetLanguage: string;
  hashtags?: string[];
  platform?: string;
}

export interface TranslateResult {
  translatedContent: string;
  translatedHashtags?: string[];
  detectedSourceLanguage?: string;
  targetLanguage: string;
}
