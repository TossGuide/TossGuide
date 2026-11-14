/**
 * Core types for the TossGuide rules engine.
 *
 * The big idea: the vision model only ever answers "what IS this?" (an item id).
 * Deciding "where does it GO?" is the job of this hand-written, cited rules data,
 * because sorting rules are local (Edmonton != Calgary != campus) and change over
 * time (Edmonton's recycling list expanded on Oct 1, 2026).
 */

/** Where the user is sorting. Campus bins follow different (institutional) rules. */
export type Context = 'edmonton-residential' | 'uofa-campus';
export const CONTEXTS: readonly Context[] = ['edmonton-residential', 'uofa-campus'];

/** Every place an item can end up. */
export type DestinationId =
  // City of Edmonton curbside streams
  | 'edm_blue_bag'
  | 'edm_green_cart'
  | 'edm_black_cart'
  // Drop-off
  | 'bottle_depot'
  | 'eco_station'
  // University of Alberta 4-stream Zero Waste Stations + battery bins
  | 'uofa_recyclables'
  | 'uofa_mixed_paper'
  | 'uofa_organics'
  | 'uofa_landfill'
  | 'uofa_battery_bin'
  | 'uofa_special'
  // Used when the official guidance does not clearly cover an item
  | 'check_local';

/** Colour token for a destination; the UI maps tokens to real hex values. */
export type ColourToken = 'blue' | 'green' | 'black' | 'orange' | 'yellow' | 'teal' | 'grey';

export interface Destination {
  id: DestinationId;
  /** Full name shown on the result card, using the official stream name. */
  name: string;
  /** Short label (fits on a chip / leaderboard). */
  shortName: string;
  colour: ColourToken;
  /** Icon key; the UI owns the actual SVGs. */
  icon: 'recycle' | 'food' | 'trash' | 'bottle' | 'hazard' | 'paper' | 'battery' | 'question';
  /** Does sending an item here keep it out of landfill? Drives the impact tally. */
  divertsFromLandfill: boolean;
  /** Which contexts this destination appears in. */
  contexts: readonly Context[];
}

/** A single yes/no "contamination check" question. */
export interface Question {
  id: QuestionId;
  text: string;
  /** Optional short hint shown under the question. */
  hint?: string;
}

export type QuestionId = 'greasy' | 'food_residue' | 'lithium' | 'clean';

/** One concrete answer from the rules. */
export interface Outcome {
  destination: DestinationId;
  /** One line explaining WHY, in plain language. */
  reason: string;
  /** Prep steps, in order ("Remove the lid", "Rinse"). */
  prep?: string[];
  /** Ids into SOURCES; every outcome must cite at least one. */
  sources: string[];
  /** True when official guidance is unclear: the UI must not present this confidently. */
  uncertain?: boolean;
  /** A secondary acceptable option, e.g. beverage containers -> recycling if no depot trip. */
  alternative?: { destination: DestinationId; note: string };
}

/** A rule is either a final outcome or a question that branches to two sub-rules. */
export type RuleNode = Outcome | { ask: QuestionId; yes: RuleNode; no: RuleNode };

export type Material =
  | 'aluminum'
  | 'steel'
  | 'glass'
  | 'pet'
  | 'hdpe'
  | 'mixed_plastic'
  | 'plastic_film'
  | 'foam'
  | 'corrugated'
  | 'mixed_paper'
  | 'carton'
  | 'food'
  | 'electronics'
  | 'battery'
  | 'other';

export interface ItemType {
  id: string;
  name: string;
  /** Zero-shot text prompts for the vision model (2-4 each). */
  prompts: string[];
  /** Extra words people might type ("cup of joe", "pop", "soda"). */
  aliases: string[];
  material: Material;
  /**
   * Typical weight in grams, or null if we have no cited/measured value yet.
   * Null weights still count as "items diverted" but add 0 to the CO2e estimate.
   */
  weightG: number | null;
  /** Where weightG came from ('measured' = team weighed it at the venue). */
  weightSource?: string;
}

export interface Source {
  id: string;
  title: string;
  url: string;
  /** Date we read it (ISO). */
  accessed: string;
}

/** What resolve() returns. */
export type Result =
  | {
      ok: true;
      status: 'final';
      itemId: string;
      itemName: string;
      context: Context;
      destination: Destination;
      reason: string;
      prep: string[];
      sources: Source[];
      uncertain: boolean;
      alternative?: { destination: Destination; note: string };
      /** Answers that led here (for display / analytics). */
      answers: Partial<Record<QuestionId, boolean>>;
    }
  | {
      ok: true;
      status: 'needs_answer';
      itemId: string;
      itemName: string;
      context: Context;
      question: Question;
      answers: Partial<Record<QuestionId, boolean>>;
    }
  | { ok: false; error: 'unknown_item' | 'invalid_context' | 'empty_input'; message: string };

/** Answers to contamination-check questions collected so far. */
export type Answers = Partial<Record<QuestionId, boolean>>;
