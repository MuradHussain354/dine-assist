import { prisma } from "@/lib/prisma";
import KitchenBoardClient from "./kitchen-board-client";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const initialOrders = await prisma.order.findMany({
    where: {
      status: {
        in: ["placed", "preparing", "ready"],
      },
    },
    include: {
      table: true,
      items: {
        include: {
          menuItem: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc", // Oldest orders first
    },
  });

  const formattedOrders = initialOrders.map((o) => ({
    id: o.id,
    tableId: o.tableId,
    tableNumber: o.table.number,
    status: o.status,
    totalAmount: o.totalAmount,
    note: o.note,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    items: o.items.map((i) => ({
      name: i.menuItem.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  }));

  return <KitchenBoardClient initialOrders={formattedOrders} />;
}

