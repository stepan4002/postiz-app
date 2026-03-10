/**
 * Per-model cost constants (USD per 1 million tokens).
 * Ollama models run locally and have zero cost.
 * Use 'ollama' key as the fallback for any 'ollama/*' model prefix.
 */
export const MODEL_COSTS: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'gpt-4o': { inputPer1M: 5.0, outputPer1M: 20.0 },
  'gpt-4o-mini': { inputPer1M: 0.60, outputPer1M: 2.40 },
  'claude-sonnet-4-5': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-haiku-4-5': { inputPer1M: 1.0, outputPer1M: 5.0 },
  'ollama': { inputPer1M: 0, outputPer1M: 0 },
};

/**
 * Calculate the estimated cost in USD for a single AI call.
 *
 * @param model - Model identifier (e.g. 'gpt-4o', 'ollama/llama3')
 * @param inputTokens - Number of input/prompt tokens consumed
 * @param outputTokens - Number of output/completion tokens generated
 * @returns Estimated cost in USD (0 for unknown models or Ollama local models)
 */
export function calculateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Direct model match
  let costs = MODEL_COSTS[model];

  // Fallback: Ollama prefix match (e.g. 'ollama/llama3', 'ollama/mistral')
  if (!costs && model.startsWith('ollama/')) {
    costs = MODEL_COSTS['ollama'];
  }

  // Unknown model: return 0 (graceful fallback, no cost charged)
  if (!costs) {
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * costs.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * costs.outputPer1M;
  return inputCost + outputCost;
}
