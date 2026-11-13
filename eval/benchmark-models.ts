/**
 * Model benchmark (research phase, docs/RESEARCH.md §4).
 *
 * Compares candidate CLIP-family models on a folder of labelled photos named
 * <itemId>.jpg (or <itemId>/<anything>.jpg), using our real item vocabulary and prompts.
 *
 * Usage: npx tsx eval/benchmark-models.ts <imageDir>
 *
 * For each model we load ONLY the parts we need: the text encoder runs once to embed
 * every prompt, then the vision encoder runs per photo. In the shipped app the text
 * embeddings are precomputed offline, so the browser downloads only the vision encoder.
 */
import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
} from '@huggingface/transformers';
import { readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { ITEMS } from '../shared/src/rules/items';

env.cacheDir = join(process.cwd(), '.cache', 'models');

interface Candidate {
  id: string;
  dtype: 'fp32' | 'q8' | 'fp16';
  visionFile: string; // for reporting download size
}

const CANDIDATES: Candidate[] = [
  { id: 'Xenova/mobileclip_s0', dtype: 'q8', visionFile: 'vision_model_quantized.onnx' },
  { id: 'Xenova/mobileclip_s2', dtype: 'q8', visionFile: 'vision_model_quantized.onnx' },
  { id: 'Xenova/clip-vit-base-patch32', dtype: 'q8', visionFile: 'vision_model_quantized.onnx' },
  { id: 'Xenova/clip-vit-base-patch32', dtype: 'fp32', visionFile: 'vision_model.onnx' },
];

function listImages(dir: string): { label: string; path: string }[] {
  const out: { label: string; path: string }[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      for (const f of readdirSync(p)) if (/\.(jpe?g|png|webp)$/i.test(f)) out.push({ label: name, path: join(p, f) });
    } else if (/\.(jpe?g|png|webp)$/i.test(name)) {
      out.push({ label: basename(name, extname(name)), path: p });
    }
  }
  return out;
}

function normalize(v: Float32Array): Float32Array {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error('usage: tsx eval/benchmark-models.ts <imageDir>');
  const images = listImages(dir);
  const prompts = ITEMS.flatMap((it) => it.prompts.map((p) => ({ itemId: it.id, text: p })));
  console.log(`${images.length} images, ${ITEMS.length} items, ${prompts.length} prompts\n`);

  for (const c of CANDIDATES) {
    const t0 = performance.now();
    const tokenizer = await AutoTokenizer.from_pretrained(c.id);
    const textModel = await CLIPTextModelWithProjection.from_pretrained(c.id, { dtype: c.dtype });
    const processor = await AutoProcessor.from_pretrained(c.id);
    const visionModel = await CLIPVisionModelWithProjection.from_pretrained(c.id, { dtype: c.dtype });
    const loadMs = performance.now() - t0;

    const tok = tokenizer(prompts.map((p) => p.text), { padding: 'max_length', truncation: true });
    const { text_embeds } = await textModel(tok);
    const dim = text_embeds.dims[1] as number;
    const textData = text_embeds.data as Float32Array;
    const textVecs = prompts.map((_, i) => normalize(textData.slice(i * dim, (i + 1) * dim)));

    let top1 = 0;
    let top3 = 0;
    const times: number[] = [];
    const rows: string[] = [];
    // Warm-up run so the first timing isn't dominated by session init.
    {
      const img = await RawImage.read(images[0]!.path);
      await visionModel(await processor(img));
    }
    for (const im of images) {
      const img = await RawImage.read(im.path);
      const s = performance.now();
      const { image_embeds } = await visionModel(await processor(img));
      times.push(performance.now() - s);
      const v = normalize(image_embeds.data as Float32Array);
      // cosine similarity per prompt, max-aggregated per item
      const best = new Map<string, number>();
      prompts.forEach((p, i) => {
        let d = 0;
        const t = textVecs[i]!;
        for (let k = 0; k < dim; k++) d += v[k]! * t[k]!;
        best.set(p.itemId, Math.max(best.get(p.itemId) ?? -1, d));
      });
      const ranked = [...best.entries()].sort((a, b) => b[1] - a[1]);
      const rank = ranked.findIndex(([id]) => id === im.label);
      if (rank === 0) top1++;
      if (rank >= 0 && rank < 3) top3++;
      rows.push(`  ${im.label.padEnd(16)} -> ${ranked.slice(0, 3).map(([id]) => id).join(', ')}${rank === 0 ? '' : '   ✗'}`);
    }
    const med = times.sort((a, b) => a - b)[Math.floor(times.length / 2)]!;
    console.log(`=== ${c.id} (${c.dtype}, ${c.visionFile})`);
    console.log(rows.join('\n'));
    console.log(
      `  top-1 ${top1}/${images.length}  top-3 ${top3}/${images.length}  median vision latency ${med.toFixed(0)} ms (Node CPU)  load ${(loadMs / 1000).toFixed(1)} s\n`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
