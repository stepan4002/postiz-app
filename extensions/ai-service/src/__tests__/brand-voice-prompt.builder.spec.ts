import { BrandVoiceInput, BrandVoicePromptBuilder } from '../brand-voice/brand-voice-prompt.builder';

describe('BrandVoicePromptBuilder', () => {
  let builder: BrandVoicePromptBuilder;

  beforeEach(() => {
    builder = new BrandVoicePromptBuilder();
  });

  describe('buildSystemPrompt', () => {
    const BASE = 'Generate a caption for this post.';

    it('returns base instruction unchanged when brandVoice is null', () => {
      const result = builder.buildSystemPrompt(null, BASE);
      expect(result).toBe(BASE);
    });

    it('returns base instruction unchanged when all brandVoice fields are empty', () => {
      const empty: BrandVoiceInput = {
        tone: [],
        targetAudience: null,
        preferredHashtags: [],
        blacklistedWords: [],
        samplePosts: [],
        language: 'en',
        notes: null,
      };
      const result = builder.buildSystemPrompt(empty, BASE);
      expect(result).toBe(BASE);
    });

    it('includes tone when provided', () => {
      const bv: BrandVoiceInput = {
        tone: ['professional', 'witty'],
        targetAudience: null,
        preferredHashtags: [],
        blacklistedWords: [],
        samplePosts: [],
        language: 'en',
        notes: null,
      };
      const result = builder.buildSystemPrompt(bv, BASE);
      expect(result).toContain('Brand voice tone: professional, witty');
    });

    it('includes targetAudience when provided', () => {
      const bv: BrandVoiceInput = {
        tone: [],
        targetAudience: 'Small business owners aged 30-50',
        preferredHashtags: [],
        blacklistedWords: [],
        samplePosts: [],
        language: 'en',
        notes: null,
      };
      const result = builder.buildSystemPrompt(bv, BASE);
      expect(result).toContain('Target audience: Small business owners aged 30-50');
    });

    it('includes blacklisted words with NEVER prefix', () => {
      const bv: BrandVoiceInput = {
        tone: [],
        targetAudience: null,
        preferredHashtags: [],
        blacklistedWords: ['cheap', 'discount', 'free'],
        samplePosts: [],
        language: 'en',
        notes: null,
      };
      const result = builder.buildSystemPrompt(bv, BASE);
      expect(result).toContain('NEVER use these words: cheap, discount, free');
    });

    it('includes preferred hashtags when provided', () => {
      const bv: BrandVoiceInput = {
        tone: [],
        targetAudience: null,
        preferredHashtags: ['#SocialMedia', '#Marketing'],
        blacklistedWords: [],
        samplePosts: [],
        language: 'en',
        notes: null,
      };
      const result = builder.buildSystemPrompt(bv, BASE);
      expect(result).toContain('Preferred hashtags (use when relevant): #SocialMedia, #Marketing');
    });

    it('omits language directive when language is English', () => {
      const bv: BrandVoiceInput = {
        tone: ['casual'],
        targetAudience: null,
        preferredHashtags: [],
        blacklistedWords: [],
        samplePosts: [],
        language: 'en',
        notes: null,
      };
      const result = builder.buildSystemPrompt(bv, BASE);
      expect(result).not.toContain('Respond in language');
    });

    it('includes language directive for non-English language', () => {
      const bv: BrandVoiceInput = {
        tone: [],
        targetAudience: null,
        preferredHashtags: [],
        blacklistedWords: [],
        samplePosts: [],
        language: 'es',
        notes: null,
      };
      const result = builder.buildSystemPrompt(bv, BASE);
      expect(result).toContain('Respond in language: es');
    });

    it('limits sample posts to first 3', () => {
      const bv: BrandVoiceInput = {
        tone: [],
        targetAudience: null,
        preferredHashtags: [],
        blacklistedWords: [],
        samplePosts: ['Post 1', 'Post 2', 'Post 3', 'Post 4', 'Post 5'],
        language: 'en',
        notes: null,
      };
      const result = builder.buildSystemPrompt(bv, BASE);
      expect(result).toContain('Sample posts in our style:');
      expect(result).toContain('Post 1');
      expect(result).toContain('Post 2');
      expect(result).toContain('Post 3');
      expect(result).not.toContain('Post 4');
      expect(result).not.toContain('Post 5');
    });

    it('separates sample posts with ---', () => {
      const bv: BrandVoiceInput = {
        tone: [],
        targetAudience: null,
        preferredHashtags: [],
        blacklistedWords: [],
        samplePosts: ['First sample post', 'Second sample post'],
        language: 'en',
        notes: null,
      };
      const result = builder.buildSystemPrompt(bv, BASE);
      expect(result).toContain('First sample post\n---\nSecond sample post');
    });

    it('includes notes when provided', () => {
      const bv: BrandVoiceInput = {
        tone: [],
        targetAudience: null,
        preferredHashtags: [],
        blacklistedWords: [],
        samplePosts: [],
        language: 'en',
        notes: 'Always end with a call to action.',
      };
      const result = builder.buildSystemPrompt(bv, BASE);
      expect(result).toContain('Additional brand guidelines: Always end with a call to action.');
    });

    it('builds a full prompt with all sections included', () => {
      const bv: BrandVoiceInput = {
        tone: ['bold', 'inspirational'],
        targetAudience: 'Entrepreneurs',
        preferredHashtags: ['#Startup', '#Growth'],
        blacklistedWords: ['fail', 'problem'],
        samplePosts: ['We help you grow faster.', 'Innovation is our DNA.'],
        language: 'de',
        notes: 'Keep it concise.',
      };
      const result = builder.buildSystemPrompt(bv, BASE);

      expect(result.startsWith(BASE)).toBe(true);
      expect(result).toContain('Brand voice tone: bold, inspirational');
      expect(result).toContain('Target audience: Entrepreneurs');
      expect(result).toContain('NEVER use these words: fail, problem');
      expect(result).toContain('Preferred hashtags (use when relevant): #Startup, #Growth');
      expect(result).toContain('Respond in language: de');
      expect(result).toContain('Sample posts in our style:');
      expect(result).toContain('Additional brand guidelines: Keep it concise.');
    });

    it('joins sections with double newlines', () => {
      const bv: BrandVoiceInput = {
        tone: ['casual'],
        targetAudience: 'Gen Z',
        preferredHashtags: [],
        blacklistedWords: [],
        samplePosts: [],
        language: 'en',
        notes: null,
      };
      const result = builder.buildSystemPrompt(bv, BASE);
      // Should have double newlines between sections
      expect(result).toContain('\n\n');
      const parts = result.split('\n\n');
      expect(parts[0]).toBe(BASE);
      expect(parts[1]).toContain('Brand voice tone: casual');
    });
  });
});
