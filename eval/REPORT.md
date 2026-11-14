# BinSight evaluation report

**Data:** SMOKE TEST (9 Wikimedia images, not venue photos): 9 photos of 9 items · **Model:** Xenova/clip-vit-base-patch32 (q8 vision encoder) · **Generated:** 2026-11-13T21:20:42.250Z
Bins are judged in the `edmonton-residential` context. Regenerate with `npm run eval`.

## Headline
| Metric | Value |
|---|---|
| Top-1 item accuracy | **77.8%** |
| Top-3 item accuracy | 100.0% |
| **Bin-level accuracy** (top-1 lands in the right bin) | **88.9%** |
| Median vision latency (Node, CPU) | 113 ms |
| Chosen threshold | 0.55 → answers 44.4% of scans directly at 100.0% bin accuracy; asks for the rest (right item in the picker 100.0% of the time) |

## Aggregation method (temperature 1)
| Method | Top-1 | Top-3 | Bin |
|---|---|---|---|
| mean | 77.8% | 100.0% | 88.9% |
| max | 66.7% | 100.0% | 88.9% |
| logsumexp | 66.7% | 100.0% | 88.9% |

Chosen: **mean**, temperature **1** (lowest negative log-likelihood, i.e. best calibrated).

## Threshold sweep
"Auto-answer" = shown directly with no tap. Target: ≥ 95.0% bin accuracy on auto-answers.

| Threshold | Auto-answer rate | Auto-answer bin accuracy | Needs confirm | Truth in picker | End-to-end |
|---|---|---|---|---|---|
| 0.05 | 66.7% | 83.3% | 33.3% | 100.0% | 88.9% |
| 0.1 | 66.7% | 83.3% | 33.3% | 100.0% | 88.9% |
| 0.15 | 66.7% | 83.3% | 33.3% | 100.0% | 88.9% |
| 0.2 | 66.7% | 83.3% | 33.3% | 100.0% | 88.9% |
| 0.25 | 66.7% | 83.3% | 33.3% | 100.0% | 88.9% |
| 0.3 | 66.7% | 83.3% | 33.3% | 100.0% | 88.9% |
| 0.35 | 66.7% | 83.3% | 33.3% | 100.0% | 88.9% |
| 0.4 | 66.7% | 83.3% | 33.3% | 100.0% | 88.9% |
| 0.45 | 66.7% | 83.3% | 33.3% | 100.0% | 88.9% |
| 0.5 | 55.6% | 80.0% | 44.4% | 100.0% | 88.9% |
| 0.55 ✅ | 44.4% | 100.0% | 55.6% | 100.0% | 100.0% |
| 0.6 | 44.4% | 100.0% | 55.6% | 100.0% | 100.0% |
| 0.65 | 44.4% | 100.0% | 55.6% | 100.0% | 100.0% |
| 0.7 | 44.4% | 100.0% | 55.6% | 100.0% | 100.0% |
| 0.75 | 44.4% | 100.0% | 55.6% | 100.0% | 100.0% |
| 0.8 | 33.3% | 100.0% | 66.7% | 100.0% | 100.0% |
| 0.85 | 33.3% | 100.0% | 66.7% | 100.0% | 100.0% |
| 0.9 | 33.3% | 100.0% | 66.7% | 100.0% | 100.0% |
| 0.95 | 11.1% | 100.0% | 88.9% | 100.0% | 100.0% |

## Per item
| Item | Photos | Top-1 | Bin | Median ms |
|---|---|---|---|---|
| battery | 1 | 0.0% | 0.0% | 146 |
| chip bag | 1 | 100.0% | 100.0% | 100 |
| coffee cup | 1 | 100.0% | 100.0% | 106 |
| fruit peel | 1 | 100.0% | 100.0% | 119 |
| glass jar | 1 | 100.0% | 100.0% | 90 |
| pizza box | 1 | 100.0% | 100.0% | 89 |
| plastic bag | 1 | 0.0% | 100.0% | 113 |
| plastic bottle | 1 | 100.0% | 100.0% | 159 |
| pop can | 1 | 100.0% | 100.0% | 113 |

## Confusion matrix (rows = truth, columns = top-1 prediction)
| truth \ predicted | battery | chip bag | coffee cup | fruit peel | glass jar | pizza box | plastic bag | plastic bottle | pop can | candy wrapper | paper bag |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **battery** | · | · | · | · | · | · | · | · | · | 1 | · |
| **chip bag** | · | **1** | · | · | · | · | · | · | · | · | · |
| **coffee cup** | · | · | **1** | · | · | · | · | · | · | · | · |
| **fruit peel** | · | · | · | **1** | · | · | · | · | · | · | · |
| **glass jar** | · | · | · | · | **1** | · | · | · | · | · | · |
| **pizza box** | · | · | · | · | · | **1** | · | · | · | · | · |
| **plastic bag** | · | · | · | · | · | · | · | · | · | · | 1 |
| **plastic bottle** | · | · | · | · | · | · | · | **1** | · | · | · |
| **pop can** | · | · | · | · | · | · | · | · | **1** | · | · |

## Failures (honest list)
| Photo | Truth | Top-3 predicted | Right bin anyway? |
|---|---|---|---|
| ../../../tmp/claude-1000/-home-ubuntu-BinSight/42da7454-ab13-4af7-92b9-590e0515aca6/scratchpad/smoke/battery/1.jpg | battery | candy_wrapper 50.5%, aerosol_can 31.6%, battery 12.7% | **no** |
| ../../../tmp/claude-1000/-home-ubuntu-BinSight/42da7454-ab13-4af7-92b9-590e0515aca6/scratchpad/smoke/plastic_bag/1.jpg | plastic bag | paper_bag 76.7%, plastic_bag 13.0%, chip_bag 8.6% | yes |
