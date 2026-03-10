import { Injectable } from '@nestjs/common';

/**
 * Lightweight interface matching the BrandVoice Prisma model fields
 * used by the prompt builder. Using a local interface avoids importing
 * Prisma types into the extension package.
 */
export interface BrandVoiceInput {
  tone: string[];
  targetAudience: string | null;
  preferredHashtags: string[];
  blacklistedWords: string[];
  samplePosts: string[];
  language: string;
  notes: string | null;
}

/**
 * Injectable service that builds a system prompt by layering brand voice
 * guidelines on top of a base instruction string.
 *
 * Pattern: Start with the base instruction, then append brand voice
 * sections only when they have meaningful values (empty arrays and null
 * fields are omitted). Join all parts with double newlines.
 */
@Injectable()
export class BrandVoicePromptBuilder {
  /**
   * Builds a system prompt combining a base instruction with brand voice
   * guidelines derived from the provided BrandVoice data.
   *
   * @param brandVoice - Brand voice configuration, or null to return base instruction unchanged
   * @param baseInstruction - The core task instruction for the AI model
   * @returns A complete system prompt string
   */
  buildSystemPrompt(
    brandVoice: BrandVoiceInput | null,
    baseInstruction: string
  ): string {
    if (!brandVoice) {
      return baseInstruction;
    }

    const parts: string[] = [baseInstruction];

    // Tone
    if (brandVoice.tone.length > 0) {
      parts.push(`Brand voice tone: ${brandVoice.tone.join(', ')}`);
    }

    // Target audience
    if (brandVoice.targetAudience) {
      parts.push(`Target audience: ${brandVoice.targetAudience}`);
    }

    // Blacklisted words
    if (brandVoice.blacklistedWords.length > 0) {
      parts.push(`NEVER use these words: ${brandVoice.blacklistedWords.join(', ')}`);
    }

    // Preferred hashtags
    if (brandVoice.preferredHashtags.length > 0) {
      parts.push(
        `Preferred hashtags (use when relevant): ${brandVoice.preferredHashtags.join(', ')}`
      );
    }

    // Language directive (English is the default — omit it)
    if (brandVoice.language !== 'en') {
      parts.push(`Respond in language: ${brandVoice.language}`);
    }

    // Sample posts (limit to first 3)
    if (brandVoice.samplePosts.length > 0) {
      const samples = brandVoice.samplePosts.slice(0, 3);
      parts.push(`Sample posts in our style:\n${samples.join('\n---\n')}`);
    }

    // Additional notes
    if (brandVoice.notes) {
      parts.push(`Additional brand guidelines: ${brandVoice.notes}`);
    }

    return parts.join('\n\n');
  }
}
