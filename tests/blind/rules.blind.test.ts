// BLIND holdout tests for the rules engine.
// Written only from docs/API_CONTRACT.md, docs/RESEARCH.md and the official sources cited there.
//
// Source shorthands used in comments:
//   EDM_RECYCLING   https://www.edmonton.ca/programs_services/garbage_waste/recycling
//   EDM_FOOD_SCRAPS https://www.edmonton.ca/programs_services/garbage_waste/food-scraps
//   EDM_ECO         https://www.edmonton.ca/programs_services/garbage_waste/eco-station-acceptable-items
//   EDM_POSTER      https://www.edmonton.ca/sites/default/files/public-files/assets/PDF/what-goes-where-poster-universal.pdf
//   UOFA_CHEAT      https://www.ualberta.ca/en/campus-operations-services/media-library/documents/waste-system-cheat-sheet-2021.pdf
//   UOFA_HOWTO      https://www.ualberta.ca/en/campus-operations-services/buildings-grounds/recycling/how-to-recycle.html
import { describe, it, expect } from 'vitest';
import { resolve, possibleDestinations, lookupTyped } from '@trashifyyeg/shared/rules/engine';
import { ITEMS, ITEMS_BY_ID } from '@trashifyyeg/shared/rules/items';

type Ctx = 'edmonton-residential' | 'uofa-campus';
const HOME: Ctx = 'edmonton-residential';
const CAMPUS: Ctx = 'uofa-campus';
const CONTEXTS: Ctx[] = [HOME, CAMPUS];

// Loose view of results so tests don't depend on exact type exports.
type AnyResult = any;

function final(itemId: string, ctx: Ctx, answers?: Record<string, boolean>): AnyResult {
  const r: AnyResult = resolve(itemId, ctx, answers as any);
  expect(r.ok, `${itemId}/${ctx} should be ok`).toBe(true);
  expect(r.status, `${itemId}/${ctx} ${JSON.stringify(answers ?? {})} should be final`).toBe('final');
  return r;
}

function destOf(itemId: string, ctx: Ctx, answers?: Record<string, boolean>): string {
  return final(itemId, ctx, answers).destination.id;
}

function itemIds(): string[] {
  return (ITEMS as any[]).map((i) => i.id ?? i.itemId);
}

/** Walk every answer combination an item can ask for, returning all final results. */
function allFinals(itemId: string, ctx: Ctx): { answers: Record<string, boolean>; result: AnyResult }[] {
  const out: { answers: Record<string, boolean>; result: AnyResult }[] = [];
  const walk = (answers: Record<string, boolean>, depth: number) => {
    expect(depth, `too many questions for ${itemId}/${ctx}`).toBeLessThan(6);
    const r: AnyResult = resolve(itemId, ctx, answers as any);
    expect(r.ok, `${itemId}/${ctx} ${JSON.stringify(answers)}`).toBe(true);
    if (r.status === 'needs_answer') {
      const q = r.question.id;
      expect(answers, `question ${q} asked again after being answered`).not.toHaveProperty(q);
      walk({ ...answers, [q]: true }, depth + 1);
      walk({ ...answers, [q]: false }, depth + 1);
    } else {
      expect(r.status).toBe('final');
      out.push({ answers, result: r });
    }
  };
  walk({}, 0);
  return out;
}

describe('items catalogue', () => {
  it('exposes the key item ids from the contract', () => {
    const ids = new Set(itemIds());
    for (const id of [
      'coffee_cup', 'coffee_lid', 'cold_cup', 'pizza_box', 'chip_bag', 'candy_wrapper', 'plastic_bag',
      'battery', 'pop_can', 'plastic_bottle', 'glass_bottle', 'juice_box', 'milk_carton', 'napkin',
      'food_scraps', 'fruit_peel', 'paper_takeout', 'plastic_takeout', 'foam_container', 'receipt',
      'tissue', 'gum', 'k_cup', 'phone', 'cable', 'pen', 'mask', 'compostable_plastic',
    ]) {
      expect(ids.has(id), id).toBe(true);
      expect(ITEMS_BY_ID[id as keyof typeof ITEMS_BY_ID], id).toBeDefined();
    }
  });
});

describe('to-go cups, lids, wrappers: EPR changed Edmonton homes on Oct 1 2026, campus unchanged', () => {
  // EDM_RECYCLING: "Paper to-go cups (example: coffee and fountain pop, remove lids and place separately in recycling)"
  // UOFA_CHEAT Landfill: "Coffee cups (unless BPI certified compostable)"
  it('coffee cup: blue bag at home, landfill on campus', () => {
    expect(destOf('coffee_cup', HOME)).toBe('edm_blue_bag');
    expect(destOf('coffee_cup', CAMPUS)).toBe('uofa_landfill');
  });

  // EDM_RECYCLING: lids go "separately in recycling"; UOFA_CHEAT: "NO plastic #3, #6 or #7 (Styrofoam, plastic coffee/pop cup lids ...)" -> Landfill
  it('coffee lid: blue bag at home, landfill on campus', () => {
    expect(destOf('coffee_lid', HOME)).toBe('edm_blue_bag');
    expect(destOf('coffee_lid', CAMPUS)).toBe('uofa_landfill');
  });

  // EDM_RECYCLING: "All food bags (example: chip bags, cereal bags, coffee bags)"; UOFA_CHEAT Landfill: "Chip bags, granola bar wrappers"
  it('chip bag: blue bag at home, landfill on campus', () => {
    expect(destOf('chip_bag', HOME)).toBe('edm_blue_bag');
    expect(destOf('chip_bag', CAMPUS)).toBe('uofa_landfill');
  });

  // EDM_RECYCLING: "All food wrappers (example: candy and snack wrappers, cheese wrap)"; UOFA_CHEAT Landfill: "granola bar wrappers"
  it('candy wrapper: blue bag at home, landfill on campus', () => {
    expect(destOf('candy_wrapper', HOME)).toBe('edm_blue_bag');
    expect(destOf('candy_wrapper', CAMPUS)).toBe('uofa_landfill');
  });

  // EDM_RECYCLING: "Foam take-out containers, cups, plates and bowls"; UOFA_CHEAT Landfill: "Styrofoam"
  it('foam container: blue bag at home, landfill on campus', () => {
    expect(destOf('foam_container', HOME)).toBe('edm_blue_bag');
    expect(destOf('foam_container', CAMPUS)).toBe('uofa_landfill');
  });
});

describe('plastic bags and film', () => {
  // EDM_RECYCLING: "Plastic bags: Shopping, bread, shipping and dry-cleaning bags"
  // UOFA_CHEAT Recyclables: "Clean plastic film - shopping bags, trash bags (any colour), zipper food bags"
  it('plastic bag: blue bag at home, recyclables on campus', () => {
    expect(destOf('plastic_bag', HOME)).toBe('edm_blue_bag');
    expect(destOf('plastic_bag', CAMPUS)).toBe('uofa_recyclables');
  });

  // UOFA_CHEAT: "clean cling wrap" -> Recyclables; "Unclean recyclables" -> Landfill
  it('plastic wrap on campus asks "clean" and routes both ways', () => {
    const q: AnyResult = resolve('plastic_wrap', CAMPUS);
    expect(q.ok).toBe(true);
    expect(q.status).toBe('needs_answer');
    expect(q.question.id).toBe('clean');
    expect(destOf('plastic_wrap', CAMPUS, { clean: true })).toBe('uofa_recyclables');
    expect(destOf('plastic_wrap', CAMPUS, { clean: false })).toBe('uofa_landfill');
  });

  // EDM_RECYCLING: "All plastic packaging is accepted in your recycling" (no clean question at home per contract)
  it('plastic wrap at home: blue bag without a question', () => {
    expect(destOf('plastic_wrap', HOME)).toBe('edm_blue_bag');
  });
});

describe('pizza box: greasy question in both contexts', () => {
  // Contract: pizza_box -> greasy (both contexts)
  it.each(CONTEXTS)('asks "greasy" when unanswered (%s)', (ctx) => {
    const r: AnyResult = resolve('pizza_box', ctx);
    expect(r.ok).toBe(true);
    expect(r.status).toBe('needs_answer');
    expect(r.question.id).toBe('greasy');
    expect(typeof r.question.text).toBe('string');
    expect(r.question.text.length).toBeGreaterThan(0);
    expect(r.itemId).toBe('pizza_box');
    expect(r.context).toBe(ctx);
  });

  // EDM_RECYCLING: "Pizza boxes (remove liner and any food chunks, some grease spots are ok)"
  it('home, clean -> blue bag', () => {
    expect(destOf('pizza_box', HOME, { greasy: false })).toBe('edm_blue_bag');
  });

  // EDM_FOOD_SCRAPS: thick paper takeout is not for the green cart; "If they have a lot of food residue
  // that can't be removed, such as sauces, please put them in the garbage."
  it('home, soaked with grease -> black cart (not the green cart)', () => {
    expect(destOf('pizza_box', HOME, { greasy: true })).toBe('edm_black_cart');
  });

  // UOFA_CHEAT Organics: "Wet or soiled cardboard/paper"
  it('campus, greasy -> organics', () => {
    expect(destOf('pizza_box', CAMPUS, { greasy: true })).toBe('uofa_organics');
  });

  // UOFA_CHEAT Mixed Paper: "Cardboard boxes (flattened)" (RESEARCH.md §4: clean -> Mixed Paper)
  it('campus, clean -> mixed paper', () => {
    expect(destOf('pizza_box', CAMPUS, { greasy: false })).toBe('uofa_mixed_paper');
  });

  it('possibleDestinations lists both outcomes', () => {
    expect(new Set(possibleDestinations('pizza_box', HOME))).toEqual(new Set(['edm_blue_bag', 'edm_black_cart']));
    expect(new Set(possibleDestinations('pizza_box', CAMPUS))).toEqual(new Set(['uofa_organics', 'uofa_mixed_paper']));
  });
});

describe('paper takeout with and without residue', () => {
  // EDM_FOOD_SCRAPS: "Please put these items in the recycling. They should be clean and empty. If they have a lot
  // of food residue that can't be removed, such as sauces, please put them in the garbage."
  it('home asks food_residue, then routes both ways', () => {
    const r: AnyResult = resolve('paper_takeout', HOME);
    expect(r.ok).toBe(true);
    expect(r.status).toBe('needs_answer');
    expect(r.question.id).toBe('food_residue');
    expect(destOf('paper_takeout', HOME, { food_residue: false })).toBe('edm_blue_bag');
    expect(destOf('paper_takeout', HOME, { food_residue: true })).toBe('edm_black_cart');
  });

  it('home never sends paper takeout to the green cart', () => {
    // EDM_FOOD_SCRAPS: "large or thick paper items, like takeout containers and paper cups, can cause problems."
    expect(possibleDestinations('paper_takeout', HOME)).not.toContain('edm_green_cart');
  });

  // UOFA_CHEAT Organics: "Paper/cardboard food containers"
  it('campus -> organics regardless of residue', () => {
    expect(destOf('paper_takeout', CAMPUS)).toBe('uofa_organics');
    expect(destOf('paper_takeout', CAMPUS, { food_residue: true })).toBe('uofa_organics');
    expect(destOf('paper_takeout', CAMPUS, { food_residue: false })).toBe('uofa_organics');
  });
});

describe('batteries', () => {
  // EDM_POSTER / EDM_RECYCLING: "If it has a battery or cord, it goes to an Eco Station."
  it('home -> Eco Station, no lithium question', () => {
    expect(destOf('battery', HOME)).toBe('eco_station');
    expect(destOf('battery', HOME, { lithium: true })).toBe('eco_station');
    expect(destOf('battery', HOME, { lithium: false })).toBe('eco_station');
  });

  // UOFA_HOWTO: battery bins for alkaline/NiMH etc; lithium-ion must never go in battery bins (email zerowaste@ualberta.ca)
  it('campus asks lithium and routes both ways', () => {
    const r: AnyResult = resolve('battery', CAMPUS);
    expect(r.ok).toBe(true);
    expect(r.status).toBe('needs_answer');
    expect(r.question.id).toBe('lithium');
    expect(destOf('battery', CAMPUS, { lithium: true })).toBe('uofa_special');
    expect(destOf('battery', CAMPUS, { lithium: false })).toBe('uofa_battery_bin');
  });

  it('battery never goes to a recycling/garbage bin in either context', () => {
    for (const ctx of CONTEXTS) {
      const reachable = possibleDestinations('battery', ctx);
      for (const bad of ['edm_blue_bag', 'edm_black_cart', 'uofa_recyclables', 'uofa_landfill']) {
        expect(reachable).not.toContain(bad);
      }
    }
  });
});

describe('refundable beverage containers', () => {
  const containers = ['pop_can', 'plastic_bottle', 'glass_bottle', 'juice_box', 'milk_carton'];

  // EDM_RECYCLING: "It's best to return beverage containers to a Bottle Depot for a refund. This includes beverage
  // bottles, cans, milk cartons, juice boxes and milk jugs. If this isn't an option, you can put them in your recycling."
  it.each(containers)('%s at home -> bottle depot, reason mentions a refund', (id) => {
    const r = final(id, HOME);
    expect(r.destination.id).toBe('bottle_depot');
    expect(r.reason).toMatch(/refund/i);
    expect(r.destination.divertsFromLandfill).toBe(true);
  });

  // Same quote: "If this isn't an option, you can put them in your recycling." (RESEARCH.md §2: alternative "blue bag")
  it.each(containers)('%s at home offers the blue bag as the alternative', (id) => {
    const r = final(id, HOME);
    expect(r.alternative?.destination?.id).toBe('edm_blue_bag');
  });

  // UOFA_CHEAT Recyclables / Beverage containers: "Juice, water, pop bottles", "Juice and pop cans",
  // "Tetra paks (juice boxes)", "Milk jugs or cartons"
  it.each(containers)('%s on campus -> recyclables', (id) => {
    expect(destOf(id, CAMPUS)).toBe('uofa_recyclables');
  });
});

describe('food and soiled paper', () => {
  // EDM_FOOD_SCRAPS: "Food-soiled paper towel and napkins"; UOFA_CHEAT Organics: "Paper towel/facial tissue/napkins"
  it('napkin: green cart at home, organics on campus', () => {
    expect(destOf('napkin', HOME)).toBe('edm_green_cart');
    expect(destOf('napkin', CAMPUS)).toBe('uofa_organics');
  });

  // EDM_FOOD_SCRAPS lists fruit/vegetable scraps, spoiled leftovers; UOFA_CHEAT Organics: "Fruit and vegetable scraps"
  it.each(['food_scraps', 'fruit_peel'])('%s: green cart at home, organics on campus', (id) => {
    expect(destOf(id, HOME)).toBe('edm_green_cart');
    expect(destOf(id, CAMPUS)).toBe('uofa_organics');
  });
});

describe('"compostable" plastic', () => {
  // EDM_FOOD_SCRAPS: "Please put all "compostable" plastics, including BPI/BNQ-certified into the garbage."
  // UOFA_CHEAT Organics: "NO plastics (other than the bag)"
  it('black cart at home, landfill on campus; never organics/green cart', () => {
    expect(destOf('compostable_plastic', HOME)).toBe('edm_black_cart');
    expect(destOf('compostable_plastic', CAMPUS)).toBe('uofa_landfill');
    expect(possibleDestinations('compostable_plastic', HOME)).not.toContain('edm_green_cart');
    expect(possibleDestinations('compostable_plastic', CAMPUS)).not.toContain('uofa_organics');
  });
});

describe('uncertain items -> check with the City, never a confident guess', () => {
  // Edmonton's recycling and food-scraps pages do not list receipts or chewing gum (RESEARCH.md §4 marks them uncertain).
  it.each(['receipt', 'gum'])('%s at home -> check_local, uncertain, not diverted, sourced', (id) => {
    const r = final(id, HOME);
    expect(r.destination.id).toBe('check_local');
    expect(r.uncertain).toBe(true);
    expect(r.destination.divertsFromLandfill).toBe(false);
    expect(r.sources.length).toBeGreaterThanOrEqual(1);
  });

  // UOFA_CHEAT Organics: "Receipts"; Landfill: "Chewing gum"
  it('campus has confident answers for receipt and gum', () => {
    const receipt = final('receipt', CAMPUS);
    expect(receipt.destination.id).toBe('uofa_organics');
    expect(receipt.uncertain).toBe(false);
    const gum = final('gum', CAMPUS);
    expect(gum.destination.id).toBe('uofa_landfill');
    expect(gum.uncertain).toBe(false);
  });
});

describe('campus vs residential differ', () => {
  // RESEARCH.md §3: "Campus ≠ home." EPR covers residential only.
  it.each(['coffee_cup', 'chip_bag', 'receipt'])('%s gets different destinations', (id) => {
    expect(destOf(id, HOME)).not.toBe(destOf(id, CAMPUS));
  });
});

describe('follow-up questions', () => {
  it('a missing answer yields needs_answer; supplying it yields final and changes the outcome', () => {
    const pending: AnyResult = resolve('pizza_box', HOME, {});
    expect(pending.status).toBe('needs_answer');
    expect(pending).not.toHaveProperty('destination');
    const yes = destOf('pizza_box', HOME, { [pending.question.id]: true });
    const no = destOf('pizza_box', HOME, { [pending.question.id]: false });
    expect(yes).not.toBe(no);
  });

  it('answers to questions an item does not ask are ignored', () => {
    // chip bag asks nothing
    const base = destOf('chip_bag', HOME);
    expect(destOf('chip_bag', HOME, { greasy: true, lithium: true, clean: false, food_residue: true })).toBe(base);
    // pizza box only asks greasy; extra answers don't change it
    expect(destOf('pizza_box', HOME, { greasy: false, lithium: true, food_residue: true })).toBe('edm_blue_bag');
    expect(destOf('pizza_box', CAMPUS, { greasy: true, clean: true })).toBe('uofa_organics');
    // battery at home asks nothing
    expect(destOf('battery', HOME, { lithium: true, greasy: true })).toBe('eco_station');
    // irrelevant answers don't satisfy a missing relevant one
    const r: AnyResult = resolve('battery', CAMPUS, { greasy: true, clean: true });
    expect(r.status).toBe('needs_answer');
    expect(r.question.id).toBe('lithium');
  });
});

describe('bad input never throws', () => {
  const bad: [string, unknown, unknown][] = [
    ['unknown id', 'definitely_not_an_item', HOME],
    ['empty string', '', HOME],
    ['undefined', undefined, HOME],
    ['null', null, HOME],
    ['number', 42, HOME],
    ['object', { id: 'pop_can' }, HOME],
    ['invalid context', 'pop_can', 'mars-base'],
    ['undefined context', 'pop_can', undefined],
  ];
  it.each(bad)('%s -> ok:false', (_label, id, ctx) => {
    let r: AnyResult = undefined;
    expect(() => {
      r = resolve(id as any, ctx as any);
    }).not.toThrow();
    expect(r.ok).toBe(false);
    expect(['unknown_item', 'invalid_context', 'empty_input']).toContain(r.error);
    expect(typeof r.message).toBe('string');
  });

  it('specific error codes', () => {
    expect((resolve('definitely_not_an_item', HOME) as AnyResult).error).toBe('unknown_item');
    expect((resolve('pop_can', 'mars-base' as any) as AnyResult).error).toBe('invalid_context');
  });

  it('possibleDestinations of an unknown id is []', () => {
    expect(possibleDestinations('definitely_not_an_item', HOME)).toEqual([]);
  });
});

describe('every item, every context, every answer combination', () => {
  for (const ctx of CONTEXTS) {
    it(`all final results are well-formed in ${ctx}`, () => {
      const ids = itemIds();
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        const finals = allFinals(id, ctx);
        expect(finals.length, id).toBeGreaterThan(0);
        const reached = new Set<string>();
        for (const { answers, result: r } of finals) {
          const label = `${id}/${ctx} ${JSON.stringify(answers)}`;
          expect(r.itemId, label).toBe(id);
          expect(r.context, label).toBe(ctx);
          // Contract: every final result has >= 1 source, each with an https:// URL
          expect(Array.isArray(r.sources), label).toBe(true);
          expect(r.sources.length, label).toBeGreaterThanOrEqual(1);
          for (const s of r.sources) expect(String(s.url), label).toMatch(/^https:\/\//);
          expect(typeof r.reason, label).toBe('string');
          expect(r.reason.trim().length, label).toBeGreaterThan(0);
          expect(Array.isArray(r.prep), label).toBe(true);
          // destination valid for this context
          expect(r.destination.contexts, label).toContain(ctx);
          // uncertain <-> check_local, and check_local never diverts
          expect(r.uncertain, label).toBe(r.destination.id === 'check_local');
          if (r.destination.id === 'check_local') expect(r.destination.divertsFromLandfill, label).toBe(false);
          // landfill streams never divert
          if (['edm_black_cart', 'uofa_landfill'].includes(r.destination.id)) {
            expect(r.destination.divertsFromLandfill, label).toBe(false);
          }
          if (r.alternative) expect(r.alternative.destination.contexts, label).toContain(ctx);
          reached.add(r.destination.id);
        }
        // possibleDestinations should match what's actually reachable
        expect(new Set(possibleDestinations(id, ctx)), `${id}/${ctx}`).toEqual(reached);
      }
    });
  }
});

describe('lookupTyped', () => {
  // Contract: typed input -> ranked candidates (score 0..1, best first); [] for empty input
  it('"battery" -> battery first', () => {
    const r = lookupTyped('battery');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].itemId).toBe('battery');
  });

  it('"coffee cup" -> coffee_cup first', () => {
    expect(lookupTyped('coffee cup')[0]?.itemId).toBe('coffee_cup');
  });

  it('empty input -> []', () => {
    expect(lookupTyped('')).toEqual([]);
    expect(lookupTyped('   ')).toEqual([]);
  });

  it('results are sorted best first with scores in 0..1', () => {
    const r = lookupTyped('pizza box');
    expect(r[0]?.itemId).toBe('pizza_box');
    for (let i = 0; i < r.length; i++) {
      expect(r[i].score).toBeGreaterThanOrEqual(0);
      expect(r[i].score).toBeLessThanOrEqual(1);
      if (i > 0) expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score);
    }
  });
});
