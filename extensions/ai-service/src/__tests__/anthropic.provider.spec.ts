import { z } from 'zod';
import { AnthropicProvider } from '../providers/anthropic.provider';

// Mock the @anthropic-ai/sdk module
jest.mock('@anthropic-ai/sdk', () => {
  const mockParse = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        parse: mockParse,
      },
    })),
    _mockParse: mockParse,
  };
});

jest.mock('../cost/model-costs', () => ({
  calculateCostUsd: jest.fn().mockReturnValue(0.00042),
}));

import { calculateCostUsd } from '../cost/model-costs';

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let mockParse: jest.MockedFunction<any>;

  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const anthropicModule = require('@anthropic-ai/sdk');
    mockParse = anthropicModule._mockParse;
    provider = new AnthropicProvider();
  });

  describe('providerName', () => {
    it('should return anthropic as provider name', () => {
      expect(provider.providerName).toBe('anthropic');
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

    it('should extract system message from array and pass as top-level system param', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: '{"text":"Hello"}', parsed_output: { text: 'Hello' } }],
        parsed_output: { text: 'Hello' },
        usage: { input_tokens: 100, output_tokens: 50 },
        model: 'claude-sonnet-4-5',
      };
      mockParse.mockResolvedValueOnce(mockResponse);

      await provider.chat(
        [
          { role: 'system', content: 'You are a social media expert.' },
          { role: 'user', content: 'Generate a caption' },
        ],
        schema,
        'claude-sonnet-4-5'
      );

      const callArgs = mockParse.mock.calls[0][0];
      expect(callArgs.system).toBe('You are a social media expert.');
    });

    it('should filter system message out of messages array', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: '{"text":"Hello"}', parsed_output: { text: 'Hello' } }],
        parsed_output: { text: 'Hello' },
        usage: { input_tokens: 100, output_tokens: 50 },
        model: 'claude-sonnet-4-5',
      };
      mockParse.mockResolvedValueOnce(mockResponse);

      await provider.chat(
        [
          { role: 'system', content: 'You are a social media expert.' },
          { role: 'user', content: 'Generate a caption' },
        ],
        schema,
        'claude-sonnet-4-5'
      );

      const callArgs = mockParse.mock.calls[0][0];
      const systemInMessages = callArgs.messages.find((m: any) => m.role === 'system');
      expect(systemInMessages).toBeUndefined();
      expect(callArgs.messages).toHaveLength(1);
      expect(callArgs.messages[0].role).toBe('user');
    });

    it('should map usage fields: input_tokens -> inputTokens, output_tokens -> outputTokens', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: '{"text":"Hello"}', parsed_output: { text: 'Hello' } }],
        parsed_output: { text: 'Hello' },
        usage: { input_tokens: 300, output_tokens: 80 },
        model: 'claude-sonnet-4-5',
      };
      mockParse.mockResolvedValueOnce(mockResponse);

      const result = await provider.chat(
        [{ role: 'user', content: 'Generate' }],
        schema,
        'claude-sonnet-4-5'
      );

      expect(result.usage.inputTokens).toBe(300);
      expect(result.usage.outputTokens).toBe(80);
    });

    it('should return estimatedCostUsd computed from calculateCostUsd', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: '{"text":"Hello"}', parsed_output: { text: 'Hello' } }],
        parsed_output: { text: 'Hello' },
        usage: { input_tokens: 100, output_tokens: 50 },
        model: 'claude-sonnet-4-5',
      };
      mockParse.mockResolvedValueOnce(mockResponse);

      const result = await provider.chat(
        [{ role: 'user', content: 'Generate' }],
        schema,
        'claude-sonnet-4-5'
      );

      expect(calculateCostUsd).toHaveBeenCalledWith('claude-sonnet-4-5', 100, 50);
      expect(result.usage.estimatedCostUsd).toBe(0.00042);
    });

    it('should return correct AICallResult with provider name, model, and output', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: '{"text":"Caption"}', parsed_output: { text: 'Caption' } }],
        parsed_output: { text: 'Caption' },
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-haiku-4-5',
      };
      mockParse.mockResolvedValueOnce(mockResponse);

      const result = await provider.chat(
        [{ role: 'user', content: 'Generate' }],
        schema,
        'claude-haiku-4-5'
      );

      expect(result.provider).toBe('anthropic');
      expect(result.model).toBe('claude-haiku-4-5');
      expect(result.output).toEqual({ text: 'Caption' });
    });

    it('should call messages.parse with output_config containing zodOutputFormat', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: '{"text":"Hello"}', parsed_output: { text: 'Hello' } }],
        parsed_output: { text: 'Hello' },
        usage: { input_tokens: 50, output_tokens: 20 },
        model: 'claude-sonnet-4-5',
      };
      mockParse.mockResolvedValueOnce(mockResponse);

      await provider.chat(
        [{ role: 'user', content: 'Generate' }],
        schema,
        'claude-sonnet-4-5'
      );

      const callArgs = mockParse.mock.calls[0][0];
      expect(callArgs.output_config).toBeDefined();
      expect(callArgs.output_config.format).toBeDefined();
      expect(callArgs.max_tokens).toBeGreaterThan(0);
    });
  });

  describe('analyzeImage()', () => {
    const schema = z.object({ description: z.string() });

    it('should include image content block in user message', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: '{"description":"Sunset"}', parsed_output: { description: 'Sunset' } }],
        parsed_output: { description: 'Sunset' },
        usage: { input_tokens: 200, output_tokens: 30 },
        model: 'claude-sonnet-4-5',
      };
      mockParse.mockResolvedValueOnce(mockResponse);

      await provider.analyzeImage(
        'https://example.com/image.jpg',
        'Describe this image',
        schema,
        'claude-sonnet-4-5'
      );

      const callArgs = mockParse.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(Array.isArray(userMessage.content)).toBe(true);

      const imageBlock = userMessage.content.find((c: any) => c.type === 'image');
      expect(imageBlock).toBeDefined();
      expect(imageBlock.source.type).toBe('url');
      expect(imageBlock.source.url).toBe('https://example.com/image.jpg');
    });

    it('should include text prompt in user message for image analysis', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: '{"description":"Sunset"}', parsed_output: { description: 'Sunset' } }],
        parsed_output: { description: 'Sunset' },
        usage: { input_tokens: 200, output_tokens: 30 },
        model: 'claude-sonnet-4-5',
      };
      mockParse.mockResolvedValueOnce(mockResponse);

      await provider.analyzeImage(
        'https://example.com/image.jpg',
        'Describe this image',
        schema,
        'claude-sonnet-4-5'
      );

      const callArgs = mockParse.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      const textBlock = userMessage.content.find((c: any) => c.type === 'text');
      expect(textBlock).toBeDefined();
      expect(textBlock.text).toBe('Describe this image');
    });

    it('should return AICallResult with usage for image analysis', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: '{"description":"Sunset"}', parsed_output: { description: 'Sunset' } }],
        parsed_output: { description: 'Sunset' },
        usage: { input_tokens: 250, output_tokens: 45 },
        model: 'claude-sonnet-4-5',
      };
      mockParse.mockResolvedValueOnce(mockResponse);

      const result = await provider.analyzeImage(
        'https://example.com/image.jpg',
        'Describe this image',
        schema,
        'claude-sonnet-4-5'
      );

      expect(result.usage.inputTokens).toBe(250);
      expect(result.usage.outputTokens).toBe(45);
      expect(result.usage.estimatedCostUsd).toBe(0.00042);
      expect(result.provider).toBe('anthropic');
    });
  });
});
