# Evaluation Report: llama3.2:3b
- **Date**: 2026-11-01
- **Model**: `llama3.2:3b`
- **Tag**: `v2`
- **Dataset**: 50 queries (20 dev, 30 test)
- **LLM Latency**: Mean: 12370ms | P95: 18366ms
- **JSON Validity Rate (Config a)**: 100%
- **Fallback Rate (Config c)**: 0%

## Headline: Exact-Match Rate by Configuration
| Configuration | Dev Exact Match | Test Exact Match | All Exact Match |
| :--- | :--- | :--- | :--- |
| LLM Only (a) | 65% (13/20) | 70% (21/30) | 68% (34/50) |
| LLM + Guard (b) | 85% (17/20) | 83.3% (25/30) | 84% (42/50) |
| LLM + Guard + Rules (e) | 100% (20/20) | 96.7% (29/30) | 98% (49/50) |
| Full Pipeline (c) | 100% (20/20) | 96.7% (29/30) | 98% (49/50) |
| Fallback Only (d) | 55% (11/20) | 50% (15/30) | 52% (26/50) |

## Per-Field Accuracy on Test Split
| Configuration | Diet | Spice Level | Budget Total | Party Size | Exclusions | Cuisine | Exact Match |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LLM Only (a) | 86.7% | 90% | 93.3% | 93.3% | 100% | 96.7% | **70%** |
| LLM + Guard (b) | 96.7% | 100% | 93.3% | 93.3% | 100% | 96.7% | **83.3%** |
| LLM + Guard + Rules (e) | 100% | 100% | 100% | 96.7% | 100% | 100% | **96.7%** |
| Full Pipeline (c) | 100% | 100% | 100% | 96.7% | 100% | 100% | **96.7%** |
| Fallback Only (d) | 93.3% | 96.7% | 93.3% | 66.7% | 76.7% | 100% | **50%** |

## Exact-Match by Category (Full Pipeline - Config c)
| Category | Dev Matches | Test Matches | Total Queries | Exact Match Rate |
| :--- | :--- | :--- | :--- | :--- |
| budget | 3/3 | 5/5 | 8 | **100%** |
| diet | 2/2 | 4/4 | 6 | **100%** |
| exclusions | 3/3 | 3/3 | 6 | **100%** |
| negation | 2/2 | 2/2 | 4 | **100%** |
| no_information | 1/1 | 3/3 | 4 | **100%** |
| party_size | 2/2 | 3/4 | 6 | **83.3%** |
| spice | 3/3 | 3/3 | 6 | **100%** |
| straightforward | 4/4 | 6/6 | 10 | **100%** |

## Failed Queries (Full Pipeline - Config c)
| ID | Split | Category | Query | Differing Fields (Expected vs Got) |
| :--- | :--- | :--- | :--- | :--- |
| 24 | test | party_size | me and my two kids, under 1500 | party_size: expected 3, got 2 |
