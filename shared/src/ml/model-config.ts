/**
 * One place for model choices, shared by the browser worker, the eval harness
 * and the embedding builder. See docs/RESEARCH.md §5 for why this model.
 */
export const MODEL_ID = 'Xenova/clip-vit-base-patch32';
/** Quantised (int8) vision encoder: ~89 MB, best accuracy/size in our benchmark. */
export const VISION_DTYPE = 'q8' as const;
/** CLIP's learned logit scale (exp(4.6052) = 100): cosine similarity × 100 = logit. */
export const LOGIT_SCALE = 100;

/** Cheap stable hash of the prompt list, so stale embeddings are detected. */
export function promptsFingerprint(prompts: { itemId: string; text: string }[]): string {
  let h = 2166136261;
  for (const ch of prompts.map((p) => `${p.itemId}\u0000${p.text}`).join('\u0001')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
