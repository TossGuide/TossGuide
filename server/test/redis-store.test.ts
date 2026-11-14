// RedisStore against a tiny fake of the Upstash REST API (HINCRBY / HINCRBYFLOAT / HGETALL).
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { RedisStore, redisFromEnv } from '../src/redis-store';
import { createApp } from '../src/app';
import { impactOf } from '@tossguide/shared/impact/impact';

function fakeUpstash(opts: { fail?: boolean } = {}) {
  const hash = new Map<string, number>();
  const calls: { url: string; auth: string | null }[] = [];
  const run = (cmd: string[]) => {
    const [op, , field, by] = cmd as [string, string, string, string];
    if (op === 'HINCRBY' || op === 'HINCRBYFLOAT') {
      hash.set(field, (hash.get(field) ?? 0) + Number(by));
      return { result: String(hash.get(field)) };
    }
    if (op === 'HGETALL') return { result: [...hash].flatMap(([k, v]) => [k, String(v)]) };
    throw new Error(op);
  };
  const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, auth: new Headers(init.headers).get('Authorization') });
    if (opts.fail) return new Response('nope', { status: 500 });
    const body = JSON.parse(String(init.body));
    const out = url.endsWith('/multi-exec') ? (body as string[][]).map(run) : run(body);
    return new Response(JSON.stringify(out), { status: 200 });
  });
  return { fetch: fetchFn as unknown as typeof fetch, calls, hash };
}

const scan = (over = {}) => ({ faculty: 'Science', itemId: 'pop_can', destination: 'bottle_depot', diverted: true, ts: 1, ...over });

describe('RedisStore', () => {
  it('keeps per-faculty totals with CO2e from the shared impact module', async () => {
    const fake = fakeUpstash();
    const store = new RedisStore({ url: 'https://r.example/', token: 't0k', fetch: fake.fetch });
    await store.add(scan());
    await store.add(scan());
    await store.add(scan({ itemId: 'chip_bag', destination: 'uofa_landfill', diverted: false }));
    await store.add(scan({ faculty: 'Arts|Design' })); // a "|" in the name still parses
    const rows = await store.totals();
    const sci = rows.find((r) => r.faculty === 'Science')!;
    expect(sci).toMatchObject({ scans: 3, itemsDiverted: 2 });
    expect(sci.co2eKg).toBeCloseTo(2 * impactOf('pop_can', 'bottle_depot').co2eKg, 9);
    expect(rows.find((r) => r.faculty === 'Arts|Design')?.scans).toBe(1);
    expect(fake.calls.every((c) => c.auth === 'Bearer t0k')).toBe(true);
    expect(fake.calls[0]!.url).toBe('https://r.example/multi-exec');
  });

  it('ignores junk in the hash (no NaN, no negatives)', async () => {
    const fake = fakeUpstash();
    fake.hash.set('Law|scans', NaN).set('Law|co2e', -5).set('nofield', 3).set('Law|diverted', 1);
    const store = new RedisStore({ url: 'https://r.example', token: 't', fetch: fake.fetch });
    expect(await store.totals()).toEqual([]); // 0 scans -> not listed
  });

  it('the API answers 503 (not a crash, no token leak) when Redis is down', async () => {
    const fake = fakeUpstash({ fail: true });
    const app = createApp({ dataFile: '/nonexistent/x.json', store: new RedisStore({ url: 'https://r', token: 'SECRET-T', fetch: fake.fetch }), logger: () => {} });
    const post = await request(app).post('/api/scan').send({ faculty: 'Science', itemId: 'pop_can', destination: 'bottle_depot', divertedFromLandfill: true });
    expect(post.status).toBe(503);
    const lb = await request(app).get('/api/leaderboard');
    expect(lb.status).toBe(503);
    expect(post.text + lb.text).not.toContain('SECRET-T');
  });

  it('reads either env var naming scheme', () => {
    expect(redisFromEnv({})).toBeNull();
    expect(redisFromEnv({ KV_REST_API_URL: 'u', KV_REST_API_TOKEN: 't' })).toEqual({ url: 'u', token: 't' });
    expect(redisFromEnv({ UPSTASH_REDIS_REST_URL: 'u2', UPSTASH_REDIS_REST_TOKEN: 't2' })).toEqual({ url: 'u2', token: 't2' });
  });
});
