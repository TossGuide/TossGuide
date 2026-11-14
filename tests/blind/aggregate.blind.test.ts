// BLIND holdout tests for prompt-score aggregation (docs/API_CONTRACT.md "Score aggregation").
// Contract: group prompt logits by item, combine per method (default 'max'), softmax over items with
// temperature (default 1); return all items sorted best first; scores sum to 1.
import { describe, it, expect } from 'vitest';
import { aggregate } from '@tossguide/shared/ml/aggregate';

// Two items: pop_can prompts {1, 3}, coffee_cup prompts {2}
const PROMPTS = [
  { itemId: 'pop_can', logit: 1 },
  { itemId: 'coffee_cup', logit: 2 },
  { itemId: 'pop_can', logit: 3 },
];

const sigmoid = (d: number) => 1 / (1 + Math.exp(-d));
const scoreOf = (cands: { itemId: string; score: number }[], id: string) => cands.find((c) => c.itemId === id)!.score;
const sum = (cands: { score: number }[]) => cands.reduce((a, c) => a + c.score, 0);

function expectWellFormed(cands: { itemId: string; score: number }[]) {
  expect(sum(cands)).toBeCloseTo(1, 6);
  for (let i = 0; i < cands.length; i++) {
    expect(Number.isFinite(cands[i].score)).toBe(true);
    expect(cands[i].score).toBeGreaterThanOrEqual(0);
    expect(cands[i].score).toBeLessThanOrEqual(1);
    if (i > 0) expect(cands[i - 1].score).toBeGreaterThanOrEqual(cands[i].score);
  }
}

describe('aggregate', () => {
  it('empty input -> []', () => {
    expect(aggregate([])).toEqual([]);
  });

  it('returns one candidate per distinct item, sorted, summing to 1', () => {
    const out = aggregate(PROMPTS);
    expect(out.map((c) => c.itemId).sort()).toEqual(['coffee_cup', 'pop_can']);
    expectWellFormed(out);
  });

  it('default method is max', () => {
    expect(aggregate(PROMPTS)).toEqual(aggregate(PROMPTS, { method: 'max' }));
  });

  it('max: pop_can uses logit 3 vs coffee_cup 2', () => {
    const out = aggregate(PROMPTS, { method: 'max' });
    expect(out[0].itemId).toBe('pop_can');
    expect(scoreOf(out, 'pop_can')).toBeCloseTo(sigmoid(1), 6);
  });

  it('mean: pop_can mean(1,3)=2 ties coffee_cup 2', () => {
    const out = aggregate(PROMPTS, { method: 'mean' });
    expectWellFormed(out);
    expect(scoreOf(out, 'pop_can')).toBeCloseTo(0.5, 6);
    expect(scoreOf(out, 'coffee_cup')).toBeCloseTo(0.5, 6);
  });

  it('logsumexp: pop_can log(e^1+e^3) > max', () => {
    const out = aggregate(PROMPTS, { method: 'logsumexp' });
    expectWellFormed(out);
    const lse = Math.log(Math.exp(1) + Math.exp(3));
    expect(scoreOf(out, 'pop_can')).toBeCloseTo(sigmoid(lse - 2), 6);
  });

  it('methods differ in the expected direction for a multi-prompt item: logsumexp > max > mean', () => {
    const mx = scoreOf(aggregate(PROMPTS, { method: 'max' }), 'pop_can');
    const mn = scoreOf(aggregate(PROMPTS, { method: 'mean' }), 'pop_can');
    const ls = scoreOf(aggregate(PROMPTS, { method: 'logsumexp' }), 'pop_can');
    expect(ls).toBeGreaterThan(mx);
    expect(mx).toBeGreaterThan(mn);
  });

  it('single-prompt items give identical results for all methods', () => {
    const single = [
      { itemId: 'pop_can', logit: 2 },
      { itemId: 'napkin', logit: 0.5 },
    ];
    const a = aggregate(single, { method: 'max' });
    const b = aggregate(single, { method: 'mean' });
    const c = aggregate(single, { method: 'logsumexp' });
    for (const id of ['pop_can', 'napkin']) {
      expect(scoreOf(b, id)).toBeCloseTo(scoreOf(a, id), 9);
      expect(scoreOf(c, id)).toBeCloseTo(scoreOf(a, id), 9);
    }
  });

  it('default temperature is 1', () => {
    expect(aggregate(PROMPTS)).toEqual(aggregate(PROMPTS, { temperature: 1 }));
  });

  it('temperature > 1 flattens, < 1 sharpens', () => {
    const t1 = aggregate(PROMPTS, { temperature: 1 })[0].score;
    const hot = aggregate(PROMPTS, { temperature: 2 });
    const cold = aggregate(PROMPTS, { temperature: 0.5 });
    expectWellFormed(hot);
    expectWellFormed(cold);
    expect(hot[0].itemId).toBe('pop_can');
    expect(cold[0].itemId).toBe('pop_can');
    expect(hot[0].score).toBeLessThan(t1);
    expect(cold[0].score).toBeGreaterThan(t1);
    // softmax(x / T): with diff 1 and T=2 -> sigmoid(0.5)
    expect(hot[0].score).toBeCloseTo(sigmoid(0.5), 6);
    expect(cold[0].score).toBeCloseTo(sigmoid(2), 6);
  });

  it('is numerically stable for large logits (no NaN/Infinity)', () => {
    const out = aggregate([
      { itemId: 'pop_can', logit: 1000 },
      { itemId: 'coffee_cup', logit: 999 },
      { itemId: 'napkin', logit: -1000 },
    ]);
    expectWellFormed(out);
    expect(out[0].itemId).toBe('pop_can');
    expect(out[0].score).toBeCloseTo(sigmoid(1), 4);
  });

  it('does not mutate its input', () => {
    const input = PROMPTS.map((p) => ({ ...p }));
    aggregate(input, { method: 'logsumexp', temperature: 0.7 });
    expect(input).toEqual(PROMPTS);
  });
});
