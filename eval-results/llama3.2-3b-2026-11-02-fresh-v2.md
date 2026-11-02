# Evaluation Report: llama3.2:3b
- **Date**: 2026-11-02
- **Model**: `llama3.2:3b`
- **Tag**: `fresh-v2`
- **Queries**: `scripts/eval/queries-fresh.json`
- **Dataset**: 30 queries (0 dev, 30 test)
- **LLM Latency**: Mean: 10463ms | P95: 16604ms
- **JSON Validity Rate (Config a)**: 100%
- **Fallback Rate (Config c)**: 0%

## Headline: Exact-Match Rate by Configuration
| Configuration | Dev Exact Match | Test Exact Match | All Exact Match |
| :--- | :--- | :--- | :--- |
| LLM Only (a) | 0% (0/0) | 63.3% (19/30) | 63.3% (19/30) |
| LLM + Guard (b) | 0% (0/0) | 70% (21/30) | 70% (21/30) |
| LLM + Guard + Rules (e) | 0% (0/0) | 73.3% (22/30) | 73.3% (22/30) |
| Full Pipeline (c) | 0% (0/0) | 73.3% (22/30) | 73.3% (22/30) |
| Fallback Only (d) | 0% (0/0) | 43.3% (13/30) | 43.3% (13/30) |

## Per-Field Accuracy on Test Split
| Configuration | Diet | Spice Level | Budget Total | Party Size | Exclusions | Cuisine | Exact Match |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LLM Only (a) | 83.3% | 100% | 86.7% | 96.7% | 96.7% | 96.7% | **63.3%** |
| LLM + Guard (b) | 96.7% | 96.7% | 83.3% | 96.7% | 96.7% | 96.7% | **70%** |
| LLM + Guard + Rules (e) | 100% | 96.7% | 90% | 93.3% | 96.7% | 96.7% | **73.3%** |
| Full Pipeline (c) | 100% | 96.7% | 90% | 93.3% | 96.7% | 96.7% | **73.3%** |
| Fallback Only (d) | 90% | 93.3% | 86.7% | 70% | 86.7% | 96.7% | **43.3%** |

## Exact-Match by Category (Full Pipeline - Config c)
| Category | Dev Matches | Test Matches | Total Queries | Exact Match Rate |
| :--- | :--- | :--- | :--- | :--- |
| budget | 0/0 | 3/6 | 6 | **50%** |
| diet | 0/0 | 3/4 | 4 | **75%** |
| exclusions | 0/0 | 3/3 | 3 | **100%** |
| no_information | 0/0 | 2/2 | 2 | **100%** |
| party_size | 0/0 | 3/5 | 5 | **60%** |
| spice | 0/0 | 3/4 | 4 | **75%** |
| straightforward | 0/0 | 5/6 | 6 | **83.3%** |

## Failed Queries (Full Pipeline - Config c)
| ID | Split | Category | Query | Differing Fields (Expected vs Got) |
| :--- | :--- | :--- | :--- | :--- |
| 105 | test | straightforward | continental dinner for two, non-veg, up to 3000 | cuisine: expected "continental", got null |
| 107 | test | budget | 300 per person for 4 | budget_total: expected 1200, got 4800 |
| 109 | test | budget | about 700 apiece, party of 3 | budget_total: expected 2100, got 700 |
| 112 | test | budget | max budget twelve hundred, just me | budget_total: expected 1200, got null |
| 113 | test | party_size | my parents and I, vegetarian, under 3000 | party_size: expected 3, got 1 |
| 114 | test | party_size | dinner with my girlfriend | party_size: expected 2, got 1 |
| 121 | test | spice | medium heat, vegetarian, for two | spice_level: expected 2, got null |
| 124 | test | diet | no meat or fish for me | exclusions: expected [], got ["meat","fish"] |
