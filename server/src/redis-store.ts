/**
 * Leaderboard storage in Redis, for serverless hosts (Vercel) where the file system
 * is wiped between requests. Talks to Upstash's REST API with plain fetch (no SDK),
 * so there's nothing extra to install.
 *
 * Only running totals are stored, one Redis hash:
 *   binsight:leaderboard  { "<faculty>|scans": n, "<faculty>|diverted": n, "<faculty>|co2e": kg }
 * CO2e is computed here from the shared impact module when the scan arrives.
 *
 * Env (Vercel's Upstash integration sets these): KV_REST_API_URL + KV_REST_API_TOKEN,
 * or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
 */
import { impactOf } from '@binsight/shared/impact/impact';
import type { DestinationId } from '@binsight/shared/rules/types';
import type { FacultyTotals, LeaderboardStore, StoredScan } from './store';

export interface RedisOptions {
  url: string;
  token: string;
  key?: string;
  fetch?: typeof fetch;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export class RedisStore implements LeaderboardStore {
  private readonly key: string;
  private readonly fetch: typeof fetch;

  constructor(private readonly opts: RedisOptions) {
    this.key = opts.key ?? 'binsight:leaderboard';
    this.fetch = opts.fetch ?? fetch;
  }

  private async call(path: string, body: unknown): Promise<unknown> {
    const res = await this.fetch(`${this.opts.url.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.opts.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`redis ${res.status}`); // never include the token
    return res.json();
  }

  async add(scan: StoredScan): Promise<void> {
    const f = scan.faculty;
    const co2e = scan.diverted ? impactOf(scan.itemId, scan.destination as DestinationId).co2eKg : 0;
    // One round trip, applied atomically (MULTI/EXEC).
    await this.call('/multi-exec', [
      ['HINCRBY', this.key, `${f}|scans`, '1'],
      ['HINCRBY', this.key, `${f}|diverted`, scan.diverted ? '1' : '0'],
      ['HINCRBYFLOAT', this.key, `${f}|co2e`, String(co2e)],
    ]);
  }

  async totals(): Promise<FacultyTotals[]> {
    const out = (await this.call('', ['HGETALL', this.key])) as { result?: unknown };
    const flat = Array.isArray(out.result) ? out.result : [];
    const rows = new Map<string, FacultyTotals>();
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const field = String(flat[i]);
      const cut = field.lastIndexOf('|');
      if (cut <= 0) continue;
      const faculty = field.slice(0, cut);
      const kind = field.slice(cut + 1);
      const row = rows.get(faculty) ?? { faculty, itemsDiverted: 0, co2eKg: 0, scans: 0 };
      if (kind === 'scans') row.scans = Math.floor(num(flat[i + 1]));
      else if (kind === 'diverted') row.itemsDiverted = Math.floor(num(flat[i + 1]));
      else if (kind === 'co2e') row.co2eKg = num(flat[i + 1]);
      rows.set(faculty, row);
    }
    return [...rows.values()].filter((r) => r.scans > 0);
  }
}

/** Redis settings from the environment, or null if not configured. */
export function redisFromEnv(env: NodeJS.ProcessEnv = process.env): RedisOptions | null {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}
