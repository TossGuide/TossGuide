import { describe, expect, it } from 'vitest';
import { countResult, EMPTY_TALLY_STATE, formatCo2, sanitize } from '../src/lib/tally';
import { impactOf } from '@tossguide/shared/impact/impact';

describe('countResult', () => {
  it('counts a diverted item and grows the streak', () => {
    const { state, diverted, replaced } = countResult(EMPTY_TALLY_STATE, 's1', 'pop_can', 'bottle_depot');
    expect(diverted).toBe(true);
    expect(replaced).toBe(false);
    expect(state).toMatchObject({ scans: 1, itemsDiverted: 1, streak: 1 });
    expect(state.co2eKg).toBeCloseTo(impactOf('pop_can', 'bottle_depot').co2eKg);
  });

  it('a landfill item counts as a scan, not diverted, and resets the streak', () => {
    let s = countResult(EMPTY_TALLY_STATE, 's1', 'pop_can', 'bottle_depot').state;
    s = countResult(s, 's2', 'chip_bag', 'uofa_landfill').state;
    expect(s).toMatchObject({ scans: 2, itemsDiverted: 1, streak: 0 });
  });

  it('a correction of the same scan replaces it instead of double counting', () => {
    let s = countResult(EMPTY_TALLY_STATE, 's1', 'pop_can', 'bottle_depot').state;
    const r = countResult(s, 's1', 'chip_bag', 'uofa_landfill');
    s = r.state;
    expect(r.replaced).toBe(true);
    expect(s).toMatchObject({ scans: 1, itemsDiverted: 0, co2eKg: 0, streak: 0 });
  });

  it('never goes negative or NaN from a corrupted stored state', () => {
    const bad = { scans: -5, itemsDiverted: NaN, co2eKg: 'lots', streak: Infinity, last: { scanId: 's1', itemId: 'pop_can', destinationId: 'bottle_depot' } };
    const { state } = countResult(bad as never, 's1', 'pop_can', 'bottle_depot');
    for (const k of ['scans', 'itemsDiverted', 'co2eKg', 'streak'] as const) {
      expect(Number.isFinite(state[k])).toBe(true);
      expect(state[k]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('sanitize / formatCo2', () => {
  it('turns garbage into an empty state', () => {
    expect(sanitize(null)).toEqual(EMPTY_TALLY_STATE);
    expect(sanitize({ last: { scanId: 1 } }).last).toBeNull();
  });
  it('formats grams and kilograms', () => {
    expect(formatCo2(0)).toBe('0 g');
    expect(formatCo2(0.1309)).toBe('131 g');
    expect(formatCo2(1.239)).toBe('1.24 kg');
    expect(formatCo2(NaN)).toBe('0 g');
  });
});

describe('migrateLegacyKeys (BinSight -> Trashify -> TossGuide renames)', () => {
  it('moves old keys to the new names once; the newest name wins; current data is never overwritten', async () => {
    const m = new Map<string, string>([
      ['binsight.tally', '{"scans":1}'],
      ['trashify.tally', '{"scans":3}'],
      ['binsight.context', '"uofa-campus"'],
      ['binsight.faculty', '"Science"'],
      ['tossguide.faculty', '"Arts"'],
      ['other', 'x'],
    ]);
    const ls = {
      get length() { return m.size; },
      key: (i: number) => [...m.keys()][i] ?? null,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
    (globalThis as any).localStorage = ls;
    const { migrateLegacyKeys } = await import('../src/lib/storage');
    migrateLegacyKeys();
    expect(m.get('tossguide.tally')).toBe('{"scans":3}'); // Trashify-era value beats BinSight-era
    expect(m.get('tossguide.context')).toBe('"uofa-campus"');
    expect(m.get('tossguide.faculty')).toBe('"Arts"');
    expect([...m.keys()].some((k) => /^(binsight|trashify)\./.test(k))).toBe(false);
    expect(m.get('other')).toBe('x');
    delete (globalThis as any).localStorage;
  });
});
