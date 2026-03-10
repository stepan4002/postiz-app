import { z } from 'zod';
import { OllamaProvider } from '../providers/ollama.provider';

jest.mock('../cost/model-costs', () => ({
  calculateCostUsd: jest.fn().mockReturnValue(0),
}));

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_VISION_MODEL;
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('providerName', () => {
    it('should return ollama as provider name', () => {
      provider = new OllamaProvider();
      expect(provider.providerName).toBe('ollama');
    });
  });

  describe('supportedTaskTypes', () => {
    it('should exclude analyzeImage when OLLAMA_VISION_MODEL is not set', () => {
      provider = new OllamaProvider();
      expect(provider.supportedTaskTypes).not.toContain('analyzeImage');
      expect(provider.supportedTaskTypes).toContain('generateCaption');
      expect(provider.supportedTaskTypes).toContain('generateHashtags');
      expect(provider.supportedTaskTypes).toContain('adaptForPlatform');
      expect(provider.supportedTaskTypes).toContain('scoreContent');
    });

    it('should include analyzeImage when OLLAMA_VISION_MODEL is set', () => {
      process.env.OLLAMA_VISION_MODEL = 'llava';
      provider = new OllamaProvider();
      expect(provider.supportedTaskTypes).toContain('analyzeImage');
      expect(provider.supportedTaskTypes).toHaveLength(5);
    });
  });

  describe('chat()', () => {
    const schema = z.object({ text: z.string() });

    it('should send POST to correct URL with correct body shape', async () => {
      const mockResponse = {
        message: { content: '{"text":"Hello world"}' },
        prompt_eval_count: 50,
        eval_count: 20,
      };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      provider = new OllamaProvider();
      await provider.chat(
        [{ role: 'user', content: 'Generate a caption' }],
        schema,
        'llama3'
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('http://localhost:11434/api/chat');
      expect(options.method).toBe('POST');
      expect(options.headers).toBeDefined();

      const body = JSON.parse(options.body);
      expect(body.model).toBe('llama3');
      expect(body.stream).toBe(false);
      expect(body.format).toBeDefined();
      expect(Array.isArray(body.messages)).toBe(true);
    });

    it('should use OLLAMA_BASE_URL env var when set', async () => {
      process.env.OLLAMA_BASE_URL = 'http://my-ollama-server:11434';
      const mockResponse = {
        message: { content: '{"text":"Hello"}' },
        prompt_eval_count: 10,
        eval_count: 5,
      };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      provider = new OllamaProvider();
      await provider.chat(
        [{ role: 'user', content: 'Generate' }],
        schema,
        'llama3'
      );

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toBe('http://my-ollama-server:11434/api/chat');
    });

    it('should parse response.message.content as JSON and validate with schema', async () => {
      const mockResponse = {
        message: { content: '{"text":"My caption"}' },
        prompt_eval_count: 30,
        eval_count: 15,
      };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      provider = new OllamaProvider();
      const result = await provider.chat(
        [{ role: 'user', content: 'Generate' }],
        schema,
        'llama3'
      );

      expect(result.output).toEqual({ text: 'My caption' });
    });

    it('should extract token counts from prompt_eval_count and eval_count', async () => {
      const mockResponse = {
        message: { content: '{"text":"Caption"}' },
        prompt_eval_count: 100,
        eval_count: 40,
      };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      provider = new OllamaProvider();
      const result = await provider.chat(
        [{ role: 'user', content: 'Generate' }],
        schema,
        'llama3'
      );

      expect(result.usage.inputTokens).toBe(100);
      expect(result.usage.outputTokens).toBe(40);
    });

    it('should use character-based estimation when token fields are 0', async () => {
      const mockResponse = {
        message: { content: '{"text":"Caption text here"}' },
        prompt_eval_count: 0,
        eval_count: 0,
      };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const messages = [{ role: 'user' as const, content: 'Generate a caption please' }];
      provider = new OllamaProvider();
      const result = await provider.chat(messages, schema, 'llama3');

      // When both are 0, should estimate based on character counts
      expect(result.usage.inputTokens).toBeGreaterThan(0);
      expect(result.usage.outputTokens).toBeGreaterThan(0);
    });

    it('should use character-based estimation when token fields are missing', async () => {
      const mockResponse = {
        message: { content: '{"text":"Caption"}' },
        // No prompt_eval_count or eval_count
      };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      provider = new OllamaProvider();
      const result = await provider.chat(
        [{ role: 'user', content: 'Generate' }],
        schema,
        'llama3'
      );

      expect(result.usage.inputTokens).toBeGreaterThan(0);
      expect(result.usage.outputTokens).toBeGreaterThan(0);
    });

    it('should return correct provider name and model', async () => {
      const mockResponse = {
        message: { content: '{"text":"Caption"}' },
        prompt_eval_count: 10,
        eval_count: 5,
      };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      provider = new OllamaProvider();
      const result = await provider.chat(
        [{ role: 'user', content: 'Generate' }],
        schema,
        'llama3'
      );

      expect(result.provider).toBe('ollama');
      expect(result.model).toBe('llama3');
    });

    it('should wrap connection errors with descriptive message', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      provider = new OllamaProvider();
      await expect(
        provider.chat([{ role: 'user', content: 'Generate' }], schema, 'llama3')
      ).rejects.toThrow(/localhost:11434/);
    });

    it('should include the base URL in connection error messages', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('fetch failed'));

      provider = new OllamaProvider();
      await expect(
        provider.chat([{ role: 'user', content: 'Generate' }], schema, 'llama3')
      ).rejects.toThrow('http://localhost:11434');
    });
  });

  describe('analyzeImage()', () => {
    const schema = z.object({ description: z.string() });

    it('should throw when OLLAMA_VISION_MODEL is not configured', async () => {
      provider = new OllamaProvider();
      await expect(
        provider.analyzeImage(
          'https://example.com/image.jpg',
          'Describe this image',
          schema,
          'llama3'
        )
      ).rejects.toThrow(/OLLAMA_VISION_MODEL/);
    });

    it('should throw descriptive error mentioning env var to set', async () => {
      provider = new OllamaProvider();
      await expect(
        provider.analyzeImage(
          'https://example.com/image.jpg',
          'Describe this image',
          schema,
          'llama3'
        )
      ).rejects.toThrow('OLLAMA_VISION_MODEL');
    });

    it('should send request when OLLAMA_VISION_MODEL is configured', async () => {
      process.env.OLLAMA_VISION_MODEL = 'llava';

      // Mock the fetch for image download and API call
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => Buffer.from('fake-image-data'),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { content: '{"description":"A beautiful sunset"}' },
            prompt_eval_count: 150,
            eval_count: 30,
          }),
        } as Response);

      provider = new OllamaProvider();
      const result = await provider.analyzeImage(
        'https://example.com/image.jpg',
        'Describe this image',
        schema,
        'llava'
      );

      expect(result.provider).toBe('ollama');
      expect(result.output).toEqual({ description: 'A beautiful sunset' });
    });
  });
});
