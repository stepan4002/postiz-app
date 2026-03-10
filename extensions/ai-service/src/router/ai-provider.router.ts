import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  IAIProvider,
  AIMessage,
  AICallContext,
  AICallResult,
  AITaskType,
} from '../interface/ai-service.interface';
import { OpenAIProvider } from '../providers/openai.provider';
import { AnthropicProvider } from '../providers/anthropic.provider';
import { OllamaProvider } from '../providers/ollama.provider';
import { AIConfigService } from '../config/ai-config.service';
import { AICostLogger } from '../cost/ai-cost-logger.service';
import { BudgetCircuitBreaker } from '../cost/budget-circuit-breaker.service';
import { BrandVoicePromptBuilder } from '../brand-voice/brand-voice-prompt.builder';

/**
 * AIProviderRouter
 *
 * The single entry point for all AI calls in the Social Command Centre.
 *
 * Responsibilities:
 *  1. Budget enforcement — calls BudgetCircuitBreaker.checkBudget before every call
 *  2. Provider selection — picks provider from per-company AIConfig.defaultProvider
 *     with fallback to the first provider that supports the task type
 *  3. BrandVoice injection — looks up BrandVoice and enriches the system prompt
 *     via BrandVoicePromptBuilder before passing messages to the provider
 *  4. Model selection — uses per-task preferredModels override or DEFAULT_MODELS fallback
 *  5. Cost logging — calls AICostLogger.log after every successful AI call
 *
 * No AI call should bypass this router — it is the enforcement boundary for
 * budget, cost tracking, and brand voice consistency (NF4.4).
 */
@Injectable()
export class AIProviderRouter {
  /**
   * Default models per provider when no per-task override is configured.
   * These models balance cost and quality for general-purpose tasks.
   */
  private readonly DEFAULT_MODELS: Record<string, string> = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-haiku-4-5',
    ollama: 'llama3',
  };

  /**
   * Vision-capable models per provider for image analysis tasks.
   * These models have multimodal capabilities (image + text input).
   */
  private readonly VISION_MODELS: Record<string, string> = {
    openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-5',
  };

  /**
   * Map of all registered AI providers, keyed by providerName.
   * Provider selection uses this map for O(1) lookup by name.
   */
  private readonly providers: Map<string, IAIProvider> = new Map();

  constructor(
    private readonly openaiProvider: OpenAIProvider,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly ollamaProvider: OllamaProvider,
    private readonly aiConfigService: AIConfigService,
    private readonly costLogger: AICostLogger,
    private readonly budgetCircuitBreaker: BudgetCircuitBreaker,
    private readonly brandVoicePromptBuilder: BrandVoicePromptBuilder,
    private readonly prisma: any,
  ) {
    this.providers = new Map<string, IAIProvider>([
      ['openai', openaiProvider as IAIProvider],
      ['anthropic', anthropicProvider as IAIProvider],
      ['ollama', ollamaProvider as IAIProvider],
    ]);
  }

  /**
   * Execute a chat-based AI call with full budget enforcement, brand voice
   * injection, and cost logging.
   *
   * Flow:
   *   1. Check budget (throws BudgetExceededError if exceeded)
   *   2. Load per-company AI config
   *   3. Select provider (config.defaultProvider + task-type fallback)
   *   4. Select model (preferredModels override or DEFAULT_MODELS)
   *   5. Inject BrandVoice into system prompt (if brandId provided)
   *   6. Call provider.chat()
   *   7. Log cost
   *   8. Return result
   *
   * @param context - AICallContext with companyId, optional brandId/postId, taskType
   * @param messages - Conversation messages (system + user turns)
   * @param schema - Zod schema for structured output validation
   * @returns AICallResult<T> with output, usage, model, and provider
   * @throws BudgetExceededError if weekly budget exceeded
   * @throws Error if no provider supports the requested task type
   */
  async execute<T>(
    context: AICallContext,
    messages: AIMessage[],
    schema: z.ZodType<T>,
  ): Promise<AICallResult<T>> {
    // Step 1: Enforce budget before making any call
    await this.budgetCircuitBreaker.checkBudget(context.companyId);

    // Step 2: Load per-company AI config
    const config = await this.aiConfigService.findByCompany(context.companyId);

    // Step 3: Select provider
    const provider = this.selectProvider(config.defaultProvider, context.taskType);

    // Step 4: Select model — prefer per-task override, fall back to provider default
    const model =
      config.preferredModels[context.taskType] ??
      this.DEFAULT_MODELS[provider.providerName] ??
      'gpt-4o-mini';

    // Step 5: Inject BrandVoice into system prompt if brandId is provided
    const enrichedMessages = await this.enrichMessagesWithBrandVoice(
      messages,
      context.brandId,
    );

    // Step 6: Call provider
    const result = await provider.chat(enrichedMessages, schema, model);

    // Step 7: Log cost (non-blocking — AICostLogger never throws)
    await this.costLogger.log({
      companyId: context.companyId,
      postId: context.postId,
      provider: result.provider,
      model: result.model,
      taskType: context.taskType,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      estimatedCostUsd: result.usage.estimatedCostUsd,
    });

    // Step 8: Return result
    return result;
  }

  /**
   * Execute an image analysis AI call with full budget enforcement, brand
   * voice injection, and cost logging.
   *
   * Uses VISION_MODELS (e.g., gpt-4o, claude-sonnet-4-5) regardless of
   * cost preference since image analysis requires multimodal capability.
   *
   * @param context - AICallContext with companyId, optional brandId/postId, taskType
   * @param imageUrl - Publicly accessible URL of the image
   * @param prompt - Instruction text for the model
   * @param schema - Zod schema for structured output validation
   * @returns AICallResult<T> with output, usage, model, and provider
   * @throws BudgetExceededError if weekly budget exceeded
   * @throws Error if no provider supports image analysis
   */
  async executeImageAnalysis<T>(
    context: AICallContext,
    imageUrl: string,
    prompt: string,
    schema: z.ZodType<T>,
  ): Promise<AICallResult<T>> {
    // Step 1: Enforce budget
    await this.budgetCircuitBreaker.checkBudget(context.companyId);

    // Step 2: Load per-company AI config
    const config = await this.aiConfigService.findByCompany(context.companyId);

    // Step 3: Select provider (must support analyzeImage task type)
    const provider = this.selectProvider(config.defaultProvider, 'analyzeImage');

    // Step 4: Use vision model for the selected provider
    const model =
      this.VISION_MODELS[provider.providerName] ??
      this.DEFAULT_MODELS[provider.providerName] ??
      'gpt-4o';

    // Step 5: Inject BrandVoice into prompt if brandId provided
    let enrichedPrompt = prompt;
    if (context.brandId) {
      const brandVoice = await (this.prisma as any).brandVoice.findUnique({
        where: { brandId: context.brandId },
      });
      if (brandVoice) {
        enrichedPrompt = this.brandVoicePromptBuilder.buildSystemPrompt(brandVoice, prompt);
      }
    }

    // Step 6: Call provider
    const result = await provider.analyzeImage(imageUrl, enrichedPrompt, schema, model);

    // Step 7: Log cost
    await this.costLogger.log({
      companyId: context.companyId,
      postId: context.postId,
      provider: result.provider,
      model: result.model,
      taskType: context.taskType,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      estimatedCostUsd: result.usage.estimatedCostUsd,
    });

    // Step 8: Return result
    return result;
  }

  /**
   * Selects the best available provider for the requested task type.
   *
   * Priority:
   *   1. Preferred provider from config if it supports the task type
   *   2. First available provider (in insertion order: openai, anthropic, ollama)
   *      that supports the task type
   *
   * @param preferredProvider - Provider name from company config (e.g., 'openai')
   * @param taskType - The AI task type to handle
   * @returns The selected IAIProvider
   * @throws Error if no provider supports the task type
   */
  private selectProvider(preferredProvider: string, taskType: AITaskType): IAIProvider {
    // Try preferred provider first
    const preferred = this.providers.get(preferredProvider);
    if (preferred && preferred.supportedTaskTypes.includes(taskType)) {
      return preferred;
    }

    // Fall back to first provider that supports the task type
    for (const [, provider] of this.providers) {
      if (provider.supportedTaskTypes.includes(taskType)) {
        return provider;
      }
    }

    throw new Error(`No provider available for task type: ${taskType}`);
  }

  /**
   * Enriches messages with brand voice if brandId is provided.
   *
   * If a system message already exists, its content is replaced with
   * the brand voice-enhanced version. If no system message exists but
   * brand voice is found, a new system message is prepended.
   *
   * @param messages - Original messages array
   * @param brandId - Optional brand identifier
   * @returns New messages array (original is not mutated)
   */
  private async enrichMessagesWithBrandVoice(
    messages: AIMessage[],
    brandId?: string,
  ): Promise<AIMessage[]> {
    if (!brandId) {
      return messages;
    }

    const brandVoice = await (this.prisma as any).brandVoice.findUnique({
      where: { brandId },
    });

    if (!brandVoice) {
      return messages;
    }

    const systemMsgIndex = messages.findIndex((m) => m.role === 'system');

    if (systemMsgIndex >= 0) {
      // Replace existing system message content with brand voice-enhanced version
      const originalSystemContent = messages[systemMsgIndex].content;
      const enhancedContent = this.brandVoicePromptBuilder.buildSystemPrompt(
        brandVoice,
        originalSystemContent,
      );
      const enriched = [...messages];
      enriched[systemMsgIndex] = { role: 'system', content: enhancedContent };
      return enriched;
    } else {
      // No system message — prepend a new one with brand voice prompt
      // Build system prompt using empty string as base (brand voice provides all context)
      const brandVoiceContent = this.brandVoicePromptBuilder.buildSystemPrompt(brandVoice, '');
      return [{ role: 'system', content: brandVoiceContent }, ...messages];
    }
  }
}
