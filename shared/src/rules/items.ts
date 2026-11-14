import type { ItemType } from './types';

/**
 * The item vocabulary: everything Trashify can recognise.
 *
 * `prompts` are what the zero-shot vision model compares a photo against. Each
 * item gets several phrasings because CLIP-style models are sensitive to wording;
 * the classifier aggregates scores across an item's prompts (see shared/src/ml/aggregate.ts).
 *
 * Weights: only filled in when we have a cited or measured value. The team weighs
 * the demo props at the venue (see PROGRESS.md); until then weightG is null and the
 * item adds 0 g to the CO2e estimate (it still counts as an item diverted).
 */
export const ITEMS: readonly ItemType[] = [
  // ---------- Beverage containers (Alberta deposit) ----------
  {
    id: 'pop_can',
    name: 'Pop can',
    prompts: [
      'a photo of an aluminum pop can',
      'a photo of a soda can',
      'a photo of an empty crushed aluminum can',
      'a photo of a can of pop on a table',
    ],
    aliases: [
      'can',
      'soda can',
      'pop',
      'soda',
      'beer can',
      'energy drink',
      'aluminum can',
      'coke can',
    ],
    material: 'aluminum',
    // Aluminum Association / Can Manufacturers Institute: average can weighs 12.97 g.
    weightG: 12.97,
    weightSource: 'Aluminum Association & CMI average can weight (via AL Circle report)',
  },
  {
    id: 'plastic_bottle',
    name: 'Plastic drink bottle',
    prompts: [
      'a photo of a plastic water bottle',
      'a photo of a plastic pop bottle',
      'a photo of a clear plastic drink bottle with a cap',
      'a photo of an empty plastic bottle lying on its side',
    ],
    aliases: [
      'water bottle',
      'pop bottle',
      'soda bottle',
      'plastic bottle',
      'gatorade',
      'juice bottle',
    ],
    material: 'pet',
    weightG: null,
  },
  {
    id: 'glass_bottle',
    name: 'Glass drink bottle',
    prompts: [
      'a photo of a glass beer bottle',
      'a photo of a glass drink bottle',
      'a photo of a glass juice bottle',
    ],
    aliases: ['beer bottle', 'wine bottle', 'glass bottle', 'kombucha bottle'],
    material: 'glass',
    weightG: null,
  },
  {
    id: 'juice_box',
    name: 'Juice box',
    prompts: [
      'a photo of a juice box with a straw',
      'a photo of a small drink carton juice box',
      'a photo of a rectangular drink carton',
    ],
    aliases: ['juice box', 'tetra pak', 'tetrapak', 'drink box'],
    material: 'carton',
    weightG: null,
  },
  {
    id: 'milk_carton',
    name: 'Milk carton',
    prompts: [
      'a photo of a paper milk carton',
      'a photo of a gable top milk carton',
      'a photo of a plastic milk jug',
    ],
    aliases: ['milk', 'milk carton', 'milk jug', 'chocolate milk', 'oat milk carton'],
    material: 'carton',
    weightG: null,
  },

  // ---------- Coffee / takeout ----------
  {
    id: 'coffee_cup',
    name: 'Paper coffee cup',
    prompts: [
      'a photo of a disposable paper coffee cup',
      'a photo of a takeout coffee cup',
      'a photo of a paper hot drink cup',
    ],
    aliases: [
      'coffee cup',
      'paper cup',
      'tim hortons cup',
      'starbucks cup',
      'hot cup',
      'tea cup',
      'to-go cup',
      'timmies',
    ],
    material: 'mixed_paper',
    weightG: null,
  },
  {
    id: 'coffee_lid',
    name: 'Plastic coffee cup lid',
    prompts: [
      'a photo of a plastic coffee cup lid',
      'a photo of a white plastic lid for a hot drink cup',
    ],
    aliases: ['lid', 'coffee lid', 'cup lid', 'plastic lid'],
    material: 'mixed_plastic',
    weightG: null,
  },
  {
    id: 'cold_cup',
    name: 'Plastic cold drink cup',
    prompts: [
      'a photo of a clear plastic cold drink cup with a lid',
      'a photo of a plastic iced coffee cup',
      'a photo of a plastic bubble tea cup',
    ],
    aliases: [
      'iced coffee cup',
      'plastic cup',
      'cold cup',
      'bubble tea',
      'smoothie cup',
      'slurpee cup',
      'fountain drink cup',
    ],
    material: 'mixed_plastic',
    weightG: null,
  },
  {
    id: 'plastic_takeout',
    name: 'Plastic takeout container',
    prompts: [
      'a photo of a plastic takeout food container',
      'a photo of a clear plastic clamshell food container',
      'a photo of a black plastic takeout container',
    ],
    aliases: [
      'takeout container',
      'plastic container',
      'clamshell',
      'to go box',
      'salad container',
      'food container',
    ],
    material: 'mixed_plastic',
    weightG: null,
  },
  {
    id: 'foam_container',
    name: 'Foam (Styrofoam) container or cup',
    prompts: [
      'a photo of a white styrofoam takeout container',
      'a photo of a foam cup',
      'a photo of a polystyrene foam food tray',
    ],
    aliases: ['styrofoam', 'foam', 'foam cup', 'foam container', 'polystyrene', 'styrofoam cup'],
    material: 'foam',
    weightG: null,
  },
  {
    id: 'paper_takeout',
    name: 'Paper takeout box',
    prompts: [
      'a photo of a paper takeout food box',
      'a photo of a paper noodle box',
      'a photo of a cardboard food tray from a restaurant',
    ],
    aliases: [
      'paper box',
      'noodle box',
      'paper takeout',
      'fry box',
      'burger box',
      'paper bowl',
      'paper plate',
    ],
    material: 'mixed_paper',
    weightG: null,
  },
  {
    id: 'pizza_box',
    name: 'Pizza box',
    prompts: [
      'a photo of a cardboard pizza box',
      'a photo of an open pizza box',
      'a photo of a greasy pizza box',
    ],
    aliases: ['pizza box', 'pizza'],
    material: 'corrugated',
    weightG: null,
  },
  {
    id: 'sandwich_wrap',
    name: 'Paper sandwich wrapper',
    prompts: [
      'a photo of a crumpled paper sandwich wrapper',
      'a photo of a paper burger wrapper',
      'a photo of a paper sub wrapper',
    ],
    aliases: ['sandwich wrapper', 'burger wrapper', 'sub wrapper', 'wax paper', 'parchment'],
    material: 'mixed_paper',
    weightG: null,
  },
  {
    id: 'plastic_utensil',
    name: 'Plastic utensil',
    prompts: [
      'a photo of a plastic fork',
      'a photo of disposable plastic cutlery',
      'a photo of a plastic spoon',
    ],
    aliases: ['fork', 'spoon', 'knife', 'cutlery', 'utensil', 'spork', 'plastic fork'],
    material: 'mixed_plastic',
    weightG: null,
  },
  {
    id: 'plastic_straw',
    name: 'Plastic straw',
    prompts: ['a photo of a plastic drinking straw', 'a photo of plastic straws'],
    aliases: ['straw', 'plastic straw'],
    material: 'mixed_plastic',
    weightG: null,
  },
  {
    id: 'compostable_plastic',
    name: '“Compostable” plastic cup or cutlery',
    prompts: [
      'a photo of a compostable plastic cup labelled compostable',
      'a photo of a PLA compostable cup',
    ],
    aliases: [
      'compostable cup',
      'compostable plastic',
      'pla',
      'bioplastic',
      'compostable fork',
      'compostable bag',
    ],
    material: 'other',
    weightG: null,
  },

  // ---------- Snacks / soft plastics ----------
  {
    id: 'chip_bag',
    name: 'Chip bag',
    prompts: [
      'a photo of an empty potato chip bag',
      'a photo of a crumpled shiny chip bag',
      'a photo of a snack bag',
    ],
    aliases: ['chip bag', 'chips', 'crisps', 'doritos', 'lays', 'snack bag', 'cheetos'],
    material: 'plastic_film',
    weightG: null,
  },
  {
    id: 'candy_wrapper',
    name: 'Candy or granola bar wrapper',
    prompts: [
      'a photo of a candy bar wrapper',
      'a photo of a granola bar wrapper',
      'a photo of a plastic snack wrapper',
    ],
    aliases: [
      'wrapper',
      'candy wrapper',
      'chocolate wrapper',
      'granola bar wrapper',
      'snack wrapper',
      'protein bar wrapper',
    ],
    material: 'plastic_film',
    weightG: null,
  },
  {
    id: 'plastic_bag',
    name: 'Plastic bag',
    prompts: [
      'a photo of a plastic shopping bag',
      'a photo of a plastic grocery bag',
      'a photo of a crumpled plastic bag',
    ],
    aliases: ['plastic bag', 'grocery bag', 'shopping bag', 'bread bag', 'ziploc', 'zipper bag'],
    material: 'plastic_film',
    weightG: null,
  },
  {
    id: 'plastic_wrap',
    name: 'Plastic wrap / film',
    prompts: [
      'a photo of plastic cling wrap',
      'a photo of a sheet of clear plastic film packaging',
      'a photo of bubble wrap',
    ],
    aliases: [
      'cling wrap',
      'saran wrap',
      'plastic film',
      'bubble wrap',
      'shrink wrap',
      'plastic packaging',
    ],
    material: 'plastic_film',
    weightG: null,
  },
  {
    id: 'yogurt_cup',
    name: 'Yogurt cup or tub',
    prompts: [
      'a photo of an empty plastic yogurt cup',
      'a photo of a plastic margarine tub',
      'a photo of a plastic pudding cup',
    ],
    aliases: ['yogurt', 'yogurt cup', 'tub', 'margarine tub', 'pudding cup', 'fruit cup'],
    material: 'mixed_plastic',
    weightG: null,
  },

  // ---------- Food & organics ----------
  {
    id: 'food_scraps',
    name: 'Food scraps / leftovers',
    prompts: [
      'a photo of leftover food scraps',
      'a photo of a half eaten sandwich',
      'a photo of food waste on a plate',
    ],
    aliases: [
      'food',
      'leftovers',
      'food scraps',
      'sandwich',
      'rice',
      'pasta',
      'bread',
      'meat',
      'bones',
      'crust',
    ],
    material: 'food',
    weightG: null,
  },
  {
    id: 'fruit_peel',
    name: 'Fruit peel or core',
    prompts: ['a photo of a banana peel', 'a photo of an apple core', 'a photo of orange peels'],
    aliases: ['banana', 'banana peel', 'apple core', 'orange peel', 'peel', 'fruit', 'core', 'pit'],
    material: 'food',
    weightG: null,
  },
  {
    id: 'coffee_grounds',
    name: 'Coffee grounds or tea bag',
    prompts: [
      'a photo of used coffee grounds',
      'a photo of a used tea bag',
      'a photo of a used paper coffee filter',
    ],
    aliases: ['coffee grounds', 'tea bag', 'teabag', 'coffee filter', 'loose tea'],
    material: 'food',
    weightG: null,
  },
  {
    id: 'napkin',
    name: 'Used napkin or paper towel',
    prompts: [
      'a photo of a used paper napkin',
      'a photo of a crumpled paper towel',
      'a photo of a dirty napkin',
      'a photo of a folded white paper napkin',
    ],
    aliases: ['napkin', 'serviette', 'paper towel', 'used napkin'],
    material: 'food',
    weightG: null,
  },
  {
    id: 'tissue',
    name: 'Facial tissue',
    prompts: ['a photo of a used facial tissue', 'a photo of a crumpled kleenex tissue'],
    aliases: ['tissue', 'kleenex', 'facial tissue'],
    material: 'other',
    weightG: null,
  },

  // ---------- Paper ----------
  {
    id: 'paper',
    name: 'Paper',
    prompts: [
      'a photo of a sheet of printer paper',
      'a photo of lined notebook paper',
      'a photo of a stack of paper documents',
    ],
    aliases: [
      'paper',
      'printer paper',
      'notes',
      'handout',
      'sheet',
      'lined paper',
      'envelope',
      'flyer',
    ],
    material: 'mixed_paper',
    weightG: null,
  },
  {
    id: 'newspaper',
    name: 'Newspaper or magazine',
    prompts: ['a photo of a newspaper', 'a photo of a magazine'],
    aliases: ['newspaper', 'magazine', 'the gateway', 'flyer', 'catalogue'],
    material: 'mixed_paper',
    weightG: null,
  },
  {
    id: 'cardboard_box',
    name: 'Cardboard box',
    prompts: [
      'a photo of a cardboard box',
      'a photo of a flattened cardboard box',
      'a photo of a brown shipping box',
    ],
    aliases: ['cardboard', 'box', 'amazon box', 'shipping box', 'cereal box', 'boxboard'],
    material: 'corrugated',
    weightG: null,
  },
  {
    id: 'paper_bag',
    name: 'Paper bag',
    prompts: ['a photo of a brown paper bag', 'a photo of a paper lunch bag'],
    aliases: ['paper bag', 'lunch bag', 'brown bag'],
    material: 'mixed_paper',
    weightG: null,
  },
  {
    id: 'egg_carton',
    name: 'Paper egg carton',
    prompts: ['a photo of a cardboard egg carton', 'a photo of a paper pulp egg carton'],
    aliases: ['egg carton', 'egg box'],
    material: 'mixed_paper',
    weightG: null,
  },
  {
    id: 'receipt',
    name: 'Receipt',
    prompts: ['a photo of a paper store receipt', 'a photo of a long printed receipt'],
    aliases: ['receipt', 'bill', 'till receipt'],
    material: 'mixed_paper',
    weightG: null,
  },

  // ---------- Metal & glass ----------
  {
    id: 'aluminum_foil',
    name: 'Aluminum foil',
    prompts: ['a photo of crumpled aluminum foil', 'a photo of an aluminum foil tray'],
    aliases: ['foil', 'tin foil', 'aluminum foil', 'aluminium foil', 'foil tray', 'pie plate'],
    material: 'aluminum',
    weightG: null,
  },
  {
    id: 'food_can',
    name: 'Food can',
    prompts: ['a photo of an empty metal soup can', 'a photo of a tin can for food'],
    aliases: ['soup can', 'tin can', 'food can', 'tuna can', 'bean can'],
    material: 'steel',
    weightG: null,
  },
  {
    id: 'glass_jar',
    name: 'Glass jar',
    prompts: ['a photo of an empty glass jar', 'a photo of a glass food jar with a lid'],
    aliases: ['jar', 'glass jar', 'pickle jar', 'jam jar', 'sauce jar', 'mason jar'],
    material: 'glass',
    weightG: null,
  },
  {
    id: 'aerosol_can',
    name: 'Empty aerosol can',
    prompts: ['a photo of an aerosol spray can', 'a photo of a can of spray deodorant'],
    aliases: ['aerosol', 'spray can', 'hairspray', 'deodorant spray', 'whipped cream can'],
    material: 'steel',
    weightG: null,
  },

  // ---------- Hazardous / electronics ----------
  {
    id: 'battery',
    name: 'Battery',
    prompts: [
      'a photo of AA batteries',
      'a photo of a coin cell battery',
      'a photo of a cylindrical alkaline battery',
      'a photo of a rechargeable lithium-ion battery cell',
    ],
    aliases: [
      'battery',
      'batteries',
      'aa',
      'aaa',
      '9v',
      'coin cell',
      'lithium battery',
      'power bank',
      'vape battery',
    ],
    material: 'battery',
    weightG: null,
  },
  {
    id: 'phone',
    name: 'Phone or small electronic',
    prompts: [
      'a photo of a smartphone',
      'a photo of an old cell phone',
      'a photo of a small electronic device',
    ],
    aliases: [
      'phone',
      'cell phone',
      'iphone',
      'smartphone',
      'earbuds',
      'headphones',
      'calculator',
      'electronics',
      'vape',
    ],
    material: 'electronics',
    weightG: null,
  },
  {
    id: 'cable',
    name: 'Cable or charger',
    prompts: [
      'a photo of a phone charging cable',
      'a photo of a tangled electrical cable',
      'a photo of a USB charger',
    ],
    aliases: ['cable', 'charger', 'cord', 'usb cable', 'wire', 'adapter'],
    material: 'electronics',
    weightG: null,
  },

  // ---------- Garbage-ish / tricky ----------
  {
    id: 'pen',
    name: 'Pen or marker',
    prompts: [
      'a photo of a plastic ballpoint pen',
      'a photo of a marker pen',
      'a photo of a highlighter',
    ],
    aliases: ['pen', 'marker', 'highlighter', 'pencil', 'mechanical pencil', 'sharpie'],
    material: 'mixed_plastic',
    weightG: null,
  },
  {
    id: 'mask',
    name: 'Face mask',
    prompts: ['a photo of a disposable face mask', 'a photo of a blue surgical mask'],
    aliases: ['mask', 'face mask', 'surgical mask', 'n95'],
    material: 'other',
    weightG: null,
  },
  {
    id: 'gloves',
    name: 'Disposable gloves',
    prompts: ['a photo of disposable latex gloves', 'a photo of a used nitrile glove'],
    aliases: ['gloves', 'latex gloves', 'nitrile gloves', 'glove'],
    material: 'other',
    weightG: null,
  },
  {
    id: 'gum',
    name: 'Chewing gum',
    prompts: ['a photo of chewed gum', 'a photo of a piece of chewing gum'],
    aliases: ['gum', 'chewing gum', 'bubble gum'],
    material: 'other',
    weightG: null,
  },
  {
    id: 'k_cup',
    name: 'Coffee pod (K-Cup)',
    prompts: ['a photo of a used coffee pod', 'a photo of a K-Cup coffee capsule'],
    aliases: ['k cup', 'k-cup', 'coffee pod', 'nespresso', 'capsule', 'keurig'],
    material: 'other',
    weightG: null,
  },
];

/**
 * Lookup by id. A frozen object with NO prototype, so `ITEMS_BY_ID['toString']`
 * is undefined rather than a built-in function.
 */
export const ITEMS_BY_ID: Readonly<Record<string, ItemType>> = Object.freeze(
  Object.assign(
    Object.create(null) as Record<string, ItemType>,
    Object.fromEntries(ITEMS.map((i) => [i.id, i])),
  ),
);

/** Safe lookup for any runtime value; undefined for unknown ids or non-strings. */
export function getItem(id: unknown): ItemType | undefined {
  return typeof id === 'string' ? ITEMS_BY_ID[id] : undefined;
}
