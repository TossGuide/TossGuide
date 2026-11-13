/// <reference lib="webworker" />
/**
 * The model runs here, off the main thread, so the camera preview and buttons
 * never freeze while CLIP crunches numbers.
 *
 * Only the VISION encoder is downloaded (~89 MB, cached by the browser after the
 * first visit). Text prompts were embedded offline (npm run embed) and are bundled.
 */
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from '@huggingface/transformers';
import { classifyEmbedding, type PromptBank } from '@binsight/shared/ml/classify-core';
import { MODEL_ID, VISION_DTYPE } from '@binsight/shared/ml/model-config';
import calibration from '@binsight/shared/ml/calibration.json';
import bankJson from '@binsight/shared/ml/embeddings/prompts.json';
import type { FromWorker, ToWorker } from './protocol';

const bank = bankJson as PromptBank;
env.allowLocalModels = false; // always fetch from the Hub (then browser cache)
env.useBrowserCache = true;

let processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> | null = null;
let model: Awaited<ReturnType<typeof CLIPVisionModelWithProjection.from_pretrained>> | null = null;
let loading: Promise<void> | null = null;

const post = (m: FromWorker) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

async function load() {
  const t0 = performance.now();
  // WASM (CPU) everywhere for now: the q8 model is what we evaluated, and int8 ops on
  // WebGPU are patchy across phones. ~100-300 ms per scan is already fast enough.
  const device = 'wasm';
  processor = await AutoProcessor.from_pretrained(MODEL_ID);
  model = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
    dtype: VISION_DTYPE,
    device,
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status === 'progress' && p.file) post({ type: 'progress', file: p.file, loaded: p.loaded ?? 0, total: p.total ?? 0 });
    },
  });
  // Warm-up: the first inference pays one-off setup costs; do it before the user taps.
  const blank = new RawImage(new Uint8ClampedArray(224 * 224 * 3).fill(128), 224, 224, 3);
  await model(await processor(blank));
  post({ type: 'ready', device, loadMs: performance.now() - t0 });
}

async function classify(id: number, img: { data: Uint8ClampedArray; width: number; height: number }) {
  if (!model || !processor) throw new Error('Model not loaded yet');
  const t = performance.now();
  const raw = new RawImage(img.data, img.width, img.height, 4).rgb();
  const { image_embeds } = await model(await processor(raw));
  const candidates = classifyEmbedding(image_embeds.data as Float32Array, bank, {
    method: calibration.method as 'max' | 'mean' | 'logsumexp',
    temperature: calibration.temperature,
  });
  post({ type: 'result', id, candidates: candidates.slice(0, 10), ms: performance.now() - t });
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  try {
    if (msg.type === 'load') {
      loading ??= load();
      await loading;
    } else if (msg.type === 'classify') {
      await classify(msg.id, msg.image);
    }
  } catch (err) {
    if (msg.type === 'load') loading = null; // allow retry
    post({ type: 'error', id: msg.type === 'classify' ? msg.id : undefined, message: err instanceof Error ? err.message : String(err) });
  }
};
