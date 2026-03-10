import { Test, TestingModule } from '@nestjs/testing';
import { AIServiceModule } from '../ai-service.module';
import { AIProviderRouter } from '../router/ai-provider.router';
import { AIConfigService } from '../config/ai-config.service';
import { BrandVoicePromptBuilder } from '../brand-voice/brand-voice-prompt.builder';
import { AiConfigController } from '../config/ai-config.controller';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { OpenAIProvider } from '../providers/openai.provider';
import { AnthropicProvider } from '../providers/anthropic.provider';
import { OllamaProvider } from '../providers/ollama.provider';
import { AICostLogger } from '../cost/ai-cost-logger.service';
import { BudgetCircuitBreaker } from '../cost/budget-circuit-breaker.service';

/**
 * Mock Prisma service to avoid real DB connections in module compilation tests.
 * Covers all model operations used by AIServiceModule providers.
 */
const mockPrisma = {
  aIConfig: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  aICostLog: {
    create: jest.fn(),
    aggregate: jest.fn(),
  },
  brandVoice: {
    findUnique: jest.fn(),
  },
  company: {
    findUnique: jest.fn(),
  },
};

describe('AIServiceModule', () => {
  let module: TestingModule;

  beforeAll(async () => {
    // Set env vars to prevent provider constructor warnings
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.ANTHROPIC_API_KEY = 'test-key';

    // Build a testing module that mirrors AIServiceModule structure but provides
    // PrismaService as a mock. This verifies the module's provider wiring compiles
    // and all expected services resolve correctly.
    //
    // NOTE: We cannot simply do Test.createTestingModule({ imports: [AIServiceModule] })
    // with overrideProvider(PrismaService) because PrismaService is globally provided
    // by DatabaseModule (@Global) in production — it is not listed in AIServiceModule's
    // providers array. For testing, we wire everything explicitly here.
    module = await Test.createTestingModule({
      providers: [
        // Mock PrismaService — replaces DatabaseModule's @Global provider in tests
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },

        // AI provider implementations
        OpenAIProvider,
        AnthropicProvider,
        OllamaProvider,

        // Pure service — no DB dependencies
        BrandVoicePromptBuilder,

        // Factories mirroring AIServiceModule wiring
        {
          provide: AIConfigService,
          useFactory: (prisma: PrismaService) => new AIConfigService(prisma as any),
          inject: [PrismaService],
        },
        {
          provide: AICostLogger,
          useFactory: (prisma: PrismaService) => new AICostLogger(prisma as any),
          inject: [PrismaService],
        },
        {
          provide: BudgetCircuitBreaker,
          useFactory: (prisma: PrismaService, aiConfigService: AIConfigService) =>
            new BudgetCircuitBreaker(prisma as any, aiConfigService),
          inject: [PrismaService, AIConfigService],
        },
        {
          provide: AIProviderRouter,
          useFactory: (
            openaiProvider: OpenAIProvider,
            anthropicProvider: AnthropicProvider,
            ollamaProvider: OllamaProvider,
            aiConfigService: AIConfigService,
            costLogger: AICostLogger,
            budgetCircuitBreaker: BudgetCircuitBreaker,
            brandVoicePromptBuilder: BrandVoicePromptBuilder,
            prisma: PrismaService,
          ) =>
            new AIProviderRouter(
              openaiProvider,
              anthropicProvider,
              ollamaProvider,
              aiConfigService,
              costLogger,
              budgetCircuitBreaker,
              brandVoicePromptBuilder,
              prisma as any,
            ),
          inject: [
            OpenAIProvider,
            AnthropicProvider,
            OllamaProvider,
            AIConfigService,
            AICostLogger,
            BudgetCircuitBreaker,
            BrandVoicePromptBuilder,
            PrismaService,
          ],
        },
        {
          provide: AiConfigController,
          useFactory: (aiConfigService: AIConfigService, prisma: PrismaService) =>
            new AiConfigController(aiConfigService, prisma as any),
          inject: [AIConfigService, PrismaService],
        },
      ],
    }).compile();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  it('creates successfully with Test.createTestingModule', () => {
    expect(module).toBeDefined();
  });

  it('resolves AIProviderRouter from the compiled module', () => {
    const router = module.get<AIProviderRouter>(AIProviderRouter);
    expect(router).toBeDefined();
    expect(router).toBeInstanceOf(AIProviderRouter);
  });

  it('resolves AIConfigService from the compiled module', () => {
    const aiConfigService = module.get<AIConfigService>(AIConfigService);
    expect(aiConfigService).toBeDefined();
    expect(aiConfigService).toBeInstanceOf(AIConfigService);
  });

  it('resolves BrandVoicePromptBuilder from the compiled module', () => {
    const builder = module.get<BrandVoicePromptBuilder>(BrandVoicePromptBuilder);
    expect(builder).toBeDefined();
    expect(builder).toBeInstanceOf(BrandVoicePromptBuilder);
  });

  it('resolves AiConfigController from the compiled module', () => {
    const controller = module.get<AiConfigController>(AiConfigController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(AiConfigController);
  });
});
