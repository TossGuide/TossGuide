import type { Context, Outcome, RuleNode } from './types';

/**
 * THE RULES TABLE.
 *
 * For each item and each context: either a final Outcome, or a yes/no question
 * ("contamination check") that branches to two outcomes.
 *
 * Every outcome cites sources (ids in sources.ts). Where official guidance does not
 * clearly cover an item we DO NOT guess: we use `unclear(...)`, which routes to the
 * "Check before you toss" destination and the UI tells the user where to check.
 *
 * Important context (see docs/RESEARCH.md):
 *  - On Oct 1, 2026 Alberta's Extended Producer Responsibility (EPR) program expanded
 *    Edmonton RESIDENTIAL recycling: to-go cups, takeout containers, foam, chip bags
 *    and all food wrappers are now accepted.
 *  - EPR covers the residential sector only. Campus (institutional) bins follow the
 *    University of Alberta's own 4-stream Zero Waste rules, which still send coffee
 *    cups, lids, chip bags and foam to Landfill. That's why the two contexts differ.
 */

// ---------- small helpers so each rule reads like a sentence ----------

const CITY_CHECK = 'Check the City’s WasteWise app or call 311 before you toss it.';
const CAMPUS_CHECK = 'Check the bin labels or email zerowaste@ualberta.ca.';

function unclear(reason: string, context: Context, sources: string[]): Outcome {
  return {
    destination: 'check_local',
    reason,
    prep: [context === 'uofa-campus' ? CAMPUS_CHECK : CITY_CHECK],
    // Always point to the official lookup tool for the user to check.
    sources: context === 'uofa-campus' ? sources : [...sources, 'edm_wastewise'],
    uncertain: true,
  };
}

/** Alberta deposit-bearing beverage containers, residential. */
function depot(what: string): Outcome {
  return {
    destination: 'bottle_depot',
    reason: `${what} carry an Alberta deposit: return them for a refund (10¢ for 1 L or less, 25¢ over 1 L).`,
    prep: ['Empty it'],
    sources: ['edm_recycling', 'bcmb_refunds'],
    alternative: {
      destination: 'edm_blue_bag',
      note: 'If you can’t get to a depot, the City says the blue bag is OK.',
    },
  };
}

/** Beverage containers on campus go in the Recyclables bin. */
function campusBeverage(what: string): Outcome {
  return {
    destination: 'uofa_recyclables',
    reason: `${what} go in the Recyclables bin at UofA Zero Waste Stations.`,
    prep: ['Empty it', 'Remove the cap'],
    sources: ['uofa_cheatsheet'],
    alternative: {
      destination: 'bottle_depot',
      note: 'Or take it home: it’s worth a deposit refund at any Alberta bottle depot.',
    },
  };
}

const blue = (
  reason: string,
  prep: string[] = ['Empty, clean and dry'],
  sources = ['edm_recycling'],
): Outcome => ({
  destination: 'edm_blue_bag',
  reason,
  prep,
  sources,
});
const green = (reason: string, prep: string[] = [], sources = ['edm_food_scraps']): Outcome => ({
  destination: 'edm_green_cart',
  reason,
  prep,
  sources,
});
const black = (reason: string, sources: string[], prep: string[] = []): Outcome => ({
  destination: 'edm_black_cart',
  reason,
  prep,
  sources,
});
const recyclables = (reason: string, prep: string[] = ['Empty and rinse it']): Outcome => ({
  destination: 'uofa_recyclables',
  reason,
  prep,
  sources: ['uofa_cheatsheet'],
});
const mixedPaper = (reason: string, prep: string[] = []): Outcome => ({
  destination: 'uofa_mixed_paper',
  reason,
  prep,
  sources: ['uofa_cheatsheet'],
});
const organics = (reason: string, prep: string[] = []): Outcome => ({
  destination: 'uofa_organics',
  reason,
  prep,
  sources: ['uofa_cheatsheet'],
});
const landfill = (reason: string, prep: string[] = []): Outcome => ({
  destination: 'uofa_landfill',
  reason,
  prep,
  sources: ['uofa_cheatsheet'],
});
/** Campus "is it clean?" check: UofA lists "Unclean recyclables" under Landfill. */
const campusIfClean = (cleanReason: string): RuleNode => ({
  ask: 'clean',
  yes: recyclables(cleanReason),
  no: landfill(
    'UofA sends unclean recyclables to Landfill: food residue contaminates the whole bag.',
  ),
});

// ---------- the table ----------

export const RULES: Record<string, Record<Context, RuleNode>> = {
  // ===== Beverage containers =====
  pop_can: {
    'edmonton-residential': depot('Pop cans'),
    'uofa-campus': campusBeverage('Pop cans'),
  },
  plastic_bottle: {
    'edmonton-residential': depot('Plastic drink bottles'),
    'uofa-campus': campusBeverage('Plastic drink bottles'),
  },
  glass_bottle: {
    'edmonton-residential': depot('Glass drink bottles'),
    'uofa-campus': campusBeverage('Glass drink bottles'),
  },
  juice_box: {
    'edmonton-residential': depot('Juice boxes'),
    'uofa-campus': campusBeverage('Juice boxes (Tetra Paks)'),
  },
  milk_carton: {
    'edmonton-residential': depot('Milk cartons and jugs'),
    'uofa-campus': campusBeverage('Milk jugs and cartons'),
  },

  // ===== Coffee & takeout =====
  coffee_cup: {
    'edmonton-residential': blue(
      'New since Oct 1, 2026: paper to-go cups are accepted in Edmonton recycling.',
      ['Empty it', 'Take the lid off: the lid goes in the blue bag separately'],
      ['edm_recycling', 'edm_epr'],
    ),
    'uofa-campus': landfill(
      'UofA lists coffee cups under Landfill (unless BPI-certified compostable). Campus bins don’t follow the new city rules.',
      ['Lid goes in Landfill too'],
    ),
  },
  coffee_lid: {
    'edmonton-residential': blue('Plastic cup lids go in the blue bag, separate from the cup.', [
      'Empty, clean and dry',
    ]),
    'uofa-campus': landfill('UofA lists plastic coffee/pop cup lids under Landfill.'),
  },
  cold_cup: {
    'edmonton-residential': blue(
      'Plastic to-go cups (like cold drink cups) are accepted in recycling.',
      ['Empty it', 'Keep the lid on'],
    ),
    'uofa-campus': unclear(
      'UofA’s guide sends cup lids and straws to Landfill but doesn’t say where clear plastic cups go.',
      'uofa-campus',
      ['uofa_cheatsheet'],
    ),
  },
  plastic_takeout: {
    'edmonton-residential': blue('Plastic takeout containers are accepted in recycling.', [
      'Scrape leftover food into the green cart',
      'Quick rinse and dry',
    ]),
    'uofa-campus': campusIfClean(
      'Clean plastic clamshells and containers go in Recyclables (but #3, #6 and #7 plastics go to Landfill).',
    ),
  },
  foam_container: {
    'edmonton-residential': blue(
      'New since Oct 1, 2026: foam takeout containers, cups and trays are accepted in recycling.',
      ['Empty, clean and dry', 'Remove absorbent pads and plastic wrap (garbage)'],
      ['edm_recycling', 'edm_eco_station'],
    ),
    'uofa-campus': landfill('UofA lists Styrofoam (#6 plastic) under Landfill.'),
  },
  paper_takeout: {
    'edmonton-residential': {
      ask: 'food_residue',
      yes: black(
        'The City asks for paper takeout containers with a lot of food residue that can’t be removed to go in the garbage.',
        ['edm_food_scraps'],
      ),
      no: blue(
        'Clean paper takeout containers go in recycling, not the food scraps cart (thick paper clogs the compost screens).',
        ['Empty, clean and dry'],
        ['edm_recycling', 'edm_food_scraps'],
      ),
    },
    'uofa-campus': organics('UofA Organics accepts paper and cardboard food containers.'),
  },
  pizza_box: {
    'edmonton-residential': {
      ask: 'greasy',
      yes: black(
        'Paper food packaging with lots of food residue that can’t be removed goes in the garbage. A few grease spots would be fine.',
        ['edm_food_scraps', 'edm_recycling'],
      ),
      no: blue('Pizza boxes are recyclable in Edmonton: some grease spots are OK.', [
        'Remove the liner and any food chunks (food goes in the green cart)',
        'Flatten it',
      ]),
    },
    'uofa-campus': {
      ask: 'greasy',
      yes: organics('UofA Organics accepts wet or soiled cardboard.'),
      no: mixedPaper('Clean, flattened cardboard goes in Mixed Paper.', ['Flatten it']),
    },
  },
  sandwich_wrap: {
    'edmonton-residential': blue(
      'Fast-food paper wraps (like sandwich wraps) are accepted in recycling.',
    ),
    'uofa-campus': organics('UofA Organics accepts parchment, waxed paper and paper sub wrappers.'),
  },
  plastic_utensil: {
    'edmonton-residential': unclear(
      'Edmonton’s updated list includes single-use cups and plates but doesn’t mention plastic cutlery.',
      'edmonton-residential',
      ['edm_recycling'],
    ),
    'uofa-campus': unclear(
      'UofA’s guide doesn’t list plastic cutlery (wooden stir sticks and chopsticks go in Organics).',
      'uofa-campus',
      ['uofa_cheatsheet'],
    ),
  },
  plastic_straw: {
    'edmonton-residential': unclear(
      'Edmonton’s list includes paper straws but doesn’t mention plastic straws.',
      'edmonton-residential',
      ['edm_recycling'],
    ),
    'uofa-campus': landfill('UofA lists straws under Landfill.'),
  },
  compostable_plastic: {
    'edmonton-residential': black(
      '“Compostable” plastics don’t break down in Edmonton’s compost process: the City asks for them in the garbage.',
      ['edm_food_scraps', 'edm_poster'],
    ),
    'uofa-campus': landfill(
      'UofA Organics takes no plastics (other than the bag), and #7 plastics aren’t accepted in Recyclables.',
    ),
  },

  // ===== Snacks & soft plastics =====
  chip_bag: {
    'edmonton-residential': blue(
      'New since Oct 1, 2026: all food bags, including chip bags, are accepted in recycling.',
      ['Empty it'],
      ['edm_recycling', 'edm_epr'],
    ),
    'uofa-campus': landfill('UofA lists chip bags under Landfill.'),
  },
  candy_wrapper: {
    'edmonton-residential': blue(
      'New since Oct 1, 2026: all food wrappers (candy and snack wrappers) are accepted in recycling.',
      ['Empty it'],
      ['edm_recycling', 'edm_epr'],
    ),
    'uofa-campus': landfill(
      'UofA lists granola bar wrappers (and similar wrappers) under Landfill.',
    ),
  },
  plastic_bag: {
    'edmonton-residential': blue('Shopping, bread and other plastic bags go in recycling.', [
      'Empty, clean and dry',
    ]),
    'uofa-campus': recyclables(
      'Clean plastic film (shopping bags, zipper bags) goes in Recyclables.',
      ['Make sure it’s empty and clean'],
    ),
  },
  plastic_wrap: {
    'edmonton-residential': blue(
      'Plastic overwrap, bubble wrap and food wrap are accepted in recycling.',
      ['Empty, clean and dry'],
    ),
    'uofa-campus': campusIfClean('Clean cling wrap and bubble wrap go in Recyclables.'),
  },
  yogurt_cup: {
    'edmonton-residential': blue(
      'Plastic tubs and food cups (yogurt, pudding) are accepted in recycling.',
      ['Empty it', 'Quick rinse and dry', 'Leave the lid on'],
    ),
    'uofa-campus': campusIfClean('Clean yogurt and margarine containers go in Recyclables.'),
  },

  // ===== Food & organics =====
  food_scraps: {
    'edmonton-residential': green(
      'All food scraps, including meat, bones, bread and leftovers, go in the green cart.',
    ),
    'uofa-campus': organics('Food scraps, including meat, bones and grains, go in Organics.'),
  },
  fruit_peel: {
    'edmonton-residential': green(
      'Fruit and vegetable peels, pits and cores go in the green cart.',
    ),
    'uofa-campus': organics('Fruit and vegetable scraps go in Organics.'),
  },
  coffee_grounds: {
    'edmonton-residential': green(
      'Coffee grounds, filters, loose tea and tea bags go in the green cart.',
    ),
    'uofa-campus': organics('Coffee grounds, tea bags and coffee filters go in Organics.'),
  },
  napkin: {
    'edmonton-residential': green('Food-soiled paper towels and napkins go in the green cart.'),
    'uofa-campus': organics('Paper towels and napkins go in Organics (not Mixed Paper).'),
  },
  tissue: {
    'edmonton-residential': unclear(
      'Edmonton lists napkins and paper towels for the green cart, but doesn’t clearly say where used facial tissue goes.',
      'edmonton-residential',
      ['edm_food_scraps', 'edm_recycling'],
    ),
    'uofa-campus': organics('UofA Organics accepts facial tissue.'),
  },

  // ===== Paper =====
  paper: {
    'edmonton-residential': blue('Computer and writing paper go in recycling.', []),
    'uofa-campus': mixedPaper('Printer and writing paper go in Mixed Paper.'),
  },
  newspaper: {
    'edmonton-residential': blue('Newspapers, flyers and magazines go in recycling.', []),
    'uofa-campus': mixedPaper('Newspapers and magazines go in Mixed Paper.'),
  },
  cardboard_box: {
    'edmonton-residential': blue('Flattened boxes go in recycling.', [
      'Flatten it',
      'Too big for the bag? Bundle with tape and put it under your blue bag',
    ]),
    'uofa-campus': mixedPaper('Flattened cardboard boxes go in Mixed Paper.', [
      'Flatten it (required)',
    ]),
  },
  paper_bag: {
    'edmonton-residential': blue('Paper bags go in recycling.', ['Empty it']),
    'uofa-campus': mixedPaper('Paper bags go in Mixed Paper.'),
  },
  egg_carton: {
    'edmonton-residential': blue('Egg cartons go in recycling.', ['Empty it']),
    'uofa-campus': mixedPaper('Egg cartons go in Mixed Paper.'),
  },
  receipt: {
    'edmonton-residential': unclear(
      'Receipts aren’t on Edmonton’s recycling or food scraps lists.',
      'edmonton-residential',
      ['edm_recycling', 'edm_food_scraps'],
    ),
    'uofa-campus': organics('UofA lists receipts under Organics (not Mixed Paper).'),
  },

  // ===== Metal & glass =====
  aluminum_foil: {
    'edmonton-residential': blue('Aluminum wrap and foil trays go in recycling.', [
      'Clean it',
      'Ball up foil wrap',
    ]),
    'uofa-campus': recyclables('Aluminum foil, pie plates and food containers go in Recyclables.'),
  },
  food_can: {
    'edmonton-residential': blue('Food cans go in recycling.', [
      'Empty and rinse',
      'Push the lid inside the can',
    ]),
    'uofa-campus': recyclables('Steel and tin food cans go in Recyclables.'),
  },
  glass_jar: {
    'edmonton-residential': blue('Glass food jars go in recycling.', [
      'Empty, clean and dry',
      'Remove the lid: it goes in recycling separately',
    ]),
    'uofa-campus': recyclables('Glass jars go in Recyclables.', [
      'Empty and rinse it',
      'Remove the cap',
    ]),
  },
  aerosol_can: {
    'edmonton-residential': blue('Empty aerosol cans go in recycling.', [
      'It must be completely empty',
    ]),
    'uofa-campus': recyclables('Empty, non-hazardous aerosol cans go in Recyclables.', [
      'It must be completely empty',
    ]),
  },

  // ===== Hazardous & electronics =====
  battery: {
    'edmonton-residential': {
      destination: 'eco_station',
      reason:
        'Batteries are household hazardous waste: drop them off free at an Eco Station. Never put them in recycling or garbage, where they can start fires.',
      prep: ['Keep it out of your carts and blue bag'],
      sources: ['edm_eco_station', 'edm_poster', 'edm_recycling'],
    },
    'uofa-campus': {
      ask: 'lithium',
      yes: {
        destination: 'uofa_special',
        reason:
          'Lithium-ion batteries never go in the campus dry-cell battery bins. Email zerowaste@ualberta.ca to arrange removal.',
        prep: [
          'Tape the terminals or put it in a plastic bag',
          'Damaged or swollen? Keep it in a plastic container',
        ],
        sources: ['uofa_how_to'],
      },
      no: {
        destination: 'uofa_battery_bin',
        reason: 'Alkaline, coin-cell and NiMH/NiCd batteries go in campus battery bins.',
        prep: ['9V or bigger: tape the positive terminal or bag it'],
        sources: ['uofa_how_to'],
      },
    },
  },
  phone: {
    'edmonton-residential': {
      destination: 'eco_station',
      reason: 'If it has a battery or a cord, it goes to an Eco Station (free).',
      prep: ['Wipe your data first'],
      sources: ['edm_eco_station', 'edm_poster'],
    },
    'uofa-campus': {
      destination: 'eco_station',
      reason:
        'Campus Zero Waste bins don’t take electronics. University-owned equipment goes through Surplus Services; take personal devices to an Eco Station.',
      prep: ['Wipe your data first'],
      sources: ['uofa_how_to', 'edm_eco_station'],
    },
  },
  cable: {
    'edmonton-residential': {
      destination: 'eco_station',
      reason:
        'If it has a battery or a cord, it goes to an Eco Station (free). Cords tangle sorting machines.',
      sources: ['edm_eco_station', 'edm_poster', 'edm_recycling'],
    },
    'uofa-campus': {
      destination: 'eco_station',
      reason:
        'Campus Zero Waste bins don’t take electronics. University-owned equipment goes through Surplus Services; take personal cables to an Eco Station.',
      sources: ['uofa_how_to', 'edm_eco_station'],
    },
  },

  // ===== Garbage & tricky =====
  pen: {
    'edmonton-residential': black(
      'Pens aren’t packaging, so they aren’t on the recycling list: worn-out plastic goods go in the garbage.',
      ['edm_poster', 'edm_curbside'],
    ),
    'uofa-campus': recyclables(
      'UofA accepts plastic pens and mechanical pencils in Recyclables. Some offices also have a “Pen Recycling” box.',
      ['Remove metal parts'],
    ),
  },
  mask: {
    'edmonton-residential': black('Masks and other hygiene items go in the garbage.', [
      'edm_poster',
    ]),
    'uofa-campus': landfill(
      'Masks aren’t accepted in Recyclables, Mixed Paper or Organics, so they go to Landfill.',
    ),
  },
  gloves: {
    'edmonton-residential': black('Disposable gloves are hygiene items: garbage.', ['edm_poster']),
    'uofa-campus': landfill('UofA lists latex gloves under Landfill.'),
  },
  gum: {
    'edmonton-residential': unclear(
      'Chewing gum isn’t on Edmonton’s food scraps or recycling lists.',
      'edmonton-residential',
      ['edm_food_scraps', 'edm_recycling'],
    ),
    'uofa-campus': landfill('UofA lists chewing gum under Landfill, not Organics.'),
  },
  k_cup: {
    'edmonton-residential': unclear(
      'Coffee pods mix plastic, foil and grounds, and Edmonton’s lists don’t mention them.',
      'edmonton-residential',
      ['edm_recycling', 'edm_food_scraps'],
    ),
    'uofa-campus': landfill('UofA lists K-Cups under Landfill.'),
  },
};
