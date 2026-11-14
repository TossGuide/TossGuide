/**
 * Leaderboard storage in PostgreSQL (the VPS setup: a local database, never exposed
 * to the internet). Used when DATABASE_URL is set; see docs/DEPLOY.md.
 *
 * One table, one row per scan. Totals are a GROUP BY, so the database is the single
 * source of truth and nothing can drift. CO2e is computed when the scan arrives, from
 * the shared, cited impact module, and stored with the row.
 */
import pg from 'pg';
import { impactOf } from '@trashifyyeg/shared/impact/impact';
import type { DestinationId } from '@trashifyyeg/shared/rules/types';
import type { FacultyTotals, LeaderboardStore, StoredScan } from './store';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS scans (
  id          bigserial PRIMARY KEY,
  faculty     text        NOT NULL,
  item_id     text        NOT NULL,
  destination text        NOT NULL,
  diverted    boolean     NOT NULL,
  co2e_kg     double precision NOT NULL DEFAULT 0 CHECK (co2e_kg >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scans_faculty_idx ON scans (faculty);`;

export class PgStore implements LeaderboardStore {
  private readonly pool: pg.Pool;
  private ready: Promise<void> | null = null;

  constructor(connectionString: string) {
    // Small pool: one tiny server, a few requests a second at most.
    this.pool = new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 3000, idleTimeoutMillis: 30_000 });
    // A dropped idle connection must not crash the process.
    this.pool.on('error', () => undefined);
  }

  /** Create the table on first use (idempotent). Retries on the next call if it failed. */
  private schema(): Promise<void> {
    this.ready ??= this.pool.query(SCHEMA).then(
      () => undefined,
      (e) => {
        this.ready = null;
        throw e;
      },
    );
    return this.ready;
  }

  async add(scan: StoredScan): Promise<void> {
    await this.schema();
    const co2e = scan.diverted ? impactOf(scan.itemId, scan.destination as DestinationId).co2eKg : 0;
    await this.pool.query(
      'INSERT INTO scans (faculty, item_id, destination, diverted, co2e_kg, created_at) VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))',
      [scan.faculty, scan.itemId, scan.destination, scan.diverted, co2e, scan.ts],
    );
  }

  async totals(): Promise<FacultyTotals[]> {
    await this.schema();
    const { rows } = await this.pool.query<{ faculty: string; scans: string; diverted: string; co2e: number | null }>(
      `SELECT faculty, count(*) AS scans, count(*) FILTER (WHERE diverted) AS diverted, sum(co2e_kg) AS co2e
         FROM scans GROUP BY faculty`,
    );
    return rows.map((r) => ({
      faculty: r.faculty,
      scans: Number(r.scans),
      itemsDiverted: Number(r.diverted),
      co2eKg: Number(r.co2e) || 0,
    }));
  }

  async count(): Promise<number> {
    await this.schema();
    const { rows } = await this.pool.query<{ n: string }>('SELECT count(*) AS n FROM scans');
    return Number(rows[0]?.n ?? 0);
  }

  /** One-time move of scans from the old JSON file into an empty table. */
  async importIfEmpty(scans: readonly StoredScan[]): Promise<number> {
    if (!scans.length || (await this.count()) > 0) return 0;
    for (const s of scans) await this.add(s);
    return scans.length;
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}
