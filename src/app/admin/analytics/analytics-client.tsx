"use client";

import React, { useState, useMemo, useEffect } from "react";
import AdminNav from "@/components/admin/admin-nav";
import {
  DateRange,
  AnalyticsOrder,
  AnalyticsOrderEvent,
  filterByDateRange,
  calculateOrderKPIs,
  calculateTopDishes,
  calculateOrdersPerHour,
  calculateRevenuePerDay,
  calculateOrdersByStatus,
} from "@/lib/analytics";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface Props {
  initialOrders: AnalyticsOrder[];
  initialEvents: AnalyticsOrderEvent[];
}

export default function AnalyticsClient({ initialOrders, initialEvents }: Props) {
  const [range, setRange] = useState<DateRange>("all");
  const [dishMetric, setDishMetric] = useState<"quantity" | "revenue">("quantity");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    return filterByDateRange(initialOrders, range);
  }, [initialOrders, range]);

  // Filter events belonging to filtered orders
  const filteredEvents = useMemo(() => {
    const orderIds = new Set(filteredOrders.map((o) => o.id));
    return initialEvents.filter((e) => orderIds.has(e.orderId));
  }, [initialEvents, filteredOrders]);

  // Aggregate metrics using pure functions
  const kpis = useMemo(() => {
    return calculateOrderKPIs(filteredOrders, filteredEvents);
  }, [filteredOrders, filteredEvents]);

  const rawTopDishes = useMemo(() => {
    return calculateTopDishes(filteredOrders, 10);
  }, [filteredOrders]);

  const sortedTopDishes = useMemo(() => {
    return [...rawTopDishes].sort((a, b) =>
      dishMetric === "quantity" ? b.quantity - a.quantity : b.revenue - a.revenue
    );
  }, [rawTopDishes, dishMetric]);

  const ordersPerHour = useMemo(() => {
    return calculateOrdersPerHour(filteredOrders);
  }, [filteredOrders]);

  const revenuePerDay = useMemo(() => {
    return calculateRevenuePerDay(filteredOrders);
  }, [filteredOrders]);

  const ordersByStatus = useMemo(() => {
    return calculateOrdersByStatus(filteredOrders);
  }, [filteredOrders]);

  const hasOrders = filteredOrders.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header & Date Range Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Order & Revenue Analytics</h1>
            <p className="text-sm text-slate-400 mt-1">
              Performance metrics, sales trends, and kitchen preparation turnaround.
            </p>
          </div>

          {/* Date Range Selector Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl self-start sm:self-auto">
            {(
              [
                { id: "today", label: "Today" },
                { id: "7days", label: "7 Days" },
                { id: "30days", label: "30 Days" },
                { id: "all", label: "All Time" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setRange(item.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  range === item.id
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 6 KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* 1. Total Orders */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
              Total Orders
            </span>
            <div className="text-2xl font-bold text-white mt-1">
              {kpis.totalOrders}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">In selected period</span>
          </div>

          {/* 2. Total Revenue */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
              Revenue
            </span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              ₹{kpis.revenue.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Excl. cancelled</span>
          </div>

          {/* 3. Avg Order Value */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
              Avg Order Value
            </span>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              ₹{kpis.avgOrderValue.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Per fulfilled order</span>
          </div>

          {/* 4. Cancellation Rate */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
              Cancellation
            </span>
            <div className={`text-2xl font-bold mt-1 ${kpis.cancellationRate > 20 ? "text-rose-400" : "text-slate-200"}`}>
              {kpis.cancellationRate}%
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Of all orders</span>
          </div>

          {/* 5. Placed to Ready (Prep Time) */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
              Avg Prep Time
            </span>
            <div className="text-2xl font-bold text-blue-400 mt-1">
              {kpis.avgPrepTimeMinutes} <span className="text-sm font-normal text-slate-400">min</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Placed to Ready</span>
          </div>

          {/* 6. Placed to Served */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
              Time to Served
            </span>
            <div className="text-2xl font-bold text-indigo-400 mt-1">
              {kpis.avgServedTimeMinutes} <span className="text-sm font-normal text-slate-400">min</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Placed to Table</span>
          </div>
        </div>

        {/* Empty State Warning if No Orders */}
        {!hasOrders && (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 mx-auto flex items-center justify-center text-xl mb-3">
              📊
            </div>
            <h3 className="text-base font-semibold text-white">No order data for this range</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
              No orders matched the selected timeframe. Try selecting &ldquo;All Time&rdquo; or place some test orders.
            </p>
          </div>
        )}

        {/* Visualizations Section */}
        {hasOrders && isMounted && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Chart 1: Top 10 Dishes */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-semibold text-white">Top 10 Dishes</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Most popular menu choices</p>
                </div>
                {/* Metric Toggle */}
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setDishMetric("quantity")}
                    className={`px-2.5 py-1 rounded-md font-medium transition ${
                      dishMetric === "quantity"
                        ? "bg-slate-800 text-amber-400 font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Quantity
                  </button>
                  <button
                    onClick={() => setDishMetric("revenue")}
                    className={`px-2.5 py-1 rounded-md font-medium transition ${
                      dishMetric === "revenue"
                        ? "bg-slate-800 text-emerald-400 font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Revenue
                  </button>
                </div>
              </div>

              <div className="h-72 w-full pt-4">
                {sortedTopDishes.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No dish breakdown available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={sortedTopDishes}
                      margin={{ top: 10, right: 10, left: -15, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="name"
                        stroke="#64748b"
                        fontSize={11}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        tickLine={false}
                      />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          borderRadius: "8px",
                          color: "#f8fafc",
                          fontSize: "12px",
                        }}
                        formatter={(val: unknown) => [
                          dishMetric === "quantity"
                            ? `${String(val)} ordered`
                            : `₹${Number(val).toLocaleString()}`,
                          dishMetric === "quantity" ? "Quantity" : "Revenue",
                        ]}
                      />
                      <Bar
                        dataKey={dishMetric}
                        fill={dishMetric === "quantity" ? "#f59e0b" : "#10b981"}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Orders by Hour of Day */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              <div className="pb-4 border-b border-slate-800">
                <h3 className="text-base font-semibold text-white">Orders by Hour of Day</h3>
                <p className="text-xs text-slate-400 mt-0.5">Local restaurant operating hours (00:00 - 23:00)</p>
              </div>

              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ordersPerHour}
                    margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="#64748b"
                      fontSize={10}
                      interval={2}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      allowDecimals={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        color: "#f8fafc",
                        fontSize: "12px",
                      }}
                      formatter={(val: unknown) => [`${String(val)} orders`, "Orders"]}
                    />
                    <Bar dataKey="orders" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Revenue per Day */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              <div className="pb-4 border-b border-slate-800">
                <h3 className="text-base font-semibold text-white">Daily Revenue Trend</h3>
                <p className="text-xs text-slate-400 mt-0.5">Daily total revenue excluding cancelled orders</p>
              </div>

              <div className="h-72 w-full pt-4">
                {revenuePerDay.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No revenue recorded yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={revenuePerDay}
                      margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        fontSize={10}
                        tickLine={false}
                      />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          borderRadius: "8px",
                          color: "#f8fafc",
                          fontSize: "12px",
                        }}
                        formatter={(val: unknown) => [`₹${Number(val).toLocaleString()}`, "Revenue"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#10b981" }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Breakdown: Orders by Status */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              <div className="pb-4 border-b border-slate-800">
                <h3 className="text-base font-semibold text-white">Orders by Status</h3>
                <p className="text-xs text-slate-400 mt-0.5">Distribution across order lifecycle states</p>
              </div>

              <div className="pt-4 flex flex-col justify-center space-y-3">
                {ordersByStatus.map((item) => {
                  const pct =
                    kpis.totalOrders === 0
                      ? 0
                      : Math.round((item.count / kpis.totalOrders) * 100);

                  const badgeColors: Record<string, { bg: string; text: string; bar: string }> = {
                    placed: { bg: "bg-amber-500/10", text: "text-amber-400", bar: "bg-amber-500" },
                    preparing: { bg: "bg-blue-500/10", text: "text-blue-400", bar: "bg-blue-500" },
                    ready: { bg: "bg-purple-500/10", text: "text-purple-400", bar: "bg-purple-500" },
                    served: { bg: "bg-emerald-500/10", text: "text-emerald-400", bar: "bg-emerald-500" },
                    cancelled: { bg: "bg-rose-500/10", text: "text-rose-400", bar: "bg-rose-500" },
                  };
                  const colors = badgeColors[item.status.toLowerCase()] || {
                    bg: "bg-slate-800",
                    text: "text-slate-300",
                    bar: "bg-slate-600",
                  };

                  return (
                    <div key={item.status} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className={`capitalize font-semibold ${colors.text}`}>
                          {item.status}
                        </span>
                        <div className="flex items-center gap-2 text-slate-400 font-mono">
                          <span>{item.count} orders</span>
                          <span className="text-slate-600">({pct}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
