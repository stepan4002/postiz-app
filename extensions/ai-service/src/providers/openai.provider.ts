import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { IAIProvider, AIMessage, AICallResult, AITaskType } from '../interface/ai-service.interface';
import { calculateCostUsd } from '../cost/model-costs';

/**
 * OpenAI provider implementation using direct SDK calls.
 * Supports GPT-4o, GPT-4o-mini, and all vision-capable models.
 * SDK client is instantiated in constructor for testability (not at module level).
 */
@Injectable()
export class OpenAIProvider implements IAIProvider {
  readonly providerName = 'openai';

  readonly supportedTaskTypes: AITaskType[] = [
    'generateCaption',
    'generateHashtags',
    'adaptForPlatform',
    'analyzeImage',
    'scoreContent',
  ];

  private readonly client: OpenAI;

  constructor() {
    // Client instantiated in constructor — not at module level (for testability)
    // Allow lazy failure: if OPENAI_API_KEY is missing it will fail when called
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Send a chat message sequence and get a typed structured response.
   * Uses zodResponseFormat for structured output parsing.
   */
  async chat<T>(
    messages: AIMessage[],
    schema: z.ZodType<T>,
    model: string
  ): Promise<AICallResult<T>> {
    const completion = await this.client.chat.completions.parse({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      response_format: zodResponseFormat(schema, 'output'),
    });

    const usage = completion.usage;
    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;

    return {
      output: completion.choices[0].message.parsed as T,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostUsd: calculateCostUsd(model, inputTokens, outputTokens),
      },
      model,
      provider: this.providerName,
    };
  }

  /**
   * Analyze an image with a text prompt and return a typed structured response.
   * Sends image as image_url content part in a multimodal user message.
   */
  async analyzeImage<T>(
    imageUrl: string,
    prompt: string,
    schema: z.ZodType<T>,
    model: string
  ): Promise<AICallResult<T>> {
    const completion = await this.client.chat.completions.parse({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: zodResponseFormat(schema, 'output'),
    });

    const usage = completion.usage;
    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;

    return {
      output: completion.choices[0].message.parsed as T,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostUsd: calculateCostUsd(model, inputTokens, outputTokens),
      },
      model,
      provider: this.providerName,
    };
  }
}
