import Link from "next/link";
import { prisma } from "@/lib/prisma";
import OrderStatusClient from "./order-status-client";

interface PageProps {
  params: {
    tableId: string;
    orderId: string;
  };
}

export const dynamic = "force-dynamic";

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

  return (
    <OrderStatusClient
      table={{
        id: table.id,
        number: table.number,
      }}
      initialOrder={{
        id: order.id,
        tableId: order.tableId,
        tableNumber: order.table.number,
        status: order.status,
        totalAmount: order.totalAmount,
        note: order.note,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          id: item.id,
          name: item.menuItem?.name || "Dish",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      }}
    />
  );
}
