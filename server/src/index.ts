/**
 * Server entry point. `npm run dev` (with Vite proxying /api) or `npm start` after
 * `npm run build` (serves the built app + API on one port).
 *
 * Settings come from the environment, or from a `.env` file in the repo root
 * (gitignored; see .env.example). Real environment variables win over .env.
 *   PORT          port to listen on (default 8787)
 *   DATABASE_URL  PostgreSQL connection string -> leaderboard stored in Postgres
 *   DATA_FILE     JSON file for the leaderboard when there's no DATABASE_URL
 *   TRUST_PROXY   "true" when behind a proxy (Vercel, Cloudflare) so rate limits use the real client IP
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { PgStore } from './pg-store';
import { ScanStore } from './store';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const port = Number(process.env.PORT) || 8787;
const dataFile = process.env.DATA_FILE || path.join(root, 'server/data/scans.json');
const trustProxy = process.env.TRUST_PROXY === 'true' ? true : undefined;

let store: PgStore | undefined;
if (process.env.DATABASE_URL) {
  store = new PgStore(process.env.DATABASE_URL);
  try {
    // Carry over scans from the JSON file the first time we switch to Postgres.
    const moved = await store.importIfEmpty(new ScanStore(dataFile).all());
    console.log(`Leaderboard: PostgreSQL${moved ? ` (imported ${moved} scans from ${dataFile})` : ''}`);
  } catch (e) {
    // Don't refuse to start: sorting works without the leaderboard, which reports 503 until the DB is back.
    console.log(`Leaderboard: PostgreSQL not reachable yet (${(e as Error).message.split('\n')[0]})`);
  }
} else {
  console.log(`Leaderboard: JSON file ${dataFile}`);
}

const app = createApp({ dataFile, store, trustProxy, staticDir: path.join(root, 'client/dist') });
app.listen(port, () => console.log(`BinSight server on http://localhost:${port}`));
