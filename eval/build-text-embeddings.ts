/**
 * Precompute CLIP text embeddings for every prompt in the item vocabulary.
 *
 * Why: the prompts never change at runtime, so there's no reason to ship the
 * ~65 MB text encoder to phones. We run it once here (Node) and save the
 * L2-normalised vectors. The browser then only needs the vision encoder.
 *
 * Re-run after editing prompts in shared/src/rules/items.ts:  npm run embed
 * (A unit test fails if the saved embeddings don't match the current prompts.)
 */
import { AutoTokenizer, CLIPTextModelWithProjection, env } from '@huggingface/transformers';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ITEMS } from '../shared/src/rules/items';
import { MODEL_ID, promptsFingerprint } from '../shared/src/ml/model-config';

env.cacheDir = join(process.cwd(), '.cache', 'models');

async function main() {
  const prompts = ITEMS.flatMap((it) => it.prompts.map((text) => ({ itemId: it.id, text })));
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
  // Full-precision text encoder: it runs offline, so size doesn't matter here.
  const model = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, { dtype: 'fp32' });
  const inputs = tokenizer(prompts.map((p) => p.text), { padding: true, truncation: true });
  const { text_embeds } = await model(inputs);
  const dim = text_embeds.dims[1] as number;
  const data = text_embeds.data as Float32Array;

  const vectors = prompts.map((_, i) => {
    const v = Array.from(data.slice(i * dim, (i + 1) * dim));
    const n = Math.hypot(...v) || 1;
    return v.map((x) => Math.round((x / n) * 1e5) / 1e5); // 5 decimals is plenty for cosine similarity
  });

  const out = {
    model: MODEL_ID,
    dim,
    fingerprint: promptsFingerprint(prompts),
    prompts: prompts.map((p, i) => ({ ...p, v: vectors[i] })),
  };
  const path = join('shared', 'src', 'ml', 'embeddings', 'prompts.json');
  writeFileSync(path, JSON.stringify(out));
  console.log(`wrote ${prompts.length} prompt embeddings (dim ${dim}) to ${path}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
