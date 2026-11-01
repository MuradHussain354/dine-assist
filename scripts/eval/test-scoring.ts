import assert from "node:assert";
import {
  normalizeExclusion,
  compareExclusions,
  compareCuisine,
  compareIntent,
  evaluateQueryUnderConfig,
  calculateP95,
  aggregateMetrics,
  aggregateByCategory,
  RawQueryOutput,
} from "./scoring";
import { EvalQuery } from "./loader";
import { Intent } from "../../src/lib/intent/schema";

function runTests() {
  console.log("==================================================");
  console.log("TESTING EVALUATION SCORING ENGINE & COMPARISON RULES");
  console.log("==================================================");

  // 1. Exclusion normalization & set comparison
  console.log("\n1. Testing exclusion normalization and set comparisons...");
  assert.strictEqual(normalizeExclusion("onions"), "onion");
  assert.strictEqual(normalizeExclusion("Onion"), "onion");
  assert.strictEqual(normalizeExclusion("  Mushrooms  "), "mushroom");
  assert.strictEqual(normalizeExclusion("peanuts"), "peanut");
  assert.strictEqual(normalizeExclusion("beef"), "beef");

  // Sets with different ordering and pluralization
  assert(
    compareExclusions(["onions", "mushrooms"], ["mushroom", "onion"]),
    "Pluralized and reordered exclusions should match as sets"
  );
  assert(
    compareExclusions(["Garlic", "  peanuts  "], ["peanut", "garlic"]),
    "Case and whitespace normalization should match"
  );
  assert(
    compareExclusions([], []),
    "Empty exclusions should match"
  );
  assert(
    !compareExclusions(["onions"], ["onions", "garlic"]),
    "Different exclusion set sizes must not match"
  );
  assert(
    !compareExclusions(["onion"], ["garlic"]),
    "Different exclusion items must not match"
  );
  assert(
    !compareExclusions(["onion"], null),
    "Null actual exclusions must not match non-empty expected"
  );
  assert(
    compareExclusions([], null),
    "Null actual exclusions should match empty expected"
  );
  console.log("✓ Exclusion normalization & set comparisons verified.");

  // 2. Spice level null vs 0
  console.log("\n2. Testing spice_level null versus 0 strictness...");
  const baseExpected: EvalQuery["expected"] = {
    diet: "veg",
    spice_level: null,
    budget_total: 1000,
    party_size: 2,
    exclusions: [],
    cuisine: null,
  };

  // null matches null
  const matchNull = compareIntent(baseExpected, {
    diet: "veg",
    spice_level: null,
    budget_total: 1000,
    party_size: 2,
    exclusions: [],
    cuisine: null,
  });
  assert.strictEqual(matchNull.fieldMatches.spice_level, true);
  assert.strictEqual(matchNull.isExactMatch, true);

  // null does NOT match 0
  const mismatchZero = compareIntent(baseExpected, {
    diet: "veg",
    spice_level: 0,
    budget_total: 1000,
    party_size: 2,
    exclusions: [],
    cuisine: null,
  });
  assert.strictEqual(
    mismatchZero.fieldMatches.spice_level,
    false,
    "spice_level 0 must NOT match null"
  );
  assert.strictEqual(
    mismatchZero.isExactMatch,
    false,
    "Exact match must fail when spice_level differs (null vs 0)"
  );

  // 0 does NOT match null
  const expectedZero: EvalQuery["expected"] = { ...baseExpected, spice_level: 0 };
  const mismatchNullFromZero = compareIntent(expectedZero, {
    diet: "veg",
    spice_level: null,
    budget_total: 1000,
    party_size: 2,
    exclusions: [],
    cuisine: null,
  });
  assert.strictEqual(
    mismatchNullFromZero.fieldMatches.spice_level,
    false,
    "spice_level null must NOT match 0"
  );

  // 0 matches 0
  const matchZero = compareIntent(expectedZero, {
    diet: "veg",
    spice_level: 0,
    budget_total: 1000,
    party_size: 2,
    exclusions: [],
    cuisine: null,
  });
  assert.strictEqual(matchZero.fieldMatches.spice_level, true);
  console.log("✓ Spice level null vs 0 distinction strictly enforced.");

  // 3. Case-insensitive and trimmed cuisine comparison
  console.log("\n3. Testing case-insensitive and trimmed cuisine comparison...");
  assert(compareCuisine("North Indian", "north indian"));
  assert(compareCuisine("  South Indian  ", "south indian"));
  assert(compareCuisine("CHINESE", "chinese"));
  assert(compareCuisine(null, null));
  assert(!compareCuisine("Italian", null));
  assert(!compareCuisine(null, "Italian"));
  assert(!compareCuisine("Mughlai", "North Indian"));
  console.log("✓ Cuisine comparison correctly handles casing, trimming, and nulls.");

  // 4. Exact-match logic (all 6 fields required)
  console.log("\n4. Testing exact-match logic across all 6 fields...");
  const completeExpected: EvalQuery["expected"] = {
    diet: "non-veg",
    spice_level: 2,
    budget_total: 2500,
    party_size: 4,
    exclusions: ["dairy", "nuts"],
    cuisine: "mughlai",
  };

  const perfectIntent: Intent = {
    diet: "non-veg",
    spice_level: 2,
    budget_total: 2500,
    party_size: 4,
    exclusions: ["nut", "dairy"],
    cuisine: "Mughlai",
  };

  const perfectResult = compareIntent(completeExpected, perfectIntent);
  assert.strictEqual(perfectResult.isExactMatch, true, "All 6 matching fields must give isExactMatch=true");

  // Break each field individually and verify isExactMatch is false
  const fields = ["diet", "spice_level", "budget_total", "party_size", "exclusions", "cuisine"] as const;
  for (const field of fields) {
    const corrupted = { ...perfectIntent };
    if (field === "diet") corrupted.diet = "veg";
    if (field === "spice_level") corrupted.spice_level = 3;
    if (field === "budget_total") corrupted.budget_total = 2000;
    if (field === "party_size") corrupted.party_size = 2;
    if (field === "exclusions") corrupted.exclusions = ["dairy"];
    if (field === "cuisine") corrupted.cuisine = "chinese";

    const res = compareIntent(completeExpected, corrupted);
    assert.strictEqual(res.fieldMatches[field], false, `Field ${field} should mismatch`);
    assert.strictEqual(res.isExactMatch, false, `Exact match must fail when ${field} mismatches`);
  }

  // Null intent (e.g. failure in config a or b)
  const nullResult = compareIntent(completeExpected, null);
  assert.strictEqual(nullResult.isExactMatch, false);
  for (const f of fields) {
    assert.strictEqual(nullResult.fieldMatches[f], false);
  }
  console.log("✓ Exact match logic requires every single field to be correct.");

  // 5. Configuration behaviors & fallbacks
  console.log("\n5. Testing 4-configuration scoring behaviors...");
  const sampleQuery: EvalQuery = {
    id: 99,
    split: "test",
    category: "straightforward",
    query: "vegetarian for 2 under 1500",
    expected: {
      diet: "veg",
      spice_level: null,
      budget_total: 1500,
      party_size: 2,
      exclusions: [],
      cuisine: null,
    },
  };

  // Case A: Valid LLM output
  const validOutput: RawQueryOutput = {
    id: 99,
    query: sampleQuery.query,
    rawLlmOutput: JSON.stringify({
      diet: "veg",
      spice_level: null,
      budget_total: 1500,
      party_size: 2,
      exclusions: [],
      cuisine: null,
    }),
    latencyMs: 800,
  };

  const scoreA = evaluateQueryUnderConfig(sampleQuery, validOutput, "llm_only");
  assert.strictEqual(scoreA.validJson, true);
  assert.strictEqual(scoreA.isExactMatch, true);

  // Case B: Invalid JSON output
  const invalidOutput: RawQueryOutput = {
    id: 99,
    query: sampleQuery.query,
    rawLlmOutput: "Sorry, I cannot help with that.",
    latencyMs: 500,
  };

  const scoreAInvalid = evaluateQueryUnderConfig(sampleQuery, invalidOutput, "llm_only");
  assert.strictEqual(scoreAInvalid.validJson, false);
  assert.strictEqual(scoreAInvalid.got, null);
  assert.strictEqual(scoreAInvalid.isExactMatch, false);

  const scoreCInvalid = evaluateQueryUnderConfig(sampleQuery, invalidOutput, "full_pipeline");
  assert.strictEqual(scoreCInvalid.usedFallback, true);
  assert(scoreCInvalid.got !== null, "Full pipeline must fall back to rule-based intent on error");
  // Fallback parses: diet=veg, budget_total=1500, party_size=2
  assert.strictEqual(scoreCInvalid.got.diet, "veg");
  assert.strictEqual(scoreCInvalid.got.party_size, 2);
  assert.strictEqual(scoreCInvalid.got.budget_total, 1500);

  // Case D: Fallback only
  const scoreD = evaluateQueryUnderConfig(sampleQuery, undefined, "fallback_only");
  assert.strictEqual(scoreD.usedFallback, true);
  assert.strictEqual(scoreD.got?.diet, "veg");
  assert.strictEqual(scoreD.got?.party_size, 2);
  console.log("✓ Pipeline configurations (a, b, c, d) and error handling behave as specified.");

  // 6. Metrics & Percentile Calculation
  console.log("\n6. Testing P95 calculation and metric aggregations...");
  const lats = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  assert.strictEqual(calculateP95(lats), 1000);
  assert.strictEqual(calculateP95([]), 0);

  const metrics = aggregateMetrics([scoreA, scoreCInvalid], [800, 500]);
  assert.strictEqual(metrics.total, 2);
  assert.strictEqual(metrics.meanLatencyMs, 650);
  assert.strictEqual(metrics.p95LatencyMs, 800);

  const catMetrics = aggregateByCategory([scoreA, scoreCInvalid]);
  assert.strictEqual(catMetrics.length, 1);
  assert.strictEqual(catMetrics[0].category, "straightforward");
  assert.strictEqual(catMetrics[0].testTotal, 2);
  console.log("✓ Metrics, percentiles, and category aggregations compute correctly.");

  console.log("\n==================================================");
  console.log("ALL SCORING TESTS PASSED SUCCESSFULLY! ✓");
  console.log("==================================================");
}

runTests();
