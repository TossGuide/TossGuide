# BinSight: Public API contract (for tests)

Tests import from these module paths (Vitest alias `@binsight/shared` → `shared/src`).
Types live in `shared/src/rules/types.ts`.

## Rules engine: `@binsight/shared/rules/engine`

```ts
type Context = 'edmonton-residential' | 'uofa-campus';
type QuestionId = 'greasy' | 'food_residue' | 'lithium' | 'clean';
type Answers = Partial<Record<QuestionId, boolean>>;

resolve(itemId: string, context: Context, answers?: Answers): Result
```
`Result` is one of:
- `{ ok: true, status: 'final', itemId, itemName, context, destination: Destination, reason: string, prep: string[], sources: Source[], uncertain: boolean, alternative?: { destination: Destination, note: string }, answers }`
- `{ ok: true, status: 'needs_answer', itemId, itemName, context, question: { id: QuestionId, text: string, hint?: string }, answers }`
- `{ ok: false, error: 'unknown_item' | 'invalid_context' | 'empty_input', message: string }`. **Never throws** for bad input (including `undefined`, `null`, `''`, or non-string ids).

`Destination = { id: DestinationId, name, shortName, colour, icon, divertsFromLandfill: boolean, contexts }`

`DestinationId` values:
- Edmonton home: `edm_blue_bag` (Recycling, blue bag), `edm_green_cart` (Food scraps, green cart), `edm_black_cart` (Garbage, black cart)
- Drop-off: `bottle_depot`, `eco_station`
- UofA campus: `uofa_recyclables`, `uofa_mixed_paper`, `uofa_organics`, `uofa_landfill`, `uofa_battery_bin`, `uofa_special` (contact Zero Waste)
- `check_local`: official guidance unclear; `uncertain: true`; `divertsFromLandfill: false`

Every final result has `sources.length >= 1`, and each source has an `https://` URL.
If an item's rule needs an answer that isn't in `answers`, the status is `needs_answer` (one question at a time).
Answers for questions an item doesn't ask are ignored.

Also exported:
```ts
possibleDestinations(itemId: string, context: Context): DestinationId[]  // every outcome reachable via any answers; [] for unknown ids
lookupTyped(text: string): { itemId: string; score: number }[]           // typed input -> ranked candidates (score 0..1, best first); [] for empty/garbage input
```

Item ids live in `shared/src/rules/items.ts` (`ITEMS`, `ITEMS_BY_ID`). Key ids: `coffee_cup`, `coffee_lid`, `cold_cup`, `pizza_box`, `chip_bag`, `candy_wrapper`, `plastic_bag`, `battery`, `pop_can`, `plastic_bottle`, `glass_bottle`, `juice_box`, `milk_carton`, `napkin`, `food_scraps`, `fruit_peel`, `paper_takeout`, `plastic_takeout`, `foam_container`, `receipt`, `tissue`, `gum`, `k_cup`, `phone`, `cable`, `pen`, `mask`, `compostable_plastic`.

Question ids by item: `pizza_box` → `greasy` (both contexts); `paper_takeout` → `food_residue` (home); `battery` → `lithium` (campus); `plastic_takeout`, `plastic_wrap`, `yogurt_cup` → `clean` (campus).

## Decision logic: `@binsight/shared/ml/decide`

```ts
interface Candidate { itemId: string; score: number }   // score = calibrated probability 0..1
type Decision =
  | { kind: 'answer'; itemId: string; confidence: number }
  | { kind: 'confirm'; reason: 'low_confidence' | 'destinations_disagree' | 'no_candidates'; candidates: Candidate[] }; // top 3, best first

decide(candidates: Candidate[], context: Context, opts?: { threshold?: number }): Decision
DEFAULT_THRESHOLD: number  // tuned from the eval set
```
- Input order isn't guaranteed: decide sorts by score.
- Answer directly only if top-1 score ≥ threshold **and** top-1 and top-2 have the same `possibleDestinations` set (for the context). A lone candidate above threshold → answer.
- Otherwise confirm with the top 3. Empty, NaN or unknown-id-only input → `confirm` / `no_candidates` with `candidates: []`. Never throws. Unknown ids are dropped.

## Score aggregation: `@binsight/shared/ml/aggregate`

```ts
aggregate(promptScores: { itemId: string; logit: number }[], opts?: { method?: 'max' | 'mean' | 'logsumexp'; temperature?: number }): Candidate[]
```
Groups prompt logits by item, combines them per `method` (default `'max'`), then applies softmax over items with `temperature` (default 1). Returns all items sorted best first; scores sum to 1.

## Impact: `@binsight/shared/impact/impact`

```ts
interface Tally { scans: number; itemsDiverted: number; co2eKg: number }
EMPTY_TALLY: Tally
impactOf(itemId: string, destinationId: DestinationId): { diverted: boolean; co2eKg: number }
addScan(tally: Tally, itemId: string, destinationId: DestinationId): Tally   // pure, returns a new object
```
- `diverted` is true only if the destination's `divertsFromLandfill` is true (landfill, black cart and `check_local` are never diverted).
- `co2eKg` ≥ 0 and finite; 0 when not diverted, or when the item has no weight or no emission factor.
- Unknown item or destination → `{ diverted: false, co2eKg: 0 }`; the tally still counts the scan.

## Server: `server/src/app.ts`

```ts
createApp(opts: { dataFile: string; rateLimit?: { windowMs: number; max: number }; logger?: (msg: string) => void }): express.Express
FACULTIES: readonly string[]   // exported from @binsight/shared/faculties
```
- `GET /api/health` → `200 { ok: true }`
- `POST /api/scan` body `{ faculty: string (one of FACULTIES), itemId: string (known id), destination: DestinationId, divertedFromLandfill: boolean }` → `201 { ok: true }`. Invalid body → `400 { ok: false, error }`. Over rate limit (per IP) → `429`.
- `GET /api/leaderboard` → `200 { faculties: { faculty: string; itemsDiverted: number; co2eKg: number; scans: number }[] }`, sorted by `itemsDiverted` desc. Starts **empty** (`[]`), with no seed data.
- Storage is a JSON file at `dataFile`. A missing or corrupted file → treated as empty (don't crash), and the server keeps working.
- Responses and logs never contain environment secrets (e.g. `FALLBACK_API_KEY`).
- Tests use `supertest` against `createApp(...)`.
