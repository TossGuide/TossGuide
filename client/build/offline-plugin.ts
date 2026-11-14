/**
 * Vite plugin for offline mode (no extra dependencies, so the team can read it all).
 *
 * 1. ONNX Runtime WASM: served at /ort/ from node_modules in dev, copied into dist/ort/
 *    at build time. Not committed to git (the files are 14-27 MB each).
 * 2. Service worker: client/src/sw.js is a template; at build we inject the exact list
 *    of files to precache (every emitted asset + /ort/ + index.html) and a version hash,
 *    so each deploy gets a fresh cache and old caches are cleaned up.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);
/** The two runtime variants the worker may pick (see classifier.worker.ts ortVariant). */
export const ORT_FILES = [
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
];

function ortDir(): string {
  // Resolve the copy Transformers.js actually uses (it pins an exact version).
  // (Neither package exports ./package.json, so walk up from the resolved entry.)
  const pkgRoot = (entry: string) => {
    let d = path.dirname(entry);
    while (!fs.existsSync(path.join(d, 'package.json'))) d = path.dirname(d);
    return d;
  };
  const tf = pkgRoot(require.resolve('@huggingface/transformers'));
  const ort = pkgRoot(createRequire(path.join(tf, 'package.json')).resolve('onnxruntime-web'));
  return path.join(ort, 'dist');
}

export function offlinePlugin(): Plugin {
  const swTemplate = path.resolve(__dirname, '../src/sw.js');
  return {
    name: 'binsight-offline',
    configureServer(server) {
      const dir = ortDir();
      server.middlewares.use('/ort/', (req, res, next) => {
        const name = path.basename((req.url ?? '').split('?')[0] ?? '');
        if (!ORT_FILES.includes(name)) return next();
        res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        fs.createReadStream(path.join(dir, name)).pipe(res);
      });
    },
    generateBundle(_opts, bundle) {
      const dir = ortDir();
      for (const f of ORT_FILES) {
        this.emitFile({ type: 'asset', fileName: `ort/${f}`, source: fs.readFileSync(path.join(dir, f)) });
      }
      // Precache only the runtime variant(s) most phones need up front; the other is
      // cached on first use by the service worker's runtime cache.
      const files = Object.keys(bundle)
        // Skip source maps, the SW itself, our /ort/ copies (added explicitly below) and
        // the duplicate WASM Vite emits from onnxruntime's own `new URL(...)` reference,
        // which is never fetched because the worker points wasmPaths at /ort/.
        .filter((f) => !f.endsWith('.map') && f !== 'sw.js' && !f.startsWith('ort/') && !f.endsWith('.wasm'))
        .concat(['ort/ort-wasm-simd-threaded.asyncify.mjs', 'ort/ort-wasm-simd-threaded.asyncify.wasm'])
        // Files from client/public aren't part of the bundle, so list the ones we need.
        .concat(['favicon.svg', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png']);
      const urls = ['/', ...files.map((f) => `/${f}`)];
      const version = createHash('sha256').update(urls.join('\n')).digest('hex').slice(0, 12);
      const sw = fs
        .readFileSync(swTemplate, 'utf8')
        .replace('self.__PRECACHE__', JSON.stringify(urls))
        .replace('self.__VERSION__', JSON.stringify(version));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
    },
  };
}
