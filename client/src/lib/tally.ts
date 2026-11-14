/**
 * Personal impact tally, kept on this device (localStorage, never throws).
 *
 * One scan counts once. If the user corrects a result ("Not right?" → picks the real
 * item, or flips Home/Campus), the same scan is re-counted with the new destination
 * instead of being added twice, so the tally can't be inflated by tapping around.
 */
import { addScan, EMPTY_TALLY, impactOf, type Tally } from '@binsight/shared/impact/impact';
import type { DestinationId } from '@binsight/shared/rules/types';

export interface TallyState extends Tally {
  /** The scan most recently counted, so a correction can replace it. */
  last: { scanId: string; itemId: string; destinationId: DestinationId } | null;
  /** Consecutive diverted items (drives the streak melody). */
  streak: number;
}

export const EMPTY_TALLY_STATE: TallyState = { ...EMPTY_TALLY, last: null, streak: 0 };

const nonNeg = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);

/** Repair anything odd from storage (hand edits, old versions) into a valid state. */
export function sanitize(v: unknown): TallyState {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const last = o.last as TallyState['last'];
  return {
    scans: Math.floor(nonNeg(o.scans)),
    itemsDiverted: Math.floor(nonNeg(o.itemsDiverted)),
    co2eKg: nonNeg(o.co2eKg),
    streak: Math.floor(nonNeg(o.streak)),
    last:
      last && typeof last.scanId === 'string' && typeof last.itemId === 'string' && typeof last.destinationId === 'string'
        ? last
        : null,
  };
}

/**
 * Count a final result. Returns the new state and whether this scan was a correction
 * of the previous one (same scanId) rather than a new scan.
 */
export function countResult(
  prev: TallyState,
  scanId: string,
  itemId: string,
  destinationId: DestinationId,
): { state: TallyState; replaced: boolean; diverted: boolean } {
  let base: TallyState = sanitize(prev);
  let streak = base.streak;
  const replaced = base.last?.scanId === scanId;
  if (replaced && base.last) {
    // Undo the previous version of this scan.
    const old = impactOf(base.last.itemId, base.last.destinationId);
    base = {
      ...base,
      scans: Math.max(0, base.scans - 1),
      itemsDiverted: Math.max(0, base.itemsDiverted - (old.diverted ? 1 : 0)),
      co2eKg: Math.max(0, base.co2eKg - old.co2eKg),
    };
    if (old.diverted) streak = Math.max(0, streak - 1);
  }
  const t = addScan(base, itemId, destinationId);
  const { diverted } = impactOf(itemId, destinationId);
  return {
    state: { ...t, last: { scanId, itemId, destinationId }, streak: diverted ? streak + 1 : 0 },
    replaced,
    diverted,
  };
}

/** "131 g" under 1 kg, "1.24 kg" above: grams read better for a handful of cans. */
export function formatCo2(kg: number): string {
  const v = nonNeg(kg);
  return v < 1 ? `${Math.round(v * 1000)} g` : `${v.toFixed(2)} kg`;
}
