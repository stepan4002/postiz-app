import { Module } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { AIConfigService } from './config/ai-config.service';
import { AICostLogger } from './cost/ai-cost-logger.service';
import { BudgetCircuitBreaker } from './cost/budget-circuit-breaker.service';
import { BrandVoicePromptBuilder } from './brand-voice/brand-voice-prompt.builder';
import { AIProviderRouter } from './router/ai-provider.router';
import { AiConfigController } from './config/ai-config.controller';

/**
 * AIServiceModule
 *
 * Wires all AI service layer components into a NestJS module.
 * Import into AppModule after CredentialManagementModule.
 *
 * Providers registered:
 *  - OpenAIProvider, AnthropicProvider, OllamaProvider — three AI provider implementations
 *  - AIConfigService — per-company AI config with env-var fallback
 *  - AICostLogger — non-blocking append-only cost logging
 *  - BudgetCircuitBreaker — weekly UTC budget enforcement
 *  - BrandVoicePromptBuilder — system prompt enrichment with brand voice
 *  - AIProviderRouter — main entry point for all AI calls
 *
 * Controllers:
 *  - AiConfigController — GET/PUT /companies/:companySlug/ai-config
 *
 * Exports:
 *  - AIProviderRouter — for Phase 5 Content Generation to call execute()
 *  - BrandVoicePromptBuilder — for direct use in other modules if needed
 *  - AIConfigService — for inspection of per-company config from other modules
 *  - AICostLogger — for use outside the router (direct cost recording if needed)
 *
 * PrismaService is globally available from DatabaseModule (@Global) — not
 * added to providers here to avoid re-registering the global singleton.
 */
@Module({
  controllers: [AiConfigController],
  providers: [
    // AI provider implementations (no constructor dependencies beyond SDK clients)
    OpenAIProvider,
    AnthropicProvider,
    OllamaProvider,

    // BrandVoicePromptBuilder — pure service, no DB dependencies
    BrandVoicePromptBuilder,

    // AIConfigService — depends on PrismaService (globally available via DatabaseModule)
    {
      provide: AIConfigService,
      useFactory: (prisma: PrismaService) => new AIConfigService(prisma as any),
      inject: [PrismaService],
    },

    // AICostLogger — depends on PrismaService
    {
      provide: AICostLogger,
      useFactory: (prisma: PrismaService) => new AICostLogger(prisma as any),
      inject: [PrismaService],
    },

    // BudgetCircuitBreaker — depends on PrismaService and AIConfigService
    {
      provide: BudgetCircuitBreaker,
      useFactory: (prisma: PrismaService, aiConfigService: AIConfigService) =>
        new BudgetCircuitBreaker(prisma as any, aiConfigService),
      inject: [PrismaService, AIConfigService],
    },

    // AIProviderRouter — depends on all providers, services, and PrismaService (for BrandVoice lookup)
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

    // AiConfigController depends on AIConfigService and PrismaService
    // Controller is in controllers[] array above; add it as injectable too for DI resolution
    {
      provide: AiConfigController,
      useFactory: (aiConfigService: AIConfigService, prisma: PrismaService) =>
        new AiConfigController(aiConfigService, prisma as any),
      inject: [AIConfigService, PrismaService],
    },
  ],
  exports: [
    AIProviderRouter,
    BrandVoicePromptBuilder,
    AIConfigService,
    AICostLogger,
  ],
})
export class AIServiceModule {}
