# Evaluation Report: llama3.2:3b
- **Date**: 2026-11-01
- **Model**: `llama3.2:3b`
- **Dataset**: 50 queries (20 dev, 30 test)
- **LLM Latency**: Mean: 12370ms | P95: 18366ms
- **JSON Validity Rate (Config a)**: 100%
- **Fallback Rate (Config c)**: 0%

## Headline: Exact-Match Rate by Configuration
| Configuration | Dev Exact Match | Test Exact Match | All Exact Match |
| :--- | :--- | :--- | :--- |
| LLM Only (a) | 65% (13/20) | 70% (21/30) | 68% (34/50) |
| LLM + Guard (b) | 85% (17/20) | 83.3% (25/30) | 84% (42/50) |
| Full Pipeline (c) | 85% (17/20) | 83.3% (25/30) | 84% (42/50) |
| Fallback Only (d) | 55% (11/20) | 46.7% (14/30) | 50% (25/50) |

## Per-Field Accuracy on Test Split
| Configuration | Diet | Spice Level | Budget Total | Party Size | Exclusions | Cuisine | Exact Match |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LLM Only (a) | 86.7% | 90% | 93.3% | 93.3% | 100% | 96.7% | **70%** |
| LLM + Guard (b) | 96.7% | 100% | 93.3% | 93.3% | 100% | 96.7% | **83.3%** |
| Full Pipeline (c) | 96.7% | 100% | 93.3% | 93.3% | 100% | 96.7% | **83.3%** |
| Fallback Only (d) | 93.3% | 96.7% | 90% | 66.7% | 76.7% | 100% | **46.7%** |

## Exact-Match by Category (Full Pipeline - Config c)
| Category | Dev Matches | Test Matches | Total Queries | Exact Match Rate |
| :--- | :--- | :--- | :--- | :--- |
| budget | 2/3 | 4/5 | 8 | **75%** |
| diet | 1/2 | 2/4 | 6 | **50%** |
| exclusions | 3/3 | 3/3 | 6 | **100%** |
| negation | 1/2 | 2/2 | 4 | **75%** |
| no_information | 1/1 | 2/3 | 4 | **75%** |
| party_size | 2/2 | 3/4 | 6 | **83.3%** |
| spice | 3/3 | 3/3 | 6 | **100%** |
| straightforward | 4/4 | 6/6 | 10 | **100%** |
