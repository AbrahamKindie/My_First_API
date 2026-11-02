
import { z } from "zod";

// Product validation schema
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
});

export const updateProductSchema = createProductSchema.partial();