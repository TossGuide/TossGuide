// BLIND holdout tests for the answer-vs-confirm decision (docs/API_CONTRACT.md "Decision logic").
// Spec: "top-1 confidence >= threshold AND top-2 map to the same destination -> answer directly;
// otherwise show the top 3 for the user to confirm. It must never confidently give a wrong answer."
import { describe, it, expect } from 'vitest';
import { decide, DEFAULT_THRESHOLD } from '@binsight/shared/ml/decide';

const HOME = 'edmonton-residential' as const;
const CAMPUS = 'uofa-campus' as const;

type D = any;

function expectSortedDesc(cands: { score: number }[]) {
  for (let i = 1; i < cands.length; i++) expect(cands[i - 1].score).toBeGreaterThanOrEqual(cands[i].score);
}

describe('DEFAULT_THRESHOLD', () => {
  it('is a probability in (0, 1)', () => {
    expect(typeof DEFAULT_THRESHOLD).toBe('number');
    expect(DEFAULT_THRESHOLD).toBeGreaterThan(0);
    expect(DEFAULT_THRESHOLD).toBeLessThan(1);
  });
});

describe('low confidence -> confirm', () => {
  it('returns low_confidence with at most 3 candidates sorted desc', () => {
    const d: D = decide(
      [
        { itemId: 'chip_bag', score: 0.2 },
        { itemId: 'coffee_cup', score: 0.3 },
        { itemId: 'napkin', score: 0.15 },
        { itemId: 'pop_can', score: 0.25 },
        { itemId: 'battery', score: 0.1 },
      ],
      HOME,
      { threshold: 0.6 },
    );
    expect(d.kind).toBe('confirm');
    expect(d.reason).toBe('low_confidence');
    expect(d.candidates.length).toBeLessThanOrEqual(3);
    expect(d.candidates.length).toBe(3);
    expectSortedDesc(d.candidates);
    expect(d.candidates.map((c: any) => c.itemId)).toEqual(['coffee_cup', 'pop_can', 'chip_bag']);
  });

  it('low confidence even when top-2 agree on destination', () => {
    // pop_can and plastic_bottle both -> bottle depot at home (EDM_RECYCLING), but 0.4 < threshold
    const d: D = decide(
      [
        { itemId: 'pop_can', score: 0.4 },
        { itemId: 'plastic_bottle', score: 0.35 },
      ],
      HOME,
      { threshold: 0.6 },
    );
    expect(d.kind).toBe('confirm');
    expect(d.reason).toBe('low_confidence');
  });
});

describe('top-2 disagree -> confirm even at high confidence', () => {
  it('coffee_cup (blue bag) vs napkin (green cart) at home, 0.9 vs 0.08', () => {
    const d: D = decide(
      [
        { itemId: 'coffee_cup', score: 0.9 },
        { itemId: 'napkin', score: 0.08 },
        { itemId: 'pop_can', score: 0.02 },
      ],
      HOME,
      { threshold: 0.5 },
    );
    expect(d.kind).toBe('confirm');
    expect(d.reason).toBe('destinations_disagree');
    expect(d.candidates[0].itemId).toBe('coffee_cup');
    expect(d.candidates.length).toBeLessThanOrEqual(3);
    expectSortedDesc(d.candidates);
  });

  it('coffee_cup vs chip_bag agree (blue bag at home, landfill on campus) -> answer', () => {
    // EDM_RECYCLING: both accepted since Oct 1 2026; UOFA_CHEAT: both Landfill
    for (const ctx of [HOME, CAMPUS]) {
      const d: D = decide(
        [
          { itemId: 'coffee_cup', score: 0.9 },
          { itemId: 'chip_bag', score: 0.08 },
        ],
        ctx,
        { threshold: 0.5 },
      );
      expect(d.kind, ctx).toBe('answer');
      expect(d.itemId).toBe('coffee_cup');
    }
  });

  it('pop_can vs coffee_cup disagree at home (bottle depot vs blue bag)', () => {
    const d: D = decide(
      [
        { itemId: 'pop_can', score: 0.95 },
        { itemId: 'coffee_cup', score: 0.04 },
      ],
      HOME,
      { threshold: 0.5 },
    );
    expect(d.kind).toBe('confirm');
    expect(d.reason).toBe('destinations_disagree');
  });

  it('a question-dependent item (pizza box) vs a fixed item does not auto-answer', () => {
    // pizza_box reaches {blue bag, black cart} at home; coffee_cup reaches {blue bag}: sets differ
    const d: D = decide(
      [
        { itemId: 'pizza_box', score: 0.9 },
        { itemId: 'coffee_cup', score: 0.05 },
      ],
      HOME,
      { threshold: 0.5 },
    );
    expect(d.kind).toBe('confirm');
    expect(d.reason).toBe('destinations_disagree');
  });
});

describe('same destination -> answer', () => {
  it('pop_can vs plastic_bottle at home (both bottle depot) at high confidence', () => {
    // EDM_RECYCLING: beverage bottles and cans -> Bottle Depot for a refund
    const d: D = decide(
      [
        { itemId: 'pop_can', score: 0.85 },
        { itemId: 'plastic_bottle', score: 0.1 },
        { itemId: 'napkin', score: 0.05 },
      ],
      HOME,
      { threshold: 0.5 },
    );
    expect(d.kind).toBe('answer');
    expect(d.itemId).toBe('pop_can');
    expect(d.confidence).toBeCloseTo(0.85, 6);
  });

  it('same pair on campus (both recyclables) also answers', () => {
    const d: D = decide(
      [
        { itemId: 'pop_can', score: 0.85 },
        { itemId: 'plastic_bottle', score: 0.1 },
      ],
      CAMPUS,
      { threshold: 0.5 },
    );
    expect(d.kind).toBe('answer');
    expect(d.itemId).toBe('pop_can');
  });

  it('context matters: coffee_cup vs plastic_bag agree at home (blue bag) but disagree on campus', () => {
    // home: both blue bag (EDM_RECYCLING); campus: coffee cup Landfill, plastic bag Recyclables (UOFA_CHEAT)
    const cands = [
      { itemId: 'coffee_cup', score: 0.9 },
      { itemId: 'plastic_bag', score: 0.05 },
    ];
    expect((decide(cands, HOME, { threshold: 0.5 }) as D).kind).toBe('answer');
    const c: D = decide(cands, CAMPUS, { threshold: 0.5 });
    expect(c.kind).toBe('confirm');
    expect(c.reason).toBe('destinations_disagree');
  });
});

describe('input handling', () => {
  it('unsorted input is sorted before deciding', () => {
    const d: D = decide(
      [
        { itemId: 'plastic_bottle', score: 0.1 },
        { itemId: 'napkin', score: 0.02 },
        { itemId: 'pop_can', score: 0.88 },
      ],
      HOME,
      { threshold: 0.5 },
    );
    expect(d.kind).toBe('answer');
    expect(d.itemId).toBe('pop_can');
  });

  it('unsorted input in a confirm comes back sorted', () => {
    const d: D = decide(
      [
        { itemId: 'napkin', score: 0.1 },
        { itemId: 'coffee_cup', score: 0.3 },
        { itemId: 'pop_can', score: 0.2 },
        { itemId: 'battery', score: 0.25 },
      ],
      HOME,
      { threshold: 0.9 },
    );
    expect(d.kind).toBe('confirm');
    expect(d.candidates.map((c: any) => c.itemId)).toEqual(['coffee_cup', 'battery', 'pop_can']);
  });

  it('does not mutate the input array', () => {
    const input = [
      { itemId: 'napkin', score: 0.1 },
      { itemId: 'coffee_cup', score: 0.8 },
    ];
    const copy = JSON.parse(JSON.stringify(input));
    decide(input, HOME, { threshold: 0.5 });
    expect(input).toEqual(copy);
  });

  const empties: [string, unknown][] = [
    ['empty array', []],
    ['NaN score', [{ itemId: 'pop_can', score: NaN }]],
    ['unknown ids only', [{ itemId: 'not_a_thing', score: 0.99 }, { itemId: 'also_fake', score: 0.01 }]],
  ];
  it.each(empties)('%s -> confirm/no_candidates with [] and no throw', (_l, input) => {
    let d: D = undefined;
    expect(() => {
      d = decide(input as any, HOME);
    }).not.toThrow();
    expect(d.kind).toBe('confirm');
    expect(d.reason).toBe('no_candidates');
    expect(d.candidates).toEqual([]);
  });

  it('unknown ids are dropped from candidates', () => {
    const d: D = decide(
      [
        { itemId: 'not_a_thing', score: 0.5 },
        { itemId: 'coffee_cup', score: 0.3 },
        { itemId: 'napkin', score: 0.2 },
      ],
      HOME,
      { threshold: 0.9 },
    );
    expect(d.kind).toBe('confirm');
    expect(d.candidates.map((c: any) => c.itemId)).not.toContain('not_a_thing');
  });

  it('an unknown top id does not block a known lone candidate', () => {
    const d: D = decide(
      [
        { itemId: 'not_a_thing', score: 0.95 },
        { itemId: 'pop_can', score: 0.9 },
      ],
      HOME,
      { threshold: 0.5 },
    );
    expect(d.kind).toBe('answer');
    expect(d.itemId).toBe('pop_can');
  });

  it('NaN entries are dropped but valid ones still count', () => {
    const d: D = decide(
      [
        { itemId: 'napkin', score: NaN },
        { itemId: 'pop_can', score: 0.9 },
      ],
      HOME,
      { threshold: 0.5 },
    );
    expect(d.kind).toBe('answer');
    expect(d.itemId).toBe('pop_can');
  });
});

describe('threshold option', () => {
  const cands = [
    { itemId: 'pop_can', score: 0.6 },
    { itemId: 'plastic_bottle', score: 0.3 },
  ];
  it('answers when top-1 >= threshold', () => {
    expect((decide(cands, HOME, { threshold: 0.5 }) as D).kind).toBe('answer');
    expect((decide(cands, HOME, { threshold: 0.6 }) as D).kind).toBe('answer'); // >= boundary
  });
  it('confirms when top-1 < threshold', () => {
    const d: D = decide(cands, HOME, { threshold: 0.7 });
    expect(d.kind).toBe('confirm');
    expect(d.reason).toBe('low_confidence');
  });
  it('default threshold is used when omitted', () => {
    const hi = [{ itemId: 'pop_can', score: Math.min(0.999, DEFAULT_THRESHOLD + 0.01) }];
    expect((decide(hi, HOME) as D).kind).toBe('answer');
    const lo = [
      { itemId: 'pop_can', score: Math.max(0.001, DEFAULT_THRESHOLD - 0.01) },
      { itemId: 'plastic_bottle', score: 0.0001 },
    ];
    expect((decide(lo, HOME) as D).kind).toBe('confirm');
  });
});

describe('lone candidate', () => {
  it('a single candidate above threshold -> answer', () => {
    const d: D = decide([{ itemId: 'battery', score: 0.8 }], HOME, { threshold: 0.5 });
    expect(d.kind).toBe('answer');
    expect(d.itemId).toBe('battery');
    expect(d.confidence).toBeCloseTo(0.8, 6);
  });
  it('a single candidate below threshold -> confirm with that candidate', () => {
    const d: D = decide([{ itemId: 'battery', score: 0.3 }], HOME, { threshold: 0.5 });
    expect(d.kind).toBe('confirm');
    expect(d.reason).toBe('low_confidence');
    expect(d.candidates.map((c: any) => c.itemId)).toEqual(['battery']);
  });
});
