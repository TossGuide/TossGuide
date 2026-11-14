/// <reference lib="webworker" />
/**
 * The model runs here, off the main thread, so the camera preview and buttons
 * never freeze while CLIP crunches numbers.
 *
 * Only the VISION encoder is downloaded (~89 MB, cached by the browser after the
 * first visit). Text prompts were embedded offline (npm run embed) and are bundled.
 */
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from '@huggingface/transformers';
import { classifyEmbedding, type PromptBank } from '@tossguide/shared/ml/classify-core';
import { MODEL_ID, VISION_DTYPE } from '@tossguide/shared/ml/model-config';
import calibration from '@tossguide/shared/ml/calibration.json';
import bankJson from '@tossguide/shared/ml/embeddings/prompts.json';
import type { FromWorker, ToWorker } from './protocol';

const bank = bankJson as PromptBank;
env.allowLocalModels = false; // always fetch from the Hub (then browser cache)
env.useBrowserCache = true;

/**
 * Serve the ONNX Runtime WASM from our own origin (/ort/, copied there by the
 * tossguide-offline Vite plugin) instead of jsDelivr: one less third-party request,
 * no CDN outage risk on demo day, and the service worker can cache it for offline.
 * Same variant choice as Transformers.js: Safari < 26 without WebGPU can't run the
 * asyncify build, so it gets the plain one.
 */
function ortVariant(): string {
  const ua = navigator.userAgent;
  const safari = /Apple/.test(navigator.vendor ?? '') && !/Chrome|Android|CriOS|FxiOS|EdgiOS/.test(ua);
  const v = Number(ua.match(/Version\/(\d+)/)?.[1] ?? 99);
  return safari && v < 26 && !('gpu' in navigator) ? '' : '.asyncify';
}
const onnxEnv = env.backends.onnx as { wasm?: { wasmPaths?: unknown } };
if (onnxEnv.wasm) {
  const base = new URL('/ort/', self.location.origin).href;
  const v = ortVariant();
  onnxEnv.wasm.wasmPaths = { mjs: `${base}ort-wasm-simd-threaded${v}.mjs`, wasm: `${base}ort-wasm-simd-threaded${v}.wasm` };
}

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
