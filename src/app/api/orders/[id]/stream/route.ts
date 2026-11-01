import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { orderEventsBus, ORDER_EVENTS, OrderUpdatePayload } from "@/lib/orders/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const orderId = params.id;
  const tableId = request.nextUrl.searchParams.get("tableId");

  if (!tableId) {
    return new Response(JSON.stringify({ error: "Missing tableId parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. Verify table ownership
  const parsedNum = parseInt(tableId, 10);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { table: true },
  });

  if (!order) {
    return new Response(JSON.stringify({ error: "Order not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isMatchingTable =
    order.tableId === tableId ||
    (!isNaN(parsedNum) && order.table.number === parsedNum);

  if (!isMatchingTable) {
    return new Response(
      JSON.stringify({ error: "Order does not belong to this table" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected state
      const initialMessage = `event: connected\ndata: ${JSON.stringify({
        orderId: order.id,
        status: order.status,
      })}\n\n`;
      controller.enqueue(encoder.encode(initialMessage));

      // Listener for status updates on this specific order
      const onOrderUpdated = (payload: OrderUpdatePayload) => {
        if (payload.orderId === orderId) {
          try {
            const sseMsg = `event: order_update\ndata: ${JSON.stringify(payload)}\n\n`;
            controller.enqueue(encoder.encode(sseMsg));
          } catch {
            // Stream closed
          }
        }
      };

      orderEventsBus.on(ORDER_EVENTS.ORDER_UPDATED, onOrderUpdated);

      // Heartbeat every 25s
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 25000);

      // Clean up on disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        orderEventsBus.off(ORDER_EVENTS.ORDER_UPDATED, onOrderUpdated);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

