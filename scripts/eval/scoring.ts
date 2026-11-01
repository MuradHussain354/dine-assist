import { Intent } from "../../src/lib/intent/schema";
import {
  parseAndValidateLlmOutput,
  applyGroundingGuard,
  extractFallbackIntent,
} from "../../src/lib/intent/extract";
import { EvalQuery } from "./loader";

export type ConfigId = "llm_only" | "llm_guard" | "full_pipeline" | "fallback_only";

export interface RawQueryOutput {
  id: number;
  query: string;
  rawLlmOutput: string | null;
  latencyMs: number;
  error?: string | null;
  isTimeout?: boolean;
}

export interface FieldComparison {
  diet: boolean;
  spice_level: boolean;
  budget_total: boolean;
  party_size: boolean;
  exclusions: boolean;
  cuisine: boolean;
}

export interface ScoredQuery {
  id: number;
  split: "dev" | "test";
  category: string;
  query: string;
  config: ConfigId;
  expected: EvalQuery["expected"];
  got: Intent | null;
  fieldMatches: FieldComparison;
  isExactMatch: boolean;
  usedFallback: boolean;
  validJson: boolean;
  latencyMs: number;
}

export interface AggregateMetrics {
  total: number;
  exactMatchCount: number;
  exactMatchRate: number;
  dietAccuracy: number;
  spiceAccuracy: number;
  budgetAccuracy: number;
  partyAccuracy: number;
  exclusionsAccuracy: number;
  cuisineAccuracy: number;
  jsonValidityRate?: number;
  fallbackRate?: number;
  meanLatencyMs: number;
  p95LatencyMs: number;
}

export interface CategoryMetric {
  category: string;
  devMatches: number;
  devTotal: number;
  testMatches: number;
  testTotal: number;
  totalMatches: number;
  total: number;
  exactMatchRate: number;
}

/**
 * Strips trailing "s", trims, and lowercases exclusion tokens.
 * e.g. "Onions" -> "onion", "peanuts" -> "peanut".
 */
export function normalizeExclusion(item: string): string {
  return item.trim().toLowerCase().replace(/s$/, "");
}

/**
 * Compare two exclusions arrays as sets of normalized tokens.
 */
export function compareExclusions(
  expected: string[],
  actual: string[] | undefined | null
): boolean {
  if (!actual) return expected.length === 0;
  const setA = new Set(expected.map(normalizeExclusion));
  const setB = new Set(actual.map(normalizeExclusion));

  if (setA.size !== setB.size) return false;
  for (const item of Array.from(setA)) {
    if (!setB.has(item)) return false;
  }
  return true;
}

/**
 * Compare cuisine after trimming and lowercasing.
 */
export function compareCuisine(
  expected: string | null,
  actual: string | null | undefined
): boolean {
  const normExpected = expected ? expected.trim().toLowerCase() : null;
  const normActual = actual ? actual.trim().toLowerCase() : null;
  return normExpected === normActual;
}

/**
 * Compare all six intent fields against expected.
 */
export function compareIntent(
  expected: EvalQuery["expected"],
  got: Intent | null
): { fieldMatches: FieldComparison; isExactMatch: boolean } {
  if (!got) {
    return {
      fieldMatches: {
        diet: false,
        spice_level: false,
        budget_total: false,
        party_size: false,
        exclusions: false,
        cuisine: false,
      },
      isExactMatch: false,
    };
  }

  const dietMatch = expected.diet === got.diet;
  // null !== 0
  const spiceMatch = expected.spice_level === got.spice_level;
  const budgetMatch = expected.budget_total === got.budget_total;
  const partyMatch = expected.party_size === got.party_size;
  const cuisineMatch = compareCuisine(expected.cuisine, got.cuisine);
  const exclusionsMatch = compareExclusions(expected.exclusions, got.exclusions);

  const isExactMatch =
    dietMatch &&
    spiceMatch &&
    budgetMatch &&
    partyMatch &&
    cuisineMatch &&
    exclusionsMatch;

  return {
    fieldMatches: {
      diet: dietMatch,
      spice_level: spiceMatch,
      budget_total: budgetMatch,
      party_size: partyMatch,
      exclusions: exclusionsMatch,
      cuisine: cuisineMatch,
    },
    isExactMatch,
  };
}

/**
 * Evaluate a single query under a specific configuration.
 */
export function evaluateQueryUnderConfig(
  query: EvalQuery,
  rawOutput: RawQueryOutput | undefined,
  config: ConfigId
): ScoredQuery {
  let got: Intent | null = null;
  let validJson = false;
  let usedFallback = false;
  const latencyMs = rawOutput?.latencyMs ?? 0;

  if (config === "fallback_only") {
    got = extractFallbackIntent(query.query);
    usedFallback = true;
    validJson = false;
  } else {
    const raw = rawOutput?.rawLlmOutput;
    const isErrorOrTimeout = !raw || rawOutput?.isTimeout || !!rawOutput?.error;

    if (!isErrorOrTimeout && raw) {
      const parsed = parseAndValidateLlmOutput(raw);
      if (parsed.success) {
        validJson = true;
        if (config === "llm_only") {
          got = parsed.data;
        } else if (config === "llm_guard") {
          got = applyGroundingGuard(parsed.data, query.query).corrected;
        } else if (config === "full_pipeline") {
          got = applyGroundingGuard(parsed.data, query.query).corrected;
          usedFallback = false;
        }
      } else {
        validJson = false;
        if (config === "full_pipeline") {
          got = extractFallbackIntent(query.query);
          usedFallback = true;
        } else {
          got = null; // Configuration a and b treat invalid schema/json as failed
        }
      }
    } else {
      validJson = false;
      if (config === "full_pipeline") {
        got = extractFallbackIntent(query.query);
        usedFallback = true;
      } else {
        got = null; // Configuration a and b fail on timeout/error
      }
    }
  }

  const { fieldMatches, isExactMatch } = compareIntent(query.expected, got);

  return {
    id: query.id,
    split: query.split,
    category: query.category,
    query: query.query,
    config,
    expected: query.expected,
    got,
    fieldMatches,
    isExactMatch,
    usedFallback,
    validJson,
    latencyMs,
  };
}

/**
 * Calculate percentile latency (p95).
 */
export function calculateP95(latencies: number[]): number {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

/**
 * Aggregate summary metrics across scored queries.
 */
export function aggregateMetrics(
  scored: ScoredQuery[],
  allLatencies: number[]
): AggregateMetrics {
  const total = scored.length;
  if (total === 0) {
    return {
      total: 0,
      exactMatchCount: 0,
      exactMatchRate: 0,
      dietAccuracy: 0,
      spiceAccuracy: 0,
      budgetAccuracy: 0,
      partyAccuracy: 0,
      exclusionsAccuracy: 0,
      cuisineAccuracy: 0,
      meanLatencyMs: 0,
      p95LatencyMs: 0,
    };
  }

  let exactMatches = 0;
  let dietCount = 0;
  let spiceCount = 0;
  let budgetCount = 0;
  let partyCount = 0;
  let exclusionsCount = 0;
  let cuisineCount = 0;
  let validJsonCount = 0;
  let fallbackCount = 0;

  for (const s of scored) {
    if (s.isExactMatch) exactMatches++;
    if (s.fieldMatches.diet) dietCount++;
    if (s.fieldMatches.spice_level) spiceCount++;
    if (s.fieldMatches.budget_total) budgetCount++;
    if (s.fieldMatches.party_size) partyCount++;
    if (s.fieldMatches.exclusions) exclusionsCount++;
    if (s.fieldMatches.cuisine) cuisineCount++;
    if (s.validJson) validJsonCount++;
    if (s.usedFallback) fallbackCount++;
  }

  const meanLatency =
    allLatencies.length === 0
      ? 0
      : Math.round(
          allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length
        );

  const p95Latency = calculateP95(allLatencies);

  const toPct = (n: number) => Math.round((n / total) * 1000) / 10;

  return {
    total,
    exactMatchCount: exactMatches,
    exactMatchRate: toPct(exactMatches),
    dietAccuracy: toPct(dietCount),
    spiceAccuracy: toPct(spiceCount),
    budgetAccuracy: toPct(budgetCount),
    partyAccuracy: toPct(partyCount),
    exclusionsAccuracy: toPct(exclusionsCount),
    cuisineAccuracy: toPct(cuisineCount),
    jsonValidityRate: toPct(validJsonCount),
    fallbackRate: toPct(fallbackCount),
    meanLatencyMs: meanLatency,
    p95LatencyMs: p95Latency,
  };
}

/**
 * Break down configuration (c) exact matches by category.
 */
export function aggregateByCategory(
  scored: ScoredQuery[]
): CategoryMetric[] {
  const catMap = new Map<
    string,
    {
      devMatches: number;
      devTotal: number;
      testMatches: number;
      testTotal: number;
    }
  >();

  for (const s of scored) {
    const existing = catMap.get(s.category) || {
      devMatches: 0,
      devTotal: 0,
      testMatches: 0,
      testTotal: 0,
    };

    if (s.split === "dev") {
      existing.devTotal++;
      if (s.isExactMatch) existing.devMatches++;
    } else {
      existing.testTotal++;
      if (s.isExactMatch) existing.testMatches++;
    }
    catMap.set(s.category, existing);
  }

  const results: CategoryMetric[] = [];
  for (const [category, data] of Array.from(catMap.entries())) {
    const totalMatches = data.devMatches + data.testMatches;
    const total = data.devTotal + data.testTotal;
    const exactMatchRate =
      total === 0 ? 0 : Math.round((totalMatches / total) * 1000) / 10;

    results.push({
      category,
      devMatches: data.devMatches,
      devTotal: data.devTotal,
      testMatches: data.testMatches,
      testTotal: data.testTotal,
      totalMatches,
      total,
      exactMatchRate,
    });
  }

  return results.sort((a, b) => a.category.localeCompare(b.category));
}
