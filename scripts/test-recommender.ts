import assert from "node:assert";
import { recommend, MenuItemInput } from "../src/lib/recommend";
import { Intent } from "../src/lib/intent/schema";

const mockMenu: MenuItemInput[] = [
  // Mains
  {
    id: "m1",
    name: "Butter Chicken",
    description: "Chicken in rich tomato gravy",
    price: 500,
    category: "main",
    dietTags: JSON.stringify(["non-veg"]),
    spiceLevel: 1,
    cuisine: "North Indian",
    isAvailable: true,
  },
  {
    id: "m2",
    name: "Paneer Butter Masala",
    description: "Cottage cheese in creamy gravy",
    price: 400,
    category: "main",
    dietTags: JSON.stringify(["veg"]),
    spiceLevel: 1,
    cuisine: "North Indian",
    isAvailable: true,
  },
  {
    id: "m3",
    name: "Spicy Mutton Curry",
    description: "Tender lamb in fiery gravy with onions",
    price: 600,
    category: "main",
    dietTags: JSON.stringify(["non-veg"]),
    spiceLevel: 3,
    cuisine: "North Indian",
    isAvailable: true,
  },
  {
    id: "m4",
    name: "Vegan Chana Masala",
    description: "Spiced chickpeas in tomato gravy",
    price: 300,
    category: "main",
    dietTags: JSON.stringify(["vegan", "veg"]),
    spiceLevel: 2,
    cuisine: "North Indian",
    isAvailable: true,
  },
  {
    id: "m5",
    name: "Unavailable Special Curry",
    description: "Out of stock curry",
    price: 250,
    category: "main",
    dietTags: JSON.stringify(["veg"]),
    spiceLevel: 1,
    cuisine: "North Indian",
    isAvailable: false, // Unavailable
  },

  // Starters
  {
    id: "s1",
    name: "Paneer Tikka",
    description: "Grilled cottage cheese cubes with bell pepper",
    price: 350,
    category: "starter",
    dietTags: JSON.stringify(["veg"]),
    spiceLevel: 2,
    cuisine: "North Indian",
    isAvailable: true,
  },
  {
    id: "s2",
    name: "Chicken Malai Tikka",
    description: "Creamy mild chicken skewers",
    price: 420,
    category: "starter",
    dietTags: JSON.stringify(["non-veg"]),
    spiceLevel: 1,
    cuisine: "Mughlai",
    isAvailable: true,
  },
  {
    id: "s3",
    name: "Vegan Crispy Corn",
    description: "Fried pepper corn salt with spring onions",
    price: 250,
    category: "starter",
    dietTags: JSON.stringify(["vegan", "veg"]),
    spiceLevel: 1,
    cuisine: "Indo-Chinese",
    isAvailable: true,
  },

  // Sides
  {
    id: "sd1",
    name: "Garlic Naan Basket",
    description: "Clay oven flatbread with garlic butter",
    price: 200,
    category: "side",
    dietTags: JSON.stringify(["veg"]),
    spiceLevel: 0,
    cuisine: "North Indian",
    isAvailable: true,
  },
  {
    id: "sd2",
    name: "Steamed Rice",
    description: "Basmati steamed white rice",
    price: 180,
    category: "side",
    dietTags: JSON.stringify(["vegan", "veg"]),
    spiceLevel: 0,
    cuisine: "North Indian",
    isAvailable: true,
  },

  // Drinks
  {
    id: "d1",
    name: "Sweet Lassi",
    description: "Churned yogurt sweetened beverage",
    price: 180,
    category: "drink",
    dietTags: JSON.stringify(["veg"]),
    spiceLevel: 0,
    cuisine: "North Indian",
    isAvailable: true,
  },
  {
    id: "d2",
    name: "Fresh Lime Soda",
    description: "Sparkling water with fresh lime",
    price: 150,
    category: "drink",
    dietTags: JSON.stringify(["vegan", "veg"]),
    spiceLevel: 0,
    cuisine: "Continental",
    isAvailable: true,
  },

  // Desserts
  {
    id: "ds1",
    name: "Gulab Jamun",
    description: "Warm fried milk dough balls in cardamom syrup",
    price: 200,
    category: "dessert",
    dietTags: JSON.stringify(["veg"]),
    spiceLevel: 0,
    cuisine: "North Indian",
    isAvailable: true,
  },
];

console.log("Running Recommender test suite...\n");

// Test 1: Totals never exceed budget_total
{
  console.log("Test 1: Budget limit enforcement");
  const testBudgets = [300, 600, 1000, 1500, 2500];

  for (const b of testBudgets) {
    const intent: Intent = {
      diet: "any",
      spice_level: 2,
      budget_total: b,
      party_size: 2,
      exclusions: [],
      cuisine: null,
    };

    const res = recommend(mockMenu, intent);
    assert(
      res.total <= b,
      `Expected total (${res.total}) to be <= budget (${b})`
    );

    // Verify computed total matches sum of items
    const manualSum = res.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    assert.strictEqual(res.total, manualSum, "Total must match sum of item prices");
  }
  console.log("  ✓ Totals strictly respect budget limits");
}

// Test 2: Veg requests never return non-veg dishes
{
  console.log("\nTest 2: Diet tag enforcement");
  const vegIntent: Intent = {
    diet: "veg",
    spice_level: 3,
    budget_total: 3000,
    party_size: 2,
    exclusions: [],
    cuisine: null,
  };

  const vegRes = recommend(mockMenu, vegIntent);
  assert(vegRes.items.length > 0, "Should return dishes for veg request");

  for (const item of vegRes.items) {
    const original = mockMenu.find((m) => m.id === item.menuItemId);
    assert(original, "Item must exist in mock menu");
    const tags = JSON.parse(original.dietTags as string);
    assert(tags.includes("veg"), `Veg order item "${item.name}" must contain 'veg' tag`);
    assert(!tags.includes("non-veg"), `Veg order item "${item.name}" must not contain 'non-veg' tag`);
  }
  console.log("  ✓ Veg requests never return non-veg dishes");

  // Vegan request
  const veganIntent: Intent = {
    diet: "vegan",
    spice_level: 3,
    budget_total: 3000,
    party_size: 1,
    exclusions: [],
    cuisine: null,
  };
  const veganRes = recommend(mockMenu, veganIntent);
  for (const item of veganRes.items) {
    const original = mockMenu.find((m) => m.id === item.menuItemId);
    const tags = JSON.parse(original!.dietTags as string);
    assert(tags.includes("vegan"), `Vegan order item "${item.name}" must contain 'vegan' tag`);
  }
  console.log("  ✓ Vegan requests strictly return vegan dishes");
}

// Test 3: Spice limits are respected (spiceLevel <= requested)
{
  console.log("\nTest 3: Spice level constraint enforcement");
  for (const maxSpice of [0, 1, 2]) {
    const intent: Intent = {
      diet: "any",
      spice_level: maxSpice,
      budget_total: 5000,
      party_size: 2,
      exclusions: [],
      cuisine: null,
    };

    const res = recommend(mockMenu, intent);
    for (const item of res.items) {
      const original = mockMenu.find((m) => m.id === item.menuItemId);
      assert(
        original!.spiceLevel <= maxSpice,
        `Item "${item.name}" spiceLevel (${original!.spiceLevel}) exceeds requested max (${maxSpice})`
      );
    }
  }
  console.log("  ✓ Spice limits (<= requested) are strictly respected");
}

// Test 4: Exclusions are respected
{
  console.log("\nTest 4: Ingredient / keyword exclusion enforcement");
  const intentWithExclusion: Intent = {
    diet: "any",
    spice_level: null,
    budget_total: 2000,
    party_size: 2,
    exclusions: ["chicken", "onions"],
    cuisine: null,
  };

  const res = recommend(mockMenu, intentWithExclusion);
  for (const item of res.items) {
    const original = mockMenu.find((m) => m.id === item.menuItemId);
    const text = `${original!.name} ${original!.description}`.toLowerCase();
    assert(!text.includes("chicken"), `Excluded item "chicken" found in "${item.name}"`);
    assert(!text.includes("onions"), `Excluded item "onions" found in "${item.name}"`);
  }
  console.log("  ✓ Exclusions are strictly respected");
}

// Test 5: Unavailable dishes are never recommended
{
  console.log("\nTest 5: Availability check");
  const intent: Intent = {
    diet: "veg",
    spice_level: 2,
    budget_total: 3000,
    party_size: 2,
    exclusions: [],
    cuisine: null,
  };

  const res = recommend(mockMenu, intent);
  for (const item of res.items) {
    const original = mockMenu.find((m) => m.id === item.menuItemId);
    assert.strictEqual(original!.isAvailable, true, "Cannot recommend unavailable item");
  }
  console.log("  ✓ Unavailable dishes are never recommended");
}

// Test 6: Message explanation when budget is too low
{
  console.log("\nTest 6: Informative message when budget is too low");
  const tightBudgetIntent: Intent = {
    diet: "any",
    spice_level: 2,
    budget_total: 100, // Cheapest item is 150
    party_size: 1,
    exclusions: [],
    cuisine: null,
  };

  const res = recommend(mockMenu, tightBudgetIntent);
  assert.strictEqual(res.items.length, 0, "No items should be recommended for impossible budget");
  assert.strictEqual(res.total, 0, "Total must be 0");
  assert(res.message.includes("minimum") || res.message.includes("too low"), "Message must explain minimum cost");
  console.log("  ✓ Explanatory message includes minimum cost when nothing fits");
}

// Test 7: Null budget gives a full combo (mains included)
{
  console.log("\nTest 7: Null budget gives a full combo with mains");
  const intent: Intent = {
    diet: "any",
    spice_level: null,
    budget_total: null,
    party_size: 2,
    exclusions: [],
    cuisine: null,
  };

  const res = recommend(mockMenu, intent);
  assert(res.items.length > 0, "Should return items when budget is null");

  // Must include at least one main
  const mainItems = res.items.filter((item) => {
    const original = mockMenu.find((m) => m.id === item.menuItemId);
    return original?.category === "main";
  });
  assert(mainItems.length > 0, "Null budget must include mains in the combo");
  assert(res.total > 0, "Total must be positive");
  // Message should not contain "₹null"
  assert(!res.message.includes("₹null"), 'Message must not contain "₹null"');
  assert(!res.message.includes("null"), 'Message must not reference null');
  console.log("  ✓ Null budget produces a full combo with mains");
}

// Test 8: Null spice doesn't filter anything
{
  console.log("\nTest 8: Null spice_level does not filter out any dishes");
  const intent: Intent = {
    diet: "any",
    spice_level: null,
    budget_total: null,
    party_size: 2,
    exclusions: [],
    cuisine: null,
  };

  const res = recommend(mockMenu, intent);
  assert(res.items.length > 0, "Should return items when spice is null");

  // Verify that high-spice items (spiceLevel 3) CAN appear
  // With null spice, no filtering should happen, so the pool includes everything.
  // The mock menu has spiceLevel 3 items (m3: Spicy Mutton Curry).
  // While the recommender may not pick it due to sorting, let's verify that
  // a direct intent targeting non-veg with null spice includes spice-3 items.
  const nonVegIntent: Intent = {
    diet: "non-veg",
    spice_level: null,
    budget_total: null,
    party_size: 3, // Needs 3 mains — will include m1 (spice 1), m3 (spice 3)
    exclusions: [],
    cuisine: null,
  };
  const nonVegRes = recommend(mockMenu, nonVegIntent);
  const spiceLevelsIncluded = nonVegRes.items.map((item) => {
    const original = mockMenu.find((m) => m.id === item.menuItemId);
    return original?.spiceLevel ?? -1;
  });
  // With only 2 non-veg mains (m1 spice=1, m3 spice=3), both must appear
  assert(
    spiceLevelsIncluded.some((s) => s === 3),
    "Null spice must allow spice level 3 items to be recommended"
  );
  console.log("  ✓ Null spice_level allows all spice levels through");
}

// Test 9: Budget-too-low message includes minimum cost
{
  console.log("\nTest 9: Budget-too-low message includes minimum cost");
  const intent: Intent = {
    diet: "veg",
    spice_level: null,
    budget_total: 50, // Way too low for anything
    party_size: 2,
    exclusions: [],
    cuisine: null,
  };

  const res = recommend(mockMenu, intent);
  assert.strictEqual(res.items.length, 0, "No items for budget=50");
  assert.strictEqual(res.total, 0, "Total must be 0");
  assert(res.message.includes("too low"), 'Message should say "too low"');
  // Check that message includes the actual minimum price
  assert(
    res.message.includes("₹") && /₹\d+/.test(res.message),
    "Message must include a minimum cost figure with ₹"
  );
  console.log("  ✓ Budget-too-low message includes minimum cost");
}

console.log("\n==================================================");
console.log("All recommender tests passed successfully! ✓");
console.log("==================================================");
