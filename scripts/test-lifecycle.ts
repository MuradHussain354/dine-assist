import assert from "node:assert";
import { prisma } from "../src/lib/prisma";
import {
  transitionOrder,
  OrderTransitionError,
  ALLOWED_TRANSITIONS,
} from "../src/lib/orders/status";

async function main() {
  console.log("==================================================");
  console.log("TESTING ORDER LIFECYCLE & STATE MACHINE");
  console.log("==================================================");

  // Setup: Find Table 1 and an available menu item
  const table1 = await prisma.diningTable.findFirst({
    where: { number: 1 },
  });
  assert(table1, "Table 1 must exist");

  const table2 = await prisma.diningTable.findFirst({
    where: { number: 2 },
  });
  assert(table2, "Table 2 must exist");

  const menuItem = await prisma.menuItem.findFirst({
    where: { isAvailable: true },
  });
  assert(menuItem, "Menu item must exist");

  const createdOrderIds: string[] = [];

  // Helper to create test orders
  const createTestOrder = async (note = "Test Order") => {
    const order = await prisma.order.create({
      data: {
        tableId: table1.id,
        status: "placed",
        totalAmount: menuItem.price,
        note,
        items: {
          create: [
            {
              menuItemId: menuItem.id,
              quantity: 1,
              unitPrice: menuItem.price,
            },
          ],
        },
        events: {
          create: [{ status: "placed" }],
        },
      },
    });
    createdOrderIds.push(order.id);
    return order;
  };

  try {
    // -----------------------------------------------------------------
    // TEST 1: Allowed transitions (placed -> preparing -> ready -> served)
    // -----------------------------------------------------------------
    console.log("\n1. Testing Happy Path Transitions...");
    const order1 = await createTestOrder("Happy Path");

    // placed -> preparing
    const prepOrder = await transitionOrder(order1.id, "preparing");
    assert.strictEqual(prepOrder.status, "preparing");
    let dbOrder = await prisma.order.findUnique({ where: { id: order1.id } });
    assert.strictEqual(dbOrder?.status, "preparing");
    console.log("  ✓ placed -> preparing succeeded");

    // preparing -> ready
    const readyOrder = await transitionOrder(order1.id, "ready");
    assert.strictEqual(readyOrder.status, "ready");
    dbOrder = await prisma.order.findUnique({ where: { id: order1.id } });
    assert.strictEqual(dbOrder?.status, "ready");
    console.log("  ✓ preparing -> ready succeeded");

    // ready -> served
    const servedOrder = await transitionOrder(order1.id, "served");
    assert.strictEqual(servedOrder.status, "served");
    dbOrder = await prisma.order.findUnique({ where: { id: order1.id } });
    assert.strictEqual(dbOrder?.status, "served");
    console.log("  ✓ ready -> served succeeded");

    // Verify all history events were recorded in OrderEvent
    const events = await prisma.orderEvent.findMany({
      where: { orderId: order1.id },
      orderBy: { createdAt: "asc" },
    });
    const statuses = events.map((e) => e.status);
    assert.deepStrictEqual(statuses, [
      "placed",
      "preparing",
      "ready",
      "served",
    ]);
    console.log("  ✓ All 4 history events recorded in OrderEvent table");

    // -----------------------------------------------------------------
    // TEST 2: Invalid transitions & terminal state protection (409)
    // -----------------------------------------------------------------
    console.log("\n2. Testing Invalid Transitions (409 Rejection)...");

    // Cannot transition from terminal state "served"
    let error409Caught = false;
    try {
      await transitionOrder(order1.id, "ready");
    } catch (e) {
      if (e instanceof OrderTransitionError && e.statusCode === 409) {
        error409Caught = true;
      }
    }
    assert(error409Caught, "served -> ready must be rejected with 409");
    console.log("  ✓ served -> ready rejected with 409");

    // Cannot skip states: placed -> served directly
    const order2 = await createTestOrder("Skip states test");
    error409Caught = false;
    try {
      await transitionOrder(order2.id, "served");
    } catch (e) {
      if (e instanceof OrderTransitionError && e.statusCode === 409) {
        error409Caught = true;
      }
    }
    assert(error409Caught, "placed -> served must be rejected with 409");
    console.log("  ✓ placed -> served rejected with 409");

    // Cannot cancel after preparing has started
    await transitionOrder(order2.id, "preparing");
    error409Caught = false;
    try {
      await transitionOrder(order2.id, "cancelled");
    } catch (e) {
      if (e instanceof OrderTransitionError && e.statusCode === 409) {
        error409Caught = true;
      }
    }
    assert(error409Caught, "preparing -> cancelled must be rejected with 409");
    console.log("  ✓ preparing -> cancelled rejected with 409");

    // -----------------------------------------------------------------
    // TEST 3: Double-advance race condition (Conditional Write)
    // -----------------------------------------------------------------
    console.log("\n3. Testing Concurrent Double-Advance Race Condition...");
    const raceOrder = await createTestOrder("Race condition test");

    // Attempt two simultaneous transitions from placed -> preparing
    const results = await Promise.allSettled([
      transitionOrder(raceOrder.id, "preparing"),
      transitionOrder(raceOrder.id, "preparing"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.strictEqual(
      fulfilled.length,
      1,
      "Exactly one transition must succeed"
    );
    assert.strictEqual(
      rejected.length,
      1,
      "Exactly one transition must be rejected"
    );

    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    assert(
      rejectionReason instanceof OrderTransitionError &&
        rejectionReason.statusCode === 409,
      "Rejected transition must be OrderTransitionError with 409"
    );

    const finalRaceOrder = await prisma.order.findUnique({
      where: { id: raceOrder.id },
    });
    assert.strictEqual(finalRaceOrder?.status, "preparing");
    console.log(
      "  ✓ Race condition handled: exactly 1 succeeded, 1 rejected with 409"
    );

    // -----------------------------------------------------------------
    // TEST 4: Cancel rules & table ownership
    // -----------------------------------------------------------------
    console.log("\n4. Testing Cancellation Rules...");

    // Placed order can be cancelled
    const cancelOrder = await createTestOrder("Cancel test");
    const cancelled = await transitionOrder(cancelOrder.id, "cancelled");
    assert.strictEqual(cancelled.status, "cancelled");
    console.log("  ✓ placed -> cancelled succeeded");

    // Cannot transition from terminal state "cancelled"
    error409Caught = false;
    try {
      await transitionOrder(cancelOrder.id, "preparing");
    } catch (e) {
      if (e instanceof OrderTransitionError && e.statusCode === 409) {
        error409Caught = true;
      }
    }
    assert(error409Caught, "cancelled -> preparing must be rejected with 409");
    console.log("  ✓ cancelled -> preparing rejected with 409");

    // Verify ALLOWED_TRANSITIONS definition
    assert.deepStrictEqual(ALLOWED_TRANSITIONS.placed, [
      "preparing",
      "cancelled",
    ]);
    assert.deepStrictEqual(ALLOWED_TRANSITIONS.preparing, ["ready"]);
    assert.deepStrictEqual(ALLOWED_TRANSITIONS.ready, ["served"]);
    assert.deepStrictEqual(ALLOWED_TRANSITIONS.served, []);
    assert.deepStrictEqual(ALLOWED_TRANSITIONS.cancelled, []);
    console.log("  ✓ State machine transition matrix fully verified");
  } finally {
    // -----------------------------------------------------------------
    // CLEANUP
    // -----------------------------------------------------------------
    console.log("\n5. Cleaning up test data...");
    if (createdOrderIds.length > 0) {
      await prisma.orderEvent.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.orderItem.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      });
    }
    console.log(`  ✓ Cleaned up ${createdOrderIds.length} test order(s)`);
  }

  console.log("\n==================================================");
  console.log("All lifecycle tests passed successfully! ✓");
  console.log("==================================================");
}

main()
  .catch((err) => {
    console.error("Lifecycle test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
