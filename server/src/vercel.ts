/**
 * Vercel serverless entry point for /api/*. Bundled by scripts/vercel-build.mjs into
 * .vercel/output/functions/api.func. Same Express app as `npm start`; storage is Redis
 * when configured (see redis-store.ts), otherwise a /tmp file that Vercel may wipe at
 * any time (fine for a quick test, not for a real leaderboard).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app';
import { RedisStore, redisFromEnv } from './redis-store';

const redis = redisFromEnv();
if (!redis) console.log('BinSight: no Redis configured; leaderboard uses /tmp and may reset');

const app = createApp({
  dataFile: '/tmp/binsight-scans.json',
  store: redis ? new RedisStore(redis) : undefined,
  trustProxy: true, // Vercel's edge sets X-Forwarded-For
  rateLimit: { windowMs: 60_000, max: 30 },
});

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // The route rewrites /api/<path> to /api?__path=<path>; restore the original URL for Express.
  const u = new URL(req.url ?? '/', 'http://local');
  const p = u.searchParams.get('__path');
  if (p !== null) {
    u.searchParams.delete('__path');
    req.url = `/api/${p}${u.search}`;
  }
  app(req as never, res as never);
}
