// BLIND holdout tests for the Express server (docs/API_CONTRACT.md "Server").
// Spec: POST /api/scan validated with zod, rate-limited per IP, JSON storage, GET /api/leaderboard per-faculty
// totals (starts empty, no seed data), GET /api/health; corrupted storage handled safely; secrets never in
// responses or logs.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { FACULTIES } from '@trashify/shared/faculties';

const SECRET = 'sk-test-SECRET-123';
process.env.FALLBACK_API_KEY = SECRET;

// Import after the env var is set, in case the module reads env at load time.
const { createApp } = await import('../../server/src/app');

const BIG_LIMIT = { windowMs: 60_000, max: 10_000 };
let tmpDir: string;
const logs: string[] = [];
const logger = (msg: string) => {
  logs.push(String(msg));
};

function tmpFile(): string {
  return path.join(tmpDir, `trashify-${crypto.randomUUID()}.json`);
}

function makeApp(dataFile = tmpFile(), rateLimit = BIG_LIMIT) {
  return createApp({ dataFile, rateLimit, logger });
}

const F0 = FACULTIES[0];
const F1 = FACULTIES[1] ?? FACULTIES[0];
const validScan = (over: Record<string, unknown> = {}) => ({
  faculty: F0,
  itemId: 'pop_can',
  destination: 'bottle_depot',
  divertedFromLandfill: true,
  ...over,
});

// Collect every response body text so we can check for leaked secrets at the end.
const bodies: string[] = [];
function record<T extends { text?: string; body?: unknown; headers?: Record<string, unknown> }>(res: T): T {
  bodies.push(String(res.text ?? ''), JSON.stringify(res.body ?? null), JSON.stringify(res.headers ?? {}));
  return res;
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trashify-blind-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('FACULTIES', () => {
  it('is a non-empty list of strings', () => {
    expect(Array.isArray(FACULTIES)).toBe(true);
    expect(FACULTIES.length).toBeGreaterThan(0);
    for (const f of FACULTIES) expect(typeof f).toBe('string');
  });
});

describe('GET /api/health', () => {
  it('returns 200 { ok: true }', async () => {
    const res = record(await request(makeApp()).get('/api/health'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('leaderboard', () => {
  it('starts empty (no seed data)', async () => {
    const res = record(await request(makeApp()).get('/api/leaderboard'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ faculties: [] });
  });

  it('a missing data file is treated as empty', async () => {
    const file = tmpFile();
    expect(fs.existsSync(file)).toBe(false);
    const res = record(await request(makeApp(file)).get('/api/leaderboard'));
    expect(res.status).toBe(200);
    expect(res.body.faculties).toEqual([]);
  });
});

describe('POST /api/scan', () => {
  it('valid scan -> 201 and the leaderboard reflects it', async () => {
    const app = makeApp();
    const post = record(await request(app).post('/api/scan').send(validScan()));
    expect(post.status).toBe(201);
    expect(post.body).toEqual({ ok: true });

    const lb = record(await request(app).get('/api/leaderboard'));
    expect(lb.status).toBe(200);
    expect(lb.body.faculties).toHaveLength(1);
    const row = lb.body.faculties[0];
    expect(row.faculty).toBe(F0);
    expect(row.scans).toBe(1);
    expect(row.itemsDiverted).toBe(1);
    expect(Number.isFinite(row.co2eKg)).toBe(true);
    expect(row.co2eKg).toBeGreaterThanOrEqual(0);
  });

  it('landfill scans count as scans but never as diverted (spec: never count landfill items)', async () => {
    const app = makeApp();
    record(
      await request(app)
        .post('/api/scan')
        .send(validScan({ faculty: F0, itemId: 'chip_bag', destination: 'uofa_landfill', divertedFromLandfill: false })),
    );
    const lb = record(await request(app).get('/api/leaderboard'));
    const row = lb.body.faculties.find((r: any) => r.faculty === F0);
    expect(row).toBeDefined();
    expect(row.scans).toBe(1);
    expect(row.itemsDiverted).toBe(0);
    expect(row.co2eKg).toBe(0);
  });

  it('leaderboard aggregates per faculty and sorts by itemsDiverted desc', async () => {
    if (FACULTIES.length < 2) return;
    const app = makeApp();
    // F1 gets 2 diverted, F0 gets 1
    for (const s of [validScan({ faculty: F0 }), validScan({ faculty: F1 }), validScan({ faculty: F1, itemId: 'plastic_bottle' })]) {
      const r = record(await request(app).post('/api/scan').send(s));
      expect(r.status).toBe(201);
    }
    const lb = record(await request(app).get('/api/leaderboard'));
    const rows = lb.body.faculties;
    expect(rows.map((r: any) => r.faculty)).toEqual([F1, F0]);
    expect(rows[0].itemsDiverted).toBe(2);
    expect(rows[0].scans).toBe(2);
    expect(rows[1].itemsDiverted).toBe(1);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].itemsDiverted).toBeGreaterThanOrEqual(rows[i].itemsDiverted);
  });

  it('persists to the JSON data file across app instances', async () => {
    const file = tmpFile();
    const r = record(await request(makeApp(file)).post('/api/scan').send(validScan()));
    expect(r.status).toBe(201);
    expect(fs.existsSync(file)).toBe(true);
    expect(() => JSON.parse(fs.readFileSync(file, 'utf8'))).not.toThrow();
    const lb = record(await request(makeApp(file)).get('/api/leaderboard'));
    expect(lb.body.faculties).toHaveLength(1);
    expect(lb.body.faculties[0].scans).toBe(1);
  });

  it('the stored data contains no image data or secrets', async () => {
    const file = tmpFile();
    record(await request(makeApp(file)).post('/api/scan').send(validScan()));
    const raw = fs.readFileSync(file, 'utf8');
    expect(raw).not.toContain(SECRET);
    expect(raw).not.toMatch(/data:image|base64/i);
  });

  const LONG = 'x'.repeat(5000);
  const invalid: [string, unknown][] = [
    ['empty object', {}],
    ['missing faculty', { itemId: 'pop_can', destination: 'bottle_depot', divertedFromLandfill: true }],
    ['missing itemId', { faculty: F0, destination: 'bottle_depot', divertedFromLandfill: true }],
    ['missing destination', { faculty: F0, itemId: 'pop_can', divertedFromLandfill: true }],
    ['missing divertedFromLandfill', { faculty: F0, itemId: 'pop_can', destination: 'bottle_depot' }],
    ['faculty wrong type', validScan({ faculty: 123 })],
    ['itemId wrong type', validScan({ itemId: ['pop_can'] })],
    ['destination wrong type', validScan({ destination: { id: 'bottle_depot' } })],
    ['divertedFromLandfill wrong type', validScan({ divertedFromLandfill: 'yes' })],
    ['unknown faculty', validScan({ faculty: 'Faculty of Wizardry' })],
    ['unknown itemId', validScan({ itemId: 'unobtainium' })],
    ['unknown destination', validScan({ destination: 'the_moon' })],
    ['extra-large faculty', validScan({ faculty: LONG })],
    ['extra-large itemId', validScan({ itemId: LONG })],
    ['extra-large destination', validScan({ destination: LONG })],
    ['null faculty', validScan({ faculty: null })],
    ['array body', [validScan()]],
  ];
  it.each(invalid)('%s -> 400 { ok: false, error }', async (_label, body) => {
    const app = makeApp();
    const res = record(await request(app).post('/api/scan').send(body as any));
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body).toHaveProperty('error');
    // nothing recorded
    const lb = record(await request(app).get('/api/leaderboard'));
    expect(lb.body.faculties).toEqual([]);
  });

  it('non-JSON body -> 400, no stack trace', async () => {
    const res = record(
      await request(makeApp()).post('/api/scan').set('Content-Type', 'application/json').send('{not json at all'),
    );
    expect(res.status).toBe(400);
    expect(res.text).not.toMatch(/at .*\.(ts|js):\d+/);
  });

  it('plain-text body -> 400', async () => {
    const res = record(await request(makeApp()).post('/api/scan').set('Content-Type', 'text/plain').send('hello'));
    expect(res.status).toBe(400);
  });

  it('does not echo request input back in errors as HTML (no reflected content)', async () => {
    const res = record(await request(makeApp()).post('/api/scan').send(validScan({ faculty: '<script>alert(1)</script>' })));
    expect(res.status).toBe(400);
    expect(res.headers['content-type'] ?? '').not.toMatch(/text\/html/);
  });
});

describe('rate limit', () => {
  it('returns 429 after max requests per IP', async () => {
    const app = makeApp(tmpFile(), { windowMs: 60_000, max: 3 });
    for (let i = 0; i < 3; i++) {
      const r = record(await request(app).post('/api/scan').send(validScan()));
      expect(r.status).toBe(201);
    }
    const blocked = record(await request(app).post('/api/scan').send(validScan()));
    expect(blocked.status).toBe(429);
    // blocked request must not be stored
    const lb = record(await request(app).get('/api/leaderboard'));
    if (lb.status === 200) expect(lb.body.faculties[0].scans).toBe(3);
  });
});

describe('corrupted storage', () => {
  const garbage: [string, string][] = [
    ['random garbage', '{{{ this is not json ]]] \u0000\u0001'],
    ['truncated JSON', '{"faculties": [{"faculty": "'],
    ['empty file', ''],
    ['JSON null', 'null'],
  ];
  it.each(garbage)('%s -> server starts, leaderboard 200 [], new scans work', async (_label, content) => {
    const file = tmpFile();
    fs.writeFileSync(file, content);
    let app: any;
    expect(() => {
      app = makeApp(file);
    }).not.toThrow();

    const lb = record(await request(app).get('/api/leaderboard'));
    expect(lb.status).toBe(200);
    expect(lb.body.faculties).toEqual([]);

    const post = record(await request(app).post('/api/scan').send(validScan()));
    expect(post.status).toBe(201);

    const lb2 = record(await request(app).get('/api/leaderboard'));
    expect(lb2.status).toBe(200);
    expect(lb2.body.faculties).toHaveLength(1);
    expect(lb2.body.faculties[0].scans).toBe(1);

    const health = record(await request(app).get('/api/health'));
    expect(health.status).toBe(200);
  });

  it('valid JSON of the wrong shape does not crash or produce NaN', async () => {
    const file = tmpFile();
    fs.writeFileSync(file, JSON.stringify({ faculties: 'oops', scans: [1, 2, 3], foo: { bar: NaN } }));
    const app = makeApp(file);
    const lb = record(await request(app).get('/api/leaderboard'));
    expect(lb.status).toBe(200);
    expect(Array.isArray(lb.body.faculties)).toBe(true);
    const post = record(await request(app).post('/api/scan').send(validScan()));
    expect(post.status).toBe(201);
    const lb2 = record(await request(app).get('/api/leaderboard'));
    expect(lb2.status).toBe(200);
    for (const row of lb2.body.faculties) {
      for (const k of ['itemsDiverted', 'co2eKg', 'scans']) {
        expect(Number.isFinite(row[k])).toBe(true);
        expect(row[k]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('secrets', () => {
  it('unknown routes do not leak secrets', async () => {
    const app = makeApp();
    record(await request(app).get('/api/does-not-exist'));
    record(await request(app).get('/.env'));
    record(await request(app).get('/api/health?debug=1'));
    record(await request(app).post('/api/scan').set('Content-Type', 'application/json').send('{"broken":'));
  });

  // Runs last within this file: checks everything collected above.
  it('no response body/header and no log message contains FALLBACK_API_KEY', () => {
    expect(bodies.length).toBeGreaterThan(0);
    for (const b of bodies) expect(b).not.toContain(SECRET);
    for (const m of logs) expect(m).not.toContain(SECRET);
  });
});
