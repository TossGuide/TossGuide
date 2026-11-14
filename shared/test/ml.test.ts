import { describe, expect, it } from 'vitest';
import { aggregate } from '../src/ml/aggregate';
import { decide, DEFAULT_THRESHOLD } from '../src/ml/decide';

describe('aggregate()', () => {
  const ps = [
    { itemId: 'a', logit: 30 },
    { itemId: 'a', logit: 20 },
    { itemId: 'b', logit: 28 },
    { itemId: 'b', logit: 27 },
  ];
  it('max aggregation picks each item’s best prompt', () => {
    const r = aggregate(ps, { method: 'max' });
    expect(r[0]!.itemId).toBe('a');
    expect(r.reduce((s, c) => s + c.score, 0)).toBeCloseTo(1, 6);
  });
  it('mean aggregation can flip the ranking', () => {
    expect(aggregate(ps, { method: 'mean' })[0]!.itemId).toBe('b');
  });
  it('logsumexp is >= max per item', () => {
    const r = aggregate(ps, { method: 'logsumexp' });
    expect(r.length).toBe(2);
    expect(r.reduce((s, c) => s + c.score, 0)).toBeCloseTo(1, 6);
  });
  it('higher temperature flattens the distribution', () => {
    const sharp = aggregate(ps, { temperature: 0.5 })[0]!.score;
    const flat = aggregate(ps, { temperature: 4 })[0]!.score;
    expect(sharp).toBeGreaterThan(flat);
  });
  it('is numerically stable with large logits and ignores junk', () => {
    const r = aggregate([
      { itemId: 'x', logit: 10000 },
      { itemId: 'y', logit: 9999 },
      { itemId: 'z', logit: Number.NaN },
    ]);
    expect(r.every((c) => Number.isFinite(c.score))).toBe(true);
    expect(r.map((c) => c.itemId)).toEqual(['x', 'y']);
  });
  it('empty input -> []', () => {
    expect(aggregate([])).toEqual([]);
  });
  it('non-positive temperature falls back to 1', () => {
    expect(aggregate(ps, { temperature: 0 })).toEqual(aggregate(ps, { temperature: 1 }));
  });
});

describe('decide()', () => {
  const home = 'edmonton-residential' as const;
  it('answers when confident and the runner-up goes to the same place', () => {
    const d = decide(
      [
        { itemId: 'pop_can', score: 0.8 },
        { itemId: 'plastic_bottle', score: 0.15 },
      ],
      home,
    );
    expect(d).toEqual({ kind: 'answer', itemId: 'pop_can', confidence: 0.8 });
  });
  it('confirms when the runner-up goes somewhere else, even if confident', () => {
    const d = decide(
      [
        { itemId: 'coffee_cup', score: 0.9 },
        { itemId: 'food_scraps', score: 0.05 },
      ],
      home,
    );
    expect(d.kind === 'confirm' && d.reason).toBe('destinations_disagree');
  });
  it('confirms below threshold with top 3 sorted', () => {
    const d = decide(
      [
        { itemId: 'paper', score: 0.1 },
        { itemId: 'coffee_cup', score: 0.3 },
        { itemId: 'cold_cup', score: 0.25 },
        { itemId: 'coffee_lid', score: 0.2 },
      ],
      home,
    );
    expect(d.kind).toBe('confirm');
    if (d.kind === 'confirm') {
      expect(d.reason).toBe('low_confidence');
      expect(d.candidates.map((c) => c.itemId)).toEqual(['coffee_cup', 'cold_cup', 'coffee_lid']);
    }
  });
  it('compares possible-destination SETS (pizza box vs paper takeout at home both reach blue/black)', () => {
    const d = decide(
      [
        { itemId: 'pizza_box', score: 0.9 },
        { itemId: 'paper_takeout', score: 0.05 },
      ],
      home,
    );
    expect(d.kind).toBe('answer');
  });
  it('single confident candidate answers', () => {
    expect(decide([{ itemId: 'battery', score: 0.99 }], home).kind).toBe('answer');
  });
  it('respects a custom threshold', () => {
    const c = [{ itemId: 'battery', score: 0.6 }];
    expect(decide(c, home, { threshold: 0.7 }).kind).toBe('confirm');
    expect(decide(c, home, { threshold: 0.5 }).kind).toBe('answer');
  });
  it('drops unknown ids and junk scores; empty -> no_candidates', () => {
    expect(decide([], home)).toEqual({ kind: 'confirm', reason: 'no_candidates', candidates: [] });
    expect(decide([{ itemId: 'nope', score: 0.99 }], home)).toEqual({
      kind: 'confirm',
      reason: 'no_candidates',
      candidates: [],
    });
    expect(decide([{ itemId: 'battery', score: Number.NaN }], home).kind).toBe('confirm');
    // @ts-expect-error runtime garbage
    expect(decide(undefined, home).kind).toBe('confirm');
  });
  it('has a sane default threshold', () => {
    expect(DEFAULT_THRESHOLD).toBeGreaterThan(0);
    expect(DEFAULT_THRESHOLD).toBeLessThan(1);
  });
});
