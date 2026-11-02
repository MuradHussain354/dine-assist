import { Intent } from "./schema";
import {
  PER_PERSON_PATTERN,
  extractBudgetAmount,
  KNOWN_CUISINES,
} from "./fallback";

export const CUISINE_ALIASES: Record<string, string[]> = {
  "indo-chinese": ["indo-chinese", "indochinese", "chinese"],
  "coastal indian": ["coastal indian", "coastal"],
  "north indian": ["north indian"],
  "south indian": ["south indian"],
  "asian": ["asian", "thai"],
  "mughlai": ["mughlai"],
  "italian": ["italian"],
  "continental": ["continental"],
};

export const PARTY_EVIDENCE_PATTERN =
  /\b(?:family|couple|wife|husband|kids|children|friends|group|us|we|both|pair|party|table\s+for|parents|mom|mum|dad|mother|father|brother|sister|son|daughter|girlfriend|boyfriend|partner|colleagues|team|guests|people|persons|with\s+my|and\s+my|me\s+and|and\s+i|along\s+with)\b/i;

export const NUMBER_WORDS_PATTERN =
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i;

export interface PostProcessResult {
  processed: Intent;
  adjustments: string[];
}

/**
 * Deterministic rules layer applied after Zod validation and grounding guard.
 */
export function applyPostProcessingRules(
  intent: Intent,
  query: string
): PostProcessResult {
  const adjustments: string[] = [];
  const processed: Intent = {
    ...intent,
    exclusions: [...intent.exclusions],
  };

  const text = query.trim().toLowerCase();

  // Rule 2: Vegan
  // if query contains "vegan", "plant-based" or "plant based", set diet to "vegan".
  if (/\b(?:vegan|plant-?based|plant\s+based)\b/i.test(text)) {
    if (processed.diet !== "vegan") {
      processed.diet = "vegan";
      adjustments.push("rule:vegan: diet set to vegan");
    }
  }
  // Rule 3: Negated diet
  // "not vegetarian", "non-vegetarian", "non vegetarian" and "non-veg" set diet to "non-veg".
  else if (
    /\b(?:not\s+vegetarian|non-?vegetarian|non\s+vegetarian|non-?veg)\b/i.test(
      text
    )
  ) {
    if (processed.diet !== "non-veg") {
      processed.diet = "non-veg";
      adjustments.push("rule:negated_diet: diet set to non-veg");
    }
  }

  // Rule 4: Missing budget
  // if LLM returned budget_total null but query has a clear budget phrase, fill it.
  const budgetMatch = extractBudgetAmount(text);
  if (processed.budget_total === null && budgetMatch) {
    processed.budget_total = budgetMatch.amount;
    adjustments.push(
      `rule:missing_budget: budget_total set to ${budgetMatch.amount}`
    );
  }

  // Rule 1: Per-person budget
  // Computed strictly from the amount found in the QUERY TEXT using the fallback regex,
  // multiplied by party_size. Never multiply the LLM's budget_total. Idempotent.
  if (PER_PERSON_PATTERN.test(text) && budgetMatch) {
    const calculatedBudget = budgetMatch.amount * (processed.party_size || 1);
    if (processed.budget_total !== calculatedBudget) {
      processed.budget_total = calculatedBudget;
      adjustments.push(
        `rule:per_person_budget: budget_total set to ${calculatedBudget}`
      );
    }
  }

  // Rule 5: Grounded cuisine
  // keep cuisine only if its lowercase text appears in query (or is a known alias); otherwise null.
  if (processed.cuisine !== null) {
    const lowerCuisine = processed.cuisine.trim().toLowerCase();
    const aliases = CUISINE_ALIASES[lowerCuisine] || [lowerCuisine];
    const isGrounded =
      text.includes(lowerCuisine) ||
      aliases.some((alias) => text.includes(alias));

    if (!isGrounded) {
      processed.cuisine = null;
      adjustments.push("rule:grounded_cuisine: cuisine reset to null");
    }
  }

  // Missing cuisine: if LLM returned null cuisine and query contains a known cuisine word from fallback list
  if (processed.cuisine === null) {
    for (const item of KNOWN_CUISINES) {
      if (item.pattern.test(text)) {
        processed.cuisine = item.name;
        adjustments.push(`rule:missing_cuisine: cuisine set to ${item.name}`);
        break;
      }
    }
  }

  // Rule 6: Grounded party size
  // party_size above 1 requires evidence in the query.
  // First remove the matched budget amount from the query, then look for a digit,
  // a number word, or one of the party keywords. If none is found, set party_size to 1.
  if (processed.party_size > 1) {
    let queryWithoutBudget = text;
    if (budgetMatch) {
      queryWithoutBudget = queryWithoutBudget.replace(
        budgetMatch.matchedText.toLowerCase(),
        ""
      );
    }
    if (processed.budget_total !== null) {
      queryWithoutBudget = queryWithoutBudget.replace(
        new RegExp(`\\b${processed.budget_total}\\b`, "g"),
        ""
      );
    }

    const hasDigit = /\d+/.test(queryWithoutBudget);
    const hasNumberWord = NUMBER_WORDS_PATTERN.test(queryWithoutBudget);
    const hasPartyWord = PARTY_EVIDENCE_PATTERN.test(queryWithoutBudget);

    if (!hasDigit && !hasNumberWord && !hasPartyWord) {
      processed.party_size = 1;
      adjustments.push("rule:grounded_party_size: party_size reset to 1");
    }
  }

  return { processed, adjustments };
}
