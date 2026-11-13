# BinSight: Progress Log

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

### Next
- [ ] Rules engine (test-first)
- [ ] Blind tests (independent subagent)
- [ ] Classifier worker + decide + first eval
- [ ] Core UI

## Decisions (and why)
- **Edmonton post-Oct 1, 2026 rules.** EPR expanded residential recycling (cups, chip bags, foam). Campus keeps the UofA 4-stream rules (EPR doesn't cover institutions), so the context toggle gives genuinely different answers.
- **Model: CLIP ViT-B/32 q8, vision encoder only.** Text embeddings are precomputed offline (fixed prompts), so the browser downloads ~89 MB instead of ~154 MB. 8/9 top-1 on the smoke test, ~107 ms/image on CPU. MobileCLIP gave broken results in our harness, so we skipped it.
- **Uncertain items never guessed:** receipt, tissue, gum, K-cup, plastic utensils and straws (residential), plastic cold cups and utensils (campus) → "Check before you toss".
- **Pizza box (residential), greasy:** the City says "some grease spots are ok". Soaked boxes follow the City's paper-food-packaging rule ("a lot of food residue that can't be removed … garbage").
- **CO2e:** EPA WARM v16 net factors (landfill − recycle). Items with no WARM factor or no weight add 0 (understates impact, never overstates it).
- **Paths:** the spec says `src/rules/` and `src/ml/`. These live in `shared/src/rules` and `shared/src/ml` so the client, server and eval harness all share one copy.

## Open problems
- MobileCLIP not working in our harness (not needed).
- Item weights mostly unmeasured (team TODO #2).

## Merged PRs
| # | Title | Author |
|---|---|---|
