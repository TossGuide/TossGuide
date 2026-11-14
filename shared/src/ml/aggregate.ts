/**
 * Turn per-PROMPT similarity logits into per-ITEM probabilities.
 *
 * Each item has several text prompts ("a photo of a paper coffee cup", "a takeout
 * coffee cup", ...). The vision model scores the photo against every prompt; here we
 * combine an item's prompt scores into one number, then softmax across items.
 *
 *  - 'max'       : item = its best-matching prompt (robust when only one phrasing fits)
 *  - 'mean'      : item = average prompt (rewards items whose prompts ALL fit)
 *  - 'logsumexp' : a soft max; between the two
 * Which works best is decided by the eval set (eval/REPORT.md), not by taste.
 *
 * `temperature` rescales logits before the softmax. It's our calibration knob:
 * tuned on the eval set so a "0.8" really means ~80% of those answers are right.
 */
export type AggregateMethod = 'max' | 'mean' | 'logsumexp';

export interface Candidate {
  itemId: string;
  score: number;
}

export function aggregate(
  promptScores: { itemId: string; logit: number }[],
  opts: { method?: AggregateMethod; temperature?: number } = {},
): Candidate[] {
  const method = opts.method ?? 'max';
  const t =
    opts.temperature !== undefined && opts.temperature > 0 && Number.isFinite(opts.temperature)
      ? opts.temperature
      : 1;

  const byItem = new Map<string, number[]>();
  for (const p of promptScores ?? []) {
    if (!p || typeof p.itemId !== 'string' || !Number.isFinite(p.logit)) continue;
    const list = byItem.get(p.itemId) ?? [];
    list.push(p.logit);
    byItem.set(p.itemId, list);
  }
  if (byItem.size === 0) return [];

  const combined = [...byItem.entries()].map(([itemId, ls]) => ({
    itemId,
    s: combine(ls, method) / t,
  }));

  // Numerically stable softmax: subtract the max before exponentiating.
  const m = Math.max(...combined.map((c) => c.s));
  const exps = combined.map((c) => ({ itemId: c.itemId, e: Math.exp(c.s - m) }));
  const z = exps.reduce((s, c) => s + c.e, 0);
  return exps.map((c) => ({ itemId: c.itemId, score: c.e / z })).sort((a, b) => b.score - a.score);
}

function combine(ls: number[], method: AggregateMethod): number {
  if (method === 'mean') return ls.reduce((s, x) => s + x, 0) / ls.length;
  const m = Math.max(...ls);
  if (method === 'max') return m;
  return m + Math.log(ls.reduce((s, x) => s + Math.exp(x - m), 0));
}
