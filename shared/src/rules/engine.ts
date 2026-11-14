/**
 * The Trashify rules engine: (item, context, answers) -> where it goes and why.
 *
 * Pure functions, no I/O, so the browser, server and eval harness all share it and
 * it's easy to unit test. It never throws on bad input: callers get { ok: false }.
 */
import { DESTINATIONS, QUESTIONS } from './destinations';
import { ITEMS, getItem } from './items';
import { RULES } from './rules';
import { SOURCES } from './sources';
import {
  CONTEXTS,
  type Answers,
  type Context,
  type DestinationId,
  type Outcome,
  type QuestionId,
  type Result,
  type RuleNode,
} from './types';

const QUESTION_IDS = Object.keys(QUESTIONS) as QuestionId[];

/** Keep only real boolean answers to known questions (drops junk from the UI/URL). */
function cleanAnswers(raw: unknown): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const q of QUESTION_IDS) {
    const v = (raw as Record<string, unknown>)[q];
    if (typeof v === 'boolean') out[q] = v;
  }
  return out;
}

/** Own-property lookup, so ids like "toString" or "__proto__" are never treated as items. */
function ruleFor(itemId: string, context: Context): RuleNode | undefined {
  if (!Object.prototype.hasOwnProperty.call(RULES, itemId)) return undefined;
  return RULES[itemId]?.[context];
}

export function resolve(itemId: string, context: Context, answers?: Answers): Result {
  if (
    itemId === undefined ||
    itemId === null ||
    (typeof itemId === 'string' && itemId.trim() === '')
  ) {
    return { ok: false, error: 'empty_input', message: 'Tell us what the item is first.' };
  }
  if (!CONTEXTS.includes(context)) {
    return {
      ok: false,
      error: 'invalid_context',
      message: `Unknown sorting context "${String(context)}".`,
    };
  }
  const id = typeof itemId === 'string' ? itemId.trim() : '';
  const item = getItem(id);
  const rule = item ? ruleFor(id, context) : undefined;
  if (!item || !rule) {
    return {
      ok: false,
      error: 'unknown_item',
      message: 'We don’t know that item yet. Try typing it differently.',
    };
  }

  const given = cleanAnswers(answers);
  const used: Answers = {};

  // Walk the decision tree. Stop and ask as soon as we hit a question with no answer.
  let node: RuleNode = rule;
  while ('ask' in node) {
    const a = given[node.ask];
    if (a === undefined) {
      return {
        ok: true,
        status: 'needs_answer',
        itemId: id,
        itemName: item.name,
        context,
        question: QUESTIONS[node.ask],
        answers: used,
      };
    }
    used[node.ask] = a;
    node = a ? node.yes : node.no;
  }

  return finalResult(id, item.name, context, node, used);
}

function finalResult(
  itemId: string,
  itemName: string,
  context: Context,
  o: Outcome,
  answers: Answers,
): Result {
  return {
    ok: true,
    status: 'final',
    itemId,
    itemName,
    context,
    destination: DESTINATIONS[o.destination],
    reason: o.reason,
    prep: o.prep ?? [],
    // Data integrity tests guarantee these ids exist; filter defensively anyway.
    sources: o.sources.map((s) => SOURCES[s]).filter((s) => s !== undefined),
    uncertain: o.uncertain === true,
    alternative: o.alternative
      ? { destination: DESTINATIONS[o.alternative.destination], note: o.alternative.note }
      : undefined,
    answers,
  };
}

/**
 * Every destination an item could end up in (over all possible answers).
 * Used by the decision logic: if the top two guesses could land in different
 * bins, we ask the user rather than guess.
 */
export function possibleDestinations(itemId: string, context: Context): DestinationId[] {
  if (typeof itemId !== 'string' || !CONTEXTS.includes(context)) return [];
  const rule = ruleFor(itemId, context);
  if (!rule) return [];
  const found = new Set<DestinationId>();
  const walk = (n: RuleNode): void => {
    if ('ask' in n) {
      walk(n.yes);
      walk(n.no);
    } else found.add(n.destination);
  };
  walk(rule);
  return [...found].sort();
}

// ---------------------------------------------------------------------------
// Typed input ("coffee cup") -> item candidates. Simple, explainable fuzzy match.
// ---------------------------------------------------------------------------

/** Lowercase, strip punctuation, crude plural stemming ("batteries" -> "battery"). */
function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((t) =>
      t.length > 4 && t.endsWith('ies')
        ? t.slice(0, -3) + 'y'
        : t.length > 3 && t.endsWith('s') && !t.endsWith('ss')
          ? t.slice(0, -1)
          : t,
    );
}

/** Levenshtein distance capped early: we only care whether it's <= 1. */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Tokens match if equal, or one typo apart for longer words ("batery"). */
const tokenMatch = (a: string, b: string) =>
  a === b || (a.length >= 5 && b.length >= 5 && withinOneEdit(a, b));

function phraseScore(q: string[], p: string[]): number {
  if (q.length === 0 || p.length === 0) return 0;
  const pInQ = p.filter((pt) => q.some((qt) => tokenMatch(qt, pt))).length;
  const qInP = q.filter((qt) => p.some((pt) => tokenMatch(qt, pt))).length;
  if (pInQ === p.length && qInP === q.length) return 1; // same words
  if (pInQ === p.length) return 0.75 + 0.2 * (p.length / q.length); // phrase inside query: "greasy pizza box"
  if (qInP === q.length) return 0.6 + 0.3 * (q.length / p.length); // query inside phrase: "pizza"
  const union = new Set([...q, ...p]).size;
  return (0.7 * Math.max(pInQ, qInP)) / union; // partial overlap
}

const PHRASES = ITEMS.map((it) => ({ id: it.id, phrases: [it.name, ...it.aliases].map(tokens) }));
const MIN_TYPED_SCORE = 0.25;

export function lookupTyped(text: string): { itemId: string; score: number }[] {
  if (typeof text !== 'string') return [];
  const q = tokens(text);
  if (q.length === 0) return [];
  return PHRASES.map(({ id, phrases }) => ({
    itemId: id,
    score: Math.max(...phrases.map((p) => phraseScore(q, p))),
  }))
    .filter((c) => c.score >= MIN_TYPED_SCORE)
    .map((c) => ({ ...c, score: Math.min(1, Math.round(c.score * 1000) / 1000) }))
    .sort((a, b) => b.score - a.score);
}
