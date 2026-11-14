# TossGuide: Progress Log

> ⏰ **Deadline: Sat Nov 14, 12:00 pm MT.** Feature-complete by 6:00 am, final push by **11:00 am**.
> **No commits, pushes or merges after 12:00 pm.** Make the repo **public** before submitting on Devpost.
> Every change lands through a PR. Never push to `main` (a local pre-push hook blocks it).

## 📸 TEAM TODO (do early, ~30 min, in parallel)
1. **Eval photos:** photograph ~5 real examples each of ~15–20 items at the venue. Use different angles, lighting and backgrounds, held in hand. **No faces.** Save as `eval/images/<itemId>/<n>.jpg`, using ids from `shared/src/rules/items.ts`. Priority ids: `coffee_cup`, `coffee_lid`, `pop_can`, `plastic_bottle`, `chip_bag`, `candy_wrapper`, `pizza_box`, `napkin`, `fruit_peel`, `plastic_bag`, `battery`, `paper`, `cardboard_box`, `plastic_takeout`, `juice_box`, `cold_cup`, `glass_jar`, `pen`, `receipt`, `tissue`.
2. **Weigh the demo props** with a kitchen scale, then fill in `weightG` + `weightSource: 'measured at venue'` in `items.ts`. Until then those items add 0 g to the CO2e estimate.
3. **Campus bin labels:** photograph a Zero Waste Station in DICE/CCIS and compare it with the 2021 UofA cheat sheet (docs/RESEARCH.md §3).

## Git workflow
- Branches: `sanika/<feature>` (Phase 1), `aditya/<feature>` (Phase 2). Pushed by Claude under the phase owner's identity (`ghswitch`).
- **PRs are opened, reviewed and merged by the humans**, on GitHub.
- Branches are stacked: each new branch starts from the previous one, so work isn't blocked on merges. **Merge the PRs in order** (oldest first). Prefer "Rebase and merge" or "Create a merge commit"; a squash merge of a stacked branch can show the earlier commits again in the next PR.
- Please enable branch protection on `main` (Settings → Branches: require a PR, block force pushes).

## Status
### Done
- [x] Repo scaffold (npm workspaces: `shared/`, `client/`, `server/`), `.gitignore` before the first commit, `.env.example`, pre-push guard, attribution disabled in `.claude/settings.json`
- [x] §2 Research → `docs/RESEARCH.md` (Checkpoint A)

- [x] Rules engine (test-first), blind tests (independent subagent), classifier worker + decide + first eval, core UI (Phase 1, Sanika)
- [x] Leaderboard backend: Express + zod, per-IP rate limit, crash-safe JSON storage; server blind tests enabled (Phase 2, Aditya)
- [x] Impact tally + faculty picker + leaderboard UI, offline outbox for scans
- [x] Offline mode: self-hosted ONNX runtime, hand-written service worker, PWA manifest + icons (verified: offline reload still loads the model and sorts)
- [x] Polish: About screen (pipeline, measured accuracy, confusion matrix, sources), sound design (off by default), read-aloud, picker "best guess", ESLint
- [x] Playwright suite: 37 headed tests, mobile + desktop, fake camera, axe, visual regression, 4 real-model tests
- [x] Eval tuning on a curated Wikimedia Commons dev set (93 photos, 25 items): logsumexp, T=1, threshold 0.6
- [x] Docs: README, docs/DEVPOST.md, docs/DEMO_SCRIPT.md, docs/DEMO_CHECKLIST.md, docs/screenshots/

### Next (team, at the venue)
- [ ] TEAM TODO 1-3 above (venue photos, weigh props, campus bin labels), then `npm run eval -- --dir eval/images --label "venue eval set"` and commit the new REPORT/calibration through a PR
- [ ] Fill in docs/DEMO_CHECKLIST.md on the demo phone
- [ ] Listen to the sound design on the demo phone; select the Music track only if it's good
- [ ] Make the repo public, submit on Devpost (draft in docs/DEVPOST.md)

### Not done (cut or out of time)
- `docs/HANDOFF.md` (Phase 1 handoff doc) was never written; this file covers the same ground.
- Optional cloud fallback (`POST /api/fallback`): not built. The app needs no API keys.
- Stretch: multi-item scan, quiz mode, few-shot k-NN, French toggle. Voice answer is done.

## Decisions (and why)
- **Edmonton post-Oct 1, 2026 rules.** EPR expanded residential recycling (cups, chip bags, foam). Campus keeps the UofA 4-stream rules (EPR doesn't cover institutions), so the context toggle gives genuinely different answers.
- **Model: CLIP ViT-B/32 q8, vision encoder only.** Text embeddings are precomputed offline (fixed prompts), so the browser downloads ~89 MB instead of ~154 MB. 8/9 top-1 on the smoke test, ~107 ms/image on CPU. MobileCLIP gave broken results in our harness, so we skipped it.
- **Uncertain items never guessed:** receipt, tissue, gum, K-cup, plastic utensils and straws (residential), plastic cold cups and utensils (campus) → "Check before you toss".
- **Pizza box (residential), greasy:** the City says "some grease spots are ok". Soaked boxes follow the City's paper-food-packaging rule ("a lot of food residue that can't be removed … garbage").
- **CO2e:** EPA WARM v16 net factors (landfill − recycle). Items with no WARM factor or no weight add 0 (understates impact, never overstates it).
- **Server rejects impossible scans.** A scan whose destination the rules can't produce for that item (or whose `divertedFromLandfill` contradicts the bin) gets 400, and CO2e is computed server-side, so the leaderboard can't be inflated by a hand-made request.
- **Tally counts a scan once.** "Not right?" corrections and the Home/Campus toggle replace the scan instead of adding one; the server post waits until the user moves on.
- **Top-2 rule kept literal.** Even at 95% confidence, a runner-up in a different bin means we ask (the blind tests require it). On the dev set that's 62% of photos asking for a tap, at 97.1% bin accuracy when we do answer.
- **Dev set instead of guessing the threshold.** No venue photos yet, so we tuned on 93 hand-reviewed Wikimedia Commons object photos (credits in eval/dev-commons/CREDITS.md; photos showing people removed). Every number is labelled with its data set.
- **No vite-plugin-pwa.** A small hand-written service worker + Vite plugin (client/build/offline-plugin.ts) that the team can read end to end.
- **Renamed BinSight → Trashify → TossGuide** (Nov 14). Everything was renamed both times: UI, docs, packages (`@tossguide/*`), storage keys, caches, server, scripts, database. The blind tests changed only in import paths and temp-file names, with no assertions touched. Old `binsight.*`/`trashify.*` localStorage keys and old service-worker caches are migrated or cleaned up on first load, so existing tallies survive.
- **Paths:** the spec says `src/rules/` and `src/ml/`. These live in `shared/src/rules` and `shared/src/ml` so the client, server and eval harness all share one copy.

## Open problems
- Item weights mostly unmeasured (team TODO #2): only the pop can adds CO2e.
- Accuracy is from web photos; venue numbers pending (team TODO #1).
- One confident wrong answer on the dev set: a printed cardboard box read as a juice box (see eval/README.md).
- MobileCLIP not working in our harness (not needed).

## Merged PRs
| # | Title | Author |
|---|---|---|
| 1 | Scaffold monorepo + research findings | SanikaVerma |
| 2 | Rules engine, decision logic, aggregation and impact (test-first) | SanikaVerma |
| 3 | Blind holdout test suite | SanikaVerma |
| 4 | On-device classifier, eval harness and core UI | SanikaVerma |

Phase 2 PRs (Aditya), stacked; merge in this order: `aditya/leaderboard-backend` → `aditya/impact-tally` → `aditya/offline-mode` → `aditya/polish` → `aditya/e2e-tests` → `aditya/eval-tuning` → `aditya/docs`. Add each to this table when merged.
