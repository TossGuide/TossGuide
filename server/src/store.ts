/**
 * Scan storage: a small JSON file, read once at startup and rewritten on each scan.
 *
 * Why a JSON file and not SQLite: a hackathon leaderboard sees hundreds of scans, not
 * millions, and a JSON file has no native build step to break on a teammate's laptop.
 *
 * Safety rules:
 * - A missing, empty, truncated or hand-mangled file is treated as empty (or we keep
 *   the records that still validate). The server must never crash because of it.
 * - Writes go to a temp file first and are then renamed over the real one, so a crash
 *   mid-write can't leave half a JSON file behind.
 * - If the disk write fails, we keep serving from memory and log it.
 * - Only { faculty, itemId, destination, diverted, ts } is stored: never photos, never IPs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { impactOf } from '@trashifyyeg/shared/impact/impact';
import type { DestinationId } from '@trashifyyeg/shared/rules/types';

export const StoredScan = z.object({
  faculty: z.string().max(100),
  itemId: z.string().max(64),
  destination: z.string().max(64),
  diverted: z.boolean(),
  ts: z.number().finite().nonnegative(),
});
export type StoredScan = z.infer<typeof StoredScan>;

export interface FacultyTotals {
  faculty: string;
  itemsDiverted: number;
  co2eKg: number;
  scans: number;
}

/** Anything that can record a scan and report per-faculty totals (JSON file or Redis). */
export interface LeaderboardStore {
  add(scan: StoredScan): Promise<void>;
  totals(): Promise<FacultyTotals[]>;
}

/** Per-faculty totals from raw scans. CO2e comes from the shared, cited impact module. */
export function totalsFromScans(scans: readonly StoredScan[]): FacultyTotals[] {
  const rows = new Map<string, FacultyTotals>();
  for (const s of scans) {
    const row = rows.get(s.faculty) ?? { faculty: s.faculty, itemsDiverted: 0, co2eKg: 0, scans: 0 };
    row.scans++;
    if (s.diverted) {
      row.itemsDiverted++;
      row.co2eKg += impactOf(s.itemId, s.destination as DestinationId).co2eKg;
    }
    rows.set(s.faculty, row);
  }
  return [...rows.values()];
}

export class ScanStore {
  private scans: StoredScan[];

  constructor(
    private readonly file: string,
    private readonly log: (msg: string) => void = () => undefined,
  ) {
    this.scans = this.read();
  }

  private read(): StoredScan[] {
    let raw: string;
    try {
      raw = fs.readFileSync(this.file, 'utf8');
    } catch {
      return []; // missing file: a fresh leaderboard
    }
    try {
      const data: unknown = JSON.parse(raw);
      const list = (data as { scans?: unknown } | null)?.scans;
      if (!Array.isArray(list)) throw new Error('no scans array');
      const good = list.flatMap((s) => {
        const r = StoredScan.safeParse(s);
        return r.success ? [r.data] : [];
      });
      if (good.length !== list.length) this.log(`store: dropped ${list.length - good.length} malformed record(s)`);
      return good;
    } catch {
      this.log('store: data file unreadable, starting empty (old file kept as .corrupt)');
      try {
        fs.copyFileSync(this.file, `${this.file}.corrupt`);
      } catch {
        /* best effort */
      }
      return [];
    }
  }

  all(): readonly StoredScan[] {
    return this.scans;
  }

  add(scan: StoredScan): void {
    this.scans.push(scan);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ version: 1, scans: this.scans }));
      fs.renameSync(tmp, this.file);
    } catch (e) {
      this.log(`store: write failed (${(e as NodeJS.ErrnoException).code ?? 'error'}), keeping scans in memory`);
    }
  }
}
