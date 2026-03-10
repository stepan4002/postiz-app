import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { IAIProvider, AIMessage, AICallResult, AITaskType } from '../interface/ai-service.interface';
import { calculateCostUsd } from '../cost/model-costs';

/**
 * Ollama provider implementation using native HTTP fetch calls.
 * Connects to a locally-running Ollama instance.
 *
 * Key design decisions:
 * - Uses native fetch (not an SDK) — Ollama doesn't have a maintained npm SDK
 * - Converts Zod schema to JSON Schema for structured output format
 * - Token counts from Ollama-specific fields (prompt_eval_count/eval_count)
 *   with character-based fallback estimation
 * - Vision support gated behind OLLAMA_VISION_MODEL env var
 */
@Injectable()
export class OllamaProvider implements IAIProvider {
  readonly providerName = 'ollama';

  private readonly baseUrl: string;
  private readonly visionModel: string | null;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.visionModel = process.env.OLLAMA_VISION_MODEL || null;
  }

  /**
   * Supported task types — analyzeImage only included when vision model is configured.
   */
  get supportedTaskTypes(): AITaskType[] {
    const base: AITaskType[] = [
      'generateCaption',
      'generateHashtags',
      'adaptForPlatform',
      'scoreContent',
    ];
    if (this.visionModel) {
      return [...base, 'analyzeImage'];
    }
    return base;
  }

  /**
   * Send a chat message sequence and get a typed structured response.
   * Uses Ollama's /api/chat endpoint with JSON schema format for structured output.
   *
   * Token counts: Ollama uses prompt_eval_count and eval_count (Pitfall 2).
   * Falls back to character-based estimation if token fields are 0 or missing.
   */
  async chat<T>(
    messages: AIMessage[],
    schema: z.ZodType<T>,
    model: string
  ): Promise<AICallResult<T>> {
    // Convert Zod schema to JSON Schema for Ollama's format field
    const jsonSchema = zodToJsonSchema(schema, { target: 'jsonSchema7' });
    const { $schema, ...cleanSchema } = jsonSchema as Record<string, unknown>;

    const requestBody = {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
      format: cleanSchema,
    };

    let data: any;
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Ollama API returned status ${response.status}`);
      }

      data = await response.json();
    } catch (error) {
      if (error instanceof Error && error.message.includes('Ollama API')) {
        throw error;
      }
      throw new Error(
        `Failed to connect to Ollama at ${this.baseUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // Parse the JSON content from Ollama's response
    const content = data.message.content;
    const parsedContent = JSON.parse(content);
    const output = schema.parse(parsedContent) as T;

    // Extract token counts — Ollama uses different field names (Pitfall 2)
    const rawInputTokens = data.prompt_eval_count ?? 0;
    const rawOutputTokens = data.eval_count ?? 0;

    // Fall back to character-based estimation if both are 0 or missing
    let inputTokens: number;
    let outputTokens: number;
    if (rawInputTokens === 0 && rawOutputTokens === 0) {
      inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
      outputTokens = Math.ceil(content.length / 4);
    } else {
      inputTokens = rawInputTokens;
      outputTokens = rawOutputTokens;
    }

    return {
      output,
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
   * Analyze an image with a text prompt.
   * Requires OLLAMA_VISION_MODEL to be configured (e.g., 'llava', 'bakllava').
   * Fetches the image and converts to base64 for Ollama's images array format.
   */
  async analyzeImage<T>(
    imageUrl: string,
    prompt: string,
    schema: z.ZodType<T>,
    model: string
  ): Promise<AICallResult<T>> {
    if (!this.visionModel) {
      throw new Error(
        'Ollama vision not configured. Set OLLAMA_VISION_MODEL env var (e.g., llava, bakllava).'
      );
    }

    // Fetch the image and convert to base64 for Ollama
    let imageBase64: string;
    try {
      const imageResponse = await fetch(imageUrl);
      const arrayBuffer = await imageResponse.arrayBuffer();
      imageBase64 = Buffer.from(arrayBuffer).toString('base64');
    } catch (error) {
      throw new Error(
        `Failed to fetch image from ${imageUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // Use vision model for image tasks, with prompt and base64 image
    const visionMessages: AIMessage[] = [
      {
        role: 'user',
        content: prompt,
      },
    ];

    // Ollama sends images as base64 in the messages[].images array
    const jsonSchema = zodToJsonSchema(schema, { target: 'jsonSchema7' });
    const { $schema, ...cleanSchema } = jsonSchema as Record<string, unknown>;

    const requestBody = {
      model: this.visionModel,
      messages: [
        {
          role: 'user',
          content: prompt,
          images: [imageBase64],
        },
      ],
      stream: false,
      format: cleanSchema,
    };

    let data: any;
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Ollama API returned status ${response.status}`);
      }

      data = await response.json();
    } catch (error) {
      if (error instanceof Error && error.message.includes('Ollama API')) {
        throw error;
      }
      throw new Error(
        `Failed to connect to Ollama at ${this.baseUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const content = data.message.content;
    const parsedContent = JSON.parse(content);
    const output = schema.parse(parsedContent) as T;

    const rawInputTokens = data.prompt_eval_count ?? 0;
    const rawOutputTokens = data.eval_count ?? 0;

    let inputTokens: number;
    let outputTokens: number;
    if (rawInputTokens === 0 && rawOutputTokens === 0) {
      inputTokens = Math.ceil(JSON.stringify(visionMessages).length / 4);
      outputTokens = Math.ceil(content.length / 4);
    } else {
      inputTokens = rawInputTokens;
      outputTokens = rawOutputTokens;
    }

    return {
      output,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostUsd: calculateCostUsd(this.visionModel, inputTokens, outputTokens),
      },
      model: this.visionModel,
      provider: this.providerName,
    };
  }
}
