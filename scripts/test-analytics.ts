import assert from "node:assert";
import {
  calculateOrderKPIs,
  calculateTopDishes,
  calculateOrdersPerHour,
  calculateRevenuePerDay,
  calculateOrdersByStatus,
  calculateChatKPIs,
  filterAndPaginateLogs,
  AnalyticsOrder,
  AnalyticsOrderEvent,
  AnalyticsChatLog,
} from "../src/lib/analytics";

function runTests() {
  console.log("==================================================");
  console.log("TESTING ANALYTICS AGGREGATION & CHAT LOGS MODULE");
  console.log("==================================================");

  // --------------------------------------------------------------------------
  // Test 1: Revenue excludes cancelled orders
  // --------------------------------------------------------------------------
  console.log("\n1. Testing revenue calculation strictly excludes cancelled orders...");
  const ordersTest1: AnalyticsOrder[] = [
    { id: "o1", status: "served", totalAmount: 1200, createdAt: new Date("2026-11-01T10:00:00Z") },
    { id: "o2", status: "preparing", totalAmount: 800, createdAt: new Date("2026-11-01T11:00:00Z") },
    { id: "o3", status: "cancelled", totalAmount: 2500, createdAt: new Date("2026-11-01T12:00:00Z") },
    { id: "o4", status: "placed", totalAmount: 500, createdAt: new Date("2026-11-01T13:00:00Z") },
  ];

  const kpis1 = calculateOrderKPIs(ordersTest1, []);
  assert.strictEqual(kpis1.totalOrders, 4, "Total orders should be 4");
  // Revenue must exclude order o3 (2500): 1200 + 800 + 500 = 2500
  assert.strictEqual(kpis1.revenue, 2500, "Revenue should sum only non-cancelled orders (2500)");
  assert.strictEqual(kpis1.avgOrderValue, 833, "AOV should be 2500 / 3 = 833");
  assert.strictEqual(kpis1.cancellationRate, 25, "Cancellation rate should be 1/4 = 25%");

  const dailyRev1 = calculateRevenuePerDay(ordersTest1, "UTC");
  assert.strictEqual(dailyRev1.length, 1);
  assert.strictEqual(dailyRev1[0].revenue, 2500, "Daily revenue must also exclude cancelled orders");
  assert.strictEqual(dailyRev1[0].orders, 3, "Non-cancelled order count should be 3");
  console.log("✓ Revenue strictly excludes cancelled orders.");

  // --------------------------------------------------------------------------
  // Test 2: Top dishes ranking by quantity and revenue
  // --------------------------------------------------------------------------
  console.log("\n2. Testing top dishes calculation...");
  const ordersTest2: AnalyticsOrder[] = [
    {
      id: "o1",
      status: "served",
      totalAmount: 900,
      createdAt: new Date("2026-11-01T10:00:00Z"),
      items: [
        { menuItemId: "dish-1", menuItemName: "Butter Chicken", quantity: 2, unitPrice: 300 },
        { menuItemId: "dish-2", menuItemName: "Garlic Naan", quantity: 3, unitPrice: 100 },
      ],
    },
    {
      id: "o2",
      status: "ready",
      totalAmount: 1200,
      createdAt: new Date("2026-11-01T11:00:00Z"),
      items: [
        { menuItemId: "dish-1", menuItemName: "Butter Chicken", quantity: 1, unitPrice: 300 },
        { menuItemId: "dish-3", menuItemName: "Paneer Tikka", quantity: 3, unitPrice: 300 },
      ],
    },
    {
      id: "o3_cancelled",
      status: "cancelled",
      totalAmount: 5000,
      createdAt: new Date("2026-11-01T12:00:00Z"),
      items: [
        { menuItemId: "dish-99", menuItemName: "Cancelled Dish", quantity: 50, unitPrice: 100 },
      ],
    },
  ];

  const topDishes = calculateTopDishes(ordersTest2, 10);
  // Cancelled items should not be present
  assert.strictEqual(topDishes.some((d) => d.id === "dish-99"), false, "Cancelled order items must be excluded");

  // dish-1: qty 2 + 1 = 3, rev: 600 + 300 = 900
  // dish-2: qty 3, rev: 300
  // dish-3: qty 3, rev: 900
  const dish1 = topDishes.find((d) => d.id === "dish-1");
  const dish2 = topDishes.find((d) => d.id === "dish-2");
  const dish3 = topDishes.find((d) => d.id === "dish-3");

  assert(dish1 && dish2 && dish3, "All active dishes must be aggregated");
  assert.strictEqual(dish1.quantity, 3);
  assert.strictEqual(dish1.revenue, 900);
  assert.strictEqual(dish2.quantity, 3);
  assert.strictEqual(dish2.revenue, 300);
  assert.strictEqual(dish3.quantity, 3);
  assert.strictEqual(dish3.revenue, 900);
  console.log("✓ Top dishes correctly aggregate quantity and revenue, ignoring cancelled orders.");

  // --------------------------------------------------------------------------
  // Test 3: Hour grouping across a timezone boundary
  // --------------------------------------------------------------------------
  console.log("\n3. Testing hour grouping across timezone boundary...");
  // Order at 20:30:00 UTC on 2026-11-01
  // In UTC (+00:00), hour is 20.
  // In Asia/Colombo (+05:30), 20:30 UTC + 5h30m = 02:00 AM on 2026-11-02 -> hour is 2!
  const tzOrder1: AnalyticsOrder = {
    id: "tz1",
    status: "placed",
    totalAmount: 500,
    createdAt: new Date("2026-11-01T20:30:00.000Z"),
  };
  // Order at 23:45:00 UTC on 2026-11-01
  // In UTC (+00:00), hour is 23.
  // In Asia/Colombo (+05:30), 23:45 UTC + 5h30m = 05:15 AM on 2026-11-02 -> hour is 5!
  const tzOrder2: AnalyticsOrder = {
    id: "tz2",
    status: "placed",
    totalAmount: 700,
    createdAt: new Date("2026-11-01T23:45:00.000Z"),
  };

  const colomboHours = calculateOrdersPerHour([tzOrder1, tzOrder2], "Asia/Colombo");
  const utcHours = calculateOrdersPerHour([tzOrder1, tzOrder2], "UTC");

  assert.strictEqual(colomboHours.length, 24, "Should have 24 hour buckets");
  assert.strictEqual(colomboHours[2].orders, 1, "Asia/Colombo: 20:30 UTC must land in hour 2 (02:00 AM)");
  assert.strictEqual(colomboHours[5].orders, 1, "Asia/Colombo: 23:45 UTC must land in hour 5 (05:15 AM)");
  assert.strictEqual(colomboHours[20].orders, 0, "Asia/Colombo: hour 20 should have 0 orders");
  assert.strictEqual(colomboHours[23].orders, 0, "Asia/Colombo: hour 23 should have 0 orders");

  assert.strictEqual(utcHours[20].orders, 1, "UTC: 20:30 UTC must land in hour 20");
  assert.strictEqual(utcHours[23].orders, 1, "UTC: 23:45 UTC must land in hour 23");
  assert.strictEqual(utcHours[2].orders, 0, "UTC: hour 2 should have 0 orders");
  assert.strictEqual(utcHours[5].orders, 0, "UTC: hour 5 should have 0 orders");
  console.log("✓ Timezone boundary conversion correctly shifts orders into local hour buckets.");

  // --------------------------------------------------------------------------
  // Test 4: Average prep time and time to served
  // --------------------------------------------------------------------------
  console.log("\n4. Testing average prep time (placed to ready) and served time...");
  const eventsTest: AnalyticsOrderEvent[] = [
    // Order 1: 15 mins to ready, 25 mins to served
    { id: "e1", orderId: "o1", status: "placed", createdAt: new Date("2026-11-01T10:00:00.000Z") },
    { id: "e2", orderId: "o1", status: "ready", createdAt: new Date("2026-11-01T10:15:00.000Z") },
    { id: "e3", orderId: "o1", status: "served", createdAt: new Date("2026-11-01T10:25:00.000Z") },
    // Order 2: 30 mins to ready, 45 mins to served
    { id: "e4", orderId: "o2", status: "placed", createdAt: new Date("2026-11-01T11:00:00.000Z") },
    { id: "e5", orderId: "o2", status: "ready", createdAt: new Date("2026-11-01T11:30:00.000Z") },
    { id: "e6", orderId: "o2", status: "served", createdAt: new Date("2026-11-01T11:45:00.000Z") },
    // Order 3: Placed only, no ready/served yet
    { id: "e7", orderId: "o3", status: "placed", createdAt: new Date("2026-11-01T12:00:00.000Z") },
  ];

  const prepKpis = calculateOrderKPIs(ordersTest1, eventsTest);
  // Avg prep time: (15 + 30) / 2 = 22.5 mins
  assert.strictEqual(prepKpis.avgPrepTimeMinutes, 22.5, "Avg prep time should be 22.5 minutes");
  // Avg served time: (25 + 45) / 2 = 35.0 mins
  assert.strictEqual(prepKpis.avgServedTimeMinutes, 35, "Avg served time should be 35.0 minutes");
  console.log("✓ Prep time and time-to-served calculations match expected averages.");

  // --------------------------------------------------------------------------
  // Test 5: P95 Latency calculation & chat KPIs
  // --------------------------------------------------------------------------
  console.log("\n5. Testing P95 latency percentile & chat KPIs...");
  // Create 20 logs with latencies from 100 to 2000 ms
  const chatLogsTest: AnalyticsChatLog[] = Array.from({ length: 20 }, (_, i) => ({
    id: `log-${i + 1}`,
    userQuery: `query ${i + 1}`,
    extractedJson: "{}",
    usedFallback: i % 4 === 0, // 5 fallbacks
    fallbackReason: i % 4 === 0 ? (i === 0 ? "timeout" : "invalid_json") : null,
    latencyMs: (i + 1) * 100, // 100, 200, ..., 2000
    createdAt: new Date("2026-11-01T10:00:00.000Z"),
  }));

  const chatKpis = calculateChatKPIs(chatLogsTest);
  assert.strictEqual(chatKpis.totalChats, 20, "Total chats should be 20");
  assert.strictEqual(chatKpis.fallbackCount, 5, "Fallback count should be 5");
  assert.strictEqual(chatKpis.fallbackRate, 25, "Fallback rate should be 25%");
  assert.strictEqual(chatKpis.avgLatencyMs, 1050, "Average latency should be 1050 ms");
  // 20 * 0.95 = 19 -> index 18 (19th element: 1900 ms)
  assert.strictEqual(chatKpis.p95LatencyMs, 1900, "P95 latency of [100..2000] should be 1900 ms");
  assert.strictEqual(chatKpis.reasonsBreakdown.timeout, 1);
  assert.strictEqual(chatKpis.reasonsBreakdown.invalid_json, 4);

  // Filter & paginate
  const paginated = filterAndPaginateLogs(chatLogsTest, {
    fallback: "yes",
    page: 1,
    pageSize: 10,
  });
  assert.strictEqual(paginated.total, 5, "Should have 5 fallback logs");
  assert.strictEqual(paginated.logs.length, 5);
  console.log("✓ P95 latency and chat KPIs computed accurately.");

  // --------------------------------------------------------------------------
  // Test 6: Empty inputs handling
  // --------------------------------------------------------------------------
  console.log("\n6. Testing empty input resilience (no NaN or divide-by-zero)...");
  const emptyOrderKpis = calculateOrderKPIs([], []);
  assert.strictEqual(emptyOrderKpis.totalOrders, 0);
  assert.strictEqual(emptyOrderKpis.revenue, 0);
  assert.strictEqual(emptyOrderKpis.avgOrderValue, 0);
  assert.strictEqual(emptyOrderKpis.cancellationRate, 0);
  assert.strictEqual(emptyOrderKpis.avgPrepTimeMinutes, 0);
  assert.strictEqual(emptyOrderKpis.avgServedTimeMinutes, 0);

  const emptyTop = calculateTopDishes([]);
  assert.deepStrictEqual(emptyTop, []);

  const emptyHours = calculateOrdersPerHour([]);
  assert.strictEqual(emptyHours.length, 24);
  assert(emptyHours.every((h) => h.orders === 0));

  const emptyDaily = calculateRevenuePerDay([]);
  assert.deepStrictEqual(emptyDaily, []);

  const emptyStatus = calculateOrdersByStatus([]);
  assert.strictEqual(emptyStatus.length, 5);
  assert(emptyStatus.every((s) => s.count === 0));

  const emptyChatKpis = calculateChatKPIs([]);
  assert.strictEqual(emptyChatKpis.totalChats, 0);
  assert.strictEqual(emptyChatKpis.fallbackCount, 0);
  assert.strictEqual(emptyChatKpis.fallbackRate, 0);
  assert.strictEqual(emptyChatKpis.avgLatencyMs, 0);
  assert.strictEqual(emptyChatKpis.p95LatencyMs, 0);
  assert.deepStrictEqual(emptyChatKpis.reasonsBreakdown, {});

  const emptyLogs = filterAndPaginateLogs([]);
  assert.strictEqual(emptyLogs.total, 0);
  assert.strictEqual(emptyLogs.totalPages, 1);
  assert.strictEqual(emptyLogs.page, 1);
  assert.deepStrictEqual(emptyLogs.logs, []);
  console.log("✓ Empty inputs safely return zero values without crashing or returning NaN.");

  console.log("\n==================================================");
  console.log("ALL ANALYTICS TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runTests();
