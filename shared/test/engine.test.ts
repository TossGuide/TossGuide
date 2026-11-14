import { describe, expect, it } from 'vitest';
import { resolve, possibleDestinations, lookupTyped } from '../src/rules/engine';
import { ITEMS } from '../src/rules/items';
import { RULES } from '../src/rules/rules';
import { SOURCES } from '../src/rules/sources';
import { DESTINATIONS } from '../src/rules/destinations';
import {
  CONTEXTS,
  type Answers,
  type Context,
  type QuestionId,
  type RuleNode,
} from '../src/rules/types';

/** Every combination of answers that reaches a distinct leaf of a rule. */
function leafAnswerSets(node: RuleNode, acc: Answers = {}): Answers[] {
  if (!('ask' in node)) return [acc];
  return [
    ...leafAnswerSets(node.yes, { ...acc, [node.ask]: true }),
    ...leafAnswerSets(node.no, { ...acc, [node.ask]: false }),
  ];
}

describe('rules data integrity', () => {
  it('every item has a rule for every context, and vice versa', () => {
    for (const it of ITEMS)
      for (const c of CONTEXTS) expect(RULES[it.id]?.[c], `${it.id}/${c}`).toBeDefined();
    expect(Object.keys(RULES).sort()).toEqual(ITEMS.map((i) => i.id).sort());
  });

  it('item ids are unique and each item has 2-4 prompts', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const it of ITEMS) {
      expect(it.prompts.length, it.id).toBeGreaterThanOrEqual(2);
      expect(it.prompts.length, it.id).toBeLessThanOrEqual(4);
    }
  });

  it('every outcome cites known sources and uses a destination valid in its context', () => {
    for (const it of ITEMS)
      for (const c of CONTEXTS)
        for (const answers of leafAnswerSets(RULES[it.id]![c])) {
          const r = resolve(it.id, c, answers);
          expect(r.ok && r.status === 'final', `${it.id}/${c}`).toBe(true);
          if (!r.ok || r.status !== 'final') continue;
          expect(r.sources.length).toBeGreaterThan(0);
          for (const s of r.sources) expect(s.url).toMatch(/^https:\/\//);
          expect(r.destination.contexts).toContain(c);
          expect(r.reason.length).toBeGreaterThan(10);
        }
  });

  it('all source ids referenced in rules exist', () => {
    const walk = (n: RuleNode): string[] =>
      'ask' in n ? [...walk(n.yes), ...walk(n.no)] : n.sources;
    for (const it of ITEMS)
      for (const c of CONTEXTS)
        for (const s of walk(RULES[it.id]![c])) expect(SOURCES[s], s).toBeDefined();
  });

  it('uncertain outcomes always route to check_local, which never counts as diverted', () => {
    expect(DESTINATIONS.check_local.divertsFromLandfill).toBe(false);
    for (const it of ITEMS)
      for (const c of CONTEXTS)
        for (const a of leafAnswerSets(RULES[it.id]![c])) {
          const r = resolve(it.id, c, a);
          if (r.ok && r.status === 'final')
            expect(r.uncertain).toBe(r.destination.id === 'check_local');
        }
  });
});

describe('resolve()', () => {
  const home: Context = 'edmonton-residential';
  const campus: Context = 'uofa-campus';
  const dest = (id: string, c: Context, a?: Answers) => {
    const r = resolve(id, c, a);
    return r.ok && r.status === 'final'
      ? r.destination.id
      : r.ok
        ? `ask:${r.question.id}`
        : `err:${r.error}`;
  };

  it('coffee cup: blue bag at home (post Oct-2026), landfill on campus', () => {
    expect(dest('coffee_cup', home)).toBe('edm_blue_bag');
    expect(dest('coffee_cup', campus)).toBe('uofa_landfill');
  });

  it('pizza box asks about grease, and the answer changes the result', () => {
    expect(dest('pizza_box', home)).toBe('ask:greasy');
    expect(dest('pizza_box', home, { greasy: false })).toBe('edm_blue_bag');
    expect(dest('pizza_box', home, { greasy: true })).toBe('edm_black_cart');
    expect(dest('pizza_box', campus, { greasy: true })).toBe('uofa_organics');
    expect(dest('pizza_box', campus, { greasy: false })).toBe('uofa_mixed_paper');
  });

  it('needs_answer carries the question text', () => {
    const r = resolve('pizza_box', home);
    expect(r.ok && r.status === 'needs_answer' && r.question.text).toMatch(/grease/i);
  });

  it('beverage containers go to the bottle depot with a refund note and a blue-bag alternative', () => {
    const r = resolve('pop_can', home);
    expect(r.ok && r.status === 'final').toBe(true);
    if (r.ok && r.status === 'final') {
      expect(r.destination.id).toBe('bottle_depot');
      expect(r.reason).toMatch(/refund/i);
      expect(r.alternative?.destination.id).toBe('edm_blue_bag');
    }
  });

  it('battery: Eco Station at home; campus asks about lithium-ion', () => {
    expect(dest('battery', home)).toBe('eco_station');
    expect(dest('battery', campus)).toBe('ask:lithium');
    expect(dest('battery', campus, { lithium: false })).toBe('uofa_battery_bin');
    expect(dest('battery', campus, { lithium: true })).toBe('uofa_special');
  });

  it('ignores answers to questions the item does not ask', () => {
    expect(dest('coffee_cup', home, { greasy: true, lithium: true })).toBe('edm_blue_bag');
  });

  it('records the answers used', () => {
    const r = resolve('pizza_box', home, { greasy: true });
    expect(r.ok && r.answers).toEqual({ greasy: true });
  });

  it('returns errors instead of throwing for bad input', () => {
    expect(dest('not_an_item', home)).toBe('err:unknown_item');
    expect(dest('', home)).toBe('err:empty_input');
    expect(dest('   ', home)).toBe('err:empty_input');
    // @ts-expect-error runtime garbage
    expect(dest(undefined, home)).toBe('err:empty_input');
    // @ts-expect-error runtime garbage
    expect(dest(42, home)).toBe('err:unknown_item');
    // @ts-expect-error runtime garbage
    expect(dest('coffee_cup', 'calgary')).toBe('err:invalid_context');
    // @ts-expect-error runtime garbage
    expect(dest('pizza_box', home, 'yes')).toBe('ask:greasy');
  });

  it('does not treat inherited object keys as items', () => {
    expect(dest('toString', home)).toBe('err:unknown_item');
    expect(dest('__proto__', home)).toBe('err:unknown_item');
  });

  it('ignores non-boolean answer values', () => {
    // @ts-expect-error runtime garbage
    expect(dest('pizza_box', home, { greasy: 'yes' })).toBe('ask:greasy');
  });
});

describe('possibleDestinations()', () => {
  it('lists every reachable destination, deduped and sorted', () => {
    expect(possibleDestinations('pizza_box', 'edmonton-residential')).toEqual([
      'edm_black_cart',
      'edm_blue_bag',
    ]);
    expect(possibleDestinations('pop_can', 'edmonton-residential')).toEqual(['bottle_depot']);
    expect(possibleDestinations('nope', 'edmonton-residential')).toEqual([]);
  });
});

describe('lookupTyped()', () => {
  const top = (t: string) => lookupTyped(t)[0]?.itemId;
  it('matches names, aliases and sloppy input', () => {
    expect(top('battery')).toBe('battery');
    expect(top('Coffee Cup')).toBe('coffee_cup');
    expect(top('timmies cup')).toBe('coffee_cup');
    expect(top('pop')).toBe('pop_can');
    expect(top('banana')).toBe('fruit_peel');
    expect(top('greasy pizza box')).toBe('pizza_box');
    expect(top('chips')).toBe('chip_bag');
    expect(top('batteries')).toBe('battery');
    expect(top('styrofoam cup')).toBe('foam_container');
  });
  it('returns [] for empty or junk input and never throws', () => {
    expect(lookupTyped('')).toEqual([]);
    expect(lookupTyped('   ')).toEqual([]);
    expect(lookupTyped('zzzzqqq')).toEqual([]);
    // @ts-expect-error runtime garbage
    expect(lookupTyped(undefined)).toEqual([]);
  });
  it('scores are in (0,1] and sorted', () => {
    const r = lookupTyped('plastic cup');
    expect(r.length).toBeGreaterThan(0);
    for (let i = 1; i < r.length; i++) expect(r[i - 1]!.score).toBeGreaterThanOrEqual(r[i]!.score);
    for (const c of r) expect(c.score > 0 && c.score <= 1).toBe(true);
  });
});
