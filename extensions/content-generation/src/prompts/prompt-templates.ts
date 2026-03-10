import { ContentType } from '../types/content.types';

// ============================================================================
// Content type prompt modifiers — injected into system prompt per content type
// ============================================================================

/**
 * Prompt modifier text for each content type.
 * Injected into the system prompt to guide AI caption generation style.
 */
export const CONTENT_TYPE_PROMPT_MODIFIERS: Record<ContentType, string> = {
  product:
    'Focus on product features, benefits, and value proposition. Highlight what makes this product unique.',
  brand_story:
    "Tell the brand's story in an engaging, authentic way. Focus on mission, values, and human connection.",
  educational:
    'Share valuable knowledge or tips. Position the brand as a thought leader. Use clear, informative language.',
  seasonal:
    'Tie content to current season, holiday, or trending event. Create urgency and relevance.',
  offer:
    'Highlight the promotion, discount, or special deal. Create urgency with clear call-to-action.',
  testimonial:
    'Showcase customer success or satisfaction. Use authentic language. Include social proof elements.',
  behind_the_scenes:
    'Show the human side of the brand. Share process, team, or workspace insights. Be authentic and relatable.',
};

// ============================================================================
// Prompt for image analysis — sends to AI vision model before caption generation
// ============================================================================

/**
 * System prompt instructing the AI to analyze an image for social media content creation.
 */
export const IMAGE_ANALYSIS_PROMPT =
  'You are an expert visual content analyst for social media. Analyze the provided image and return a structured JSON description suitable for social media caption generation. Include: description (one sentence overview), objects (list of key subjects/items visible), mood (emotional tone of the image), and suggestedTone (recommended writing tone for captions based on the image).';

// ============================================================================
// Caption system prompt builder
// ============================================================================

/**
 * Builds the system prompt for base caption generation.
 *
 * The content type modifier guides the AI's approach.
 * If imageAnalysis is provided, it includes structured visual context.
 * The user brief goes in the USER message — NOT here (NF1.3 prompt injection prevention).
 *
 * @param contentType - Type of content being generated
 * @param imageAnalysis - Optional structured result from image analysis
 * @param brief - Optional brief (NOT included in system prompt — for user message only)
 * @returns System prompt string for caption generation
 */
export function buildCaptionSystemPrompt(
  contentType: ContentType,
  imageAnalysis?: {
    description: string;
    objects: string[];
    mood: string;
    suggestedTone: string;
  },
  brief?: string,
): string {
  const modifier = CONTENT_TYPE_PROMPT_MODIFIERS[contentType];

  let prompt = `You are an expert social media copywriter specializing in brand content creation.

Content focus: ${modifier}

Write an engaging social media caption. Keep it authentic, on-brand, and compelling.`;

  if (imageAnalysis) {
    prompt += `

Image context:
- Description: ${imageAnalysis.description}
- Key elements: ${imageAnalysis.objects.join(', ')}
- Visual mood: ${imageAnalysis.mood}
- Suggested tone: ${imageAnalysis.suggestedTone}

Use the image context to inform the caption — reference relevant visual elements naturally.`;
  }

  prompt += `

Return a JSON object with "caption" (string) and "hashtags" (array of strings, each starting with #).`;

  return prompt;
}

// ============================================================================
// Scoring prompt builder
// ============================================================================

/**
 * Builds the prompt for scoring a caption's quality on a 0-1 scale.
 * Instructs the AI to evaluate relevance, engagement potential, brand appropriateness, and platform fit.
 *
 * @param caption - The caption text to evaluate
 * @param platform - The target platform (instagram, facebook, linkedin, x)
 * @returns Prompt string for content scoring
 */
export function buildScoreContentPrompt(caption: string, platform: string): string {
  return `You are a social media content quality evaluator. Score the following caption on a scale from 0 to 1 based on its quality for ${platform}.

Caption to evaluate:
"${caption}"

Platform: ${platform}

Evaluate the caption on these criteria:
1. Relevance and clarity (is the message clear and purposeful?)
2. Engagement potential (would this prompt likes, comments, or shares?)
3. Brand appropriateness (does it feel professional and on-brand?)
4. Platform fit (is it suitable for ${platform}'s audience and format?)

Return a JSON object with a single "score" field (number between 0 and 1, where 0 is very poor and 1 is excellent).`;
}
