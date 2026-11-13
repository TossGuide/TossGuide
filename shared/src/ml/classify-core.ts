/**
 * The model-agnostic half of classification, shared by the browser worker and the
 * Node eval harness so both score images in exactly the same way.
 *
 *   image embedding (from the vision encoder)
 *     -> cosine similarity with every precomputed prompt embedding
 *     -> × CLIP logit scale -> per-prompt logits
 *     -> aggregate per item + temperature softmax (aggregate.ts)
 *     -> ranked candidates
 */
import { aggregate, type AggregateMethod, type Candidate } from './aggregate';
import { LOGIT_SCALE } from './model-config';

export interface PromptBank {
  model: string;
  dim: number;
  fingerprint: string;
  prompts: { itemId: string; text: string; v: number[] }[];
}

export interface Calibration {
  method: AggregateMethod;
  temperature: number;
  threshold: number;
}

export function l2normalize(v: ArrayLike<number>): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i]! * v[i]!;
  n = Math.sqrt(n);
  const out = new Float32Array(v.length);
  if (!(n > 0)) return out; // zero/NaN vector -> zeros (all prompts tie)
  for (let i = 0; i < v.length; i++) out[i] = v[i]! / n;
  return out;
}

/** Per-prompt logits for one image embedding. */
export function scorePrompts(imageEmbed: ArrayLike<number>, bank: PromptBank): { itemId: string; logit: number }[] {
  if (imageEmbed.length !== bank.dim) {
    throw new Error(`embedding size ${imageEmbed.length} != prompt bank size ${bank.dim}`);
  }
  const img = l2normalize(imageEmbed);
  return bank.prompts.map((p) => {
    let dot = 0;
    for (let k = 0; k < bank.dim; k++) dot += img[k]! * p.v[k]!;
    return { itemId: p.itemId, logit: dot * LOGIT_SCALE };
  });
}

export function classifyEmbedding(
  imageEmbed: ArrayLike<number>,
  bank: PromptBank,
  calib: Pick<Calibration, 'method' | 'temperature'>,
): Candidate[] {
  return aggregate(scorePrompts(imageEmbed, bank), { method: calib.method, temperature: calib.temperature });
}
