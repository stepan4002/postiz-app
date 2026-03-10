import {
  CONTENT_TYPE_PROMPT_MODIFIERS,
  buildCaptionSystemPrompt,
  buildScoreContentPrompt,
} from '../prompts/prompt-templates';
import {
  PLATFORM_CAPTION_NORMS,
  buildPlatformAdaptationPrompt,
} from '../prompts/platform-norms';
import {
  ImageAnalysisSchema,
  PlatformCaptionSchema,
  ConfidenceScoreSchema,
} from '../types/content.types';

describe('CONTENT_TYPE_PROMPT_MODIFIERS', () => {
  const expectedContentTypes = [
    'product',
    'brand_story',
    'educational',
    'seasonal',
    'offer',
    'testimonial',
    'behind_the_scenes',
  ];

  it('should have entries for all 7 content types', () => {
    for (const contentType of expectedContentTypes) {
      expect(CONTENT_TYPE_PROMPT_MODIFIERS).toHaveProperty(contentType);
    }
    expect(Object.keys(CONTENT_TYPE_PROMPT_MODIFIERS)).toHaveLength(7);
  });

  it('should have non-empty string modifiers for each content type', () => {
    for (const contentType of expectedContentTypes) {
      const modifier = CONTENT_TYPE_PROMPT_MODIFIERS[contentType as keyof typeof CONTENT_TYPE_PROMPT_MODIFIERS];
      expect(typeof modifier).toBe('string');
      expect(modifier.length).toBeGreaterThan(10);
    }
  });
});

describe('buildCaptionSystemPrompt', () => {
  it('should return a string containing the content type modifier text', () => {
    const prompt = buildCaptionSystemPrompt('product');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain(CONTENT_TYPE_PROMPT_MODIFIERS['product']);
  });

  it('should return a string containing image analysis context when provided', () => {
    const imageAnalysis = {
      description: 'A red sneaker on a white background',
      objects: ['sneaker', 'shoe', 'product'],
      mood: 'clean and modern',
      suggestedTone: 'energetic and youthful',
    };
    const prompt = buildCaptionSystemPrompt('product', imageAnalysis);
    expect(prompt).toContain(imageAnalysis.description);
    expect(prompt).toContain(imageAnalysis.mood);
    expect(prompt).toContain(imageAnalysis.suggestedTone);
  });

  it('should work without optional imageAnalysis', () => {
    const prompt = buildCaptionSystemPrompt('brand_story');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should include brand_story modifier', () => {
    const prompt = buildCaptionSystemPrompt('brand_story');
    expect(prompt).toContain(CONTENT_TYPE_PROMPT_MODIFIERS['brand_story']);
  });
});

describe('PLATFORM_CAPTION_NORMS', () => {
  const expectedPlatforms = ['instagram', 'facebook', 'linkedin', 'x'];

  it('should have entries for all 4 platforms', () => {
    for (const platform of expectedPlatforms) {
      expect(PLATFORM_CAPTION_NORMS).toHaveProperty(platform);
    }
    expect(Object.keys(PLATFORM_CAPTION_NORMS)).toHaveLength(4);
  });

  it('should have correct field structure for each platform', () => {
    for (const platform of expectedPlatforms) {
      const norms = PLATFORM_CAPTION_NORMS[platform as keyof typeof PLATFORM_CAPTION_NORMS];
      expect(norms).toHaveProperty('maxLength');
      expect(norms).toHaveProperty('optimalLength');
      expect(norms).toHaveProperty('hashtagCount');
      expect(norms).toHaveProperty('style');
      expect(typeof norms.maxLength).toBe('number');
      expect(typeof norms.optimalLength).toBe('number');
      expect(typeof norms.hashtagCount).toBe('string');
      expect(typeof norms.style).toBe('string');
    }
  });

  it('should have correct maxLength for instagram (2200)', () => {
    expect(PLATFORM_CAPTION_NORMS.instagram.maxLength).toBe(2200);
  });

  it('should have correct maxLength for x (280)', () => {
    expect(PLATFORM_CAPTION_NORMS.x.maxLength).toBe(280);
  });
});

describe('buildPlatformAdaptationPrompt', () => {
  it('should include platform maxLength and style guidance', () => {
    const prompt = buildPlatformAdaptationPrompt('instagram', 'A great product!', ['#sneakers', '#fashion']);
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('2200');
    expect(prompt).toContain(PLATFORM_CAPTION_NORMS.instagram.style);
  });

  it('should include the base caption', () => {
    const baseCaption = 'A fantastic new product launch!';
    const prompt = buildPlatformAdaptationPrompt('linkedin', baseCaption, []);
    expect(prompt).toContain(baseCaption);
  });

  it('should include base hashtags when provided', () => {
    const hashtags = ['#business', '#innovation'];
    const prompt = buildPlatformAdaptationPrompt('linkedin', 'Caption', hashtags);
    expect(prompt).toContain('#business');
  });
});

describe('buildScoreContentPrompt', () => {
  it('should include the caption text and platform name', () => {
    const caption = 'This is an amazing product for everyone!';
    const prompt = buildScoreContentPrompt(caption, 'instagram');
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain(caption);
    expect(prompt).toContain('instagram');
  });

  it('should include scoring guidance (0-1 scale)', () => {
    const prompt = buildScoreContentPrompt('Some caption', 'facebook');
    // Should mention scoring or evaluation
    expect(prompt.toLowerCase()).toMatch(/score|evaluat|rate|quality/);
  });
});

describe('ImageAnalysisSchema', () => {
  it('should validate correct input', () => {
    const valid = {
      description: 'A product photo',
      objects: ['product', 'background'],
      mood: 'professional',
      suggestedTone: 'formal',
    };
    const result = ImageAnalysisSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject missing fields', () => {
    const invalid = {
      description: 'A product photo',
      // missing objects, mood, suggestedTone
    };
    const result = ImageAnalysisSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject wrong type for objects (should be array)', () => {
    const invalid = {
      description: 'A product photo',
      objects: 'not-an-array',
      mood: 'professional',
      suggestedTone: 'formal',
    };
    const result = ImageAnalysisSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('PlatformCaptionSchema', () => {
  it('should validate correct input', () => {
    const valid = {
      caption: 'Great product!',
      hashtags: ['#product', '#awesome'],
    };
    const result = PlatformCaptionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject missing caption field', () => {
    const invalid = {
      hashtags: ['#product'],
    };
    const result = PlatformCaptionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('ConfidenceScoreSchema', () => {
  it('should validate score is a number between 0 and 1', () => {
    const valid = { score: 0.85 };
    const result = ConfidenceScoreSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject score above 1', () => {
    const invalid = { score: 1.5 };
    const result = ConfidenceScoreSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject score below 0', () => {
    const invalid = { score: -0.1 };
    const result = ConfidenceScoreSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept boundary values 0 and 1', () => {
    expect(ConfidenceScoreSchema.safeParse({ score: 0 }).success).toBe(true);
    expect(ConfidenceScoreSchema.safeParse({ score: 1 }).success).toBe(true);
  });
});
