// @social/ai-service barrel exports
// Phase 3 Plan 01: Interface contracts, cost constants, brand voice builder
// Phase 3 Plan 02: OpenAIProvider, AnthropicProvider, OllamaProvider
// Phase 3 Plan 03: AIConfigService, AICostLogger, BudgetCircuitBreaker
// Phase 3 Plan 04: AIProviderRouter, AiConfigController, AIServiceModule

// Interface contracts: IAIProvider, AICallResult<T>, AICallContext, AIUsage, AITaskType, AIMessage
export * from './interface/ai-service.interface';

// Cost constants: MODEL_COSTS, calculateCostUsd
export * from './cost/model-costs';

// Brand voice builder: BrandVoicePromptBuilder, BrandVoiceInput
export * from './brand-voice/brand-voice-prompt.builder';

// AI providers: OpenAIProvider, AnthropicProvider, OllamaProvider
export * from './providers/openai.provider';
export * from './providers/anthropic.provider';
export * from './providers/ollama.provider';

// Config and cost services: AIConfigService, AIConfigData, AICostLogger, AICostLogParams
export * from './config/ai-config.service';
export * from './cost/ai-cost-logger.service';
export * from './cost/budget-circuit-breaker.service';

// Config controller: AiConfigController
export * from './config/ai-config.controller';

// Router: AIProviderRouter — main entry point for all AI calls
export * from './router/ai-provider.router';

// Batch generation
export * from './batch/batch-generation.service';
export * from './batch/batch-generation.controller';

// Translation
export * from './translation/translation.service';

// Module: AIServiceModule — NestJS module for registration in AppModule
export * from './ai-service.module';
