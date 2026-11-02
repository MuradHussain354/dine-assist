# Evaluation Report: llama3.2:3b
- **Date**: 2026-11-02
- **Model**: `llama3.2:3b`
- **Tag**: `fresh-v3`
- **Queries**: `scripts/eval/queries-fresh.json`
- **Dataset**: 30 queries (0 dev, 30 test)
- **LLM Latency**: Mean: 10463ms | P95: 16604ms
- **JSON Validity Rate (Config a)**: 100%
- **Fallback Rate (Config c)**: 0%

## Headline: Exact-Match Rate by Configuration
| Configuration | Dev Exact Match | Test Exact Match | All Exact Match |
| :--- | :--- | :--- | :--- |
| LLM Only (a) | 0% (0/0) | 63.3% (19/30) | 63.3% (19/30) |
| LLM + Guard (b) | 0% (0/0) | 76.7% (23/30) | 76.7% (23/30) |
| LLM + Guard + Rules (e) | 0% (0/0) | 93.3% (28/30) | 93.3% (28/30) |
| Full Pipeline (c) | 0% (0/0) | 93.3% (28/30) | 93.3% (28/30) |
| Fallback Only (d) | 0% (0/0) | 50% (15/30) | 50% (15/30) |

## Per-Field Accuracy on Test Split
| Configuration | Diet | Spice Level | Budget Total | Party Size | Exclusions | Cuisine | Exact Match |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LLM Only (a) | 83.3% | 100% | 86.7% | 96.7% | 96.7% | 96.7% | **63.3%** |
| LLM + Guard (b) | 96.7% | 100% | 86.7% | 96.7% | 96.7% | 96.7% | **76.7%** |
| LLM + Guard + Rules (e) | 100% | 100% | 100% | 96.7% | 96.7% | 100% | **93.3%** |
| Full Pipeline (c) | 100% | 100% | 100% | 96.7% | 96.7% | 100% | **93.3%** |
| Fallback Only (d) | 90% | 93.3% | 93.3% | 70% | 86.7% | 96.7% | **50%** |

## Exact-Match by Category (Full Pipeline - Config c)
| Category | Dev Matches | Test Matches | Total Queries | Exact Match Rate |
| :--- | :--- | :--- | :--- | :--- |
| budget | 0/0 | 6/6 | 6 | **100%** |
| diet | 0/0 | 3/4 | 4 | **75%** |
| exclusions | 0/0 | 3/3 | 3 | **100%** |
| no_information | 0/0 | 2/2 | 2 | **100%** |
| party_size | 0/0 | 4/5 | 5 | **80%** |
| spice | 0/0 | 4/4 | 4 | **100%** |
| straightforward | 0/0 | 6/6 | 6 | **100%** |

## Failed Queries (Full Pipeline - Config c)
| ID | Split | Category | Query | Differing Fields (Expected vs Got) |
| :--- | :--- | :--- | :--- | :--- |
| 113 | test | party_size | my parents and I, vegetarian, under 3000 | party_size: expected 3, got 2 |
| 124 | test | diet | no meat or fish for me | exclusions: expected [], got ["meat","fish"] |
