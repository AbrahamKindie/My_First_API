
import { z } from "zod";

// Reusable ID validation
const positiveIdSchema = z.coerce
  .number()
  .int("ID must be an integer.")
  .positive("ID must be greater than zero.");

// Add product to cart
export const addToCartSchema = z.object({
  body: z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().positive().default(1),
  }).strict(),

  params: z.object({}),
  query: z.object({}),
});

// Update cart item quantity
export const updateCartItemSchema = z.object({
  body: z.object({
    quantity: z.coerce
      .number()
      .int("Quantity must be an integer.")
      .positive("Quantity must be greater than zero.")
      .max(10000, "Quantity is too large."),
  }).strict(),

  params: z.object({
    id: positiveIdSchema,
  }).strict(),

  query: z.object({}).strict(),
});

// Remove cart item
export const removeCartItemSchema = z.object({
  body: z.object({}).strict(),

  params: z.object({
    id: positiveIdSchema,
  }).strict(),

  query: z.object({}).strict(),
});

// Clear cart
export const clearCartSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

