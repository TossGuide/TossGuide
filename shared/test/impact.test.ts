import { describe, expect, it } from 'vitest';
import { addScan, EMPTY_TALLY, impactOf, EMISSION_SAVINGS_KG_PER_KG } from '../src/impact/impact';
import { FACULTIES } from '../src/faculties';

describe('impactOf()', () => {
  it('pop can to the depot: diverted, CO2e = 12.97 g × 10.09 kg/kg', () => {
    const r = impactOf('pop_can', 'bottle_depot');
    expect(r.diverted).toBe(true);
    expect(r.co2eKg).toBeCloseTo(0.01297 * 10.09, 6);
  });
  it('landfill / black cart / check_local are never diverted', () => {
    for (const d of ['edm_black_cart', 'uofa_landfill', 'check_local'] as const)
      expect(impactOf('pop_can', d)).toEqual({ diverted: false, co2eKg: 0 });
  });
  it('items with no measured weight count as diverted with 0 CO2e', () => {
    expect(impactOf('chip_bag', 'edm_blue_bag')).toEqual({ diverted: true, co2eKg: 0 });
  });
  it('only applies the recycling factor on recycling routes (not compost or Eco Station)', () => {
    expect(impactOf('pop_can', 'eco_station').co2eKg).toBe(0);
    expect(impactOf('pop_can', 'uofa_organics').co2eKg).toBe(0);
  });
  it('unknown inputs are safe', () => {
    expect(impactOf('nope', 'edm_blue_bag')).toEqual({ diverted: false, co2eKg: 0 });
    // @ts-expect-error runtime garbage
    expect(impactOf('pop_can', 'mars')).toEqual({ diverted: false, co2eKg: 0 });
  });
  it('factors are positive and finite', () => {
    for (const v of Object.values(EMISSION_SAVINGS_KG_PER_KG))
      expect(v > 0 && Number.isFinite(v)).toBe(true);
  });
});

describe('addScan()', () => {
  it('is pure and accumulates', () => {
    const t1 = addScan(EMPTY_TALLY, 'pop_can', 'bottle_depot');
    expect(EMPTY_TALLY).toEqual({ scans: 0, itemsDiverted: 0, co2eKg: 0 });
    const t2 = addScan(t1, 'coffee_cup', 'uofa_landfill');
    expect(t2.scans).toBe(2);
    expect(t2.itemsDiverted).toBe(1);
    expect(t2.co2eKg).toBeCloseTo(t1.co2eKg, 9);
  });
  it('repairs a corrupted tally instead of propagating NaN', () => {
    const t = addScan(
      { scans: Number.NaN, itemsDiverted: -5, co2eKg: Infinity } as never,
      'pop_can',
      'bottle_depot',
    );
    expect(t.scans).toBe(1);
    expect(t.itemsDiverted).toBe(1);
    expect(Number.isFinite(t.co2eKg) && t.co2eKg > 0).toBe(true);
  });
});

describe('FACULTIES', () => {
  it('is a non-empty unique list', () => {
    expect(FACULTIES.length).toBeGreaterThan(10);
    expect(new Set(FACULTIES).size).toBe(FACULTIES.length);
  });
});
