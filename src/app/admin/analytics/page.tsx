import { prisma } from "@/lib/prisma";
import AnalyticsClient from "./analytics-client";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const [orders, events] = await Promise.all([
    prisma.order.findMany({
      include: {
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.orderEvent.findMany({
      orderBy: {
        createdAt: "asc",
      },
    }),
  ]);

  const serializedOrders = orders.map((o) => ({
    id: o.id,
    status: o.status,
    totalAmount: o.totalAmount,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      orderId: i.orderId,
      menuItemId: i.menuItemId,
      menuItemName: i.menuItem?.name || "Unknown Item",
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  }));

  const serializedEvents = events.map((e) => ({
    id: e.id,
    orderId: e.orderId,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
  }));

  return (
    <AnalyticsClient
      initialOrders={serializedOrders}
      initialEvents={serializedEvents}
    />
  );
}

