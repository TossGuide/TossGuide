# Evaluation

`npm run eval` runs the real classifier (same model, prompts and scoring code as the app) over
labelled photos and writes `REPORT.md`, `summary.json`, `shared/src/ml/eval-summary.json` (shown on
the About screen) and `shared/src/ml/calibration.json` (aggregation method, temperature and threshold
the app uses).

```bash
npm run eval -- --dir eval/images --label "venue eval set"                  # team photos (the real test)
npm run eval -- --dir eval/dev-commons --label "Wikimedia Commons dev set"  # what REPORT.md shows now
npm run eval -- --dir <dir> --no-calibrate                                   # report only, don't retune
```

## Photo sets

| Set | What | Status |
|---|---|---|
| `eval/images/<itemId>/*.jpg` | **Venue set**: ~5 photos each of ~15–20 items, taken by the team at the venue (no faces). | Not collected yet |
| `eval/dev-commons/<itemId>/*.jpg` | **Dev set**: 93 freely licensed object photos of 25 items from Wikimedia Commons, fetched by `eval/scripts/fetch-commons-devset.py` and reviewed by hand on contact sheets (71 off-topic photos, duplicates or photos showing people deleted). Credits and licences: `dev-commons/CREDITS.md`. | Used for the current numbers |

The dev set is **not** the venue test. Web photos are cleaner (studio shots, product photos) in some
ways and stranger (art, close-ups) in others. Re-run on the venue set and expect the numbers to move.

## Tuning done on the dev set (Nov 14)

- **Aggregation:** logsumexp beat max and mean on top-1 (see REPORT.md).
- **Prompts:** added prompts for battery, pop can, plastic bottle, napkin and juice box (each item stays
  at 2–4 prompts). Same 93 photos, old vs new prompts: top-1 80.6% → 82.8%, bin-level 87.1% → 89.2%.
  We chose the new prompts after looking at these photos' failures, so this gain is optimistic.
- **Threshold:** 0.6, the lowest threshold where auto-answers reach ≥ 95% bin accuracy
  (97.1% on 37.6% of photos). At the old placeholder (0.5), the AA battery photo was auto-answered as a
  candy wrapper (→ blue bag). At 0.6 it goes to the picker, with Battery in the top 3.

## Known failure modes (honest list)

- **The "top-2 must agree" rule** means most photos (62%) get a one-tap confirmation, even when the
  model is confident, because the runner-up item goes to a different bin (e.g. pop can vs food can,
  depot vs blue bag). This is by design: a wrong bin is worse than a tap.
- **One confident wrong answer** on the dev set: a printed cardboard box read as a juice box (77%) with
  a milk carton as runner-up, so both point at the bottle depot. Product-print boxes look like cartons
  to CLIP.
- Napkins wrapped around cutlery are read as gloves; crumpled foil can look like a pop can.
