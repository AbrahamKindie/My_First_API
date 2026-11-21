
import { z } from "zod";

// ============================================
// UPDATE SHOP PROFILE
// All profile fields can be updated immediately.
// No Admin approval is required.
// Logo and cover image use a separate upload endpoint.
// ============================================

export const updateShopProfileSchema = z.object({
  name: z.string()
    .trim()
    .min(2, "Shop name must be at least 2 characters")
    .max(150)
    .optional(),

  shopCategoryId: z.number()
    .int("Shop category ID must be an integer")
    .positive("Please select a valid shop category")
    .optional(),

  address: z.string()
    .trim()
    .max(255)
    .nullable()
    .optional(),

  city: z.string()
    .trim()
    .max(100)
    .nullable()
    .optional(),

  region: z.string()
    .trim()
    .max(100)
    .nullable()
    .optional(),

  phone: z.string()
    .trim()
    .min(7, "Phone number must be at least 7 characters")
    .max(20)
    .optional(),

  email: z.string()
    .trim()
    .email("Invalid shop email address")
    .max(255)
    .nullable()
    .optional(),

  description: z.string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(2000)
    .optional(),
})
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one shop field must be provided",
    }
  );
