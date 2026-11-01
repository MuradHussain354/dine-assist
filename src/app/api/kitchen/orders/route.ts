import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
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

    const formattedOrders = orders.map((o) => ({
      id: o.id,
      tableId: o.tableId,
      tableNumber: o.table.number,
      status: o.status,
      totalAmount: o.totalAmount,
      note: o.note,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      items: o.items.map((i) => ({
        id: i.id,
        name: i.menuItem.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    }));

    return NextResponse.json({ orders: formattedOrders });
  } catch (error) {
    console.error("Fetch kitchen orders error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
