"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface OrderData {
  id: string;
  tableId: string;
  tableNumber: number;
  status: string;
  totalAmount: number;
  note?: string | null;
  createdAt: string;
  items: OrderItem[];
}

interface Props {
  table: {
    id: string;
    number: number;
  };
  initialOrder: OrderData;
}

const STEPS = [
  { key: "placed", label: "Placed", icon: "📋" },
  { key: "preparing", label: "Preparing", icon: "🍳" },
  { key: "ready", label: "Ready", icon: "🔔" },
  { key: "served", label: "Served", icon: "✅" },
] as const;

export default function OrderStatusClient({ table, initialOrder }: Props) {
  const [order, setOrder] = useState<OrderData>(initialOrder);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Polling fallback
  const fetchOrderStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${order.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.order) {
          setOrder((prev) => ({
            ...prev,
            status: data.order.status,
          }));
        }
      }
    } catch {
      // Ignore polling errors
    }
  }, [order.id]);

  // Setup SSE stream for customer order status with automatic reconnect and 5s fallback polling
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (!fallbackInterval) {
        fallbackInterval = setInterval(fetchOrderStatus, 5000);
      }
    };

    const stopPolling = () => {
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
    };

    const connectSSE = () => {
      eventSource = new EventSource(
        `/api/orders/${order.id}/stream?tableId=${encodeURIComponent(table.id)}`
      );

      eventSource.onopen = () => {
        stopPolling();
      };

      eventSource.addEventListener("order_update", (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.status) {
            setOrder((prev) => ({
              ...prev,
              status: payload.status,
            }));
          }
        } catch (e) {
          console.error("SSE parse error:", e);
        }
      });

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        startPolling();
        setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      stopPolling();
    };
  }, [order.id, table.id, fetchOrderStatus]);

  // Handle Cancel Order
  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this order?")) return;

    setIsCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: table.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel order");
      }

      setOrder((prev) => ({ ...prev, status: "cancelled" }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error cancelling order";
      setCancelError(message);
    } finally {
      setIsCancelling(false);
    }
  };

  const currentStatus = order.status.toLowerCase();
  const isCancelled = currentStatus === "cancelled";

  // Stepper calculations
  const stepIndex = STEPS.findIndex((s) => s.key === currentStatus);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href={`/t/${table.number}`}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs transition"
              aria-label="Back to menu"
            >
              ←
            </Link>
            <div>
              <h1 className="text-sm font-bold leading-tight">Order Status</h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Table #{table.number}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Order ID
            </span>
            <span className="text-xs font-mono font-semibold text-slate-700">
              #{order.id.slice(-8).toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-4">
        {/* Status Stepper / Hero Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 text-center">
          {isCancelled ? (
            <div className="space-y-3">
              <div className="w-16 h-16 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto text-3xl">
                ✕
              </div>
              <h2 className="text-lg font-extrabold text-rose-900">
                Order Cancelled
              </h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                This order was cancelled. No charges will be incurred.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Live Status Header */}
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider bg-emerald-50 text-emerald-800 border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {currentStatus === "placed" && "Order Placed • Sent to Kitchen"}
                  {currentStatus === "preparing" && "Cooking in Kitchen"}
                  {currentStatus === "ready" && "Ready to Serve!"}
                  {currentStatus === "served" && "Served • Bon Appétit"}
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 mt-2">
                  {currentStatus === "placed" && "We received your order!"}
                  {currentStatus === "preparing" && "Chefs are on it!"}
                  {currentStatus === "ready" && "Food is ready for your table!"}
                  {currentStatus === "served" && "Enjoy your meal!"}
                </h2>
              </div>

              {/* Progress Stepper */}
              <div className="pt-2">
                <div className="relative flex items-center justify-between">
                  {/* Background Track Line */}
                  <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0" />
                  {/* Progress Line */}
                  <div
                    className="absolute top-1/2 left-0 h-1 bg-emerald-500 -translate-y-1/2 z-0 transition-all duration-500"
                    style={{
                      width: `${(Math.max(0, stepIndex) / (STEPS.length - 1)) * 100}%`,
                    }}
                  />

                  {STEPS.map((step, idx) => {
                    const isCompleted = idx < stepIndex;
                    const isCurrent = idx === stepIndex;

                    return (
                      <div
                        key={step.key}
                        className="relative z-10 flex flex-col items-center"
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-all duration-300 ${
                            isCurrent
                              ? "bg-emerald-600 text-white ring-4 ring-emerald-100 scale-110"
                              : isCompleted
                              ? "bg-emerald-500 text-white"
                              : "bg-white text-slate-400 border-2 border-slate-200"
                          }`}
                        >
                          {isCompleted ? "✓" : step.icon}
                        </div>
                        <span
                          className={`text-[11px] font-bold mt-2 ${
                            isCurrent
                              ? "text-emerald-700"
                              : isCompleted
                              ? "text-slate-700"
                              : "text-slate-400"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Cancellation Error Alert */}
          {cancelError && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 text-left">
              <span className="font-bold block">Cancellation Notice</span>
              {cancelError}
            </div>
          )}

          {/* Cancel Button (ONLY when status is 'placed') */}
          {currentStatus === "placed" && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                {isCancelling ? "Cancelling order..." : "Cancel Order"}
              </button>
              <p className="text-[11px] text-slate-400 mt-1">
                You can cancel while the order is waiting in the queue.
              </p>
            </div>
          )}
        </div>

        {/* Order Details Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Ordered Items
          </h3>

          {order.note && (
            <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium">
              <span className="font-bold block text-[10px] uppercase tracking-wider text-amber-700">
                Special Instructions:
              </span>
              {order.note}
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 truncate">
                    {item.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    ₹{item.unitPrice} × {item.quantity}
                  </p>
                </div>

                <span className="font-extrabold text-slate-900 tabular-nums">
                  ₹{item.unitPrice * item.quantity}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between font-extrabold text-sm text-slate-900">
            <span>Grand Total</span>
            <span className="text-emerald-700 text-base">
              ₹{order.totalAmount}
            </span>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="text-center pt-2">
          <Link
            href={`/t/${table.number}`}
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow transition"
          >
            ← Order More Items
          </Link>
        </div>
      </main>
    </div>
  );
}

