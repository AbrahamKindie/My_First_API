import { z } from "zod";

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, "At least one product is required"),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([  "PENDING", "CONFIRMED","SHIPPED","DELIVERED","CANCELLED"]),
});