
import { z } from "zod";

// ============================================
// GLOBAL SHOP CATEGORY VALIDATION (ADMIN)
// ============================================

export const createShopCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(25, "Category name cannot exceed 25 characters"),
}).strict();

export const updateShopCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(25, "Category name cannot exceed 25 characters"),
}).strict();

// ============================================
// PRODUCT CATEGORY VALIDATION (SHOP OWNER)
// ============================================

export const createProductCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(40, "Category name cannot exceed 40 characters"),

  description: z
    .string()
    .trim()
    .max(200, "Description cannot exceed 200 characters")
    .nullable()
    .optional(),
}).strict();

// ============================================
// UPDATE PRODUCT CATEGORY
// ============================================

export const updateProductCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Category name must be at least 2 characters")
      .max(40, "Category name cannot exceed 40 characters")
      .optional(),

    description: z
      .string()
      .trim()
      .max(200, "Description cannot exceed 200 characters")
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided for update",
    }
  );
