import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { IAIProvider, AIMessage, AICallResult, AITaskType } from '../interface/ai-service.interface';
import { calculateCostUsd } from '../cost/model-costs';

/**
 * Build a zodOutputFormat-compatible object for use with Anthropic messages.parse.
 *
 * The official @anthropic-ai/sdk zodOutputFormat helper requires Zod v4 (z.toJSONSchema).
 * Since this project uses Zod v3, we build an equivalent format object using
 * zod-to-json-schema for schema conversion and manual JSON parsing for output.
 */
function buildZodOutputFormat<T>(schema: z.ZodType<T>) {
  const jsonSchema = zodToJsonSchema(schema, { target: 'jsonSchema7' });
  // Remove the $schema property as Anthropic doesn't need it
  const { $schema, ...cleanSchema } = jsonSchema as Record<string, unknown>;

  return {
    type: 'json_schema' as const,
    schema: cleanSchema,
    parse: (content: string): T => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (error) {
        throw new Error(
          `Failed to parse structured output as JSON: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      const result = schema.safeParse(parsed);
      if (!result.success) {
        throw new Error(`Failed to parse structured output: ${result.error.message}`);
      }
      return result.data;
    },
  };
}

/**
 * Anthropic provider implementation using direct SDK calls.
 * Supports Claude Sonnet and Claude Haiku models.
 *
 * Key design decisions:
 * - System message extracted from messages array and passed as top-level param
 *   (Anthropic API requires system to be at top level, not in messages array)
 * - SDK client is instantiated in constructor for testability (not at module level)
 * - Uses custom zodOutputFormat compatible with Zod v3 (SDK's version requires Zod v4)
 */
@Injectable()
export class AnthropicProvider implements IAIProvider {
  readonly providerName = 'anthropic';

  readonly supportedTaskTypes: AITaskType[] = [
    'generateCaption',
    'generateHashtags',
    'adaptForPlatform',
    'analyzeImage',
    'scoreContent',
  ];

  private readonly client: Anthropic;

  constructor() {
    // Client instantiated in constructor — not at module level (for testability)
    // Allow lazy failure: if ANTHROPIC_API_KEY is missing it will fail when called
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  /**
   * Send a chat message sequence and get a typed structured response.
   * Uses zodOutputFormat in output_config for structured output parsing.
   *
   * Pitfall: Anthropic API requires system message as top-level param,
   * NOT inside the messages array. We extract it here.
   */
  async chat<T>(
    messages: AIMessage[],
    schema: z.ZodType<T>,
    model: string
  ): Promise<AICallResult<T>> {
    // Extract system message — Anthropic requires it at top level (Pitfall 1)
    const systemMsg = messages.find((m) => m.role === 'system')?.content;
    const userMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const response = await this.client.messages.parse({
      model,
      max_tokens: 4096,
      ...(systemMsg ? { system: systemMsg } : {}),
      messages: userMessages,
      output_config: { format: buildZodOutputFormat(schema) },
    });

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    return {
      output: response.parsed_output as T,
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
   * Anthropic supports URL source for images directly.
   */
  async analyzeImage<T>(
    imageUrl: string,
    prompt: string,
    schema: z.ZodType<T>,
    model: string
  ): Promise<AICallResult<T>> {
    const response = await this.client.messages.parse({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'url', url: imageUrl },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      output_config: { format: buildZodOutputFormat(schema) },
    });

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    return {
      output: response.parsed_output as T,
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
