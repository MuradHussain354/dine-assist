import { z } from "zod";

export const orderItemInputSchema = z.object({
  menuItemId: z.string().min(1, "Menu item ID is required"),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(20, "Quantity cannot exceed 20 per item"),
});

export const createOrderSchema = z
  .object({
    tableId: z.string().min(1, "Table ID is required"),
    items: z
      .array(orderItemInputSchema)
      .min(1, "At least one item is required to place an order"),
    note: z.string().max(200, "Note must be under 200 characters").optional(),
  })
  .refine(
    (data) => {
      const totalQuantity = data.items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
      return totalQuantity <= 30;
    },
    {
      message: "An order cannot exceed 30 items in total",
      path: ["items"],
    }
  );

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

