import assert from "node:assert";
import { Intent } from "../src/lib/intent/schema";
import { applyPostProcessingRules } from "../src/lib/intent/postprocess";
import { applyGroundingGuard } from "../src/lib/intent/extract";

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

  // 1. Rule 1: Per-person budget (including Query 107 fix & idempotency)
  console.log("\n1. Testing Rule 1: Per-person budget & idempotency...");
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

    // Query 107 fix: "300 per person for 4" with already multiplied LLM budget 1200
    // Must NOT multiply to 4800! Must remain 1200 (idempotent).
    const input107multiplied: Intent = {
      ...baseIntent(),
      budget_total: 1200,
      party_size: 4,
    };
    const res107a = applyPostProcessingRules(
      input107multiplied,
      "300 per person for 4"
    );
    assert.strictEqual(
      res107a.processed.budget_total,
      1200,
      'Query 107: already multiplied budget 1200 must NOT become 4800'
    );
    assert.strictEqual(
      res107a.adjustments.filter((a) => a.includes("rule:per_person_budget")).length,
      0,
      "No adjustment needed when already 1200"
    );

    // Query 107: "300 per person for 4" with unmultiplied LLM budget 300
    const input107unmultiplied: Intent = {
      ...baseIntent(),
      budget_total: 300,
      party_size: 4,
    };
    const res107b = applyPostProcessingRules(
      input107unmultiplied,
      "300 per person for 4"
    );
    assert.strictEqual(
      res107b.processed.budget_total,
      1200,
      'Query 107: unmultiplied budget 300 must become 1200'
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
  console.log("✓ Rule 1 verified (positive, negative & idempotency).");

  // 1b. Per-person synonyms (apiece, per plate, per guest, per pax, per diner, a person, each person)
  console.log("\n1b. Testing per-person synonyms...");
  {
    // Query 109: "about 700 apiece, party of 3"
    const input109: Intent = { ...baseIntent(), budget_total: 700, party_size: 3 };
    const res109 = applyPostProcessingRules(input109, "about 700 apiece, party of 3");
    assert.strictEqual(res109.processed.budget_total, 2100, "apiece should multiply by party_size");

    // "500 per plate for 2"
    const inputPlate: Intent = { ...baseIntent(), budget_total: 500, party_size: 2 };
    const resPlate = applyPostProcessingRules(inputPlate, "500 per plate for 2");
    assert.strictEqual(resPlate.processed.budget_total, 1000);

    // "600 per guest for 3"
    const inputGuest: Intent = { ...baseIntent(), budget_total: 600, party_size: 3 };
    const resGuest = applyPostProcessingRules(inputGuest, "600 per guest for 3");
    assert.strictEqual(resGuest.processed.budget_total, 1800);

    // "400 per pax for 4"
    const inputPax: Intent = { ...baseIntent(), budget_total: 400, party_size: 4 };
    const resPax = applyPostProcessingRules(inputPax, "400 per pax for 4");
    assert.strictEqual(resPax.processed.budget_total, 1600);

    // "800 per diner for 2"
    const inputDiner: Intent = { ...baseIntent(), budget_total: 800, party_size: 2 };
    const resDiner = applyPostProcessingRules(inputDiner, "800 per diner for 2");
    assert.strictEqual(resDiner.processed.budget_total, 1600);

    // "1000 a person for 2"
    const inputAPerson: Intent = { ...baseIntent(), budget_total: 1000, party_size: 2 };
    const resAPerson = applyPostProcessingRules(inputAPerson, "1000 a person for 2");
    assert.strictEqual(resAPerson.processed.budget_total, 2000);

    // "500 each person for 3"
    const inputEachPerson: Intent = { ...baseIntent(), budget_total: 500, party_size: 3 };
    const resEachPerson = applyPostProcessingRules(inputEachPerson, "500 each person for 3");
    assert.strictEqual(resEachPerson.processed.budget_total, 1500);
  }
  console.log("✓ Per-person synonyms verified.");

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

  // 4. Rule 4: Missing budget & Budget Guard (Query 112)
  console.log("\n4. Testing Rule 4: Missing budget & Budget Guard...");
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

    // Query 112: "max budget twelve hundred, just me" through applyGroundingGuard
    // Guard must NOT reset budget_total 1200 because query has number words "twelve hundred"!
    const guard112 = applyGroundingGuard(
      { ...baseIntent(), budget_total: 1200 },
      "max budget twelve hundred, just me"
    );
    assert.strictEqual(
      guard112.corrected.budget_total,
      1200,
      'Query 112: number words "twelve hundred" must prevent budget_total guard reset'
    );

    // Guard with "k" amount without digits: e.g. "within 2k"
    const guardK = applyGroundingGuard(
      { ...baseIntent(), budget_total: 2000 },
      "within 2k for dinner"
    );
    assert.strictEqual(guardK.corrected.budget_total, 2000);

    // Negative guard test: query without budget number words or digits resets hallucinated budget
    const guardNoBudget = applyGroundingGuard(
      { ...baseIntent(), budget_total: 1500 },
      "spicy noodles with veggies"
    );
    assert.strictEqual(
      guardNoBudget.corrected.budget_total,
      null,
      "Query without budget evidence must reset budget_total to null"
    );

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
  }
  console.log("✓ Rule 4 & Budget Guard verified.");

  // 4b. Spice Vocabulary Guard (Query 121)
  console.log("\n4b. Testing Spice Vocabulary in Guard...");
  {
    // Query 121: "medium heat, vegetarian, for two" with spice_level 2
    const guard121 = applyGroundingGuard(
      { ...baseIntent(), spice_level: 2 },
      "medium heat, vegetarian, for two"
    );
    assert.strictEqual(
      guard121.corrected.spice_level,
      2,
      'Query 121: "medium heat" must be recognized by spice guard'
    );

    // "with a nice kick"
    const guardKick = applyGroundingGuard(
      { ...baseIntent(), spice_level: 2 },
      "curry with a nice kick"
    );
    assert.strictEqual(guardKick.corrected.spice_level, 2);

    // "extra chilli"
    const guardChilli = applyGroundingGuard(
      { ...baseIntent(), spice_level: 3 },
      "extra chilli noodles"
    );
    assert.strictEqual(guardChilli.corrected.spice_level, 3);

    // "piquant dish"
    const guardPiquant = applyGroundingGuard(
      { ...baseIntent(), spice_level: 2 },
      "piquant dish for two"
    );
    assert.strictEqual(guardPiquant.corrected.spice_level, 2);

    // Negative test: query with no spice vocabulary resets hallucinated spice_level
    const guardNoSpice = applyGroundingGuard(
      { ...baseIntent(), spice_level: 2 },
      "vegetarian noodles for two"
    );
    assert.strictEqual(
      guardNoSpice.corrected.spice_level,
      null,
      "Query without spice words must reset spice_level to null"
    );
  }
  console.log("✓ Spice Vocabulary Guard verified.");

  // 5. Rule 5: Grounded cuisine & Missing Cuisine (Query 105)
  console.log("\n5. Testing Rule 5: Grounded cuisine & Missing Cuisine...");
  {
    // Fire: "surprise me" with cuisine "Mughlai" -> resets to null
    const input1: Intent = { ...baseIntent(), cuisine: "Mughlai" };
    const res1 = applyPostProcessingRules(input1, "surprise me");
    assert.strictEqual(res1.processed.cuisine, null);
    assert(
      res1.adjustments.some((a) => a.includes("rule:grounded_cuisine")),
      "Should include rule:grounded_cuisine adjustment"
    );

    // Query 105: "continental dinner for two, non-veg, up to 3000" with cuisine null
    // Must fill in "Continental" via rule:missing_cuisine!
    const input105: Intent = { ...baseIntent(), cuisine: null };
    const res105 = applyPostProcessingRules(
      input105,
      "continental dinner for two, non-veg, up to 3000"
    );
    assert.strictEqual(
      res105.processed.cuisine,
      "Continental",
      'Query 105: missing cuisine "continental" must be filled in'
    );
    assert(
      res105.adjustments.some((a) => a.includes("rule:missing_cuisine")),
      "Should include rule:missing_cuisine adjustment"
    );

    // "thai curry" with cuisine null -> filled in as "Asian"
    const inputThai: Intent = { ...baseIntent(), cuisine: null };
    const resThai = applyPostProcessingRules(inputThai, "thai curry for two");
    assert.strictEqual(resThai.processed.cuisine, "Asian");
    assert(resThai.adjustments.some((a) => a.includes("rule:missing_cuisine")));

    // Negative test: "spicy dinner for two" with cuisine null -> remains null
    const inputNoCuisine: Intent = { ...baseIntent(), cuisine: null };
    const resNoCuisine = applyPostProcessingRules(inputNoCuisine, "spicy dinner for two");
    assert.strictEqual(resNoCuisine.processed.cuisine, null);
    assert(!resNoCuisine.adjustments.some((a) => a.includes("rule:missing_cuisine")));

    // Negative test: "spicy chinese food" with cuisine "Indo-Chinese" (alias matched) -> kept
    const inputChinese: Intent = { ...baseIntent(), cuisine: "Indo-Chinese" };
    const resChinese = applyPostProcessingRules(
      inputChinese,
      "spicy chinese food"
    );
    assert.strictEqual(resChinese.processed.cuisine, "Indo-Chinese");
  }
  console.log("✓ Grounded cuisine & Missing cuisine verified.");

  // 6. Rule 6: Grounded party size (Queries 113, 114)
  console.log("\n6. Testing Rule 6: Grounded party size & Evidence Expansion...");
  {
    // Query 113: "my parents and I, vegetarian, under 3000" with party_size 3
    // Must NOT be reset to 1 because "parents" and "and I" are party evidence!
    const input113: Intent = { ...baseIntent(), party_size: 3, budget_total: 3000 };
    const res113 = applyPostProcessingRules(
      input113,
      "my parents and I, vegetarian, under 3000"
    );
    assert.strictEqual(
      res113.processed.party_size,
      3,
      'Query 113: "parents" and "and I" must keep party_size 3'
    );
    assert(!res113.adjustments.some((a) => a.includes("rule:grounded_party_size")));

    // Query 114: "dinner with my girlfriend" with party_size 2
    // Must NOT be reset to 1 because "girlfriend" and "with my" are party evidence!
    const input114: Intent = { ...baseIntent(), party_size: 2 };
    const res114 = applyPostProcessingRules(input114, "dinner with my girlfriend");
    assert.strictEqual(
      res114.processed.party_size,
      2,
      'Query 114: "girlfriend" must keep party_size 2'
    );
    assert(!res114.adjustments.some((a) => a.includes("rule:grounded_party_size")));

    // Additional party words: colleagues, team, partner, mom, dad, along with
    const inputColleagues: Intent = { ...baseIntent(), party_size: 4 };
    assert.strictEqual(
      applyPostProcessingRules(inputColleagues, "lunch with colleagues").processed.party_size,
      4
    );

    const inputTeam: Intent = { ...baseIntent(), party_size: 8, budget_total: 8000 };
    assert.strictEqual(
      applyPostProcessingRules(inputTeam, "the whole team of 8, budget 8000").processed.party_size,
      8
    );

    const inputPartner: Intent = { ...baseIntent(), party_size: 2 };
    assert.strictEqual(
      applyPostProcessingRules(inputPartner, "along with my partner").processed.party_size,
      2
    );

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
  console.log("✓ Rule 6 & Party evidence expansion verified.");

  console.log("\n==================================================");
  console.log("ALL DETERMINISTIC RULES TESTS PASSED SUCCESSFULLY! ✓");
  console.log("==================================================");
}

runTests();


