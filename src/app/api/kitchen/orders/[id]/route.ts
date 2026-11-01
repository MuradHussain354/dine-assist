import { NextResponse } from "next/server";
import { z } from "zod";
import {
  transitionOrder,
  OrderTransitionError,
  OrderStatus,
} from "@/lib/orders/status";

const updateStatusSchema = z.object({
  status: z.enum(["preparing", "ready", "served", "cancelled"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const rawBody = await request.json();
    const result = updateStatusSchema.safeParse(rawBody);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error.issues?.[0]?.message || "Invalid status update",
        },
        { status: 400 }
      );
    }

    const { status } = result.data;
    const updatedOrder = await transitionOrder(params.id, status as OrderStatus);

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    });
  } catch (error: unknown) {
    if (error instanceof OrderTransitionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Kitchen order status transition error:", error);
    return NextResponse.json(
      { error: "Internal server error during order update" },
      { status: 500 }
    );
  }
}
