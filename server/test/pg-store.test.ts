// PgStore against a REAL PostgreSQL database. Skipped unless TEST_DATABASE_URL is set,
// so `npm test` works on laptops without Postgres. On the server:
//   TEST_DATABASE_URL=postgres://trashify:...@127.0.0.1/trashify_test npx vitest run server/test/pg-store.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import pg from 'pg';
import { PgStore } from '../src/pg-store';
import { createApp } from '../src/app';
import { impactOf } from '@trashify/shared/impact/impact';

const URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!URL)('PgStore (real Postgres)', () => {
  let store: PgStore;
  beforeAll(async () => {
    const c = new pg.Client({ connectionString: URL });
    await c.connect();
    await c.query('DROP TABLE IF EXISTS scans');
    await c.end();
    store = new PgStore(URL!);
  });
  afterAll(() => store.close());

  const scan = (over = {}) => ({ faculty: 'Science', itemId: 'pop_can', destination: 'bottle_depot', diverted: true, ts: Date.now(), ...over });

  it('creates its table, stores scans and totals them per faculty', async () => {
    await store.add(scan());
    await store.add(scan());
    await store.add(scan({ itemId: 'chip_bag', destination: 'uofa_landfill', diverted: false }));
    await store.add(scan({ faculty: "Arts'; DROP TABLE scans; --" })); // parameterised, so harmless
    const rows = await store.totals();
    const sci = rows.find((r) => r.faculty === 'Science')!;
    expect(sci).toMatchObject({ scans: 3, itemsDiverted: 2 });
    expect(sci.co2eKg).toBeCloseTo(2 * impactOf('pop_can', 'bottle_depot').co2eKg, 9);
    expect(rows.find((r) => r.faculty.startsWith('Arts'))?.scans).toBe(1);
    expect(await store.count()).toBe(4);
  });

  it('imports old JSON scans only into an empty table', async () => {
    expect(await store.importIfEmpty([scan()])).toBe(0); // not empty -> no import
  });

  it('works end to end through the API', async () => {
    const app = createApp({ dataFile: '/nonexistent/unused.json', store, logger: () => {} });
    const post = await request(app)
      .post('/api/scan')
      .send({ faculty: 'Engineering', itemId: 'pop_can', destination: 'bottle_depot', divertedFromLandfill: true });
    expect(post.status).toBe(201);
    const lb = await request(app).get('/api/leaderboard');
    expect(lb.body.faculties.find((r: { faculty: string }) => r.faculty === 'Engineering')).toMatchObject({ scans: 1, itemsDiverted: 1 });
  });
});

describe('PgStore when the database is unreachable', () => {
  it('the API answers 503 instead of crashing', async () => {
    const dead = new PgStore('postgres://nobody:wrong@127.0.0.1:1/none');
    const app = createApp({ dataFile: '/nonexistent/unused.json', store: dead, logger: () => {} });
    const lb = await request(app).get('/api/leaderboard');
    expect(lb.status).toBe(503);
    const post = await request(app)
      .post('/api/scan')
      .send({ faculty: 'Engineering', itemId: 'pop_can', destination: 'bottle_depot', divertedFromLandfill: true });
    expect(post.status).toBe(503);
    expect(lb.text + post.text).not.toContain('wrong');
    await dead.close();
  });
});
