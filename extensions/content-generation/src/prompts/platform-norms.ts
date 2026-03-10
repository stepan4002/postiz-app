// ============================================================================
// Platform caption norms for Instagram, Facebook, LinkedIn, X
// Values based on platform research (RESEARCH.md)
// ============================================================================

export interface PlatformNorms {
  /** Hard character limit enforced by the platform */
  maxLength: number;
  /** Recommended length for best engagement */
  optimalLength: number;
  /** Recommended hashtag count range */
  hashtagCount: string;
  /** Writing style guidance */
  style: string;
}

export const PLATFORM_CAPTION_NORMS: Record<string, PlatformNorms> = {
  instagram: {
    maxLength: 2200,
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
};

/**
 * Builds a system prompt instructing the AI to adapt a base caption for a specific platform.
 * Includes platform norms (max length, optimal length, hashtag count, style).
 *
 * @param platform - Target platform (instagram, facebook, linkedin, x)
 * @param baseCaption - The original caption to adapt
 * @param baseHashtags - Starting hashtags to incorporate or replace
 * @returns System prompt string for platform adaptation
 */
export function buildPlatformAdaptationPrompt(
  platform: string,
  baseCaption: string,
  baseHashtags: string[],
): string {
  const norms = PLATFORM_CAPTION_NORMS[platform];

  if (!norms) {
    throw new Error(`Unknown platform: ${platform}. Supported: ${Object.keys(PLATFORM_CAPTION_NORMS).join(', ')}`);
  }

  const hashtagsText = baseHashtags.length > 0 ? baseHashtags.join(' ') : 'none provided';

  return `You are a social media expert adapting content for ${platform.toUpperCase()}.

Platform guidelines for ${platform}:
- Maximum character limit: ${norms.maxLength} characters
- Optimal caption length: ${norms.optimalLength} characters
- Recommended hashtag count: ${norms.hashtagCount} hashtags
- Writing style: ${norms.style}

Base caption to adapt:
"${baseCaption}"

Base hashtags: ${hashtagsText}

Adapt the caption to fit ${platform}'s style and constraints. Ensure the caption stays within the ${norms.maxLength} character limit and ideally around ${norms.optimalLength} characters. Choose ${norms.hashtagCount} relevant hashtags. Write in a ${norms.style} style.

Return a JSON object with "caption" (string) and "hashtags" (array of strings, each starting with #).`;
}
