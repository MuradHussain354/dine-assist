import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  transitionOrder,
  OrderTransitionError,
} from "@/lib/orders/status";

const cancelSchema = z.object({
  tableId: z.string().min(1, "Table ID is required"),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parseResult = cancelSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: parseResult.error.issues?.[0]?.message || "Table ID is required to cancel",
        },
        { status: 400 }
      );
    }

    const { tableId } = parseResult.data;
    const orderId = params.id;

    // 1. Fetch order to verify table ownership and status
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // 2. Verify order belongs to the table
    const parsedNum = parseInt(tableId, 10);
    const isMatchingTable =
      order.tableId === tableId ||
      (!isNaN(parsedNum) && order.table.number === parsedNum);

    if (!isMatchingTable) {
      return NextResponse.json(
        { error: "Order does not belong to this table" },
        { status: 403 }
      );
    }

    // 3. Customer cancel rule: only allowed if order is still "placed"
    if (order.status !== "placed") {
      return NextResponse.json(
        {
          error: `Cannot cancel order. The kitchen has already started processing it (current status: ${order.status}).`,
        },
        { status: 409 }
      );
    }

    // 4. Transition order to "cancelled"
    const updatedOrder = await transitionOrder(orderId, "cancelled");

    return NextResponse.json({
      success: true,
      orderId: updatedOrder.id,
      status: updatedOrder.status,
    });
  } catch (error: unknown) {
    if (error instanceof OrderTransitionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Cancel order error:", error);
    return NextResponse.json(
      { error: "Internal server error while cancelling order" },
      { status: 500 }
    );
  }
}

