# TossGuide: Research Findings

Researched Fri Nov 13, 2026 (HackEd Beta 2026). Every rule in `shared/src/rules/rules.ts` cites one of the sources below, by id.

## 1. City of Edmonton streams (residential)

| Stream | Official name & container | Collected | Source |
|---|---|---|---|
| Recycling | "see-through blue bags" (apartments: building's blue bin) | weekly | [Curbside Collection][edm_curbside] |
| Food scraps | "green food scraps cart" | weekly spring–fall, every 2 weeks in winter | [Curbside Collection][edm_curbside] |
| Garbage | "black garbage cart" (120 L or 240 L) | every 2 weeks | [Curbside Collection][edm_curbside] |
| Yard waste | paper or see-through bags, seasonal | 2× spring, 2× fall | [Curbside Collection][edm_curbside] |
| Hazardous & electronics | Eco Stations (Ambleside, Kennedale, Strathcona; Coronation closed until spring 2027) | drop-off, free for HHW/e-waste | [Eco Station accepted items][edm_eco_station] |

### ⚡ Big finding: Edmonton's recycling list changed on **Oct 1, 2026**
Alberta's **Extended Producer Responsibility (EPR)** regulation moved recycling costs to producers (the PRO for packaging is Circular Materials). Starting **Oct 1, 2026**, Edmonton residential recycling accepts ([Recycling page][edm_recycling], [EPR page][edm_epr]):
- **paper to-go cups** ("remove lids and place separately in recycling") and **plastic to-go cups** ("keep lids on")
- **takeout containers** (plastic, foil and paper), fast food paper bags, boxes and wraps
- **all food bags** (chip bags, cereal bags) and **all food wrappers** (candy and snack wrappers)
- **foam packaging** (takeout containers, cups, meat trays, blocks)
- "All plastic packaging is accepted in your recycling, regardless of this symbol" (resin codes don't matter any more)

Most online sorting guides (and AI chatbots) still say coffee cups and chip bags are garbage. **That answer is now wrong for Edmonton homes.** This is TossGuide's clearest "hyper-local and current" advantage.

**Conflict noted:** the City's [Waste Sorting in the Public Space][edm_public] page (City facilities and parks sorting stations) still lists "chip bags/candy wrappers" and "coffee cups" under Garbage. EPR covers the *residential* sector only ("EPR focuses on the residential sector"), so public and institutional bins can differ. TossGuide's residential mode follows the residential rules; we don't model public sorting stations.

### Other key residential rules
- **Pizza boxes:** recycling, "remove liner and any food chunks, some grease spots are ok" ([Recycling][edm_recycling]).
- **Paper takeout containers and cups:** *not* the food scraps cart (thick paper clogs the screens). Put them in recycling; "If they have a lot of food residue that can't be removed, such as sauces, please put them in the garbage." ([Food Scraps → Tricky Items][edm_food_scraps])
- **"Compostable" plastics** (including BPI/BNQ certified) → **garbage**. They don't break down in the City's process ([Food Scraps][edm_food_scraps], [poster][edm_poster]).
- **Food-soiled paper towel and napkins; coffee grounds, filters, tea bags** → green cart ([Food Scraps][edm_food_scraps]).
- **Beverage containers:** "It's best to return beverage containers to a Bottle Depot for a refund. This includes beverage bottles, cans, milk cartons, juice boxes and milk jugs. If this isn't an option, you can put them in your recycling." ([Recycling][edm_recycling])
- **Batteries and electronics:** "If it has a battery or cord, it goes to an Eco Station." Lithium-ion batteries are a "serious fire risk" in recycling ([poster][edm_poster], [Recycling][edm_recycling]).
- **Broken glass** → sealed box in garbage (not recycling) ([Curbside][edm_curbside]).
- **Books** are no longer accepted in recycling ([Recycling][edm_recycling]). Not modelled.

## 2. Alberta beverage container deposit
- Refund: **10¢ for registered containers 1 L or less, 25¢ over 1 L**, based on size only, not material ([BCMB depot compliance][bcmb_refunds]; [Alberta Depot FAQ](https://www.albertadepot.ca/frequently-asked-questions)).
- Eligible: ready-to-drink beverage containers including cans, bottles, cartons, juice boxes, milk (all types, including dairy alternatives); drink mixes became deposit-bearing July 1, 2025 ([BCMB guide][bcmb_guide]).
- Not eligible: soup/broth cartons, cooking coconut milk, concentrates that need dilution, infant formula, containers not registered in Alberta ([BCMB guide][bcmb_guide]).
- TossGuide: beverage containers → **Bottle depot** (primary), with the City-approved alternative "blue bag".

## 3. University of Alberta campus bins
Official source found: the **[UofA 4-Stream Zero Waste System cheat sheet][uofa_cheatsheet]** (linked from [How to Recycle][uofa_how_to]; file dated 2021).

| Stream | Colour on signage | Highlights |
|---|---|---|
| **Recyclables** | blue | clean plastic film (bags, cling wrap, bubble wrap); plastic containers; beverage containers ("CAPS MUST BE REMOVED"); glass jars; aluminum foil; steel cans; empty aerosols; plastic pens. "NO plastic #3, #6 or #7 (Styrofoam, plastic coffee/pop cup lids, straws, CDs, K-cups)" |
| **Organics** | green | all food; paper/cardboard food containers; wet or soiled cardboard/paper; paper towel, facial tissue and napkins; parchment, waxed paper and paper sub wrappers; **receipts**; coffee filters; wood stir sticks. "NO plastics (other than the bag), coffee/pop cups or gum" |
| **Mixed Paper** | yellow/orange | printer paper, newspapers, magazines, paper bags, egg cartons, flattened cardboard ("MUST BE FLATTENED"). "NO paper towel/facial tissue/napkins" |
| **Landfill** | black | #3/#6/#7 plastics, **coffee cups (unless BPI certified compostable)**, **chip bags, granola bar wrappers**, latex gloves, foam packing, **unclean recyclables**, tape, chewing gum |

Special streams ([How to Recycle][uofa_how_to]): campus **battery bins** for alkaline, coin-cell and NiCd/NiMH/NiZn (tape 9V+ terminals); **lithium-ion** batteries must never go in battery bins (tape the terminals, email zerowaste@ualberta.ca); pens and markers go to "Pen Recycling" boxes; equipment goes through Surplus Services.

**Campus ≠ home.** Because EPR doesn't cover institutions, campus still sends coffee cups, lids, chip bags, wrappers and foam to **Landfill**, while the same items go in the **blue bag** at home. TossGuide's context toggle shows this live.

**TODO (team):** the cheat sheet is dated 2021. Photograph the actual Zero Waste Station labels in DICE / CCIS to confirm they match, and note any differences in PROGRESS.md.

## 4. Rules table (generated from code: `npx tsx eval/gen-rules-table.ts`)
⚠️ *uncertain* = official guidance doesn't clearly cover this item. The app shows "Check before you toss" with a link to WasteWise or UofA Zero Waste, and never gives a confident guess.

| Item | Edmonton home | UofA campus |
|---|---|---|
| Pop can (`pop_can`) | Bottle depot [edm_recycling, bcmb_refunds] | Recyclables [uofa_cheatsheet] |
| Plastic drink bottle (`plastic_bottle`) | Bottle depot [edm_recycling, bcmb_refunds] | Recyclables [uofa_cheatsheet] |
| Glass drink bottle (`glass_bottle`) | Bottle depot [edm_recycling, bcmb_refunds] | Recyclables [uofa_cheatsheet] |
| Juice box (`juice_box`) | Bottle depot [edm_recycling, bcmb_refunds] | Recyclables [uofa_cheatsheet] |
| Milk carton (`milk_carton`) | Bottle depot [edm_recycling, bcmb_refunds] | Recyclables [uofa_cheatsheet] |
| Paper coffee cup (`coffee_cup`) | Blue bag [edm_recycling, edm_epr] | Landfill [uofa_cheatsheet] |
| Plastic coffee cup lid (`coffee_lid`) | Blue bag [edm_recycling] | Landfill [uofa_cheatsheet] |
| Plastic cold drink cup (`cold_cup`) | Blue bag [edm_recycling] | Check ⚠️ *uncertain* [uofa_cheatsheet] |
| Plastic takeout container (`plastic_takeout`) | Blue bag [edm_recycling] | **Q: Is it empty and rinsed clean?** Yes → Recyclables [uofa_cheatsheet]; No → Landfill [uofa_cheatsheet] |
| Foam (Styrofoam) container or cup (`foam_container`) | Blue bag [edm_recycling, edm_eco_station] | Landfill [uofa_cheatsheet] |
| Paper takeout box (`paper_takeout`) | **Q: Is there food or sauce stuck on it that you can’t scrape or rinse off?** Yes → Black cart [edm_food_scraps]; No → Blue bag [edm_recycling, edm_food_scraps] | Organics [uofa_cheatsheet] |
| Pizza box (`pizza_box`) | **Q: Is it soaked with grease or food that won’t come off?** Yes → Black cart [edm_food_scraps, edm_recycling]; No → Blue bag [edm_recycling] | **Q: Is it soaked with grease or food that won’t come off?** Yes → Organics [uofa_cheatsheet]; No → Mixed Paper [uofa_cheatsheet] |
| Paper sandwich wrapper (`sandwich_wrap`) | Blue bag [edm_recycling] | Organics [uofa_cheatsheet] |
| Plastic utensil (`plastic_utensil`) | Check ⚠️ *uncertain* [edm_recycling, edm_wastewise] | Check ⚠️ *uncertain* [uofa_cheatsheet] |
| Plastic straw (`plastic_straw`) | Check ⚠️ *uncertain* [edm_recycling, edm_wastewise] | Landfill [uofa_cheatsheet] |
| “Compostable” plastic cup or cutlery (`compostable_plastic`) | Black cart [edm_food_scraps, edm_poster] | Landfill [uofa_cheatsheet] |
| Chip bag (`chip_bag`) | Blue bag [edm_recycling, edm_epr] | Landfill [uofa_cheatsheet] |
| Candy or granola bar wrapper (`candy_wrapper`) | Blue bag [edm_recycling, edm_epr] | Landfill [uofa_cheatsheet] |
| Plastic bag (`plastic_bag`) | Blue bag [edm_recycling] | Recyclables [uofa_cheatsheet] |
| Plastic wrap / film (`plastic_wrap`) | Blue bag [edm_recycling] | **Q: Is it empty and rinsed clean?** Yes → Recyclables [uofa_cheatsheet]; No → Landfill [uofa_cheatsheet] |
| Yogurt cup or tub (`yogurt_cup`) | Blue bag [edm_recycling] | **Q: Is it empty and rinsed clean?** Yes → Recyclables [uofa_cheatsheet]; No → Landfill [uofa_cheatsheet] |
| Food scraps / leftovers (`food_scraps`) | Green cart [edm_food_scraps] | Organics [uofa_cheatsheet] |
| Fruit peel or core (`fruit_peel`) | Green cart [edm_food_scraps] | Organics [uofa_cheatsheet] |
| Coffee grounds or tea bag (`coffee_grounds`) | Green cart [edm_food_scraps] | Organics [uofa_cheatsheet] |
| Used napkin or paper towel (`napkin`) | Green cart [edm_food_scraps] | Organics [uofa_cheatsheet] |
| Facial tissue (`tissue`) | Check ⚠️ *uncertain* [edm_food_scraps, edm_recycling, edm_wastewise] | Organics [uofa_cheatsheet] |
| Paper (`paper`) | Blue bag [edm_recycling] | Mixed Paper [uofa_cheatsheet] |
| Newspaper or magazine (`newspaper`) | Blue bag [edm_recycling] | Mixed Paper [uofa_cheatsheet] |
| Cardboard box (`cardboard_box`) | Blue bag [edm_recycling] | Mixed Paper [uofa_cheatsheet] |
| Paper bag (`paper_bag`) | Blue bag [edm_recycling] | Mixed Paper [uofa_cheatsheet] |
| Paper egg carton (`egg_carton`) | Blue bag [edm_recycling] | Mixed Paper [uofa_cheatsheet] |
| Receipt (`receipt`) | Check ⚠️ *uncertain* [edm_recycling, edm_food_scraps, edm_wastewise] | Organics [uofa_cheatsheet] |
| Aluminum foil (`aluminum_foil`) | Blue bag [edm_recycling] | Recyclables [uofa_cheatsheet] |
| Food can (`food_can`) | Blue bag [edm_recycling] | Recyclables [uofa_cheatsheet] |
| Glass jar (`glass_jar`) | Blue bag [edm_recycling] | Recyclables [uofa_cheatsheet] |
| Empty aerosol can (`aerosol_can`) | Blue bag [edm_recycling] | Recyclables [uofa_cheatsheet] |
| Battery (`battery`) | Eco Station [edm_eco_station, edm_poster, edm_recycling] | **Q: Is it a lithium-ion battery (phone, laptop, vape, power bank)?** Yes → Special [uofa_how_to]; No → Battery bin [uofa_how_to] |
| Phone or small electronic (`phone`) | Eco Station [edm_eco_station, edm_poster] | Eco Station [uofa_how_to, edm_eco_station] |
| Cable or charger (`cable`) | Eco Station [edm_eco_station, edm_poster, edm_recycling] | Eco Station [uofa_how_to, edm_eco_station] |
| Pen or marker (`pen`) | Black cart [edm_poster, edm_curbside] | Recyclables [uofa_cheatsheet] |
| Face mask (`mask`) | Black cart [edm_poster] | Landfill [uofa_cheatsheet] |
| Disposable gloves (`gloves`) | Black cart [edm_poster] | Landfill [uofa_cheatsheet] |
| Chewing gum (`gum`) | Check ⚠️ *uncertain* [edm_food_scraps, edm_recycling, edm_wastewise] | Landfill [uofa_cheatsheet] |
| Coffee pod (K-Cup) (`k_cup`) | Check ⚠️ *uncertain* [edm_recycling, edm_food_scraps, edm_wastewise] | Landfill [uofa_cheatsheet] |

Source ids → URLs: see `shared/src/rules/sources.ts` and the links at the bottom of this file.

## 5. Model research & benchmark

**Approach:** zero-shot CLIP-family model via Transformers.js (ONNX Runtime Web; WebGPU when available, otherwise WASM). Because our prompts are fixed, we **precompute the text embeddings offline** (`npm run embed`) and the browser downloads **only the vision encoder**. This roughly halves the download, and the text model never runs on the phone.

Candidate sizes (from the Hugging Face API, `onnx/` folders):

| Model | Vision encoder (q8) | Text encoder (q8, offline only) | Licence |
|---|---|---|---|
| [Xenova/clip-vit-base-patch32](https://huggingface.co/Xenova/clip-vit-base-patch32) (OpenAI CLIP ViT-B/32) | 89 MB | 65 MB | MIT |
| [Xenova/mobileclip_s0](https://huggingface.co/Xenova/mobileclip_s0) (Apple MobileCLIP) | 12 MB | 43 MB | Apple ml-mobileclip (code MIT) |
| [Xenova/mobileclip_s2](https://huggingface.co/Xenova/mobileclip_s2) | 37 MB | 64 MB | as above |
| [Xenova/siglip-base-patch16-224](https://huggingface.co/Xenova/siglip-base-patch16-224) | 99 MB | 111 MB | not stated on card, so not benchmarked |

**Preliminary benchmark** (`npx tsx eval/benchmark-models.ts <dir>`): 9 openly licensed object photos from Wikimedia Commons (no people; kept out of the repo), classified against all 44 items and 115 prompts with max-aggregation, Node 24 on a laptop CPU:

| Model | dtype | top-1 | top-3 | median vision latency |
|---|---|---|---|---|
| CLIP ViT-B/32 | q8 | **8/9** | 9/9 | **107 ms** |
| CLIP ViT-B/32 | fp32 | 8/9 | 9/9 | 120 ms |
| MobileCLIP S0 | q8 | 0/9 | 0/9 | 210 ms |
| MobileCLIP S2 | q8 | 0/9 | 1/9 | 484 ms |

(The banana image was first scored under the wrong label, `banana_peel`, which isn't an item id. Every model ranked `fruit_peel` first or third for it, and the numbers above use the correct label.)
MobileCLIP produced near-random rankings through the generic `CLIPVisionModelWithProjection` path. This is most likely a preprocessing or quantization mismatch in our harness, not the model itself. Given the 24 h budget we didn't debug it further.

**Decision:** **CLIP ViT-B/32, q8 vision encoder (~89 MB, MIT licence)**. It has the best accuracy, is fast, and stays under the ~150 MB target. It's cached by the service worker after first load. Phone latency is to be measured during the demo checklist. 9 web images is only a smoke test: the real numbers come from `npm run eval` on the team's venue photos.

## 6. Emission factors (impact tally)

Source: **US EPA WARM v16** (Dec 2023), net emissions in MTCO2E per short ton, which includes avoided manufacturing ([containers, packaging & non-durable goods chapter](https://www.epa.gov/system/files/documents/2023-12/warm_containers_packaging_and_non-durable_goods_materials_v16_dec.pdf), Exhibits 1-4, 2-7, 3-7, 5-3; [organic materials chapter](https://www.epa.gov/system/files/documents/2023-12/warm_organic_materials_v16_dec.pdf), Exhibit 1-10).
Saving = landfilling − recycling (or composting). kg CO2e per kg = MTCO2E per short ton ÷ 0.907185.

| WARM material | Landfilled | Recycled / composted | Saving (MTCO2E/short ton) | **Saving (kg CO2e per kg)** |
|---|---|---|---|---|
| Aluminum cans | 0.02 | -9.13 | 9.15 | **10.09** |
| Steel cans | 0.02 | -1.83 | 1.85 | **2.04** |
| Glass | 0.02 | -0.28 | 0.30 | **0.33** |
| PET | 0.02 | -1.04 | 1.06 | **1.17** |
| HDPE | 0.02 | -0.76 | 0.78 | **0.86** |
| Mixed plastics | 0.02 | -0.93 | 0.95 | **1.05** |
| Corrugated containers | 0.18 | -3.14 | 3.32 | **3.66** |
| Mixed paper (general) | 0.07 | -3.55 | 3.62 | **3.99** |
| Food waste (composted) | 0.50 | -0.15 | 0.65 | **0.72** |

- WARM has **no recycling factor** for LDPE/film, polystyrene foam or cartons, so those items count as "diverted" but add **0 kg CO2e**. That understates the impact, which is the honest direction.
- WARM is US-grid based, so for Alberta it's an estimate. The UI labels it "estimate" and links here.
- The [EPA GHG Emission Factors Hub 2025, Table 9](https://www.epa.gov/system/files/documents/2025-01/ghg-emission-factors-hub-2025.pdf) gives scope-3 "waste generated" factors that **exclude** avoided emissions, so it isn't suitable for a "saved" number. We noted it and didn't use it.

**Item weights:** the only cited value we found is the average aluminum can, **12.97 g** (Aluminum Association and Can Manufacturers Institute, via [AL Circle](https://www.alcircle.com/news/aluminum-can-maintains-position-as-most-sustainable-beverage-container-24961)). Other weights are `null` until the **team weighs the demo props with a kitchen scale** (TODO in PROGRESS.md). Until then those items count toward "items diverted" but add 0 g to the CO2e figure. We don't invent weights.

## 7. Optional cloud fallback
Not required: the app works fully on-device. If we have time, `POST /api/fallback` can proxy a vision-capable LLM API with a free tier. The key lives only in server `.env`, the route is disabled when the key is empty, and users see a one-time notice before any photo leaves the device. Not researched further: it isn't on the critical path.

[edm_recycling]: https://www.edmonton.ca/programs_services/garbage_waste/recycling
[edm_food_scraps]: https://www.edmonton.ca/programs_services/garbage_waste/food-scraps
[edm_curbside]: https://www.edmonton.ca/programs_services/garbage_waste/curbside-cart-collection
[edm_poster]: https://www.edmonton.ca/sites/default/files/public-files/assets/PDF/what-goes-where-poster-universal.pdf
[edm_eco_station]: https://www.edmonton.ca/programs_services/garbage_waste/eco-station-acceptable-items
[edm_epr]: https://www.edmonton.ca/programs_services/garbage_waste/extended-producer-responsibility
[edm_public]: https://www.edmonton.ca/programs_services/garbage_waste/waste-sorting-public-space
[bcmb_refunds]: https://www.bcmb.ab.ca/depot-owners-operators/depot-compliance/
[bcmb_guide]: https://www.bcmb.ab.ca/news/guide-redeeming-beverage-deposits-alberta-57/
[uofa_cheatsheet]: https://www.ualberta.ca/en/campus-operations-services/media-library/documents/waste-system-cheat-sheet-2021.pdf
[uofa_how_to]: https://www.ualberta.ca/en/campus-operations-services/buildings-grounds/recycling/how-to-recycle.html
