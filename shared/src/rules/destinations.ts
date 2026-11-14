import type { Destination, DestinationId, Question, QuestionId } from './types';

/**
 * Destination names and colours follow the official programs:
 *  - Edmonton curbside: "see-through blue bags" (recycling), "green food scraps cart",
 *    "black garbage cart" (edmonton.ca curbside collection page).
 *  - UofA Zero Waste Stations: Recyclables (blue), Organics (green), Mixed Paper
 *    (orange/yellow), Landfill (black), per the UofA 4-stream cheat sheet.
 */
export const DESTINATIONS: Record<DestinationId, Destination> = {
  edm_blue_bag: {
    id: 'edm_blue_bag',
    name: 'Recycling (blue bag)',
    shortName: 'Blue bag',
    colour: 'blue',
    icon: 'recycle',
    divertsFromLandfill: true,
    contexts: ['edmonton-residential'],
  },
  edm_green_cart: {
    id: 'edm_green_cart',
    name: 'Food scraps (green cart)',
    shortName: 'Green cart',
    colour: 'green',
    icon: 'food',
    divertsFromLandfill: true,
    contexts: ['edmonton-residential'],
  },
  edm_black_cart: {
    id: 'edm_black_cart',
    name: 'Garbage (black cart)',
    shortName: 'Black cart',
    colour: 'black',
    icon: 'trash',
    divertsFromLandfill: false,
    contexts: ['edmonton-residential'],
  },
  bottle_depot: {
    id: 'bottle_depot',
    name: 'Bottle depot (refund)',
    shortName: 'Bottle depot',
    colour: 'teal',
    icon: 'bottle',
    divertsFromLandfill: true,
    contexts: ['edmonton-residential', 'uofa-campus'],
  },
  eco_station: {
    id: 'eco_station',
    name: 'Eco Station drop-off',
    shortName: 'Eco Station',
    colour: 'orange',
    icon: 'hazard',
    divertsFromLandfill: true,
    contexts: ['edmonton-residential', 'uofa-campus'],
  },
  uofa_recyclables: {
    id: 'uofa_recyclables',
    name: 'Recyclables (blue bin)',
    shortName: 'Recyclables',
    colour: 'blue',
    icon: 'recycle',
    divertsFromLandfill: true,
    contexts: ['uofa-campus'],
  },
  uofa_mixed_paper: {
    id: 'uofa_mixed_paper',
    name: 'Mixed Paper (yellow bin)',
    shortName: 'Mixed Paper',
    colour: 'yellow',
    icon: 'paper',
    divertsFromLandfill: true,
    contexts: ['uofa-campus'],
  },
  uofa_organics: {
    id: 'uofa_organics',
    name: 'Organics (green bin)',
    shortName: 'Organics',
    colour: 'green',
    icon: 'food',
    divertsFromLandfill: true,
    contexts: ['uofa-campus'],
  },
  uofa_landfill: {
    id: 'uofa_landfill',
    name: 'Landfill (black bin)',
    shortName: 'Landfill',
    colour: 'black',
    icon: 'trash',
    divertsFromLandfill: false,
    contexts: ['uofa-campus'],
  },
  uofa_battery_bin: {
    id: 'uofa_battery_bin',
    name: 'Campus battery bin',
    shortName: 'Battery bin',
    colour: 'orange',
    icon: 'battery',
    divertsFromLandfill: true,
    contexts: ['uofa-campus'],
  },
  uofa_special: {
    id: 'uofa_special',
    name: 'Special handling (contact Zero Waste)',
    shortName: 'Special',
    colour: 'orange',
    icon: 'hazard',
    divertsFromLandfill: true,
    contexts: ['uofa-campus'],
  },
  check_local: {
    id: 'check_local',
    name: 'Check before you toss',
    shortName: 'Check',
    colour: 'grey',
    icon: 'question',
    // Unknown destinations are never counted as "diverted".
    divertsFromLandfill: false,
    contexts: ['edmonton-residential', 'uofa-campus'],
  },
};

export const QUESTIONS: Record<QuestionId, Question> = {
  greasy: {
    id: 'greasy',
    text: 'Is it soaked with grease or food that won’t come off?',
    hint: 'A few grease spots don’t count.',
  },
  food_residue: {
    id: 'food_residue',
    text: 'Is there food or sauce stuck on it that you can’t scrape or rinse off?',
  },
  clean: {
    id: 'clean',
    text: 'Is it empty and rinsed clean?',
  },
  lithium: {
    id: 'lithium',
    text: 'Is it a lithium-ion battery (phone, laptop, vape, power bank)?',
    hint: 'Regular AA/AAA/9V and coin cells are “No”.',
  },
};
