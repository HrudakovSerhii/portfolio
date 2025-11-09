import { describe, it, expect } from 'vitest';

/**
 * Test for weighted progress calculation
 * Model sizes: SmolLM: 270MB (76%), distilbert-squad: 65MB (18%), all-MiniLM-L6-v2: 23MB (6%)
 */

describe('Weighted Progress Calculation', () => {
  // Simulate the weighted progress calculation from chat-ui.js
  const calculateWeightedProgress = (embeddingProgress, eqaProgress, textGenProgress) => {
    const weights = {
      embedding: 0.06,  // 23MB / 358MB total
      eqa: 0.18,        // 65MB / 358MB total
      textGen: 0.76     // 270MB / 358MB total
    };

    return (
      (embeddingProgress * weights.embedding) +
      (eqaProgress * weights.eqa) +
      (textGenProgress * weights.textGen)
    );
  };

  it('should calculate 0% when all workers are at 0%', () => {
    const total = calculateWeightedProgress(0, 0, 0);
    expect(total).toBe(0);
  });

  it('should calculate 100% when all workers are at 100%', () => {
    const total = calculateWeightedProgress(100, 100, 100);
    expect(total).toBe(100);
  });

  it('should weight embedding worker at 6%', () => {
    const total = calculateWeightedProgress(100, 0, 0);
    expect(total).toBe(6);
  });

  it('should weight EQA worker at 18%', () => {
    const total = calculateWeightedProgress(0, 100, 0);
    expect(total).toBe(18);
  });

  it('should weight text generation worker at 76%', () => {
    const total = calculateWeightedProgress(0, 0, 100);
    expect(total).toBe(76);
  });

  it('should calculate correct progress with mixed values', () => {
    // Embedding at 50%, EQA at 75%, TextGen at 25%
    const total = calculateWeightedProgress(50, 75, 25);
    const expected = (50 * 0.06) + (75 * 0.18) + (25 * 0.76);
    expect(total).toBeCloseTo(expected, 2);
    expect(total).toBeCloseTo(35.5, 1);
  });

  it('should handle partial loading scenarios', () => {
    // Embedding complete, EQA half done, TextGen not started
    const total = calculateWeightedProgress(100, 50, 0);
    const expected = (100 * 0.06) + (50 * 0.18) + (0 * 0.76);
    expect(total).toBe(expected);
    expect(total).toBe(15); // 6% + 9% + 0%
  });

  it('should show significant progress only when large model loads', () => {
    // Small models complete, large model at 50%
    const total = calculateWeightedProgress(100, 100, 50);
    const expected = (100 * 0.06) + (100 * 0.18) + (50 * 0.76);
    expect(total).toBe(expected);
    expect(total).toBe(62); // 6% + 18% + 38%
  });

  it('should ensure smooth progress without jumps', () => {
    // Simulate parallel loading
    const scenarios = [
      { embedding: 0, eqa: 0, textGen: 0 },
      { embedding: 50, eqa: 30, textGen: 20 },
      { embedding: 100, eqa: 60, textGen: 40 },
      { embedding: 100, eqa: 100, textGen: 60 },
      { embedding: 100, eqa: 100, textGen: 100 }
    ];

    let previousProgress = 0;
    scenarios.forEach(scenario => {
      const progress = calculateWeightedProgress(
        scenario.embedding,
        scenario.eqa,
        scenario.textGen
      );
      
      // Progress should always increase or stay the same
      expect(progress).toBeGreaterThanOrEqual(previousProgress);
      previousProgress = progress;
    });
  });
});
