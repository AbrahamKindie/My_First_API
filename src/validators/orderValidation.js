
import { z } from "zod";

// ==========================================
// CREATE ORDER VALIDATION
// ==========================================

export const createOrderSchema = z.object({
  shippingName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(100, "Full name cannot exceed 100 characters."),

  shippingPhone: z
    .string()
    .trim()
    .min(9, "Enter a valid phone number.")
    .max(20, "Phone number is too long."),

  shippingAddress: z
    .string()
    .trim()
    .min(
      6,
      "Please enter a more specific location (more than 5 characters)."
    )
    .max(250, "Delivery address cannot exceed 250 characters."),

  shippingCity: z
    .string()
    .trim()
    .min(2, "City must be at least 2 characters.")
    .max(100, "City cannot exceed 100 characters."),

  shippingCountry: z
    .string()
    .trim()
    .min(2, "Country must be at least 2 characters.")
    .max(100, "Country cannot exceed 100 characters.")
    .default("Ethiopia"),

  paymentMethod: z.literal("CASH_ON_DELIVERY"),
}).strict();

// ==========================================
// UPDATE ORDER STATUS VALIDATION
// ==========================================

export const updateOrderStatusSchema = z.object({
  status: z.enum(
    [
      "CONFIRMED",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ],
    {
      error: "Invalid order status.",
    }
  ),
}).strict();
