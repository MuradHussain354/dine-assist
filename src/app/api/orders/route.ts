import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrderSchema } from "@/lib/validations/order";

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parseResult = createOrderSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return NextResponse.json(
        {
          error: issue?.message || "Invalid order request",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { tableId, items } = parseResult.data;

    // 1. Verify dining table exists (by CUID or numeric table number)
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
      return NextResponse.json(
        { error: `Dining table "${tableId}" not found` },
        { status: 404 }
      );
    }

    // 2. Consolidate any duplicate item entries
    const consolidatedMap = new Map<string, number>();
    for (const item of items) {
      const curr = consolidatedMap.get(item.menuItemId) || 0;
      consolidatedMap.set(item.menuItemId, curr + item.quantity);
    }

    // Validate consolidated quantities
    let totalQuantity = 0;
    for (const qty of Array.from(consolidatedMap.values())) {
      if (qty > 20) {
        return NextResponse.json(
          { error: `Cannot order more than 20 of any individual dish` },
          { status: 400 }
        );
      }
      totalQuantity += qty;
    }

    if (totalQuantity > 30) {
      return NextResponse.json(
        { error: `An order cannot exceed 30 items in total (found ${totalQuantity})` },
        { status: 400 }
      );
    }

    // 3. Load items from database to verify availability and snapshot official prices
    const itemIds = Array.from(consolidatedMap.keys());
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: itemIds },
      },
    });

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    for (const id of itemIds) {
      const dbItem = menuItemMap.get(id);
      if (!dbItem) {
        return NextResponse.json(
          { error: `Dish not found in menu` },
          { status: 400 }
        );
      }
      if (!dbItem.isAvailable) {
        return NextResponse.json(
          { error: `"${dbItem.name}" is currently unavailable` },
          { status: 400 }
        );
      }
    }

    // 4. Compute unitPrice and totalAmount strictly from DB
    let computedTotal = 0;
    const orderItemsCreateData: {
      menuItemId: string;
      quantity: number;
      unitPrice: number;
    }[] = [];

    for (const [id, qty] of Array.from(consolidatedMap.entries())) {
      const dbItem = menuItemMap.get(id)!;
      const unitPrice = dbItem.price;
      computedTotal += unitPrice * qty;
      orderItemsCreateData.push({
        menuItemId: id,
        quantity: qty,
        unitPrice,
      });
    }

    // 5. Create Order and OrderItems in one transaction
    const order = await prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          tableId: table.id,
          status: "placed",
          totalAmount: computedTotal,
          items: {
            create: orderItemsCreateData,
          },
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        orderId: order.id,
        tableId: table.id,
        tableNumber: table.number,
        totalAmount: order.totalAmount,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Order creation error:", error);
    return NextResponse.json(
      { error: "Internal server error while placing order" },
      { status: 500 }
    );
  }
}
