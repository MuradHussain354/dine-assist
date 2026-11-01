import Link from "next/link";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: {
    tableId: string;
    orderId: string;
  };
}

export default async function OrderConfirmationPage({ params }: PageProps) {
  const { tableId, orderId } = params;

  // 1. Resolve table
  const parsedNum = parseInt(tableId, 10);
  const table = await prisma.diningTable.findFirst({
    where: {
      OR: [
        { id: tableId },
        ...(!isNaN(parsedNum) ? [{ number: parsedNum }] : []),
      ],
    },
  });

  if (!table) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            🍽️
          </div>
          <h1 className="text-xl font-bold mb-2">Table Not Found</h1>
          <p className="text-xs text-slate-500 mb-6">
            We couldn&apos;t verify table &ldquo;{tableId}&rdquo;.
          </p>
          <Link
            href="/"
            className="inline-flex px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
          >
            Go to Home
          </Link>
        </div>
      </main>
    );
  }

  // 2. Fetch order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      table: true,
      items: {
        include: {
          menuItem: true,
        },
      },
    },
  });

  if (!order) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            🧾
          </div>
          <h1 className="text-xl font-bold mb-2">Order Not Found</h1>
          <p className="text-xs text-slate-500 mb-6">
            We couldn&apos;t locate order &ldquo;{orderId}&rdquo;.
          </p>
          <Link
            href={`/t/${table.number}`}
            className="inline-flex px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
          >
            Return to Table #{table.number}
          </Link>
        </div>
      </main>
    );
  }

  // 3. Table Ownership Check: Make sure an order can only be viewed on the table it belongs to
  if (order.tableId !== table.id) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-rose-200 p-8 text-center">
          <div className="w-16 h-16 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            🔒
          </div>
          <h1 className="text-xl font-bold text-rose-900 mb-2">
            Order Restricted
          </h1>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            This order belongs to another table (Table #{order.table.number}).
            Orders can only be viewed from the table where they were placed.
          </p>
          <Link
            href={`/t/${table.number}`}
            className="inline-flex px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
          >
            Back to Table #{table.number} Menu
          </Link>
        </div>
      </main>
    );
  }

  // Status badge styling
  const statusConfig: Record<
    string,
    { label: string; bg: string; text: string; border: string; icon: string }
  > = {
    placed: {
      label: "Order Placed",
      bg: "bg-blue-50",
      text: "text-blue-800",
      border: "border-blue-200",
      icon: "📋",
    },
    preparing: {
      label: "Preparing in Kitchen",
      bg: "bg-amber-50",
      text: "text-amber-800",
      border: "border-amber-200",
      icon: "🍳",
    },
    ready: {
      label: "Ready to Serve",
      bg: "bg-purple-50",
      text: "text-purple-800",
      border: "border-purple-200",
      icon: "🔔",
    },
    served: {
      label: "Served",
      bg: "bg-emerald-50",
      text: "text-emerald-800",
      border: "border-emerald-200",
      icon: "✅",
    },
    cancelled: {
      label: "Cancelled",
      bg: "bg-rose-50",
      text: "text-rose-800",
      border: "border-rose-200",
      icon: "❌",
    },
  };

  const currentStatus =
    statusConfig[order.status.toLowerCase()] || statusConfig.placed;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
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
        {/* Status Hero Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl shadow-xs">
            {currentStatus.icon}
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border mb-2 uppercase tracking-wider ${currentStatus.bg} ${currentStatus.text} ${currentStatus.border}`}
          >
            <span>{currentStatus.label}</span>
          </div>

          <h2 className="text-lg font-extrabold text-slate-900 mb-1">
            Thank you for ordering!
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Your dishes have been transmitted to the kitchen. Live preparation status will update automatically.
          </p>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
            Placed on{" "}
            {new Date(order.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            ,{" "}
            {new Date(order.createdAt).toLocaleDateString([], {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>

        {/* Order Details Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Ordered Items
          </h3>

          <div className="divide-y divide-slate-100">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 truncate">
                    {item.menuItem?.name || "Dish"}
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

          {/* Pricing Totals */}
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-1">
              <span>Total Paid / Due</span>
              <span className="text-emerald-700 text-base">
                ₹{order.totalAmount}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
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
