export type DateRange = "today" | "7days" | "30days" | "all";

export interface AnalyticsOrderItem {
  id?: string;
  orderId?: string;
  menuItemId: string;
  menuItemName?: string;
  quantity: number;
  unitPrice: number;
}

export interface AnalyticsOrder {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: Date | string;
  items?: AnalyticsOrderItem[];
}

export interface AnalyticsOrderEvent {
  id?: string;
  orderId: string;
  status: string;
  createdAt: Date | string;
}

export interface AnalyticsChatLog {
  id: string;
  tableId?: string;
  tableNumber?: number;
  tableName?: string;
  userQuery: string;
  extractedJson: string;
  usedFallback: boolean;
  fallbackReason?: string | null;
  latencyMs: number;
  recommendedItemIds?: string;
  createdAt: Date | string;
}

export interface DateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dateString: string; // "YYYY-MM-DD"
}

export function getTimezone(): string {
  return process.env.APP_TIMEZONE || "Asia/Colombo";
}

export function getDateTimeParts(
  date: Date | string | number,
  timeZone: string = getTimezone()
): DateTimeParts {
  const d = typeof date === "object" ? date : new Date(date);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(d);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  let hour = parseInt(partMap.hour, 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const dateString = `${year}-${mm}-${dd}`;

  return { year, month, day, hour, minute, second, dateString };
}

export function isWithinDateRange(
  date: Date | string | number,
  range: DateRange,
  now: Date = new Date(),
  timeZone: string = getTimezone()
): boolean {
  if (range === "all") return true;

  const itemParts = getDateTimeParts(date, timeZone);
  const nowParts = getDateTimeParts(now, timeZone);

  if (range === "today") {
    return itemParts.dateString === nowParts.dateString;
  }

  const itemTime = new Date(date).getTime();
  const nowTime = now.getTime();

  if (range === "7days") {
    const sevenDaysAgo = nowTime - 7 * 24 * 60 * 60 * 1000;
    return itemTime >= sevenDaysAgo && itemTime <= nowTime + 60000;
  }

  if (range === "30days") {
    const thirtyDaysAgo = nowTime - 30 * 24 * 60 * 60 * 1000;
    return itemTime >= thirtyDaysAgo && itemTime <= nowTime + 60000;
  }

  return true;
}

export function filterByDateRange<T extends { createdAt: Date | string }>(
  items: T[],
  range: DateRange,
  now: Date = new Date(),
  timeZone: string = getTimezone()
): T[] {
  if (range === "all") return items;
  return items.filter((item) => isWithinDateRange(item.createdAt, range, now, timeZone));
}

export interface OrderKPIs {
  totalOrders: number;
  revenue: number;
  avgOrderValue: number;
  cancellationRate: number;
  avgPrepTimeMinutes: number;
  avgServedTimeMinutes: number;
}

export function calculateOrderKPIs(
  orders: AnalyticsOrder[],
  events: AnalyticsOrderEvent[] = []
): OrderKPIs {
  const totalOrders = orders.length;
  if (totalOrders === 0) {
    return {
      totalOrders: 0,
      revenue: 0,
      avgOrderValue: 0,
      cancellationRate: 0,
      avgPrepTimeMinutes: 0,
      avgServedTimeMinutes: 0,
    };
  }

  const nonCancelledOrders = orders.filter((o) => o.status !== "cancelled");
  const cancelledCount = totalOrders - nonCancelledOrders.length;
  const cancellationRate = Math.round((cancelledCount / totalOrders) * 1000) / 10;

  const revenue = nonCancelledOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const avgOrderValue =
    nonCancelledOrders.length === 0 ? 0 : Math.round(revenue / nonCancelledOrders.length);

  // Group events by orderId
  const eventsByOrder = new Map<string, { placedAt?: number; readyAt?: number; servedAt?: number }>();
  for (const event of events) {
    const existing = eventsByOrder.get(event.orderId) || {};
    const time = new Date(event.createdAt).getTime();
    if (event.status === "placed" && (!existing.placedAt || time < existing.placedAt)) {
      existing.placedAt = time;
    } else if (event.status === "ready" && (!existing.readyAt || time < existing.readyAt)) {
      existing.readyAt = time;
    } else if (event.status === "served" && (!existing.servedAt || time < existing.servedAt)) {
      existing.servedAt = time;
    }
    eventsByOrder.set(event.orderId, existing);
  }

  let totalPrepMinutes = 0;
  let prepCount = 0;
  let totalServedMinutes = 0;
  let servedCount = 0;

  for (const [, times] of Array.from(eventsByOrder.entries())) {
    if (times.placedAt && times.readyAt && times.readyAt >= times.placedAt) {
      totalPrepMinutes += (times.readyAt - times.placedAt) / (1000 * 60);
      prepCount++;
    }
    if (times.placedAt && times.servedAt && times.servedAt >= times.placedAt) {
      totalServedMinutes += (times.servedAt - times.placedAt) / (1000 * 60);
      servedCount++;
    }
  }

  const avgPrepTimeMinutes =
    prepCount === 0 ? 0 : Math.round((totalPrepMinutes / prepCount) * 10) / 10;
  const avgServedTimeMinutes =
    servedCount === 0 ? 0 : Math.round((totalServedMinutes / servedCount) * 10) / 10;

  return {
    totalOrders,
    revenue,
    avgOrderValue,
    cancellationRate,
    avgPrepTimeMinutes,
    avgServedTimeMinutes,
  };
}

export interface TopDishItem {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export function calculateTopDishes(
  itemsOrOrders: (AnalyticsOrderItem | AnalyticsOrder)[],
  limit: number = 10
): TopDishItem[] {
  const map = new Map<string, { name: string; quantity: number; revenue: number }>();

  function processItem(item: AnalyticsOrderItem) {
    const existing = map.get(item.menuItemId) || {
      name: item.menuItemName || item.menuItemId,
      quantity: 0,
      revenue: 0,
    };
    existing.quantity += item.quantity;
    existing.revenue += item.quantity * item.unitPrice;
    if (item.menuItemName) existing.name = item.menuItemName;
    map.set(item.menuItemId, existing);
  }

  for (const entry of itemsOrOrders) {
    if ("items" in entry && Array.isArray(entry.items)) {
      if ((entry as AnalyticsOrder).status === "cancelled") continue;
      for (const item of entry.items) {
        processItem(item);
      }
    } else if ("menuItemId" in entry) {
      processItem(entry as AnalyticsOrderItem);
    }
  }

  return Array.from(map.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      quantity: data.quantity,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

export function calculateOrdersPerHour(
  orders: AnalyticsOrder[],
  timeZone: string = getTimezone()
): { hour: number; label: string; orders: number }[] {
  const hourCounts = new Array(24).fill(0);

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const parts = getDateTimeParts(order.createdAt, timeZone);
    if (parts.hour >= 0 && parts.hour < 24) {
      hourCounts[parts.hour]++;
    }
  }

  return hourCounts.map((count, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    orders: count,
  }));
}

export function calculateRevenuePerDay(
  orders: AnalyticsOrder[],
  timeZone: string = getTimezone()
): { date: string; revenue: number; orders: number }[] {
  const dayMap = new Map<string, { revenue: number; orders: number }>();

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const parts = getDateTimeParts(order.createdAt, timeZone);
    const dateKey = parts.dateString;
    const existing = dayMap.get(dateKey) || { revenue: 0, orders: 0 };
    existing.revenue += order.totalAmount || 0;
    existing.orders += 1;
    dayMap.set(dateKey, existing);
  }

  return Array.from(dayMap.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, data]) => ({
      date,
      revenue: data.revenue,
      orders: data.orders,
    }));
}

export function calculateOrdersByStatus(
  orders: AnalyticsOrder[]
): { status: string; count: number }[] {
  const counts: Record<string, number> = {
    placed: 0,
    preparing: 0,
    ready: 0,
    served: 0,
    cancelled: 0,
  };

  for (const o of orders) {
    const s = (o.status || "").toLowerCase();
    counts[s] = (counts[s] || 0) + 1;
  }

  return Object.entries(counts).map(([status, count]) => ({
    status,
    count,
  }));
}

export interface ChatKPIs {
  totalChats: number;
  fallbackCount: number;
  fallbackRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  reasonsBreakdown: Record<string, number>;
}

export function calculateChatKPIs(chatLogs: AnalyticsChatLog[]): ChatKPIs {
  const totalChats = chatLogs.length;
  if (totalChats === 0) {
    return {
      totalChats: 0,
      fallbackCount: 0,
      fallbackRate: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      reasonsBreakdown: {},
    };
  }

  let fallbackCount = 0;
  let totalLatency = 0;
  const latencies: number[] = [];
  const reasonsBreakdown: Record<string, number> = {};

  for (const log of chatLogs) {
    totalLatency += log.latencyMs || 0;
    latencies.push(log.latencyMs || 0);
    if (log.usedFallback) {
      fallbackCount++;
      const reason = log.fallbackReason || "unknown";
      reasonsBreakdown[reason] = (reasonsBreakdown[reason] || 0) + 1;
    }
  }

  latencies.sort((a, b) => a - b);
  const p95Index = Math.max(0, Math.ceil(0.95 * latencies.length) - 1);
  const p95LatencyMs = latencies[p95Index] ?? 0;

  const fallbackRate = Math.round((fallbackCount / totalChats) * 1000) / 10;
  const avgLatencyMs = Math.round(totalLatency / totalChats);

  return {
    totalChats,
    fallbackCount,
    fallbackRate,
    avgLatencyMs,
    p95LatencyMs,
    reasonsBreakdown,
  };
}

export interface FilterLogsOptions {
  search?: string;
  fallback?: "all" | "yes" | "no";
  reason?: string;
  dateRange?: DateRange;
  page?: number;
  pageSize?: number;
  timeZone?: string;
  now?: Date;
}

export function filterAndPaginateLogs(
  logs: AnalyticsChatLog[],
  options: FilterLogsOptions = {}
): {
  logs: AnalyticsChatLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const {
    search = "",
    fallback = "all",
    reason = "all",
    dateRange = "all",
    page = 1,
    pageSize = 25,
    timeZone = getTimezone(),
    now = new Date(),
  } = options;

  const filtered = logs.filter((log) => {
    if (!isWithinDateRange(log.createdAt, dateRange, now, timeZone)) {
      return false;
    }

    if (fallback === "yes" && !log.usedFallback) return false;
    if (fallback === "no" && log.usedFallback) return false;

    if (reason !== "all") {
      if (log.fallbackReason !== reason) return false;
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const inQuery = (log.userQuery || "").toLowerCase().includes(q);
      const inTable = log.tableName ? log.tableName.toLowerCase().includes(q) : false;
      const inTableNum = log.tableNumber !== undefined ? String(log.tableNumber).includes(q) : false;
      if (!inQuery && !inTable && !inTableNum) return false;
    }

    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLogs = filtered.slice(startIndex, startIndex + pageSize);

  return {
    logs: paginatedLogs,
    total,
    page: currentPage,
    pageSize,
    totalPages,
  };
}

