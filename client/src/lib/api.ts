/**
 * Talks to the optional leaderboard backend. The app must work fully without it:
 * every call has a short timeout and resolves to a status instead of throwing.
 *
 * Scans that can't be sent (offline, server down) wait in a small outbox in
 * localStorage and are retried later, so demo scans made without Wi-Fi still count.
 */
import { load, save } from './storage';
import type { DestinationId } from '@tossguide/shared/rules/types';

export interface ScanPayload {
  faculty: string;
  itemId: string;
  destination: DestinationId;
  divertedFromLandfill: boolean;
}
export interface LeaderboardRow {
  faculty: string;
  itemsDiverted: number;
  co2eKg: number;
  scans: number;
}
export type Leaderboard = { status: 'ok'; rows: LeaderboardRow[] } | { status: 'offline' };

const OUTBOX_KEY = 'tossguide.outbox';
const OUTBOX_MAX = 50;
const TIMEOUT_MS = 4000;

const isPayloadList = (v: unknown): v is ScanPayload[] =>
  Array.isArray(v) && v.every((p) => p && typeof p === 'object' && typeof (p as ScanPayload).faculty === 'string');

async function fetchJson(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
  } finally {
    clearTimeout(t);
  }
}

/** Send one scan. 'sent' | 'queued' (network problem, will retry) | 'rejected' (server said no). */
async function send(p: ScanPayload): Promise<'sent' | 'queued' | 'rejected'> {
  try {
    const res = await fetchJson('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    if (res.ok) return 'sent';
    // 4xx other than rate limiting won't succeed on retry, so drop it.
    return res.status === 429 || res.status >= 500 ? 'queued' : 'rejected';
  } catch {
    return 'queued';
  }
}

let flushing = false;
/** Retry queued scans (oldest first). Stops at the first failure to keep order. */
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    let box = load(OUTBOX_KEY, [] as ScanPayload[], isPayloadList);
    while (box.length) {
      const r = await send(box[0]!);
      if (r === 'queued') break;
      box = box.slice(1);
      save(OUTBOX_KEY, box);
    }
  } finally {
    flushing = false;
  }
}

export async function postScan(p: ScanPayload): Promise<'sent' | 'queued' | 'rejected'> {
  await flushOutbox();
  const r = await send(p);
  if (r === 'queued') {
    const box = load(OUTBOX_KEY, [] as ScanPayload[], isPayloadList);
    save(OUTBOX_KEY, [...box, p].slice(-OUTBOX_MAX));
  }
  return r;
}

export function outboxSize(): number {
  return load(OUTBOX_KEY, [] as ScanPayload[], isPayloadList).length;
}

export async function getLeaderboard(): Promise<Leaderboard> {
  try {
    const res = await fetchJson('/api/leaderboard');
    if (!res.ok) return { status: 'offline' };
    const body = (await res.json()) as { faculties?: unknown };
    if (!Array.isArray(body.faculties)) return { status: 'offline' };
    const rows = body.faculties.filter(
      (r): r is LeaderboardRow =>
        !!r && typeof r.faculty === 'string' && Number.isFinite(r.itemsDiverted) && Number.isFinite(r.co2eKg),
    );
    return { status: 'ok', rows };
  } catch {
    return { status: 'offline' };
  }
}
