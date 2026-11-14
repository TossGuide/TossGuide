/**
 * Vercel build (Build Output API v3), run by Vercel via vercel.json "buildCommand".
 *
 *   static site  <- client/dist (production build, no test hook)
 *   /api/*       <- if BACKEND_URL is set (Vercel env var): forwarded to that server, e.g. the
 *                   VPS running `npm start` with its local PostgreSQL leaderboard.
 *                   Otherwise: one Node serverless function (server/src/vercel.ts, bundled
 *                   with esbuild), with Redis if configured, else a /tmp file that can reset.
 *
 * Writing .vercel/output ourselves means Vercel deploys exactly what we tested, with no
 * framework guessing. Locally: `node scripts/vercel-build.mjs` then inspect .vercel/output.
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

const OUT = '.vercel/output';
/**
 * BACKEND_URL as people actually type it into Vercel: tolerate quotes, spaces, a missing
 * http://, and a trailing "/" or "/api". Ends up as "http(s)://host[:port]".
 */
export function normalizeBackendUrl(raw = '') {
  let v = String(raw).trim().replace(/^["']+|["']+$/g, '').trim();
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = `http://${v}`;
  v = v.replace(/\/+$/, '').replace(/\/api$/i, '').replace(/\/+$/, '');
  return /^https?:\/\/[^/\s]+$/i.test(v) ? v : null;
}

const BACKEND_URL = normalizeBackendUrl(process.env.BACKEND_URL);
if (BACKEND_URL === null) {
  console.error(
    `\nBACKEND_URL is set to "${process.env.BACKEND_URL}", which isn't a server address.\n` +
      'Set it in Vercel (Settings -> Environment Variables) to something like http://203.0.113.5:8080\n' +
      'or https://your-tunnel.trycloudflare.com, or delete it to use the built-in serverless API.\n',
  );
  process.exit(1);
}
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
  target: 'node22',
  format: 'cjs',
  footer: { js: 'module.exports = module.exports.default;' },
  logLevel: 'info',
});
// The repo is "type": "module"; mark this folder CommonJS so index.js loads as a CJS bundle.
writeFileSync(join(fn, 'package.json'), '{ "type": "commonjs" }\n');
writeFileSync(
  join(fn, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.js', launcherType: 'Nodejs', shouldAddHelpers: false }, null, 2),
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
        BACKEND_URL
          ? { src: '^/api/(.*)$', dest: `${BACKEND_URL}/api/$1` }
          : { src: '^/api/(.*)$', dest: '/api?__path=$1' },
        { handle: 'filesystem' },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);
console.log(`\nVercel output ready in ${OUT}`);
console.log(BACKEND_URL ? `/api/* -> ${BACKEND_URL}/api/*` : '/api/* -> serverless function (set BACKEND_URL to use your own server)');
