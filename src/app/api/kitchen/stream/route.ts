import { NextRequest } from "next/server";
import { orderEventsBus, ORDER_EVENTS, OrderUpdatePayload } from "@/lib/orders/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connected event
      const initialMessage = `event: connected\ndata: ${JSON.stringify({
        message: "Connected to kitchen real-time stream",
      })}\n\n`;
      controller.enqueue(encoder.encode(initialMessage));

      // 2. Setup event listeners
      const onOrderEvent = (payload: OrderUpdatePayload) => {
        try {
          const sseMsg = `event: order_update\ndata: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(encoder.encode(sseMsg));
        } catch {
          // Controller might be closed
        }
      };

      orderEventsBus.on(ORDER_EVENTS.ORDER_UPDATED, onOrderEvent);
      orderEventsBus.on(ORDER_EVENTS.ORDER_CREATED, onOrderEvent);

      // 3. Heartbeat every 25 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 25000);

      // 4. Clean up on disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        orderEventsBus.off(ORDER_EVENTS.ORDER_UPDATED, onOrderEvent);
        orderEventsBus.off(ORDER_EVENTS.ORDER_CREATED, onOrderEvent);
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

