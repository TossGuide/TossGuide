/**
 * Fixed-window rate limiter, per key (the client IP). In memory on purpose: one small
 * server process at a hackathon doesn't need Redis, and a restart forgiving everyone
 * is fine. Returns true if the request is allowed.
 */
export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export function createRateLimiter(opts: RateLimitOptions, now: () => number = Date.now) {
  const hits = new Map<string, { start: number; count: number }>();
  return function allow(key: string): boolean {
    const t = now();
    const w = hits.get(key);
    if (!w || t - w.start >= opts.windowMs) {
      hits.set(key, { start: t, count: 1 });
      // Opportunistic cleanup so the map can't grow forever.
      if (hits.size > 10_000) for (const [k, v] of hits) if (t - v.start >= opts.windowMs) hits.delete(k);
      return true;
    }
    w.count++;
    return w.count <= opts.max;
  };
}
