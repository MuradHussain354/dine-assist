import assert from "node:assert";
import { Intent } from "../src/lib/intent/schema";
import { applyPostProcessingRules } from "../src/lib/intent/postprocess";

function baseIntent(): Intent {
  return {
    diet: "any",
    spice_level: null,
    budget_total: null,
    party_size: 1,
    exclusions: [],
    cuisine: null,
  };
}

function runTests() {
  console.log("==================================================");
  console.log("TESTING DETERMINISTIC RULES LAYER (postprocess.ts)");
  console.log("==================================================");

  // 1. Rule 1: Per-person budget
  console.log("\n1. Testing Rule 1: Per-person budget...");
  {
    // Fire: "500 each for 3"
    const input: Intent = { ...baseIntent(), budget_total: 500, party_size: 3 };
    const { processed, adjustments } = applyPostProcessingRules(
      input,
      "500 each for 3"
    );
    assert.strictEqual(processed.budget_total, 1500);
    assert(
      adjustments.some((a) => a.includes("rule:per_person_budget")),
      "Should include rule:per_person_budget adjustment"
    );

    // Fire: "600 per person, four people"
    const input2: Intent = { ...baseIntent(), budget_total: 600, party_size: 4 };
    const res2 = applyPostProcessingRules(
      input2,
      "600 per person, four people"
    );
    assert.strictEqual(res2.processed.budget_total, 2400);

    // Fire: "rs 400 /person for 2"
    const input3: Intent = { ...baseIntent(), budget_total: 400, party_size: 2 };
    const res3 = applyPostProcessingRules(input3, "rs 400 /person for 2");
    assert.strictEqual(res3.processed.budget_total, 800);

    // Negative test: "500 rupees" without "each" is NOT multiplied
    const inputNoEach: Intent = {
      ...baseIntent(),
      budget_total: 500,
      party_size: 3,
    };
    const resNoEach = applyPostProcessingRules(
      inputNoEach,
      "500 rupees for three"
    );
    assert.strictEqual(
      resNoEach.processed.budget_total,
      500,
      '"500 rupees" without "each" must NOT be multiplied'
    );
    assert(
      !resNoEach.adjustments.some((a) => a.includes("rule:per_person_budget")),
      "Must not add per_person_budget adjustment when no per-person phrase"
    );
  }
  console.log("✓ Rule 1 verified (positive & negative cases).");

  // 2. Rule 2: Vegan
  console.log("\n2. Testing Rule 2: Vegan...");
  {
    // Fire: "vegan dishes for two"
    const input1: Intent = { ...baseIntent(), diet: "veg" };
    const res1 = applyPostProcessingRules(input1, "vegan dishes for two");
    assert.strictEqual(res1.processed.diet, "vegan");
    assert(
      res1.adjustments.some((a) => a.includes("rule:vegan")),
      "Should include rule:vegan adjustment"
    );

    // Fire: "completely plant based, three people"
    const input2: Intent = { ...baseIntent(), diet: "any" };
    const res2 = applyPostProcessingRules(
      input2,
      "completely plant based, three people"
    );
    assert.strictEqual(res2.processed.diet, "vegan");

    // Fire: "plant-based lunch"
    const input3: Intent = { ...baseIntent(), diet: "any" };
    const res3 = applyPostProcessingRules(input3, "plant-based lunch");
    assert.strictEqual(res3.processed.diet, "vegan");

    // Negative test: "vegetarian food" must not set diet to vegan
    const inputVeg: Intent = { ...baseIntent(), diet: "veg" };
    const resVeg = applyPostProcessingRules(inputVeg, "vegetarian food");
    assert.strictEqual(resVeg.processed.diet, "veg");
    assert(!resVeg.adjustments.some((a) => a.includes("rule:vegan")));
  }
  console.log("✓ Rule 2 verified (positive & negative cases).");

  // 3. Rule 3: Negated diet
  console.log("\n3. Testing Rule 3: Negated diet...");
  {
    // Fire: "not vegetarian, under 2000 for two"
    const input1: Intent = { ...baseIntent(), diet: "any" };
    const res1 = applyPostProcessingRules(
      input1,
      "not vegetarian, under 2000 for two"
    );
    assert.strictEqual(res1.processed.diet, "non-veg");
    assert(
      res1.adjustments.some((a) => a.includes("rule:negated_diet")),
      "Should include rule:negated_diet adjustment"
    );

    // Fire: "non-vegetarian"
    const input2: Intent = { ...baseIntent(), diet: "any" };
    const res2 = applyPostProcessingRules(input2, "non-vegetarian options");
    assert.strictEqual(res2.processed.diet, "non-veg");

    // Fire: "non vegetarian"
    const input3: Intent = { ...baseIntent(), diet: "any" };
    const res3 = applyPostProcessingRules(input3, "non vegetarian options");
    assert.strictEqual(res3.processed.diet, "non-veg");

    // Fire: "non-veg"
    const input4: Intent = { ...baseIntent(), diet: "any" };
    const res4 = applyPostProcessingRules(input4, "non-veg dinner");
    assert.strictEqual(res4.processed.diet, "non-veg");

    // Negative test: "pure veg" must not set diet to non-veg
    const inputVeg: Intent = { ...baseIntent(), diet: "veg" };
    const resVeg = applyPostProcessingRules(inputVeg, "pure veg dinner");
    assert.strictEqual(resVeg.processed.diet, "veg");
    assert(!resVeg.adjustments.some((a) => a.includes("rule:negated_diet")));
  }
  console.log("✓ Rule 3 verified (positive & negative cases).");

  // 4. Rule 4: Missing budget
  console.log("\n4. Testing Rule 4: Missing budget...");
  {
    // Fire: "I am vegetarian, under 700" with budget_total null
    const input1: Intent = { ...baseIntent(), budget_total: null };
    const res1 = applyPostProcessingRules(
      input1,
      "I am vegetarian, under 700"
    );
    assert.strictEqual(res1.processed.budget_total, 700);
    assert(
      res1.adjustments.some((a) => a.includes("rule:missing_budget")),
      "Should include rule:missing_budget adjustment"
    );

    // Fire: "max 1500"
    const input2: Intent = { ...baseIntent(), budget_total: null };
    const res2 = applyPostProcessingRules(input2, "max 1500 for dinner");
    assert.strictEqual(res2.processed.budget_total, 1500);

    // Fire: "around 2k"
    const input3: Intent = { ...baseIntent(), budget_total: null };
    const res3 = applyPostProcessingRules(input3, "around 2k for party");
    assert.strictEqual(res3.processed.budget_total, 2000);

    // Negative test: already has budget_total 800
    const inputExisting: Intent = { ...baseIntent(), budget_total: 800 };
    const resExisting = applyPostProcessingRules(
      inputExisting,
      "under 700 dinner"
    );
    assert.strictEqual(
      resExisting.processed.budget_total,
      800,
      "Should not overwrite existing budget_total under missing_budget rule"
    );
    assert(
      !resExisting.adjustments.some((a) => a.includes("rule:missing_budget"))
    );

    // Negative test: no budget phrase in query
    const inputNoBudget: Intent = { ...baseIntent(), budget_total: null };
    const resNoBudget = applyPostProcessingRules(
      inputNoBudget,
      "tasty spicy biryani"
    );
    assert.strictEqual(resNoBudget.processed.budget_total, null);
    assert(
      !resNoBudget.adjustments.some((a) => a.includes("rule:missing_budget"))
    );
  }
  console.log("✓ Rule 4 verified (positive & negative cases).");

  // 5. Rule 5: Grounded cuisine
  console.log("\n5. Testing Rule 5: Grounded cuisine...");
  {
    // Fire: "surprise me" with cuisine "Mughlai" -> resets to null
    const input1: Intent = { ...baseIntent(), cuisine: "Mughlai" };
    const res1 = applyPostProcessingRules(input1, "surprise me");
    assert.strictEqual(res1.processed.cuisine, null);
    assert(
      res1.adjustments.some((a) => a.includes("rule:grounded_cuisine")),
      "Should include rule:grounded_cuisine adjustment"
    );

    // Negative test: "spicy chinese food" with cuisine "Indo-Chinese" (alias matched) -> kept
    const inputChinese: Intent = { ...baseIntent(), cuisine: "Indo-Chinese" };
    const resChinese = applyPostProcessingRules(
      inputChinese,
      "spicy chinese food"
    );
    assert.strictEqual(resChinese.processed.cuisine, "Indo-Chinese");
    assert(
      !resChinese.adjustments.some((a) => a.includes("rule:grounded_cuisine"))
    );

    // Negative test: "thai food" with cuisine "Asian" (alias matched) -> kept
    const inputAsian: Intent = { ...baseIntent(), cuisine: "Asian" };
    const resAsian = applyPostProcessingRules(inputAsian, "thai curry");
    assert.strictEqual(resAsian.processed.cuisine, "Asian");

    // Negative test: "North Indian thali" with cuisine "North Indian" -> kept
    const inputNI: Intent = { ...baseIntent(), cuisine: "North Indian" };
    const resNI = applyPostProcessingRules(inputNI, "North Indian thali");
    assert.strictEqual(resNI.processed.cuisine, "North Indian");
  }
  console.log("✓ Rule 5 verified (positive & negative cases).");

  // 6. Rule 6: Grounded party size
  console.log("\n6. Testing Rule 6: Grounded party size...");
  {
    // Fire: "dinner under 1500" with party_size 2 -> resets to 1 (1500 is budget, not party evidence)
    const input1: Intent = {
      ...baseIntent(),
      party_size: 2,
      budget_total: 1500,
    };
    const res1 = applyPostProcessingRules(input1, "dinner under 1500");
    assert.strictEqual(
      res1.processed.party_size,
      1,
      "dinner under 1500 should reset party_size to 1"
    );
    assert(
      res1.adjustments.some((a) => a.includes("rule:grounded_party_size")),
      "Should include rule:grounded_party_size adjustment"
    );

    // Negative test: "under 1500 for two" doesn't treat 1500 as party evidence, but keeps 2 due to "two"
    const inputTwo: Intent = {
      ...baseIntent(),
      party_size: 2,
      budget_total: 1500,
    };
    const resTwo = applyPostProcessingRules(inputTwo, "under 1500 for two");
    assert.strictEqual(
      resTwo.processed.party_size,
      2,
      '"under 1500 for two" must keep party_size 2'
    );
    assert(
      !resTwo.adjustments.some((a) => a.includes("rule:grounded_party_size"))
    );

    // Negative test: "just me" stays party_size 1
    const inputMe: Intent = { ...baseIntent(), party_size: 1 };
    const resMe = applyPostProcessingRules(inputMe, "just me");
    assert.strictEqual(
      resMe.processed.party_size,
      1,
      '"just me" stays party_size 1'
    );

    // Fire: "surprise me" with party_size 3 -> resets to 1
    const inputSurprise: Intent = { ...baseIntent(), party_size: 3 };
    const resSurprise = applyPostProcessingRules(inputSurprise, "surprise me");
    assert.strictEqual(resSurprise.processed.party_size, 1);

    // Negative test: "family dinner" keeps party_size 4
    const inputFam: Intent = { ...baseIntent(), party_size: 4 };
    const resFam = applyPostProcessingRules(inputFam, "family dinner");
    assert.strictEqual(resFam.processed.party_size, 4);

    // Negative test: "mushroom pizza" should NOT treat "us" inside "mushroom" as evidence
    const inputMushroom: Intent = { ...baseIntent(), party_size: 2 };
    const resMushroom = applyPostProcessingRules(
      inputMushroom,
      "mushroom pizza"
    );
    assert.strictEqual(
      resMushroom.processed.party_size,
      1,
      '"mushroom" must not trigger "us" keyword without word boundary'
    );
  }
  console.log("✓ Rule 6 verified (positive & negative cases).");

  console.log("\n==================================================");
  console.log("ALL DETERMINISTIC RULES TESTS PASSED SUCCESSFULLY! ✓");
  console.log("==================================================");
}

runTests();

