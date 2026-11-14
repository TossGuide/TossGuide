/**
 * Vercel build (Build Output API v3), run by Vercel via vercel.json "buildCommand".
 *
 *   static site  <- client/dist (production build, no test hook)
 *   /api/*       <- one Node serverless function: server/src/vercel.ts bundled with esbuild
 *
 * Writing .vercel/output ourselves means Vercel deploys exactly what we tested, with no
 * framework guessing. Locally: `node scripts/vercel-build.mjs` then inspect .vercel/output.
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

const OUT = '.vercel/output';
const run = (cmd) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, VITE_TEST_HOOK: '' } });

rmSync(OUT, { recursive: true, force: true });

// 1) Client: production build -> static/
run('npm run build -w client');
cpSync('client/dist', join(OUT, 'static'), { recursive: true });
// Vite also emits an unused 27 MB copy of the ONNX WASM under assets/ (the worker loads /ort/).
for (const f of readdirSync(join(OUT, 'static/assets')))
  if (f.endsWith('.wasm')) rmSync(join(OUT, 'static/assets', f));

// 2) API: bundle the Express app into a single CommonJS file.
const fn = join(OUT, 'functions/api.func');
mkdirSync(fn, { recursive: true });
await build({
  entryPoints: ['server/src/vercel.ts'],
  outfile: join(fn, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  footer: { js: 'module.exports = module.exports.default;' },
  logLevel: 'info',
});
// The repo is "type": "module"; mark this folder CommonJS so index.js loads as a CJS bundle.
writeFileSync(join(fn, 'package.json'), '{ "type": "commonjs" }\n');
writeFileSync(
  join(fn, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs20.x', handler: 'index.js', launcherType: 'Nodejs', shouldAddHelpers: false }, null, 2),
);

// 3) Routing: API -> function; real files; everything else -> index.html (single-page app).
const noCache = { 'cache-control': 'no-cache' };
writeFileSync(
  join(OUT, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/(sw\\.js|index\\.html|manifest\\.webmanifest)$', headers: noCache, continue: true },
        { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
        { src: '^/api/(.*)$', dest: '/api?__path=$1' },
        { handle: 'filesystem' },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);
console.log(`\nVercel output ready in ${OUT}`);
