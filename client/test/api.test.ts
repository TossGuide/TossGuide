import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal in-memory localStorage for the node test environment.
class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

const payload = { faculty: 'Science', itemId: 'pop_can', destination: 'bottle_depot' as const, divertedFromLandfill: true };

describe('api', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('localStorage', new MemStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('queues a scan when the backend is unreachable, then flushes it later', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network'));
    vi.stubGlobal('fetch', fetchMock);
    const api = await import('../src/lib/api');
    expect(await api.postScan(payload)).toBe('queued');
    expect(api.outboxSize()).toBe(1);

    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 201 }));
    await api.flushOutbox();
    expect(api.outboxSize()).toBe(0);
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).toEqual(payload);
  });

  it('drops a scan the server rejects as invalid (retrying would never work)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 400 })));
    const api = await import('../src/lib/api');
    expect(await api.postScan(payload)).toBe('rejected');
    expect(api.outboxSize()).toBe(0);
  });

  it('leaderboard: offline on network error, bad JSON or bad shape', async () => {
    const api = await import('../src/lib/api');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('x')));
    expect(await api.getLeaderboard()).toEqual({ status: 'offline' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })));
    expect(await api.getLeaderboard()).toEqual({ status: 'offline' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"faculties":"x"}', { status: 200 })));
    expect(await api.getLeaderboard()).toEqual({ status: 'offline' });
  });

  it('leaderboard: filters malformed rows', async () => {
    const body = { faculties: [{ faculty: 'Arts', itemsDiverted: 2, co2eKg: 0.1, scans: 2 }, { faculty: 3 }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));
    const api = await import('../src/lib/api');
    const lb = await api.getLeaderboard();
    expect(lb.status === 'ok' && lb.rows.map((r) => r.faculty)).toEqual(['Arts']);
  });
});
