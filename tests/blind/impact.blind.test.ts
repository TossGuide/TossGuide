// BLIND holdout tests for the impact tally (docs/API_CONTRACT.md "Impact", RESEARCH.md §6).
// Spec: count items correctly diverted from landfill + estimated CO2e; never count landfill items;
// no NaN or negative values.
import { describe, it, expect } from 'vitest';
import { EMPTY_TALLY, impactOf, addScan } from '@tossguide/shared/impact/impact';

const NOT_DIVERTED = ['edm_black_cart', 'uofa_landfill', 'check_local'] as const;
const DIVERTING = [
  ['pop_can', 'bottle_depot'],
  ['pop_can', 'edm_blue_bag'],
  ['pop_can', 'uofa_recyclables'],
  ['coffee_cup', 'edm_blue_bag'],
  ['napkin', 'edm_green_cart'],
  ['food_scraps', 'uofa_organics'],
  ['pizza_box', 'uofa_mixed_paper'],
  ['battery', 'eco_station'],
  ['battery', 'uofa_battery_bin'],
  ['plastic_bag', 'uofa_recyclables'],
] as const;

const finiteNonNeg = (n: number) => {
  expect(Number.isFinite(n)).toBe(true);
  expect(n).toBeGreaterThanOrEqual(0);
};

describe('EMPTY_TALLY', () => {
  it('is all zeros', () => {
    expect(EMPTY_TALLY).toEqual({ scans: 0, itemsDiverted: 0, co2eKg: 0 });
  });
});

describe('impactOf', () => {
  // Contract: landfill, black cart and check_local are never diverted; co2e 0 when not diverted
  it.each(NOT_DIVERTED)('%s is never diverted and adds 0 CO2e', (dest) => {
    for (const item of ['pop_can', 'coffee_cup', 'receipt', 'gum', 'chip_bag', 'napkin']) {
      const r = impactOf(item, dest as any);
      expect(r.diverted).toBe(false);
      expect(r.co2eKg).toBe(0);
    }
  });

  it.each(DIVERTING)('%s -> %s is diverted with finite CO2e >= 0', (item, dest) => {
    const r = impactOf(item, dest as any);
    expect(r.diverted).toBe(true);
    finiteNonNeg(r.co2eKg);
  });

  // RESEARCH.md §6: aluminum can 12.97 g (Aluminum Association / CMI via AL Circle) and EPA WARM v16
  // aluminum cans saving 9.15 MTCO2E/short ton = 10.09 kg CO2e/kg -> ~0.131 kg per can
  it('pop can to the bottle depot counts as diverted with CO2e > 0 (~0.13 kg)', () => {
    const r = impactOf('pop_can', 'bottle_depot');
    expect(r.diverted).toBe(true);
    expect(r.co2eKg).toBeGreaterThan(0);
    expect(r.co2eKg).toBeGreaterThan(0.12);
    expect(r.co2eKg).toBeLessThan(0.14);
  });

  it('pop can in the black cart is not diverted', () => {
    expect(impactOf('pop_can', 'edm_black_cart')).toEqual({ diverted: false, co2eKg: 0 });
  });

  it('unknown item or destination -> { diverted: false, co2eKg: 0 }', () => {
    expect(impactOf('not_a_thing', 'bottle_depot')).toEqual({ diverted: false, co2eKg: 0 });
    expect(impactOf('pop_can', 'not_a_bin' as any)).toEqual({ diverted: false, co2eKg: 0 });
    expect(impactOf('', '' as any)).toEqual({ diverted: false, co2eKg: 0 });
    expect(impactOf(undefined as any, undefined as any)).toEqual({ diverted: false, co2eKg: 0 });
    expect(impactOf(null as any, null as any)).toEqual({ diverted: false, co2eKg: 0 });
  });
});

describe('addScan', () => {
  it('is pure: does not mutate the input tally and returns a new object', () => {
    const t = Object.freeze({ scans: 2, itemsDiverted: 1, co2eKg: 0.5 });
    const next = addScan(t, 'pop_can', 'bottle_depot');
    expect(next).not.toBe(t);
    expect(t).toEqual({ scans: 2, itemsDiverted: 1, co2eKg: 0.5 });
    expect(next.scans).toBe(3);
    expect(next.itemsDiverted).toBe(2);
    expect(next.co2eKg).toBeGreaterThan(0.5);
  });

  it('does not mutate EMPTY_TALLY', () => {
    addScan(EMPTY_TALLY, 'pop_can', 'bottle_depot');
    expect(EMPTY_TALLY).toEqual({ scans: 0, itemsDiverted: 0, co2eKg: 0 });
  });

  it('increments scans for every call, diverted or not, known or not', () => {
    let t = EMPTY_TALLY;
    t = addScan(t, 'pop_can', 'bottle_depot');
    t = addScan(t, 'chip_bag', 'uofa_landfill');
    t = addScan(t, 'receipt', 'check_local');
    t = addScan(t, 'not_a_thing', 'nope' as any);
    t = addScan(t, 'mask', 'edm_black_cart');
    expect(t.scans).toBe(5);
    expect(t.itemsDiverted).toBe(1);
    finiteNonNeg(t.co2eKg);
  });

  it.each(NOT_DIVERTED)('%s adds nothing to itemsDiverted or co2eKg', (dest) => {
    const t = addScan(EMPTY_TALLY, 'pop_can', dest as any);
    expect(t).toEqual({ scans: 1, itemsDiverted: 0, co2eKg: 0 });
  });

  it('unknown inputs never produce NaN or negatives', () => {
    const weird: [unknown, unknown][] = [
      ['not_a_thing', 'bottle_depot'],
      ['pop_can', 'nope'],
      [undefined, undefined],
      [null, null],
      [42, {}],
      ['', ''],
      ['__proto__', 'constructor'],
    ];
    let t = EMPTY_TALLY;
    for (const [item, dest] of weird) {
      t = addScan(t, item as any, dest as any);
      expect(Number.isNaN(t.co2eKg)).toBe(false);
      finiteNonNeg(t.co2eKg);
      finiteNonNeg(t.itemsDiverted);
      finiteNonNeg(t.scans);
    }
    expect(t.scans).toBe(weird.length);
    expect(t.itemsDiverted).toBe(0);
    expect(t.co2eKg).toBe(0);
  });

  it('many repeated adds stay finite and accumulate correctly', () => {
    const one = impactOf('pop_can', 'bottle_depot').co2eKg;
    let t = EMPTY_TALLY;
    const N = 20000;
    for (let i = 0; i < N; i++) t = addScan(t, 'pop_can', 'bottle_depot');
    expect(t.scans).toBe(N);
    expect(t.itemsDiverted).toBe(N);
    finiteNonNeg(t.co2eKg);
    expect(Math.abs(t.co2eKg - one * N)).toBeLessThan(one * N * 0.01 + 1e-9);
  });
});
