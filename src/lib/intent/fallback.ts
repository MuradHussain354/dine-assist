import { Intent } from "./schema";

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  couple: 2,
};

export function extractFallbackIntent(query: string): Intent {
  const text = query.trim().toLowerCase();

  // 1. Party Size
  let partySize = 1;
  if (/\b(?:just\s+me|myself|alone|solo)\b/.test(text)) {
    partySize = 1;
  } else {
    const partyMatch =
      text.match(/\bfor\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|couple)\b/) ||
      text.match(/\bparty\s+of\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/) ||
      text.match(/\btable\s+for\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/) ||
      text.match(/\b(\d+)\s*(?:people|persons|pax|guests|heads)\b/);

    if (partyMatch && partyMatch[1]) {
      const val = partyMatch[1];
      if (/^\d+$/.test(val)) {
        partySize = Math.max(1, parseInt(val, 10));
      } else if (NUMBER_WORDS[val]) {
        partySize = NUMBER_WORDS[val];
      }
    }
  }

  // 2. Diet
  let diet: Intent["diet"] = "any";
  if (/\bvegan\b/.test(text)) {
    diet = "vegan";
  } else if (/\b(?:non-?veg|chicken|mutton|fish|prawns?|meat|lamb|seafood)\b/.test(text)) {
    diet = "non-veg";
  } else if (/\b(?:vegetarian|pure\s+veg|veg)\b/.test(text)) {
    // Avoid matching "veg" inside "non-veg"
    if (!/\bnon-?veg\b/.test(text)) {
      diet = "veg";
    }
  }

  // 3. Spice Level
  let spiceLevel: Intent["spice_level"] = null;
  if (/\b(?:not\s+too\s+spicy|not\s+very\s+spicy|not\s+spicy|low\s+spice|mild|mildly\s+spicy|light\s+spice|little\s+spicy)\b/.test(text)) {
    spiceLevel = 1;
  } else if (/\b(?:medium\s+spic(?:y|e)|moderate\s+spice|medium)\b/.test(text)) {
    spiceLevel = 2;
  } else if (/\b(?:very\s+spicy|extra\s+spicy|super\s+spicy|spicy|hot|fiery)\b/.test(text)) {
    spiceLevel = 3;
  } else if (/\b(?:no\s+spice|zero\s+spice|sweet|bland)\b/.test(text)) {
    spiceLevel = 0;
  }

  // 4. Budget
  let budgetTotal: number | null = null;
  const isPerPerson = /\b(?:per\s+(?:person|head|pax|each)|a\s+head|\/person|\/head|each)\b/.test(text);

  // Regex for amounts:
  // "under 1500", "1500 rupees", "rs 1500", "₹1500", "budget 2000"
  const amountPatterns = [
    /(?:under|below|within|less\s+than|upto|up\s+to|around|budget(?:\s+of)?|max)?\s*(?:rs\.?|inr|₹)\s*(\d+(?:,\d+)?)\b/,
    /\b(\d+(?:,\d+)?)\s*(?:rupees|rs\.?|inr|₹)/,
    /(?:under|below|within|less\s+than|upto|up\s+to|around|budget(?:\s+of)?|max)\s*(\d+(?:,\d+)?)\b/,
  ];

  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const rawNum = parseInt(match[1].replace(/,/g, ""), 10);
      if (!isNaN(rawNum) && rawNum > 0) {
        budgetTotal = isPerPerson ? rawNum * partySize : rawNum;
        break;
      }
    }
  }

  // 5. Exclusions
  const exclusions: string[] = [];
  const exclusionMatch = text.match(
    /\b(?:no|without|except|excluding|exclude)\s+([a-z\s,]+?)(?:\s*(?:under|below|within|for\s+\d+|for\s+two|for\s+three|for\s+four|budget|spice|cuisine|with|\.|$))/
  );

  if (exclusionMatch && exclusionMatch[1]) {
    const items = exclusionMatch[1]
      .split(/,|\band\b/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && !["please", "extra", "more"].includes(s));
    exclusions.push(...items);
  }

  // 6. Cuisine
  let cuisine: string | null = null;
  if (/\bnorth\s+indian\b/.test(text)) {
    cuisine = "North Indian";
  } else if (/\bsouth\s+indian\b/.test(text)) {
    cuisine = "South Indian";
  } else if (/\bmughlai\b/.test(text)) {
    cuisine = "Mughlai";
  } else if (/\b(?:indo-?chinese|chinese)\b/.test(text)) {
    cuisine = "Indo-Chinese";
  } else if (/\b(?:coastal\s+indian|coastal)\b/.test(text)) {
    cuisine = "Coastal Indian";
  } else if (/\bcontinental\b/.test(text)) {
    cuisine = "Continental";
  } else if (/\b(?:asian|thai)\b/.test(text)) {
    cuisine = "Asian";
  } else if (/\bitalian\b/.test(text)) {
    cuisine = "Italian";
  }

  return {
    diet,
    spice_level: spiceLevel,
    budget_total: budgetTotal,
    party_size: partySize,
    exclusions,
    cuisine,
  };
}
