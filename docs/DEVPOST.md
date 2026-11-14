# TrashifyYEG: Devpost draft

**Tagline:** Point. Sort. Done. Which Edmonton bin does it go in, and why, in two seconds.

**Prize tracks to select:** Main · Best Environmental Project (ERA) · Best Looking Project.
Best Inclusion of Music only if the team has listened to the sound design on the demo phone and it's genuinely good (it's off by default).

## Inspiration

Standing at a Zero Waste Station in DICE with a coffee cup, nobody knows where it goes, and the answer just changed. On **October 1, 2026**, Alberta's Extended Producer Responsibility rules expanded Edmonton's residential recycling: coffee cups, chip bags, candy wrappers and foam now go in the **blue bag** at home. On campus, the UofA's own bins still send most of those to landfill. Most sorting guides and chatbots haven't caught up. We wanted a tool that knows *Edmonton's* rules as of *this month*, and admits when it isn't sure.

## What it does

Point your phone at an item. TrashifyYEG recognizes it on the device and tells you the exact bin, in the City's or UofA's own words and colours, plus a one-line reason, prep steps ("lid off, lid goes in separately") and a link to the official source.

- **Home / Campus toggle:** the same coffee cup goes to the blue bag at home and to Landfill on campus.
- **Contamination check:** when the rule depends on condition, it asks one yes/no question (greasy pizza box? lithium battery?).
- **Never confidently wrong:** if it's unsure, or its top two guesses go in different bins, it shows "Is this a…?" with the top 3. Items the City doesn't clearly cover say "Check before you toss".
- **Bottle depot:** refundable drinks go to the depot, with the 10¢/25¢ refund.
- **Impact:** a personal tally of items kept out of landfill with a cited CO₂e estimate, and a live faculty leaderboard.
- **Works offline**, keeps your photo on your phone, can read the answer aloud, and is fully keyboard and screen-reader accessible.

## How we built it

- **On-device AI:** OpenAI's CLIP (ViT-B/32, int8) running in a Web Worker with Transformers.js and ONNX Runtime WASM. No training. We wrote 120 text prompts for 44 item types and precomputed their embeddings, so phones download only the ~89 MB vision encoder.
- **Decision logic:** a pure function that answers only when the top score clears a threshold *and* the top two candidates end up in the same bins. The threshold, temperature and aggregation are chosen by our eval harness, not by hand.
- **Rules engine:** hand-written TypeScript rule trees for 44 items × 2 contexts, researched from City of Edmonton, BCMB and UofA pages. Every rule cites its source.
- **Evaluation harness:** `npm run eval` runs the same model in Node over labelled photos and reports top-1/top-3/bin accuracy, a confusion matrix, latency and a threshold sweep, then writes the calibration the app uses.
- **Backend:** a tiny Express + zod API for the leaderboard, with per-IP rate limiting and crash-safe JSON storage. CO₂e is computed on the server from the same shared module.
- **Frontend:** vanilla TypeScript + Vite, mobile-first, bin-coloured cards with icons and text (never colour alone), a hand-written service worker for offline, and a Web Audio chime per bin.
- **Testing:** 244 unit/integration tests, a blind holdout suite written by a separate agent from the spec alone, and 37 headed Playwright tests (fake camera, offline, axe accessibility, visual regression, real-model runs).

## Challenges we ran into

- **The rules changed six weeks ago.** Reconciling the City's new EPR pages with older pages (and campus rules that didn't change) took careful reading. Where the City is unclear (receipts, tissues, utensils), we chose "check first" over guessing.
- **"Accurate" isn't enough for sorting.** A 94%-confident pop can whose runner-up is a food can still goes to a *different* bin, so we ask. That makes the app ask often, a trade-off we chose deliberately.
- **Offline ML in the browser:** self-hosting the ONNX runtime and getting a service worker and Transformers.js's cache to cooperate.
- **Honest evaluation without venue photos (yet):** we built a reviewed set of freely licensed photos, removed anything showing people, and labelled every number with where it came from.

## Accomplishments that we're proud of

- 89.2% bin-level accuracy on our 93-photo dev set, and 97.1% when it answers without asking, with the threshold chosen from data.
- It catches its own mistakes: the AA battery photo it once called a "candy wrapper" now goes to the picker.
- Works in airplane mode after one visit.
- A blind test suite that the implementation had to satisfy without anyone editing the tests.

## What we learned

- Zero-shot models are great at "what is it" and terrible at "where does it go". Keep those two jobs separate.
- Measure before you tune: prompt tweaks we were sure about moved accuracy by only a couple of points.
- Local rules are the product. The model is just the input device.

## What's next

- Re-run the eval on venue photos and a few-shot k-NN boost for items CLIP confuses.
- Weigh common items for a fuller CO₂e estimate.
- QR codes on Zero Waste Stations that open TrashifyYEG in campus mode.
- More cities as data files: the engine doesn't change, only the cited rules.

## Built with

TypeScript · Vite · Transformers.js · ONNX Runtime Web · OpenAI CLIP · Express · zod · Vitest · Playwright · axe-core · Web Audio API · Web Speech API · Service Workers
