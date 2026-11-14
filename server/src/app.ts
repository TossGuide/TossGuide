/**
 * Trashify leaderboard API. Tiny on purpose: the app works without it.
 *
 *   GET  /api/health       -> { ok: true }
 *   POST /api/scan         -> records { faculty, itemId, destination, divertedFromLandfill }
 *   GET  /api/leaderboard  -> per-faculty totals, most items diverted first
 *
 * Privacy: no photos, no accounts, no IPs stored. The IP is used only in memory for
 * rate limiting. CO2e is computed here from the shared, cited impact module, so a
 * client can't inflate its faculty's number.
 */
import express, { type ErrorRequestHandler, type Request } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { FACULTIES } from '@trashify/shared/faculties';
import { DESTINATIONS } from '@trashify/shared/rules/destinations';
import { possibleDestinations } from '@trashify/shared/rules/engine';
import { getItem } from '@trashify/shared/rules/items';
import { CONTEXTS, type DestinationId } from '@trashify/shared/rules/types';
import { createRateLimiter, type RateLimitOptions } from './rate-limit';
import { ScanStore, totalsFromScans, type LeaderboardStore } from './store';

export interface AppOptions {
  dataFile: string;
  rateLimit?: RateLimitOptions;
  logger?: (msg: string) => void;
  /** Serve the built client (client/dist) from the same origin, for `npm start`. */
  staticDir?: string;
  /** Where scans go. Default: the JSON file at dataFile. On Vercel: Redis (redis-store.ts). */
  store?: LeaderboardStore;
  /** Express "trust proxy" (which X-Forwarded-For hops to trust for the client IP). */
  trustProxy?: boolean | string;
}

const DESTINATION_IDS = Object.keys(DESTINATIONS) as [DestinationId, ...DestinationId[]];

/** zod schema for POST /api/scan. `.strict()` rejects unexpected fields (e.g. image data). */
export const ScanBody = z
  .object({
    faculty: z.enum(FACULTIES),
    itemId: z.string().max(64).refine((id) => getItem(id) !== undefined, 'unknown item'),
    destination: z.enum(DESTINATION_IDS),
    divertedFromLandfill: z.boolean(),
  })
  .strict();

/** Every destination the rules can give this item in any context (any answers). */
const reachable = (itemId: string) => new Set(CONTEXTS.flatMap((c) => possibleDestinations(itemId, c)));

export function createApp(opts: AppOptions) {
  const log = opts.logger ?? ((m: string) => console.log(m));
  const store: LeaderboardStore = opts.store ?? fileStore(new ScanStore(opts.dataFile, log));
  const allow = createRateLimiter(opts.rateLimit ?? { windowMs: 60_000, max: 30 });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', opts.trustProxy ?? 'loopback'); // the Vite dev proxy forwards from localhost

  // Access log: method, path, status, time. Never bodies, headers or env.
  app.use((req, res, next) => {
    const t0 = Date.now();
    res.on('finish', () => log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - t0}ms`));
    next();
  });

  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/scan', async (req: Request, res) => {
    if (!allow(req.ip ?? 'unknown')) {
      res.status(429).json({ ok: false, error: 'rate_limited' });
      return;
    }
    const parsed = ScanBody.safeParse(req.body);
    if (!parsed.success) {
      // Only field paths go back, never the submitted values (no reflected input).
      const fields = [...new Set(parsed.error.issues.map((i) => i.path.join('.') || 'body'))];
      res.status(400).json({ ok: false, error: 'invalid_body', fields });
      return;
    }
    const { faculty, itemId, destination, divertedFromLandfill } = parsed.data;
    if (!reachable(itemId).has(destination)) {
      res.status(400).json({ ok: false, error: 'destination_not_possible_for_item' });
      return;
    }
    if (DESTINATIONS[destination].divertsFromLandfill !== divertedFromLandfill) {
      res.status(400).json({ ok: false, error: 'diverted_flag_mismatch' });
      return;
    }
    try {
      await store.add({ faculty, itemId, destination, diverted: divertedFromLandfill, ts: Date.now() });
    } catch {
      log('store: add failed');
      res.status(503).json({ ok: false, error: 'storage_unavailable' });
      return;
    }
    res.status(201).json({ ok: true });
  });

  app.get('/api/leaderboard', async (_req, res) => {
    let rows;
    try {
      rows = await store.totals();
    } catch {
      log('store: read failed');
      res.status(503).json({ ok: false, error: 'storage_unavailable' });
      return;
    }
    const faculties = [...rows].sort(
      (a, b) => b.itemsDiverted - a.itemsDiverted || b.scans - a.scans || a.faculty.localeCompare(b.faculty),
    );
    res.json({ faculties });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ ok: false, error: 'not_found' });
  });

  // Production: serve the built PWA. index.html for unknown paths (single-page app).
  if (opts.staticDir && fs.existsSync(opts.staticDir)) {
    const dir = opts.staticDir;
    app.use(
      express.static(dir, {
        dotfiles: 'deny',
        setHeaders: (res, file) => {
          // The service worker and index must be revalidated so updates reach users.
          if (/(sw\.js|index\.html|manifest\.webmanifest)$/.test(file)) res.set('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dir, 'index.html')));
  }

  // Errors (bad JSON, body too large, anything unexpected): JSON, no stack traces.
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) log(`error: ${err?.name ?? 'Error'}`);
    res.status(status).json({ ok: false, error: status === 413 ? 'body_too_large' : status === 500 ? 'server_error' : 'bad_request' });
  };
  app.use(onError);

  return app;
}

/** The JSON-file store, adapted to the LeaderboardStore interface. */
function fileStore(file: ScanStore): LeaderboardStore {
  return { add: async (s) => file.add(s), totals: async () => totalsFromScans(file.all()) };
}
