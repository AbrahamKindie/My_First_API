
import { z } from "zod";

// Create product validation
export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Product name must be at least 2 characters")
    .max(25, "Product name cannot exceed 25 characters"),

  description: z
    .string()
    .trim()
    .max(200, "Description cannot exceed 200 characters")
    .nullable()
    .optional(),

  price: z
    .number()
    .positive("Price must be greater than 0"),

  stock: z
    .number()
    .int("Stock must be an integer")
    .positive("Stock must be greater than 0"),

  categoryId: z
    .number()
    .int("Category ID must be an integer")
    .positive("Category ID must be greater than 0"),

  images: z
    .array(z.string().url("Please provide a valid URL"))
    .optional(),

  isFeatured: z
    .boolean()
    .optional(),
});

// Update product validation
export const updateProductSchema = createProductSchema.partial();

// Set featured status validation
export const setProductFeaturedSchema = z.object({
  isFeatured: z.boolean({
    error: "isFeatured must be a boolean",
  }),
});

// Set product discount validation
export const setProductDiscountSchema = z.object({
  type: z.enum(["PERCENTAGE", "FIXED"], {
    error: "Discount type must be PERCENTAGE or FIXED",
  }),

  value: z
    .number()
    .positive("Discount value must be greater than 0"),

  startsAt: z
    .string()
    .datetime("Please provide a valid start date")
    .optional()
    .nullable(),

  endsAt: z
    .string()
    .datetime("Please provide a valid end date")
    .optional()
    .nullable(),

  isActive: z
    .boolean()
    .optional(),
});
