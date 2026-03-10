import { MODEL_COSTS, calculateCostUsd } from '../cost/model-costs';

describe('model-costs', () => {
  describe('MODEL_COSTS', () => {
    it('contains entries for gpt-4o', () => {
      expect(MODEL_COSTS['gpt-4o']).toBeDefined();
      expect(MODEL_COSTS['gpt-4o'].inputPer1M).toBe(5.0);
      expect(MODEL_COSTS['gpt-4o'].outputPer1M).toBe(20.0);
    });

    it('contains entries for gpt-4o-mini', () => {
      expect(MODEL_COSTS['gpt-4o-mini']).toBeDefined();
      expect(MODEL_COSTS['gpt-4o-mini'].inputPer1M).toBe(0.60);
      expect(MODEL_COSTS['gpt-4o-mini'].outputPer1M).toBe(2.40);
    });

    it('contains entries for claude-sonnet-4-5', () => {
      expect(MODEL_COSTS['claude-sonnet-4-5']).toBeDefined();
      expect(MODEL_COSTS['claude-sonnet-4-5'].inputPer1M).toBe(3.0);
      expect(MODEL_COSTS['claude-sonnet-4-5'].outputPer1M).toBe(15.0);
    });

    it('contains entries for claude-haiku-4-5', () => {
      expect(MODEL_COSTS['claude-haiku-4-5']).toBeDefined();
      expect(MODEL_COSTS['claude-haiku-4-5'].inputPer1M).toBe(1.0);
      expect(MODEL_COSTS['claude-haiku-4-5'].outputPer1M).toBe(5.0);
    });

    it('contains entries for ollama with zero costs', () => {
      expect(MODEL_COSTS['ollama']).toBeDefined();
      expect(MODEL_COSTS['ollama'].inputPer1M).toBe(0);
      expect(MODEL_COSTS['ollama'].outputPer1M).toBe(0);
    });
  });

  describe('calculateCostUsd', () => {
    it('calculates correct cost for gpt-4o', () => {
      // (1000/1e6)*5 + (500/1e6)*20 = 0.005 + 0.01 = 0.015
      const cost = calculateCostUsd('gpt-4o', 1000, 500);
      expect(cost).toBeCloseTo(0.015, 6);
    });

    it('calculates correct cost for gpt-4o-mini with 1M tokens each', () => {
      // (1_000_000/1e6)*0.60 + (1_000_000/1e6)*2.40 = 0.60 + 2.40 = 3.00
      const cost = calculateCostUsd('gpt-4o-mini', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(3.0, 6);
    });

    it('calculates correct cost for claude-sonnet-4-5', () => {
      // (2000/1e6)*3 + (1000/1e6)*15 = 0.006 + 0.015 = 0.021
      const cost = calculateCostUsd('claude-sonnet-4-5', 2000, 1000);
      expect(cost).toBeCloseTo(0.021, 6);
    });

    it('returns 0 for ollama (local model, no cost)', () => {
      const cost = calculateCostUsd('ollama', 5000, 3000);
      expect(cost).toBe(0);
    });

    it('returns 0 for ollama/llama3 (prefix match)', () => {
      const cost = calculateCostUsd('ollama/llama3', 5000, 3000);
      expect(cost).toBe(0);
    });

    it('returns 0 for any ollama/* prefix variant', () => {
      expect(calculateCostUsd('ollama/mistral', 1000, 1000)).toBe(0);
      expect(calculateCostUsd('ollama/phi3', 1000, 1000)).toBe(0);
      expect(calculateCostUsd('ollama/qwen2.5', 1000, 1000)).toBe(0);
    });

    it('returns 0 for unknown model (graceful fallback)', () => {
      const cost = calculateCostUsd('unknown-model', 1000, 1000);
      expect(cost).toBe(0);
    });

    it('returns 0 for empty string model', () => {
      const cost = calculateCostUsd('', 1000, 1000);
      expect(cost).toBe(0);
    });

    it('returns 0 for claude-haiku-4-5 with zero tokens', () => {
      const cost = calculateCostUsd('claude-haiku-4-5', 0, 0);
      expect(cost).toBe(0);
    });

    it('calculates correct cost for gpt-4o with known token counts from plan', () => {
      // Verifying plan behavior: calculateCostUsd('gpt-4o', 1000, 500) = 0.015
      expect(calculateCostUsd('gpt-4o', 1000, 500)).toBeCloseTo(0.015, 6);
    });

    it('calculates gpt-4o-mini 1M+1M = 3.00 as per plan', () => {
      // Verifying plan behavior: 0.60 + 2.40 = 3.00
      expect(calculateCostUsd('gpt-4o-mini', 1_000_000, 1_000_000)).toBeCloseTo(3.0, 4);
    });
  });
});
