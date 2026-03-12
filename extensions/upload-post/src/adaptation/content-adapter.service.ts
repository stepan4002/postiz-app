import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

export interface AdaptContentRequest {
  content: string;
  sourceLang: string;
  targetLang: string;
  targetLangCode: string;
  platforms: string[];
  brandTone?: string[];
  brandDescription?: string;
}

export interface AdaptedContent {
  content: string;
  targetLang: string;
  targetLangCode: string;
  platforms: string[];
}

@Injectable()
export class ContentAdapterService {
  private readonly logger = new Logger(ContentAdapterService.name);
  private openai: OpenAI | null = null;

  private getOpenai(): OpenAI | null {
    if (!process.env.OPENAI_API_KEY) {
      return null;
    }
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.openai;
  }

  /**
   * Adapt content for a target language and platform set.
   * If source and target languages are the same, returns content as-is.
   */
  async adaptContent(request: AdaptContentRequest): Promise<AdaptedContent> {
    const {
      content,
      sourceLang,
      targetLang,
      targetLangCode,
      platforms,
      brandTone,
      brandDescription,
    } = request;

    // No translation needed if same language
    if (sourceLang.toLowerCase() === targetLang.toLowerCase()) {
      return { content, targetLang, targetLangCode, platforms };
    }

    const openai = this.getOpenai();
    if (!openai) {
      this.logger.warn(
        'OpenAI API key not configured — returning original content without translation',
      );
      return { content, targetLang, targetLangCode, platforms };
    }

    try {
      const translated = await this.translateContent(
        openai,
        content,
        sourceLang,
        targetLang,
        platforms,
        brandTone,
        brandDescription,
      );

      return {
        content: translated,
        targetLang,
        targetLangCode,
        platforms,
      };
    } catch (err: any) {
      this.logger.error(
        `Translation failed from ${sourceLang} to ${targetLang}: ${err.message}`,
      );
      // Fall back to original content
      return { content, targetLang, targetLangCode, platforms };
    }
  }

  /**
   * Adapt content for multiple target profiles at once.
   */
  async adaptContentBatch(
    content: string,
    sourceLang: string,
    targets: Array<{
      targetLang: string;
      targetLangCode: string;
      platforms: string[];
      brandTone?: string[];
      brandDescription?: string;
    }>,
  ): Promise<AdaptedContent[]> {
    const results = await Promise.allSettled(
      targets.map((target) =>
        this.adaptContent({
          content,
          sourceLang,
          ...target,
        }),
      ),
    );

    return results.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      // On failure, return original content
      this.logger.warn(
        `Batch translation failed for target ${targets[i].targetLangCode}: ${result.reason}`,
      );
      return {
        content,
        targetLang: targets[i].targetLang,
        targetLangCode: targets[i].targetLangCode,
        platforms: targets[i].platforms,
      };
    });
  }

  private async translateContent(
    openai: OpenAI,
    content: string,
    sourceLang: string,
    targetLang: string,
    platforms: string[],
    brandTone?: string[],
    brandDescription?: string,
  ): Promise<string> {
    const systemPrompt = this.buildTranslationPrompt(
      sourceLang,
      targetLang,
      platforms,
      brandTone,
      brandDescription,
    );

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    });

    const translated = response.choices[0]?.message?.content?.trim();
    if (!translated) {
      throw new Error('Empty translation response');
    }

    return translated;
  }

  private buildTranslationPrompt(
    sourceLang: string,
    targetLang: string,
    platforms: string[],
    brandTone?: string[],
    brandDescription?: string,
  ): string {
    const parts = [
      `You are a professional social media translator. Translate the following social media post from ${sourceLang} to ${targetLang}.`,
      '',
      'Rules:',
      '- Maintain the original tone, emotion, and intent of the post.',
      '- Adapt hashtags to be relevant in the target language and culture.',
      '- Keep @mentions unchanged.',
      '- Adapt emojis and cultural references as appropriate.',
      '- Keep URLs unchanged.',
      `- The post will be published on: ${platforms.join(', ')}.`,
      '- Output ONLY the translated text, nothing else.',
    ];

    if (brandTone && brandTone.length > 0) {
      parts.push(`- Brand voice/tone: ${brandTone.join(', ')}.`);
    }

    if (brandDescription) {
      parts.push(`- Brand context: ${brandDescription}.`);
    }

    return parts.join('\n');
  }
}
