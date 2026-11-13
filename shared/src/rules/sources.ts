import type { Source } from './types';

/**
 * Every rule in rules.ts cites one or more of these. If you add a rule, add or
 * reuse a source here. Never add a rule without a source.
 * Full research notes: docs/RESEARCH.md
 */
const ACCESSED = '2026-11-13';

export const SOURCES: Record<string, Source> = {
  edm_recycling: {
    id: 'edm_recycling',
    title: 'City of Edmonton: Recycling (What Can I Recycle?, updated for Oct 1, 2026 EPR changes)',
    url: 'https://www.edmonton.ca/programs_services/garbage_waste/recycling',
    accessed: ACCESSED,
  },
  edm_food_scraps: {
    id: 'edm_food_scraps',
    title: 'City of Edmonton: Food Scraps (What goes in your food scraps cart / Tricky items)',
    url: 'https://www.edmonton.ca/programs_services/garbage_waste/food-scraps',
    accessed: ACCESSED,
  },
  edm_curbside: {
    id: 'edm_curbside',
    title:
      'City of Edmonton: Curbside Collection (green food scraps cart, black garbage cart, blue bags)',
    url: 'https://www.edmonton.ca/programs_services/garbage_waste/curbside-cart-collection',
    accessed: ACCESSED,
  },
  edm_poster: {
    id: 'edm_poster',
    title: 'City of Edmonton: What Goes Where? poster (revised Sep 2026)',
    url: 'https://www.edmonton.ca/sites/default/files/public-files/assets/PDF/what-goes-where-poster-universal.pdf',
    accessed: ACCESSED,
  },
  edm_eco_station: {
    id: 'edm_eco_station',
    title: 'City of Edmonton: Eco Station accepted items',
    url: 'https://www.edmonton.ca/programs_services/garbage_waste/eco-station-acceptable-items',
    accessed: ACCESSED,
  },
  edm_epr: {
    id: 'edm_epr',
    title: 'City of Edmonton: Extended Producer Responsibility',
    url: 'https://www.edmonton.ca/programs_services/garbage_waste/extended-producer-responsibility',
    accessed: ACCESSED,
  },
  edm_wastewise: {
    id: 'edm_wastewise',
    title: 'City of Edmonton: WasteWise (official item lookup)',
    url: 'https://www.edmonton.ca/programs_services/apps_mobile/wastewise-app',
    accessed: ACCESSED,
  },
  bcmb_refunds: {
    id: 'bcmb_refunds',
    title: 'Beverage Container Management Board: depot refunds (10¢ for 1 L or less, 25¢ over 1 L)',
    url: 'https://www.bcmb.ab.ca/depot-owners-operators/depot-compliance/',
    accessed: ACCESSED,
  },
  bcmb_guide: {
    id: 'bcmb_guide',
    title: 'BCMB: Your Guide to Redeeming Beverage Deposits in Alberta',
    url: 'https://www.bcmb.ab.ca/news/guide-redeeming-beverage-deposits-alberta-57/',
    accessed: ACCESSED,
  },
  uofa_cheatsheet: {
    id: 'uofa_cheatsheet',
    title: 'University of Alberta: 4-Stream Zero Waste System cheat sheet',
    url: 'https://www.ualberta.ca/en/campus-operations-services/media-library/documents/waste-system-cheat-sheet-2021.pdf',
    accessed: ACCESSED,
  },
  uofa_how_to: {
    id: 'uofa_how_to',
    title: 'University of Alberta: How to Recycle (batteries, pens, special streams)',
    url: 'https://www.ualberta.ca/en/campus-operations-services/buildings-grounds/recycling/how-to-recycle.html',
    accessed: ACCESSED,
  },
};
