"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";

export interface KitchenOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface KitchenOrder {
  id: string;
  tableId: string;
  tableNumber: number;
  status: string;
  totalAmount: number;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  items: KitchenOrderItem[];
  isNew?: boolean;
}

interface Props {
  initialOrders: KitchenOrder[];
}

export default function KitchenBoardClient({ initialOrders }: Props) {
  const [orders, setOrders] = useState<KitchenOrder[]>(initialOrders);
  const [streamConnected, setStreamConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  // Live timer tick every 1000ms
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format waiting time: "Waiting for Xm Ys"
  const getWaitingTime = useCallback(
    (createdAtIso: string) => {
      const created = new Date(createdAtIso).getTime();
      const diffMs = Math.max(0, currentTime - created);
      const totalSec = Math.floor(diffMs / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      if (mins === 0) {
        return `${secs}s`;
      }
      return `${mins}m ${secs}s`;
    },
    [currentTime]
  );

  // Polling fallback function
  const fetchActiveOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/kitchen/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch {
      // Ignore polling errors
    }
  }, []);

  // SSE Stream setup with automatic reconnect and 5s fallback polling
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      setStreamConnected(false);
      if (!fallbackInterval) {
        fallbackInterval = setInterval(fetchActiveOrders, 5000);
      }
    };

    const stopPolling = () => {
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
    };

    const connectSSE = () => {
      eventSource = new EventSource("/api/kitchen/stream");

      eventSource.onopen = () => {
        setStreamConnected(true);
        stopPolling();
      };

      eventSource.addEventListener("connected", () => {
        setStreamConnected(true);
        stopPolling();
      });

      eventSource.addEventListener("order_update", (event) => {
        try {
          const payload = JSON.parse(event.data);
          setOrders((prev) => {
            // If order was served or cancelled, it disappears from active kitchen board
            if (payload.status === "served" || payload.status === "cancelled") {
              return prev.filter((o) => o.id !== payload.orderId);
            }

            const existingIndex = prev.findIndex((o) => o.id === payload.orderId);
            if (existingIndex !== -1) {
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                status: payload.status,
                updatedAt: payload.updatedAt || new Date().toISOString(),
              };
              return updated;
            } else {
              // Newly placed order arriving live
              const newOrder: KitchenOrder = {
                id: payload.orderId,
                tableId: payload.tableId,
                tableNumber: payload.tableNumber,
                status: payload.status,
                totalAmount: payload.totalAmount || 0,
                note: payload.note,
                createdAt: payload.createdAt || new Date().toISOString(),
                updatedAt: payload.updatedAt || new Date().toISOString(),
                items: payload.items || [],
                isNew: true,
              };
              return [...prev, newOrder].sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime()
              );
            }
          });
        } catch (e) {
          console.error("SSE parse error:", e);
        }
      });

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        startPolling();
        // Try reconnecting in 5 seconds
        setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      stopPolling();
    };
  }, [fetchActiveOrders]);

  // Advance Order Status
  const handleAdvanceStatus = async (
    orderId: string,
    currentStatus: string
  ) => {
    let nextStatus = "";
    if (currentStatus === "placed") nextStatus = "preparing";
    else if (currentStatus === "preparing") nextStatus = "ready";
    else if (currentStatus === "ready") nextStatus = "served";
    else return;

    setActionError(null);
    setPendingOrderId(orderId);

    try {
      const res = await fetch(`/api/kitchen/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update order status");
      }

      // Optimistic state update
      setOrders((prev) => {
        if (nextStatus === "served") {
          return prev.filter((o) => o.id !== orderId);
        }
        return prev.map((o) =>
          o.id === orderId
            ? { ...o, status: nextStatus, isNew: false }
            : o
        );
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error updating order status";
      setActionError(message);
      // Re-fetch to synchronize state
      fetchActiveOrders();
    } finally {
      setPendingOrderId(null);
    }
  };

  // Cancel Placed Order
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;

    setActionError(null);
    setPendingOrderId(orderId);

    try {
      const res = await fetch(`/api/kitchen/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel order");
      }

      // Remove from board
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error cancelling order";
      setActionError(message);
      fetchActiveOrders();
    } finally {
      setPendingOrderId(null);
    }
  };

  // Group orders by column
  const placedOrders = orders.filter((o) => o.status === "placed");
  const preparingOrders = orders.filter((o) => o.status === "preparing");
  const readyOrders = orders.filter((o) => o.status === "ready");

  const renderCard = (order: KitchenOrder) => {
    const isPending = pendingOrderId === order.id;

    return (
      <div
        key={order.id}
        className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${
          order.isNew
            ? "border-emerald-400 ring-2 ring-emerald-400/30 animate-pulse-once"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5 mb-2.5">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold text-slate-900">
                Table #{order.tableNumber}
              </span>
              {order.isNew && (
                <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-bounce">
                  New
                </span>
              )}
            </div>
            <span className="text-[11px] font-mono text-slate-400 block">
              #{order.id.slice(-6).toUpperCase()}
            </span>
          </div>

          {/* Ticking Timer */}
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
              Waiting
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
              ⏱️ {getWaitingTime(order.createdAt)}
            </span>
          </div>
        </div>

        {/* Note if any */}
        {order.note && (
          <div className="mb-3 p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium leading-snug">
            <span className="font-bold block text-[10px] uppercase tracking-wider text-amber-700">
              Note:
            </span>
            {order.note}
          </div>
        )}

        {/* Items List */}
        <div className="space-y-1 mb-4 text-xs">
          {order.items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-slate-100 font-extrabold text-slate-800 flex items-center justify-center text-[11px]">
                  {item.quantity}
                </span>
                <span className="font-semibold text-slate-800 leading-tight">
                  {item.name}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          {order.status === "placed" && (
            <>
              <button
                type="button"
                onClick={() => handleAdvanceStatus(order.id, "placed")}
                disabled={isPending}
                className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
              >
                {isPending ? "Updating..." : "Start Preparing 🍳"}
              </button>
              <button
                type="button"
                onClick={() => handleCancelOrder(order.id)}
                disabled={isPending}
                className="py-2.5 px-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 disabled:opacity-50 text-slate-600 font-bold text-xs rounded-xl transition"
                title="Cancel Order"
              >
                ✕
              </button>
            </>
          )}

          {order.status === "preparing" && (
            <button
              type="button"
              onClick={() => handleAdvanceStatus(order.id, "preparing")}
              disabled={isPending}
              className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
            >
              {isPending ? "Updating..." : "Mark Ready 🔔"}
            </button>
          )}

          {order.status === "ready" && (
            <button
              type="button"
              onClick={() => handleAdvanceStatus(order.id, "ready")}
              disabled={isPending}
              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
            >
              {isPending ? "Updating..." : "Mark Served ✓"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Top Staff Navigation Header */}
      <header className="sticky top-0 z-30 bg-slate-950 border-b border-slate-800 px-6 py-3.5 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-extrabold text-sm shadow">
              KDS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white leading-tight">
                  Kitchen Live Display
                </h1>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    streamConnected
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : "bg-amber-950 text-amber-400 border border-amber-800"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      streamConnected
                        ? "bg-emerald-400 animate-pulse"
                        : "bg-amber-400"
                    }`}
                  ></span>
                  {streamConnected ? "Live SSE" : "Polling (5s)"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {orders.length} active{" "}
                {orders.length === 1 ? "ticket" : "tickets"} in queue
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/menu"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              Menu Admin
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 text-xs font-semibold transition"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>

        {/* Action Error Notification */}
        {actionError && (
          <div className="mt-3 p-2.5 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center justify-between">
            <span>{actionError}</span>
            <button
              onClick={() => setActionError(null)}
              className="text-rose-400 hover:text-white font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}
      </header>

      {/* 3-Column Board */}
      <main className="flex-1 p-6 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
        {/* Column 1: Placed */}
        <section className="bg-slate-950/60 rounded-3xl p-4 border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Placed
              </h2>
            </div>
            <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-200 text-xs font-extrabold flex items-center justify-center">
              {placedOrders.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {placedOrders.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs font-medium">
                No orders waiting
              </div>
            ) : (
              placedOrders.map(renderCard)
            )}
          </div>
        </section>

        {/* Column 2: Preparing */}
        <section className="bg-slate-950/60 rounded-3xl p-4 border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Preparing
              </h2>
            </div>
            <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-200 text-xs font-extrabold flex items-center justify-center">
              {preparingOrders.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {preparingOrders.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs font-medium">
                No dishes cooking
              </div>
            ) : (
              preparingOrders.map(renderCard)
            )}
          </div>
        </section>

        {/* Column 3: Ready */}
        <section className="bg-slate-950/60 rounded-3xl p-4 border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Ready to Serve
              </h2>
            </div>
            <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-200 text-xs font-extrabold flex items-center justify-center">
              {readyOrders.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {readyOrders.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs font-medium">
                No orders ready for pickup
              </div>
            ) : (
              readyOrders.map(renderCard)
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
