import { describe, expect, it } from 'vitest';
import { classifyEmbedding, l2normalize, scorePrompts, type PromptBank } from '../src/ml/classify-core';
import { promptsFingerprint } from '../src/ml/model-config';
import { ITEMS } from '../src/rules/items';
import bank from '../src/ml/embeddings/prompts.json';

const toy: PromptBank = {
  model: 'toy',
  dim: 3,
  fingerprint: 'x',
  prompts: [
    { itemId: 'pop_can', text: 'a', v: [1, 0, 0] },
    { itemId: 'pop_can', text: 'b', v: [0.8, 0.6, 0] },
    { itemId: 'battery', text: 'c', v: [0, 1, 0] },
    { itemId: 'paper', text: 'd', v: [0, 0, 1] },
  ],
};

describe('classify core', () => {
  it('normalises, including the zero vector', () => {
    const n = l2normalize([3, 4]);
    expect(n[0]).toBeCloseTo(0.6);
    expect(n[1]).toBeCloseTo(0.8);
    expect(Array.from(l2normalize([0, 0]))).toEqual([0, 0]);
  });
  it('scores prompts by cosine × 100', () => {
    const s = scorePrompts([2, 0, 0], toy);
    expect(s[0]!.logit).toBeCloseTo(100);
    expect(s[2]!.logit).toBeCloseTo(0);
  });
  it('ranks the matching item first and returns probabilities', () => {
    const r = classifyEmbedding([0.1, 1, 0], toy, { method: 'max', temperature: 1 });
    expect(r[0]!.itemId).toBe('battery');
    expect(r.reduce((s, c) => s + c.score, 0)).toBeCloseTo(1);
  });
  it('rejects mismatched embedding sizes loudly', () => {
    expect(() => scorePrompts([1, 2], toy)).toThrow(/size/);
  });
});

describe('shipped prompt embeddings', () => {
  it('match the current item prompts (run `npm run embed` if this fails)', () => {
    const prompts = ITEMS.flatMap((it) => it.prompts.map((text) => ({ itemId: it.id, text })));
    expect(bank.fingerprint).toBe(promptsFingerprint(prompts));
    expect(bank.prompts.length).toBe(prompts.length);
    expect(bank.prompts[0]!.v.length).toBe(bank.dim);
  });
});
