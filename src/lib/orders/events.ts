import { EventEmitter } from "events";

export interface OrderUpdatePayload {
  orderId: string;
  tableId: string;
  tableNumber: number;
  status: string;
  previousStatus?: string;
  totalAmount?: number;
  note?: string | null;
  items?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __dineAssistOrderEvents: EventEmitter | undefined;
}

if (!globalThis.__dineAssistOrderEvents) {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(100);
  globalThis.__dineAssistOrderEvents = emitter;
}

export const orderEventsBus: EventEmitter = globalThis.__dineAssistOrderEvents;

export const ORDER_EVENTS = {
  ORDER_UPDATED: "order_updated",
  ORDER_CREATED: "order_created",
} as const;

