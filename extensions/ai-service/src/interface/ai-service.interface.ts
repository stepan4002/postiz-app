import { z } from 'zod';

/**
 * Discriminated union of all AI task types supported by the service layer.
 */
export type AITaskType =
  | 'generateCaption'
  | 'generateHashtags'
  | 'adaptForPlatform'
  | 'analyzeImage'
  | 'scoreContent';

/**
 * A single message in a chat conversation.
 */
export type AIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/**
 * Context passed alongside every AI call for cost tracking and logging.
 */
export interface AICallContext {
  companyId: string;
  brandId?: string;
  postId?: string;
  taskType: AITaskType;
}

/**
 * Token usage and estimated cost for a single AI call.
 */
export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

/**
 * Typed result returned from any AI provider call.
 */
export interface AICallResult<T> {
  output: T;
  usage: AIUsage;
  model: string;
  provider: string;
}

/**
 * Provider-agnostic interface that all AI providers must implement.
 * Implementations: OpenAIProvider, AnthropicProvider, OllamaProvider.
 */
export interface IAIProvider {
  readonly providerName: string;
  readonly supportedTaskTypes: AITaskType[];

  /**
   * Send a chat message sequence to the model and get a typed structured response.
   * @param messages - The conversation messages (system + user turns)
   * @param schema - Zod schema for validating and typing the output
   * @param model - Model identifier (e.g. 'gpt-4o', 'claude-sonnet-4-5')
   */
  chat<T>(
    messages: AIMessage[],
    schema: z.ZodType<T>,
    model: string
  ): Promise<AICallResult<T>>;

  /**
   * Analyze an image with a text prompt and return a typed structured response.
   * @param imageUrl - Publicly accessible URL of the image to analyze
   * @param prompt - Instruction text for the model
   * @param schema - Zod schema for validating and typing the output
   * @param model - Model identifier
   */
  analyzeImage<T>(
    imageUrl: string,
    prompt: string,
    schema: z.ZodType<T>,
    model: string
  ): Promise<AICallResult<T>>;
}
