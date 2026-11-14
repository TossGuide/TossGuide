// Our own server tests (the blind suite in tests/blind/ covers the public contract).
// These pin down the extra behaviour we chose: consistency checks, CO2e from the
// shared impact module, rate-limit windows and atomic writes.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app';
import { impactOf } from '@tossguide/shared/impact/impact';
import { createRateLimiter } from '../src/rate-limit';
import { ScanStore } from '../src/store';

let dir: string;
let file: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tossguide-server-'));
  file = path.join(dir, 'scans.json');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const scan = (over: Record<string, unknown> = {}) => ({
  faculty: 'Engineering',
  itemId: 'pop_can',
  destination: 'bottle_depot',
  divertedFromLandfill: true,
  ...over,
});

describe('POST /api/scan consistency', () => {
  it('rejects a destination the rules never give for that item (no faking the leaderboard)', async () => {
    const res = await request(createApp({ dataFile: file })).post('/api/scan').send(scan({ destination: 'edm_green_cart' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('destination_not_possible_for_item');
  });

  it('rejects divertedFromLandfill that contradicts the destination', async () => {
    const app = createApp({ dataFile: file });
    const r1 = await request(app).post('/api/scan').send(scan({ divertedFromLandfill: false }));
    expect(r1.status).toBe(400);
    const r2 = await request(app)
      .post('/api/scan')
      .send(scan({ itemId: 'chip_bag', destination: 'uofa_landfill', divertedFromLandfill: true }));
    expect(r2.status).toBe(400);
  });

  it('accepts check_local for uncertain items and does not count it as diverted', async () => {
    const app = createApp({ dataFile: file });
    const r = await request(app)
      .post('/api/scan')
      .send(scan({ itemId: 'receipt', destination: 'check_local', divertedFromLandfill: false }));
    expect(r.status).toBe(201);
    const lb = await request(app).get('/api/leaderboard');
    expect(lb.body.faculties[0]).toMatchObject({ scans: 1, itemsDiverted: 0, co2eKg: 0 });
  });
});

describe('GET /api/leaderboard', () => {
  it('computes CO2e with the shared impact module (server never trusts a client number)', async () => {
    const app = createApp({ dataFile: file });
    await request(app).post('/api/scan').send(scan());
    await request(app).post('/api/scan').send(scan());
    const lb = await request(app).get('/api/leaderboard');
    const expected = 2 * impactOf('pop_can', 'bottle_depot').co2eKg;
    expect(lb.body.faculties[0].co2eKg).toBeCloseTo(expected, 9);
    expect(expected).toBeGreaterThan(0); // pop can has a cited weight
  });

  it('ties are broken by scans, then by name, so the order is stable', async () => {
    const app = createApp({ dataFile: file });
    await request(app).post('/api/scan').send(scan({ faculty: 'Science' }));
    await request(app).post('/api/scan').send(scan({ faculty: 'Arts' }));
    await request(app)
      .post('/api/scan')
      .send(scan({ faculty: 'Science', itemId: 'chip_bag', destination: 'uofa_landfill', divertedFromLandfill: false }));
    const names = (await request(app).get('/api/leaderboard')).body.faculties.map((r: { faculty: string }) => r.faculty);
    expect(names).toEqual(['Science', 'Arts']);
  });

  it('is never cached by the browser or service worker', async () => {
    const lb = await request(createApp({ dataFile: file })).get('/api/leaderboard');
    expect(lb.headers['cache-control']).toMatch(/no-store/);
  });
});

describe('errors', () => {
  it('unknown API routes give a JSON 404', async () => {
    const res = await request(createApp({ dataFile: file })).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: 'not_found' });
  });

  it('a huge body is rejected with 413, not a crash', async () => {
    const res = await request(createApp({ dataFile: file }))
      .post('/api/scan')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ ...scan(), pad: 'x'.repeat(50_000) }));
    expect(res.status).toBe(413);
    expect(res.body.ok).toBe(false);
  });

  it('logs requests through the injected logger without bodies', async () => {
    const logs: string[] = [];
    const app = createApp({ dataFile: file, logger: (m) => logs.push(m) });
    await request(app).post('/api/scan').send(scan());
    expect(logs.some((l) => l.includes('POST /api/scan 201'))).toBe(true);
    expect(logs.join('\n')).not.toContain('Engineering');
  });
});

describe('rate limiter', () => {
  it('allows max per window per key, then resets after the window', () => {
    let now = 0;
    const limit = createRateLimiter({ windowMs: 1000, max: 2 }, () => now);
    expect([limit('a'), limit('a'), limit('a')]).toEqual([true, true, false]);
    expect(limit('b')).toBe(true); // separate key
    now = 1001;
    expect(limit('a')).toBe(true);
  });
});

describe('ScanStore', () => {
  it('drops malformed records from a hand-edited file but keeps the good ones', () => {
    fs.writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        scans: [
          { faculty: 'Arts', itemId: 'pop_can', destination: 'bottle_depot', diverted: true, ts: 1 },
          { faculty: 'Arts', itemId: 'pop_can', destination: 'bottle_depot', diverted: 'yes', ts: 2 },
          null,
        ],
      }),
    );
    expect(new ScanStore(file).all()).toHaveLength(1);
  });

  it('writes atomically (no temp files left behind) and creates the folder', () => {
    const nested = path.join(dir, 'a', 'b', 'scans.json');
    const store = new ScanStore(nested);
    store.add({ faculty: 'Arts', itemId: 'pop_can', destination: 'bottle_depot', diverted: true, ts: 1 });
    expect(fs.readdirSync(path.dirname(nested))).toEqual(['scans.json']);
  });

  it('keeps working in memory if the disk write fails', () => {
    const store = new ScanStore(file);
    const spy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('disk full');
    });
    expect(() =>
      store.add({ faculty: 'Arts', itemId: 'pop_can', destination: 'bottle_depot', diverted: true, ts: 1 }),
    ).not.toThrow();
    spy.mockRestore();
    expect(store.all()).toHaveLength(1);
  });
});
