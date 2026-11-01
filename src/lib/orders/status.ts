import { prisma } from "@/lib/prisma";
import { orderEventsBus, ORDER_EVENTS, OrderUpdatePayload } from "./events";

export type OrderStatus =
  | "placed"
  | "preparing"
  | "ready"
  | "served"
  | "cancelled";

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  placed: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["served"],
  served: [],
  cancelled: [],
};

export class OrderTransitionError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 409) {
    super(message);
    this.name = "OrderTransitionError";
    this.statusCode = statusCode;
  }
}

/**
 * Executes a valid status transition for an order in an atomic transaction
 * with conditional write (updateMany where id and current status match)
 * to prevent double-advance race conditions.
 */
export async function transitionOrder(
  orderId: string,
  nextStatus: OrderStatus
) {
  let emittedPayload: OrderUpdatePayload | null = null;

  const updatedOrder = await prisma.$transaction(async (tx) => {
    // 1. Fetch current order state
    const order = await tx.order.findUnique({
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
      throw new OrderTransitionError(`Order "${orderId}" not found`, 404);
    }

    const currentStatus = order.status as OrderStatus;

    // 2. Validate state machine transition
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      throw new OrderTransitionError(
        `Invalid status transition: Cannot transition order from "${currentStatus}" to "${nextStatus}". Allowed next states: ${
          allowed.length > 0 ? allowed.join(", ") : "none (terminal state)"
        }.`,
        409
      );
    }

    // 3. Conditional write: only update if current status still matches
    const result = await tx.order.updateMany({
      where: {
        id: orderId,
        status: currentStatus,
      },
      data: {
        status: nextStatus,
      },
    });

    if (result.count === 0) {
      throw new OrderTransitionError(
        `Concurrent update detected: Order "${orderId}" status was modified concurrently. Transition to "${nextStatus}" aborted.`,
        409
      );
    }

    // 4. Record history event in OrderEvent table
    await tx.orderEvent.create({
      data: {
        orderId,
        status: nextStatus,
      },
    });

    emittedPayload = {
      orderId: order.id,
      tableId: order.tableId,
      tableNumber: order.table.number,
      status: nextStatus,
      previousStatus: currentStatus,
      totalAmount: order.totalAmount,
      note: order.note,
      items: order.items.map((i) => ({
        name: i.menuItem.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      ...order,
      status: nextStatus,
    };
  });

  // 5. Emit event to staff & customer live streams
  if (emittedPayload) {
    orderEventsBus.emit(ORDER_EVENTS.ORDER_UPDATED, emittedPayload);
  }

  return updatedOrder;
}
