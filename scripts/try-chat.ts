import { PrismaClient } from "@prisma/client";
import { extractIntent } from "../src/lib/intent/extract";
import { recommend } from "../src/lib/recommend";

const prisma = new PrismaClient();

async function main() {
  const query =
    process.argv.slice(2).join(" ").trim() ||
    "something spicy, vegetarian, under 1500 rupees for two";

  console.log("==================================================");
  console.log("DINE-ASSIST: AI CORE INTERACTIVE TEST");
  console.log("==================================================");
  console.log(`User Query: "${query}"\n`);

  console.log("1. Fetching available menu items from database...");
  const menuItems = await prisma.menuItem.findMany({
    where: { isAvailable: true },
  });
  console.log(`Found ${menuItems.length} available dishes.\n`);

  console.log("2. Running Intent Extraction (Ollama / Fallback)...");
  const extraction = await extractIntent(query);
  console.log(`Extraction Latency: ${extraction.latencyMs}ms`);
  console.log(`Used Fallback: ${extraction.usedFallback}`);
  console.log("Structured Intent:");
  console.log(JSON.stringify(extraction.intent, null, 2));

  console.log("\n3. Running Pure Recommender...");
  const recommendation = recommend(menuItems, extraction.intent);
  console.log("\nRecommendation Results:");
  console.log(`Message: ${recommendation.message}`);
  console.log("--------------------------------------------------");
  if (recommendation.items.length === 0) {
    console.log("No items recommended.");
  } else {
    for (const item of recommendation.items) {
      console.log(
        `• ${item.name} x${item.quantity} @ ₹${item.price} each = ₹${item.price * item.quantity}`
      );
    }
  }
  console.log("--------------------------------------------------");
  console.log(`TOTAL AMOUNT: ₹${recommendation.total}`);
  if (extraction.intent.budget_total !== null) {
    console.log(`BUDGET LIMIT: ₹${extraction.intent.budget_total}`);
    console.log(
      `Budget Met: ${recommendation.total <= extraction.intent.budget_total ? "YES ✓" : "NO ✕"}`
    );
  }
  console.log("==================================================");
}

main()
  .catch((e) => {
    console.error("Error in try-chat:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
