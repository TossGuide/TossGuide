/**
 * Should we answer, or ask the user to confirm?
 *
 * BinSight's promise is "never confidently wrong". A wrong bin is worse than a
 * quick tap, so we only answer directly when BOTH:
 *   1. the top guess is confident (score >= threshold), and
 *   2. the runner-up would end up in the same bin(s) anyway, so even if we
 *      mixed up a pop can and a plastic bottle the user still gets the right answer.
 * Otherwise we show the top 3 and let the user pick (or type it).
 *
 * The threshold is chosen from the eval set's threshold sweep (eval/REPORT.md).
 */
import { possibleDestinations } from '../rules/engine';
import { ITEMS_BY_ID } from '../rules/items';
import type { Context } from '../rules/types';
import type { Candidate } from './aggregate';
import calibration from './calibration.json';

export type { Candidate };

export type Decision =
  | { kind: 'answer'; itemId: string; confidence: number }
  | {
      kind: 'confirm';
      reason: 'low_confidence' | 'destinations_disagree' | 'no_candidates';
      candidates: Candidate[];
    };

/** Tuned by `npm run eval` and stored in calibration.json. */
export const DEFAULT_THRESHOLD: number = calibration.threshold;

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

export function decide(
  candidates: Candidate[],
  context: Context,
  opts: { threshold?: number } = {},
): Decision {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const valid = (Array.isArray(candidates) ? candidates : [])
    .filter((c) => c && ITEMS_BY_ID.has(c.itemId) && Number.isFinite(c.score))
    .sort((a, b) => b.score - a.score);

  if (valid.length === 0) return { kind: 'confirm', reason: 'no_candidates', candidates: [] };
  const top3 = valid.slice(0, 3);
  const [first, second] = valid as [Candidate, Candidate | undefined];

  if (first.score < threshold)
    return { kind: 'confirm', reason: 'low_confidence', candidates: top3 };
  if (
    second &&
    !sameSet(
      possibleDestinations(first.itemId, context),
      possibleDestinations(second.itemId, context),
    )
  ) {
    return { kind: 'confirm', reason: 'destinations_disagree', candidates: top3 };
  }
  return { kind: 'answer', itemId: first.itemId, confidence: first.score };
}
