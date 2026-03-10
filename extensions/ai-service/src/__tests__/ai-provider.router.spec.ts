import { AIProviderRouter } from '../router/ai-provider.router';
import { BudgetExceededError } from '../cost/budget-circuit-breaker.service';
import { AICallContext, AIMessage, AICallResult, AITaskType } from '../interface/ai-service.interface';
import { z } from 'zod';

describe('AIProviderRouter', () => {
  let router: AIProviderRouter;

  let mockOpenAIProvider: any;
  let mockAnthropicProvider: any;
  let mockOllamaProvider: any;
  let mockAIConfigService: any;
  let mockCostLogger: any;
  let mockBudgetCircuitBreaker: any;
  let mockBrandVoicePromptBuilder: any;
  let mockPrisma: any;

  const companyId = 'company-123';
  const brandId = 'brand-456';

  const defaultConfig = {
    defaultProvider: 'openai',
    preferredModels: {},
    weeklyBudgetUsd: null,
  };

  const makeResult = <T>(output: T, model = 'gpt-4o-mini'): AICallResult<T> => ({
    output,
    usage: { inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.001 },
    model,
    provider: 'openai',
  });

  const schema = z.object({ text: z.string() });

  beforeEach(() => {
    mockOpenAIProvider = {
      providerName: 'openai',
      supportedTaskTypes: ['generateCaption', 'generateHashtags', 'adaptForPlatform', 'analyzeImage', 'scoreContent'],
      chat: jest.fn(),
      analyzeImage: jest.fn(),
    };

    mockAnthropicProvider = {
      providerName: 'anthropic',
      supportedTaskTypes: ['generateCaption', 'generateHashtags', 'adaptForPlatform', 'analyzeImage', 'scoreContent'],
      chat: jest.fn(),
      analyzeImage: jest.fn(),
    };

    mockOllamaProvider = {
      providerName: 'ollama',
      supportedTaskTypes: ['generateCaption', 'generateHashtags', 'adaptForPlatform', 'scoreContent'],
      chat: jest.fn(),
      analyzeImage: jest.fn(),
    };

    mockAIConfigService = {
      findByCompany: jest.fn().mockResolvedValue(defaultConfig),
    };

    mockCostLogger = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockBudgetCircuitBreaker = {
      checkBudget: jest.fn().mockResolvedValue(undefined),
    };

    mockBrandVoicePromptBuilder = {
      buildSystemPrompt: jest.fn().mockReturnValue('built system prompt'),
    };

    mockPrisma = {
      brandVoice: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    router = new AIProviderRouter(
      mockOpenAIProvider,
      mockAnthropicProvider,
      mockOllamaProvider,
      mockAIConfigService,
      mockCostLogger,
      mockBudgetCircuitBreaker,
      mockBrandVoicePromptBuilder,
      mockPrisma,
    );
  });

  describe('execute()', () => {
    it('calls budgetCircuitBreaker.checkBudget before provider.chat', async () => {
      const callOrder: string[] = [];
      mockBudgetCircuitBreaker.checkBudget.mockImplementation(async () => {
        callOrder.push('checkBudget');
      });
      mockOpenAIProvider.chat.mockImplementation(async () => {
        callOrder.push('chat');
        return makeResult({ text: 'hello' });
      });

      const context: AICallContext = { companyId, taskType: 'generateCaption' };
      const messages: AIMessage[] = [{ role: 'user', content: 'Write a caption' }];

      await router.execute(context, messages, schema);

      expect(callOrder).toEqual(['checkBudget', 'chat']);
    });

    it('selects openai provider when config.defaultProvider = "openai"', async () => {
      mockAIConfigService.findByCompany.mockResolvedValue({ ...defaultConfig, defaultProvider: 'openai' });
      mockOpenAIProvider.chat.mockResolvedValue(makeResult({ text: 'hello' }, 'gpt-4o-mini'));

      const context: AICallContext = { companyId, taskType: 'generateCaption' };
      const messages: AIMessage[] = [{ role: 'user', content: 'Write a caption' }];

      await router.execute(context, messages, schema);

      expect(mockOpenAIProvider.chat).toHaveBeenCalled();
      expect(mockAnthropicProvider.chat).not.toHaveBeenCalled();
    });

    it('selects anthropic provider when config.defaultProvider = "anthropic"', async () => {
      mockAIConfigService.findByCompany.mockResolvedValue({ ...defaultConfig, defaultProvider: 'anthropic' });
      mockAnthropicProvider.chat.mockResolvedValue({
        ...makeResult({ text: 'hello' }),
        provider: 'anthropic',
        model: 'claude-haiku-4-5',
      });

      const context: AICallContext = { companyId, taskType: 'generateCaption' };
      const messages: AIMessage[] = [{ role: 'user', content: 'Write a caption' }];

      await router.execute(context, messages, schema);

      expect(mockAnthropicProvider.chat).toHaveBeenCalled();
      expect(mockOpenAIProvider.chat).not.toHaveBeenCalled();
    });

    it('uses preferredModels[taskType] when set in config', async () => {
      mockAIConfigService.findByCompany.mockResolvedValue({
        ...defaultConfig,
        defaultProvider: 'openai',
        preferredModels: { generateCaption: 'gpt-4o' },
      });
      mockOpenAIProvider.chat.mockResolvedValue(makeResult({ text: 'hello' }, 'gpt-4o'));

      const context: AICallContext = { companyId, taskType: 'generateCaption' };
      const messages: AIMessage[] = [{ role: 'user', content: 'Write a caption' }];

      await router.execute(context, messages, schema);

      expect(mockOpenAIProvider.chat).toHaveBeenCalledWith(
        expect.any(Array),
        schema,
        'gpt-4o',
      );
    });

    it('falls back to DEFAULT_MODELS when preferredModels not set', async () => {
      mockAIConfigService.findByCompany.mockResolvedValue({
        ...defaultConfig,
        defaultProvider: 'openai',
        preferredModels: {},
      });
      mockOpenAIProvider.chat.mockResolvedValue(makeResult({ text: 'hello' }, 'gpt-4o-mini'));

      const context: AICallContext = { companyId, taskType: 'generateCaption' };
      const messages: AIMessage[] = [{ role: 'user', content: 'Write a caption' }];

      await router.execute(context, messages, schema);

      expect(mockOpenAIProvider.chat).toHaveBeenCalledWith(
        expect.any(Array),
        schema,
        'gpt-4o-mini', // default for openai
      );
    });

    it('calls costLogger.log after successful call', async () => {
      mockOpenAIProvider.chat.mockResolvedValue(makeResult({ text: 'hello' }, 'gpt-4o-mini'));

      const context: AICallContext = { companyId, postId: 'post-789', taskType: 'generateCaption' };
      const messages: AIMessage[] = [{ role: 'user', content: 'Write a caption' }];

      await router.execute(context, messages, schema);

      expect(mockCostLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          postId: 'post-789',
          provider: 'openai',
          model: 'gpt-4o-mini',
          taskType: 'generateCaption',
          inputTokens: 100,
          outputTokens: 50,
          estimatedCostUsd: 0.001,
        }),
      );
    });

    it('injects BrandVoice into system message when brandId provided', async () => {
      const brandVoice = {
        tone: ['professional'],
        targetAudience: 'marketers',
        preferredHashtags: ['#marketing'],
        blacklistedWords: [],
        samplePosts: [],
        language: 'en',
        notes: null,
      };
      mockPrisma.brandVoice.findUnique.mockResolvedValue(brandVoice);
      mockBrandVoicePromptBuilder.buildSystemPrompt.mockReturnValue('enhanced system prompt');
      mockOpenAIProvider.chat.mockResolvedValue(makeResult({ text: 'hello' }));

      const context: AICallContext = { companyId, brandId, taskType: 'generateCaption' };
      const messages: AIMessage[] = [
        { role: 'system', content: 'original system' },
        { role: 'user', content: 'Write a caption' },
      ];

      await router.execute(context, messages, schema);

      expect(mockPrisma.brandVoice.findUnique).toHaveBeenCalledWith({
        where: { brandId },
      });
      expect(mockBrandVoicePromptBuilder.buildSystemPrompt).toHaveBeenCalledWith(
        brandVoice,
        'original system',
      );
      // The system message in the call should be the enhanced one
      const chatCall = mockOpenAIProvider.chat.mock.calls[0];
      const messagesPassedToChat = chatCall[0] as AIMessage[];
      const systemMsg = messagesPassedToChat.find((m) => m.role === 'system');
      expect(systemMsg?.content).toBe('enhanced system prompt');
    });

    it('does NOT inject BrandVoice when brandId not provided', async () => {
      mockOpenAIProvider.chat.mockResolvedValue(makeResult({ text: 'hello' }));

      const context: AICallContext = { companyId, taskType: 'generateCaption' };
      const messages: AIMessage[] = [{ role: 'user', content: 'Write a caption' }];

      await router.execute(context, messages, schema);

      expect(mockPrisma.brandVoice.findUnique).not.toHaveBeenCalled();
      expect(mockBrandVoicePromptBuilder.buildSystemPrompt).not.toHaveBeenCalled();
    });

    it('propagates BudgetExceededError from checkBudget', async () => {
      const budgetError = new BudgetExceededError(companyId, 150, 100);
      mockBudgetCircuitBreaker.checkBudget.mockRejectedValue(budgetError);

      const context: AICallContext = { companyId, taskType: 'generateCaption' };
      const messages: AIMessage[] = [{ role: 'user', content: 'Write a caption' }];

      await expect(router.execute(context, messages, schema)).rejects.toThrow(BudgetExceededError);
      expect(mockOpenAIProvider.chat).not.toHaveBeenCalled();
    });

    it('falls back to another provider when primary does not support task type', async () => {
      // Ollama does NOT support analyzeImage (no vision model configured in test)
      // but openai and anthropic do
      mockAIConfigService.findByCompany.mockResolvedValue({
        ...defaultConfig,
        defaultProvider: 'ollama',
      });
      // Ollama doesn't support analyzeImage in test mock
      mockOllamaProvider.supportedTaskTypes = ['generateCaption', 'generateHashtags'];
      mockOpenAIProvider.chat.mockResolvedValue(makeResult({ text: 'hello' }));

      const context: AICallContext = { companyId, taskType: 'analyzeImage' };
      const messages: AIMessage[] = [{ role: 'user', content: 'Analyze this' }];

      await router.execute(context, messages, schema);

      // Should fallback to openai or anthropic (first that supports analyzeImage)
      expect(mockOpenAIProvider.chat).toHaveBeenCalled();
    });

    it('prepends a system message with brand voice prompt when no system message exists and brandId provided', async () => {
      const brandVoice = {
        tone: ['casual'],
        targetAudience: 'Gen Z',
        preferredHashtags: [],
        blacklistedWords: [],
        samplePosts: [],
        language: 'en',
        notes: null,
      };
      mockPrisma.brandVoice.findUnique.mockResolvedValue(brandVoice);
      mockBrandVoicePromptBuilder.buildSystemPrompt.mockReturnValue('brand voice system prompt');
      mockOpenAIProvider.chat.mockResolvedValue(makeResult({ text: 'hello' }));

      const context: AICallContext = { companyId, brandId, taskType: 'generateCaption' };
      // No system message in the original messages
      const messages: AIMessage[] = [{ role: 'user', content: 'Write a caption' }];

      await router.execute(context, messages, schema);

      const chatCall = mockOpenAIProvider.chat.mock.calls[0];
      const messagesPassedToChat = chatCall[0] as AIMessage[];
      const systemMsg = messagesPassedToChat.find((m) => m.role === 'system');
      expect(systemMsg).toBeDefined();
      expect(systemMsg?.content).toBe('brand voice system prompt');
    });
  });

  describe('executeImageAnalysis()', () => {
    it('calls provider.analyzeImage with vision model', async () => {
      mockOpenAIProvider.analyzeImage.mockResolvedValue({
        output: { description: 'A sunset' },
        usage: { inputTokens: 200, outputTokens: 100, estimatedCostUsd: 0.01 },
        model: 'gpt-4o',
        provider: 'openai',
      });

      const imageSchema = z.object({ description: z.string() });
      const context: AICallContext = { companyId, taskType: 'analyzeImage' };

      await router.executeImageAnalysis(context, 'https://example.com/img.jpg', 'Describe this', imageSchema);

      expect(mockOpenAIProvider.analyzeImage).toHaveBeenCalledWith(
        'https://example.com/img.jpg',
        expect.any(String),
        imageSchema,
        'gpt-4o', // vision model for openai
      );
    });

    it('calls budgetCircuitBreaker.checkBudget before analyzeImage', async () => {
      const callOrder: string[] = [];
      mockBudgetCircuitBreaker.checkBudget.mockImplementation(async () => {
        callOrder.push('checkBudget');
      });
      mockOpenAIProvider.analyzeImage.mockImplementation(async () => {
        callOrder.push('analyzeImage');
        return {
          output: { description: 'image' },
          usage: { inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.001 },
          model: 'gpt-4o',
          provider: 'openai',
        };
      });

      const imageSchema = z.object({ description: z.string() });
      const context: AICallContext = { companyId, taskType: 'analyzeImage' };

      await router.executeImageAnalysis(context, 'https://example.com/img.jpg', 'Describe this', imageSchema);

      expect(callOrder).toEqual(['checkBudget', 'analyzeImage']);
    });

    it('logs cost after successful analyzeImage call', async () => {
      mockOpenAIProvider.analyzeImage.mockResolvedValue({
        output: { description: 'A sunset' },
        usage: { inputTokens: 200, outputTokens: 100, estimatedCostUsd: 0.01 },
        model: 'gpt-4o',
        provider: 'openai',
      });

      const imageSchema = z.object({ description: z.string() });
      const context: AICallContext = { companyId, taskType: 'analyzeImage' };

      await router.executeImageAnalysis(context, 'https://example.com/img.jpg', 'Describe this', imageSchema);

      expect(mockCostLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          taskType: 'analyzeImage',
          inputTokens: 200,
          outputTokens: 100,
          estimatedCostUsd: 0.01,
        }),
      );
    });

    it('selects a provider that supports analyzeImage', async () => {
      // Set ollama as default but ollama doesn't support analyzeImage in test
      mockAIConfigService.findByCompany.mockResolvedValue({
        ...defaultConfig,
        defaultProvider: 'ollama',
      });
      mockOllamaProvider.supportedTaskTypes = ['generateCaption'];
      mockOpenAIProvider.analyzeImage.mockResolvedValue({
        output: { description: 'A sunset' },
        usage: { inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.001 },
        model: 'gpt-4o',
        provider: 'openai',
      });

      const imageSchema = z.object({ description: z.string() });
      const context: AICallContext = { companyId, taskType: 'analyzeImage' };

      await router.executeImageAnalysis(context, 'https://example.com/img.jpg', 'Describe this', imageSchema);

      expect(mockOpenAIProvider.analyzeImage).toHaveBeenCalled();
    });
  });
});
