/**
 * Impact tally: items kept out of landfill and an ESTIMATED CO2e saving.
 *
 * Factors: US EPA WARM v16 (Dec 2023) net emissions, landfilling minus recycling
 * (or composting for food), converted to kg CO2e saved per kg of material.
 * Derivation and links: docs/RESEARCH.md §6. Materials with no WARM recycling
 * factor (film, foam, cartons) and items with no measured weight add 0 kg. That
 * understates impact, which is the honest direction for an estimate.
 */
import { DESTINATIONS } from '../rules/destinations';
import { getItem } from '../rules/items';
import type { DestinationId, Material } from '../rules/types';

/** kg CO2e saved per kg diverted (WARM v16, see RESEARCH.md §6). */
export const EMISSION_SAVINGS_KG_PER_KG: Partial<Record<Material, number>> = {
  aluminum: 10.09, // aluminum cans: 0.02 - (-9.13) MTCO2E/short ton
  steel: 2.04, // steel cans: 0.02 - (-1.83)
  glass: 0.33, // 0.02 - (-0.28)
  pet: 1.17, // 0.02 - (-1.04)
  hdpe: 0.86, // 0.02 - (-0.76)
  mixed_plastic: 1.05, // 0.02 - (-0.93)
  corrugated: 3.66, // 0.18 - (-3.14)
  mixed_paper: 3.99, // mixed paper (general): 0.07 - (-3.55)
  food: 0.72, // food waste, composted: 0.50 - (-0.15)
};

/** Which destinations are recycling routes vs compost routes, so the right factor applies. */
const RECYCLING_ROUTES: ReadonlySet<DestinationId> = new Set([
  'edm_blue_bag',
  'bottle_depot',
  'uofa_recyclables',
  'uofa_mixed_paper',
]);
const COMPOST_ROUTES: ReadonlySet<DestinationId> = new Set(['edm_green_cart', 'uofa_organics']);

export interface Tally {
  scans: number;
  itemsDiverted: number;
  co2eKg: number;
}
export const EMPTY_TALLY: Readonly<Tally> = Object.freeze({
  scans: 0,
  itemsDiverted: 0,
  co2eKg: 0,
});

export function impactOf(
  itemId: string,
  destinationId: DestinationId,
): { diverted: boolean; co2eKg: number } {
  const item = getItem(itemId);
  const dest = Object.prototype.hasOwnProperty.call(DESTINATIONS, destinationId)
    ? DESTINATIONS[destinationId]
    : undefined;
  if (!item || !dest || !dest.divertsFromLandfill) return { diverted: false, co2eKg: 0 };

  const factor = EMISSION_SAVINGS_KG_PER_KG[item.material];
  const routeOk =
    item.material === 'food'
      ? COMPOST_ROUTES.has(destinationId)
      : RECYCLING_ROUTES.has(destinationId);
  if (!factor || !routeOk || item.weightG === null || !(item.weightG > 0))
    return { diverted: true, co2eKg: 0 };
  return { diverted: true, co2eKg: (item.weightG / 1000) * factor };
}

/** Non-negative finite number, or 0. Protects the tally from corrupted localStorage. */
const safe = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);

export function addScan(tally: Tally, itemId: string, destinationId: DestinationId): Tally {
  const { diverted, co2eKg } = impactOf(itemId, destinationId);
  return {
    scans: Math.floor(safe(tally?.scans)) + 1,
    itemsDiverted: Math.floor(safe(tally?.itemsDiverted)) + (diverted ? 1 : 0),
    co2eKg: safe(tally?.co2eKg) + co2eKg,
  };
}
