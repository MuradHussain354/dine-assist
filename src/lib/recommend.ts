import { Intent } from "./intent/schema";

export interface MenuItemInput {
  id: string;
  name: string;
  description: string;
  price: number;
  category: "starter" | "main" | "side" | "dessert" | "drink" | string;
  dietTags: string | string[];
  spiceLevel: number;
  cuisine: string;
  isAvailable: boolean;
}

export interface RecommendedItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface RecommendationResult {
  items: RecommendedItem[];
  total: number;
  message: string;
}

function parseTags(dietTags: string | string[]): string[] {
  if (Array.isArray(dietTags)) return dietTags;
  if (typeof dietTags === "string") {
    try {
      return JSON.parse(dietTags);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Diagnose why no items survived filtering, naming the specific filter.
 */
function diagnoseEmptyFilters(
  allAvailable: MenuItemInput[],
  intent: Intent
): string {
  const diet = intent.diet;
  const spice = intent.spice_level;
  const exclusions = intent.exclusions ?? [];
  const partySize = Math.max(1, intent.party_size || 1);

  // Check diet alone
  if (diet !== "any") {
    const afterDiet = allAvailable.filter((item) => {
      const tags = parseTags(item.dietTags);
      if (diet === "veg") return tags.includes("veg");
      if (diet === "vegan") return tags.includes("vegan");
      if (diet === "non-veg") return tags.includes("non-veg");
      return true;
    });

    if (afterDiet.length === 0) {
      return `No ${diet} dishes are currently available.`;
    }

    // Diet + spice
    if (spice !== null && spice !== undefined) {
      const afterSpice = afterDiet.filter((i) => i.spiceLevel <= spice);
      if (afterSpice.length === 0) {
        return `No ${diet} dishes at or below spice level ${spice}.`;
      }
    }
  }

  // Check spice alone
  if (spice !== null && spice !== undefined) {
    const afterSpice = allAvailable.filter((i) => i.spiceLevel <= spice);
    if (afterSpice.length === 0) {
      return `No dishes at or below spice level ${spice}.`;
    }
  }

  // Check exclusions
  if (exclusions.length > 0) {
    const afterExclusions = allAvailable.filter((item) => {
      const nameLower = item.name.toLowerCase();
      const descLower = (item.description || "").toLowerCase();
      const tags = parseTags(item.dietTags).map((t) => t.toLowerCase());
      for (const rawEx of exclusions) {
        const ex = rawEx.trim().toLowerCase();
        if (!ex) continue;
        if (
          nameLower.includes(ex) ||
          descLower.includes(ex) ||
          tags.some((t) => t.includes(ex))
        )
          return false;
      }
      return true;
    });
    if (afterExclusions.length === 0) {
      return `No dishes remaining after excluding ${exclusions.join(", ")}.`;
    }
  }

  // Budget check (should be caught upstream, but just in case)
  if (intent.budget_total !== null) {
    const cheapest = Math.min(...allAvailable.map((i) => i.price));
    if (intent.budget_total < cheapest) {
      return `Budget of ₹${intent.budget_total} is too low. Minimum cost for ${partySize} person(s) is ₹${cheapest}.`;
    }
  }

  return "No available dishes matched your dietary preferences, spice limits, or exclusions.";
}

export function recommend(
  menuItems: MenuItemInput[],
  intent: Intent
): RecommendationResult {
  const partySize = Math.max(1, intent.party_size || 1);
  const budget = intent.budget_total;
  const targetSpice = intent.spice_level;

  // 1. Filter candidates by availability, diet, exclusions, and spice level
  const allAvailable = menuItems.filter((item) => item.isAvailable);

  const filtered = allAvailable.filter((item) => {
    const tags = parseTags(item.dietTags);

    // Diet filter
    if (intent.diet === "veg") {
      if (!tags.includes("veg")) return false;
    } else if (intent.diet === "vegan") {
      if (!tags.includes("vegan")) return false;
    } else if (intent.diet === "non-veg") {
      if (!tags.includes("non-veg")) return false;
    }

    // Exclusions filter (name, description, tags)
    if (intent.exclusions && intent.exclusions.length > 0) {
      const nameLower = item.name.toLowerCase();
      const descLower = (item.description || "").toLowerCase();
      const tagsLower = tags.map((t) => t.toLowerCase());

      for (const rawEx of intent.exclusions) {
        const ex = rawEx.trim().toLowerCase();
        if (!ex) continue;
        if (
          nameLower.includes(ex) ||
          descLower.includes(ex) ||
          tagsLower.some((t) => t.includes(ex))
        ) {
          return false;
        }
      }
    }

    // Spice level filter (<= requested) — only when spice_level is explicitly set
    if (intent.spice_level !== null && intent.spice_level !== undefined) {
      if (item.spiceLevel > intent.spice_level) {
        return false;
      }
    }

    return true;
  });

  // If no items match filters at all
  if (filtered.length === 0) {
    return {
      items: [],
      total: 0,
      message: diagnoseEmptyFilters(allAvailable, intent),
    };
  }

  // Calculate minimum possible price among any matching dish
  const minItemPrice = Math.min(...filtered.map((i) => i.price));

  // If budget is specified and cannot even afford the single cheapest matching item
  if (budget !== null && budget < minItemPrice) {
    return {
      items: [],
      total: 0,
      message: `Your budget of ₹${budget} is too low. The minimum price for a dish matching your criteria is ₹${minItemPrice}.`,
    };
  }

  // Group filtered items by category
  const mains = filtered.filter((i) => i.category === "main");
  const starters = filtered.filter((i) => i.category === "starter");
  const sides = filtered.filter((i) => i.category === "side");
  const startersAndSides = [...starters, ...sides];
  const drinks = filtered.filter((i) => i.category === "drink");
  const desserts = filtered.filter((i) => i.category === "dessert");

  // Helper to score and sort candidates by cuisine match, spice closeness, price
  const sortCandidates = (list: MenuItemInput[]): MenuItemInput[] => {
    // When spice_level is null, use 1 as a neutral sorting pivot
    const spicePivot = targetSpice !== null && targetSpice !== undefined ? targetSpice : 1;
    return [...list].sort((a, b) => {
      // Preferred cuisine
      if (intent.cuisine) {
        const aCuisine = a.cuisine.toLowerCase() === intent.cuisine.toLowerCase();
        const bCuisine = b.cuisine.toLowerCase() === intent.cuisine.toLowerCase();
        if (aCuisine && !bCuisine) return -1;
        if (!aCuisine && bCuisine) return 1;
      }

      // Closeness to requested spice level
      const aSpiceDiff = Math.abs(a.spiceLevel - spicePivot);
      const bSpiceDiff = Math.abs(b.spiceLevel - spicePivot);
      if (aSpiceDiff !== bSpiceDiff) return aSpiceDiff - bSpiceDiff;

      // Price ascending
      return a.price - b.price;
    });
  };

  const sortedMains = sortCandidates(mains);
  const sortedStarterSides = sortCandidates(startersAndSides);
  const sortedDrinks = sortCandidates(drinks);
  const sortedDesserts = sortCandidates(desserts);

  // Targets
  const targetMains = partySize; // roughly one main per person
  const targetStarterSides = Math.ceil(partySize / 2); // shared starter/side for every 2 people
  const targetDrinks = partySize; // 1 drink per person
  const targetDesserts = Math.ceil(partySize / 2);

  // Minimum cost for a full combo
  const cheapestMain = sortedMains.length > 0 ? sortedMains[0].price : 0;
  const cheapestStarterSide =
    sortedStarterSides.length > 0 ? sortedStarterSides[0].price : 0;
  const cheapestDrink = sortedDrinks.length > 0 ? sortedDrinks[0].price : 0;
  const minFullComboCost =
    cheapestMain * targetMains +
    cheapestStarterSide * targetStarterSides +
    cheapestDrink * targetDrinks;

  const selectedItems: RecommendedItem[] = [];
  let runningTotal = 0;

  const canAfford = (price: number) => {
    if (budget === null) return true;
    return runningTotal + price <= budget;
  };

  const addItem = (item: MenuItemInput) => {
    runningTotal += item.price;
    const existing = selectedItems.find((i) => i.menuItemId === item.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      selectedItems.push({
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
      });
    }
  };

  // Helper to pick items from pool, avoiding repeats unless pool is smaller than target
  const pickFromPool = (pool: MenuItemInput[], targetCount: number) => {
    if (pool.length === 0 || targetCount <= 0) return 0;
    let picked = 0;
    const selectedIds = new Set<string>();

    // Pass 1: unique dishes for variety
    for (const item of pool) {
      if (picked >= targetCount) break;
      if (selectedIds.has(item.id)) continue;
      if (canAfford(item.price)) {
        addItem(item);
        selectedIds.add(item.id);
        picked++;
      }
    }

    // Pass 2: allow duplicates only if pool has fewer unique items than target
    if (picked < targetCount && pool.length < targetCount) {
      while (picked < targetCount) {
        const affordable = pool.filter((i) => canAfford(i.price));
        if (affordable.length === 0) break;
        addItem(affordable[0]);
        picked++;
      }
    }

    return picked;
  };

  // Fill in Priority Order:
  // 1. Mains (about 1 per person)
  const pickedMains = pickFromPool(sortedMains, targetMains);

  // 2. Shared starter or side (1 for every two people)
  const pickedStarterSides = pickFromPool(
    sortedStarterSides,
    targetStarterSides
  );

  // 3. One drink per person
  const pickedDrinks = pickFromPool(sortedDrinks, targetDrinks);

  // 4. Dessert only if budget remains
  let pickedDesserts = 0;
  if (budget === null || runningTotal < budget) {
    pickedDesserts = pickFromPool(sortedDesserts, targetDesserts);
  }

  // If nothing could be selected at all
  if (selectedItems.length === 0) {
    const budgetMsg =
      budget !== null
        ? `Budget of ₹${budget} is too low. Minimum cost for ${partySize} person(s) is ₹${minItemPrice}.`
        : "Could not build an order with available dishes.";
    return {
      items: [],
      total: 0,
      message: budgetMsg,
    };
  }

  // Determine if combo is complete or partial
  const isComplete =
    pickedMains >= targetMains &&
    pickedStarterSides >= targetStarterSides &&
    pickedDrinks >= targetDrinks;

  let message = "";
  if (!isComplete) {
    const budgetPart =
      budget !== null
        ? ` within ₹${budget}`
        : "";
    message = `Assembled a partial combo (${pickedMains}/${targetMains} mains, ${pickedStarterSides}/${targetStarterSides} starters/sides, ${pickedDrinks}/${targetDrinks} drinks)${budgetPart}. A complete combo for ${partySize} requires at least ₹${minFullComboCost}.`;
  } else {
    const dessertNote =
      pickedDesserts > 0 ? ` and ${pickedDesserts} dessert(s)` : "";
    message = `Recommended complete combo for ${partySize} (${pickedMains} main(s), ${pickedStarterSides} starter/side(s), ${pickedDrinks} drink(s)${dessertNote}) totaling ₹${runningTotal}.`;
  }

  return {
    items: selectedItems,
    total: runningTotal,
    message,
  };
}
