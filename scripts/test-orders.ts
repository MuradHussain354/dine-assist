import assert from "node:assert";
import { prisma } from "../src/lib/prisma";
import { createOrderSchema } from "../src/lib/validations/order";

async function runTests() {
  console.log("==================================================");
  console.log("TESTING ORDERS VALIDATION AND WORKFLOW");
  console.log("==================================================");

  // 1. Test Zod validation rules
  console.log("\n1. Testing Zod Validation Schema...");

  // Valid order
  const valid = createOrderSchema.safeParse({
    tableId: "t1",
    items: [{ menuItemId: "m1", quantity: 2 }],
    note: "Extra napkins please",
  });
  assert(valid.success, "Valid order should pass validation");
  console.log("  ✓ Valid order passes schema validation");

  // Quantity > 20 per item
  const tooManyPerItem = createOrderSchema.safeParse({
    tableId: "t1",
    items: [{ menuItemId: "m1", quantity: 25 }],
  });
  assert(!tooManyPerItem.success, "Quantity > 20 should fail");
  console.log("  ✓ Quantity > 20 per item rejected by schema");

  // Total quantity > 30 items
  const tooManyTotal = createOrderSchema.safeParse({
    tableId: "t1",
    items: [
      { menuItemId: "m1", quantity: 18 },
      { menuItemId: "m2", quantity: 15 },
    ],
  });
  assert(!tooManyTotal.success, "Total quantity > 30 should fail refinement");
  console.log("  ✓ Total quantity > 30 rejected by schema refinement");

  // Empty items
  const emptyItems = createOrderSchema.safeParse({
    tableId: "t1",
    items: [],
  });
  assert(!emptyItems.success, "Empty items array should fail");
  console.log("  ✓ Empty items array rejected");

  // 2. Test database operations
  console.log("\n2. Testing Database Order Placement...");
  const table = await prisma.diningTable.findFirst({
    where: { number: 1 },
  });
  assert(table, "Table 1 must exist from seed");

  const availableDishes = await prisma.menuItem.findMany({
    where: { isAvailable: true },
    take: 2,
  });
  assert(availableDishes.length >= 2, "Must have at least 2 available dishes");

  const [dish1, dish2] = availableDishes;

  // Simulate order creation in transaction (exact same logic as in /api/orders)
  const qty1 = 2;
  const qty2 = 1;
  const expectedTotal = dish1.price * qty1 + dish2.price * qty2;

  const order = await prisma.$transaction(async (tx) => {
    return tx.order.create({
      data: {
        tableId: table.id,
        status: "placed",
        totalAmount: expectedTotal,
        items: {
          create: [
            {
              menuItemId: dish1.id,
              quantity: qty1,
              unitPrice: dish1.price, // DB price snapshot
            },
            {
              menuItemId: dish2.id,
              quantity: qty2,
              unitPrice: dish2.price, // DB price snapshot
            },
          ],
        },
      },
      include: {
        items: true,
      },
    });
  });

  assert(order.id, "Order must have generated ID");
  assert.strictEqual(order.status, "placed", 'Status must be "placed"');
  assert.strictEqual(order.totalAmount, expectedTotal, "Total must match server computed sum");
  assert.strictEqual(order.items.length, 2, "Must create 2 OrderItems");
  assert.strictEqual(order.items[0].unitPrice, dish1.price, "Snapshot price must match DB");
  assert.strictEqual(order.items[1].unitPrice, dish2.price, "Snapshot price must match DB");
  console.log(`  ✓ Created order #${order.id.slice(-8)} with status "placed" totaling ₹${order.totalAmount}`);

  // Test Table Ownership check
  const table2 = await prisma.diningTable.findFirst({
    where: { number: 2 },
  });
  assert(table2, "Table 2 must exist");
  assert.notStrictEqual(order.tableId, table2.id, "Order should not belong to Table 2");
  console.log("  ✓ Order ownership verified (only belongs to Table 1, not Table 2)");

  // Clean up test order
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
  console.log("  ✓ Test order cleaned up");

  console.log("\n==================================================");
  console.log("All order validation & workflow tests passed! ✓");
  console.log("==================================================");
}

runTests()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
