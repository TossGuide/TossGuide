# BinSight evaluation report

**Data:** Wikimedia Commons dev set (object photos, not venue photos): 93 photos of 25 items · **Model:** Xenova/clip-vit-base-patch32 (q8 vision encoder) · **Generated:** 2026-11-14T01:42:03.988Z
Bins are judged in the `edmonton-residential` context. Regenerate with `npm run eval`.

## Headline
| Metric | Value |
|---|---|
| Top-1 item accuracy | **82.8%** |
| Top-3 item accuracy | 92.5% |
| **Bin-level accuracy** (top-1 lands in the right bin) | **89.2%** |
| Median vision latency (Node, CPU) | 91 ms |
| Chosen threshold | 0.6 → answers 37.6% of scans directly at 97.1% bin accuracy; asks for the rest (right item in the picker 91.4% of the time) |

## Aggregation method (temperature 1)
| Method | Top-1 | Top-3 | Bin |
|---|---|---|---|
| logsumexp | 82.8% | 92.5% | 89.2% |
| max | 79.6% | 92.5% | 84.9% |
| mean | 74.2% | 93.5% | 84.9% |

Chosen: **logsumexp**, temperature **1** (lowest negative log-likelihood, i.e. best calibrated).

## Threshold sweep
"Auto-answer" = shown directly with no tap. Target: ≥ 95.0% bin accuracy on auto-answers.

| Threshold | Auto-answer rate | Auto-answer bin accuracy | Needs confirm | Truth in picker | End-to-end |
|---|---|---|---|---|---|
| 0.05 | 45.2% | 92.9% | 54.8% | 94.1% | 93.5% |
| 0.1 | 45.2% | 92.9% | 54.8% | 94.1% | 93.5% |
| 0.15 | 45.2% | 92.9% | 54.8% | 94.1% | 93.5% |
| 0.2 | 45.2% | 92.9% | 54.8% | 94.1% | 93.5% |
| 0.25 | 45.2% | 92.9% | 54.8% | 94.1% | 93.5% |
| 0.3 | 44.1% | 92.7% | 55.9% | 94.2% | 93.5% |
| 0.35 | 43.0% | 92.5% | 57.0% | 92.5% | 92.5% |
| 0.4 | 41.9% | 94.9% | 58.1% | 90.7% | 92.5% |
| 0.45 | 41.9% | 94.9% | 58.1% | 90.7% | 92.5% |
| 0.5 | 40.9% | 94.7% | 59.1% | 90.9% | 92.5% |
| 0.55 | 38.7% | 94.4% | 61.3% | 91.2% | 92.5% |
| 0.6 ✅ | 37.6% | 97.1% | 62.4% | 91.4% | 93.5% |
| 0.65 | 36.6% | 97.1% | 63.4% | 91.5% | 93.5% |
| 0.7 | 34.4% | 96.9% | 65.6% | 91.8% | 93.5% |
| 0.75 | 33.3% | 96.8% | 66.7% | 90.3% | 92.5% |
| 0.8 | 30.1% | 100.0% | 69.9% | 89.2% | 92.5% |
| 0.85 | 26.9% | 100.0% | 73.1% | 89.7% | 92.5% |
| 0.9 | 20.4% | 100.0% | 79.6% | 90.5% | 92.5% |
| 0.95 | 10.8% | 100.0% | 89.2% | 91.6% | 92.5% |

## Per item
| Item | Photos | Top-1 | Bin | Median ms |
|---|---|---|---|---|
| aluminum foil | 4 | 50.0% | 75.0% | 92 |
| battery | 5 | 80.0% | 80.0% | 84 |
| candy wrapper | 4 | 75.0% | 100.0% | 97 |
| cardboard box | 5 | 80.0% | 80.0% | 92 |
| chip bag | 4 | 100.0% | 100.0% | 88 |
| coffee cup | 5 | 100.0% | 100.0% | 89 |
| cold cup | 5 | 60.0% | 80.0% | 86 |
| egg carton | 4 | 100.0% | 100.0% | 87 |
| foam container | 4 | 100.0% | 100.0% | 92 |
| food can | 2 | 50.0% | 50.0% | 90 |
| food scraps | 1 | 100.0% | 100.0% | 140 |
| fruit peel | 4 | 100.0% | 100.0% | 92 |
| glass bottle | 5 | 100.0% | 100.0% | 89 |
| glass jar | 4 | 100.0% | 100.0% | 90 |
| juice box | 1 | 0.0% | 0.0% | 91 |
| milk carton | 4 | 75.0% | 75.0% | 96 |
| napkin | 4 | 50.0% | 50.0% | 91 |
| paper | 4 | 100.0% | 100.0% | 94 |
| pen | 5 | 100.0% | 100.0% | 94 |
| phone | 3 | 100.0% | 100.0% | 92 |
| pizza box | 4 | 75.0% | 100.0% | 91 |
| plastic bag | 4 | 75.0% | 100.0% | 92 |
| plastic bottle | 1 | 100.0% | 100.0% | 118 |
| plastic takeout | 3 | 100.0% | 100.0% | 84 |
| pop can | 4 | 50.0% | 75.0% | 96 |

## Confusion matrix (rows = truth, columns = top-1 prediction)
| truth \ predicted | aluminum foil | battery | candy wrapper | cardboard box | chip bag | coffee cup | cold cup | egg carton | foam container | food can | food scraps | fruit peel | glass bottle | glass jar | juice box | milk carton | napkin | paper | pen | phone | pizza box | plastic bag | plastic bottle | plastic takeout | pop can | plastic wrap | sandwich wrap | paper takeout | coffee grounds | gloves | paper bag |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **aluminum foil** | **2** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 1 | 1 | · | · | · | · | · |
| **battery** | · | **4** | 1 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| **candy wrapper** | · | · | **3** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 1 | · | · | · | · |
| **cardboard box** | · | · | · | **4** | · | · | · | · | · | · | · | · | · | · | 1 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| **chip bag** | · | · | · | · | **4** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| **coffee cup** | · | · | · | · | · | **5** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| **cold cup** | · | · | · | · | · | 1 | **3** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 1 | · | · | · |
| **egg carton** | · | · | · | · | · | · | · | **4** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| **foam container** | · | · | · | · | · | · | · | · | **4** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| **food can** | · | · | · | · | · | · | · | · | · | **1** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 1 | · | · |
| **food scraps** | · | · | · | · | · | · | · | · | · | · | **1** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| **fruit peel** | · | · | · | · | · | · | · | · | · | · | · | **4** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| **glass bottle** | · | · | · | · | · | · | · | · | · | · | · | · | **5** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| **glass jar** | · | · | · | · | · | · | · | · | · | · | · | · | · | **4** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| **juice box** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 1 | · | · | · | · | · |
| **milk carton** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **3** | · | · | · | · | · | · | · | · | · | · | 1 | · | · | · | · |
| **napkin** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **2** | · | · | · | · | · | · | · | · | · | · | · | · | 2 | · |
| **paper** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **4** | · | · | · | · | · | · | · | · | · | · | · | · | · |
| **pen** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **5** | · | · | · | · | · | · | · | · | · | · | · | · |
| **phone** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **3** | · | · | · | · | · | · | · | · | · | · | · |
| **pizza box** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **3** | · | · | · | · | · | · | 1 | · | · | · |
| **plastic bag** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **3** | · | · | · | · | · | · | · | · | 1 |
| **plastic bottle** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **1** | · | · | · | · | · | · | · | · |
| **plastic takeout** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **3** | · | · | · | · | · | · | · |
| **pop can** | · | · | · | · | · | · | · | · | · | 1 | · | · | · | · | 1 | · | · | · | · | · | · | · | · | · | **2** | · | · | · | · | · | · |

## Failures (honest list)
| Photo | Truth | Top-3 predicted | Right bin anyway? |
|---|---|---|---|
| eval/dev-commons/aluminum_foil/2.jpg | aluminum foil | plastic_wrap 30.8%, egg_carton 23.6%, pop_can 16.4% | yes |
| eval/dev-commons/aluminum_foil/3.jpg | aluminum foil | pop_can 89.6%, aluminum_foil 6.3%, gum 2.0% | **no** |
| eval/dev-commons/battery/1.jpg | battery | candy_wrapper 55.6%, aerosol_can 25.1%, battery 11.3% | **no** |
| eval/dev-commons/candy_wrapper/3.jpg | candy wrapper | sandwich_wrap 44.7%, napkin 36.5%, receipt 8.0% | yes |
| eval/dev-commons/cardboard_box/1.jpg | cardboard box | juice_box 76.7%, milk_carton 6.5%, receipt 4.6% | **no** |
| eval/dev-commons/cold_cup/3.jpg | cold cup | paper_takeout 20.2%, chip_bag 14.5%, cold_cup 13.6% | **no** |
| eval/dev-commons/cold_cup/5.jpg | cold cup | coffee_cup 66.6%, paper_bag 19.8%, cold_cup 4.6% | yes |
| eval/dev-commons/food_can/4.jpg | food can | coffee_grounds 24.6%, battery 19.4%, k_cup 15.9% | **no** |
| eval/dev-commons/juice_box/4.jpg | juice box | plastic_wrap 22.6%, pen 20.7%, juice_box 16.1% | **no** |
| eval/dev-commons/milk_carton/4.jpg | milk carton | sandwich_wrap 36.3%, chip_bag 25.7%, candy_wrapper 10.9% | **no** |
| eval/dev-commons/napkin/1.jpg | napkin | gloves 39.6%, sandwich_wrap 15.8%, plastic_wrap 10.5% | **no** |
| eval/dev-commons/napkin/4.jpg | napkin | gloves 57.1%, plastic_utensil 19.0%, napkin 11.3% | **no** |
| eval/dev-commons/pizza_box/1.jpg | pizza box | paper_takeout 58.5%, paper 29.2%, pizza_box 6.6% | yes |
| eval/dev-commons/plastic_bag/1.jpg | plastic bag | paper_bag 47.2%, chip_bag 39.5%, plastic_bag 10.0% | yes |
| eval/dev-commons/pop_can/2.jpg | pop can | food_can 56.8%, pop_can 9.4%, plastic_takeout 7.8% | **no** |
| eval/dev-commons/pop_can/4.jpg | pop can | juice_box 71.0%, glass_bottle 18.0%, aerosol_can 3.3% | yes |
