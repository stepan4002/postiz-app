import { z } from 'zod';
import { OpenAIProvider } from '../providers/openai.provider';

// Mock the openai module
jest.mock('openai', () => {
  const mockParse = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          parse: mockParse,
        },
      },
    })),
    _mockParse: mockParse,
  };
});

jest.mock('../cost/model-costs', () => ({
  calculateCostUsd: jest.fn().mockReturnValue(0.00025),
}));

import { calculateCostUsd } from '../cost/model-costs';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockParse: jest.MockedFunction<any>;

  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-key';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-import to get mock reference
    const openaiModule = require('openai');
    mockParse = openaiModule._mockParse;
    provider = new OpenAIProvider();
  });

  describe('providerName', () => {
    it('should return openai as provider name', () => {
      expect(provider.providerName).toBe('openai');
    });
  });

  describe('supportedTaskTypes', () => {
    it('should support all 5 task types including analyzeImage', () => {
      expect(provider.supportedTaskTypes).toContain('generateCaption');
      expect(provider.supportedTaskTypes).toContain('generateHashtags');
      expect(provider.supportedTaskTypes).toContain('adaptForPlatform');
      expect(provider.supportedTaskTypes).toContain('analyzeImage');
      expect(provider.supportedTaskTypes).toContain('scoreContent');
      expect(provider.supportedTaskTypes).toHaveLength(5);
    });
  });

  describe('chat()', () => {
    const schema = z.object({ text: z.string() });

    it('should call chat.completions.parse with zodResponseFormat and return AICallResult', async () => {
      const mockCompletion = {
        choices: [{ message: { parsed: { text: 'Hello world' } } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
        },
        model: 'gpt-4o',
      };
      mockParse.mockResolvedValueOnce(mockCompletion);

      const result = await provider.chat(
        [{ role: 'user', content: 'Generate a caption' }],
        schema,
        'gpt-4o'
      );

      expect(mockParse).toHaveBeenCalledTimes(1);
      const callArgs = mockParse.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4o');
      expect(callArgs.response_format).toBeDefined();
      expect(callArgs.messages).toHaveLength(1);
    });

    it('should map usage fields: prompt_tokens -> inputTokens, completion_tokens -> outputTokens', async () => {
      const mockCompletion = {
        choices: [{ message: { parsed: { text: 'Caption text' } } }],
        usage: {
          prompt_tokens: 200,
          completion_tokens: 75,
        },
        model: 'gpt-4o',
      };
      mockParse.mockResolvedValueOnce(mockCompletion);

      const result = await provider.chat(
        [{ role: 'user', content: 'Generate' }],
        schema,
        'gpt-4o'
      );

      expect(result.usage.inputTokens).toBe(200);
      expect(result.usage.outputTokens).toBe(75);
    });

    it('should return estimatedCostUsd computed from calculateCostUsd', async () => {
      const mockCompletion = {
        choices: [{ message: { parsed: { text: 'Caption' } } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
        },
        model: 'gpt-4o',
      };
      mockParse.mockResolvedValueOnce(mockCompletion);

      const result = await provider.chat(
        [{ role: 'user', content: 'Generate' }],
        schema,
        'gpt-4o'
      );

      expect(calculateCostUsd).toHaveBeenCalledWith('gpt-4o', 100, 50);
      expect(result.usage.estimatedCostUsd).toBe(0.00025);
    });

    it('should return correct provider and model in result', async () => {
      const mockCompletion = {
        choices: [{ message: { parsed: { text: 'Caption' } } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        model: 'gpt-4o-mini',
      };
      mockParse.mockResolvedValueOnce(mockCompletion);

      const result = await provider.chat(
        [{ role: 'user', content: 'Generate' }],
        schema,
        'gpt-4o-mini'
      );

      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o-mini');
    });

    it('should return parsed output from completion', async () => {
      const mockCompletion = {
        choices: [{ message: { parsed: { text: 'My caption text' } } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        model: 'gpt-4o',
      };
      mockParse.mockResolvedValueOnce(mockCompletion);

      const result = await provider.chat(
        [{ role: 'user', content: 'Generate' }],
        schema,
        'gpt-4o'
      );

      expect(result.output).toEqual({ text: 'My caption text' });
    });
  });

  describe('analyzeImage()', () => {
    const schema = z.object({ description: z.string() });

    it('should include image_url content part in user message', async () => {
      const mockCompletion = {
        choices: [{ message: { parsed: { description: 'A beautiful sunset' } } }],
        usage: { prompt_tokens: 150, completion_tokens: 30 },
        model: 'gpt-4o',
      };
      mockParse.mockResolvedValueOnce(mockCompletion);

      await provider.analyzeImage(
        'https://example.com/image.jpg',
        'Describe this image',
        schema,
        'gpt-4o'
      );

      const callArgs = mockParse.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(Array.isArray(userMessage.content)).toBe(true);

      const imageContent = userMessage.content.find((c: any) => c.type === 'image_url');
      expect(imageContent).toBeDefined();
      expect(imageContent.image_url.url).toBe('https://example.com/image.jpg');
    });

    it('should include text prompt in user message content', async () => {
      const mockCompletion = {
        choices: [{ message: { parsed: { description: 'Description' } } }],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
        model: 'gpt-4o',
      };
      mockParse.mockResolvedValueOnce(mockCompletion);

      await provider.analyzeImage(
        'https://example.com/image.jpg',
        'Describe this image',
        schema,
        'gpt-4o'
      );

      const callArgs = mockParse.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      const textContent = userMessage.content.find((c: any) => c.type === 'text');
      expect(textContent).toBeDefined();
      expect(textContent.text).toBe('Describe this image');
    });

    it('should return AICallResult with usage for image analysis', async () => {
      const mockCompletion = {
        choices: [{ message: { parsed: { description: 'A sunset' } } }],
        usage: { prompt_tokens: 200, completion_tokens: 40 },
        model: 'gpt-4o',
      };
      mockParse.mockResolvedValueOnce(mockCompletion);

      const result = await provider.analyzeImage(
        'https://example.com/image.jpg',
        'Describe this image',
        schema,
        'gpt-4o'
      );

      expect(result.usage.inputTokens).toBe(200);
      expect(result.usage.outputTokens).toBe(40);
      expect(result.usage.estimatedCostUsd).toBe(0.00025);
      expect(result.provider).toBe('openai');
    });
  });
});
