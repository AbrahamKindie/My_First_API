
import { z } from "zod";

// ==========================================
// ADMIN PRODUCT STATUS
// ==========================================

export const setProductStatusSchema = z.object({
  status: z.enum(
    ["ACTIVE", "ADMIN_DEACTIVATED"],
    {
      error: "Product status must be ACTIVE or ADMIN_DEACTIVATED",
    }
  ),
});

// ==========================================
// SHOP OWNER FEATURED PRODUCT
// ==========================================

export const setProductFeaturedSchema = z.object({
  isFeatured: z.preprocess(
    (value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    },
    z.boolean()
  ),
});

// ==========================================
// SHOP OWNER PRODUCT DISCOUNT
// ==========================================

export const setProductDiscountSchema = z
  .object({
    type: z.enum(["PERCENTAGE", "FIXED"], {
      error: "Discount type must be PERCENTAGE or FIXED",
    }),

    value: z.coerce
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

    isActive: z.preprocess(
      (value) => {
        if (value === "true") return true;
        if (value === "false") return false;
        return value;
      },
      z.boolean().optional()
    ),
  })
  .superRefine((data, ctx) => {
    if (
      data.type === "PERCENTAGE" &&
      data.value > 100
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Percentage discount cannot exceed 100%",
      });
    }

    if (data.startsAt && data.endsAt) {
      const start = new Date(data.startsAt);
      const end = new Date(data.endsAt);

      if (end <= start) {
        ctx.addIssue({
          code: "custom",
          path: ["endsAt"],
          message: "End date must be later than start date",
        });
      }
    }
  });

// ==========================================
// PRODUCT CATEGORY VALIDATION
// ==========================================

const productCategoryIdSchema = z.preprocess(
  (value) => {
    if (
      value === "" ||
      value === undefined ||
      value === null
    ) {
      return undefined;
    }

    return Number(value);
  },
  z
    .number()
    .int("Product category ID must be an integer")
    .positive("Please select a valid product category")
);

const optionalProductCategoryIdSchema = z.preprocess(
  (value) => {
    if (
      value === "" ||
      value === undefined ||
      value === null
    ) {
      return undefined;
    }

    return Number(value);
  },
  z
    .number()
    .int("Product category ID must be an integer")
    .positive("Please select a valid product category")
    .optional()
);

// ==========================================
// RETAINED PRODUCT IMAGES
// ==========================================

const retainedImagesSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    return value;
  },
  z
    .array(
      z
        .string()
        .trim()
        .min(1, "Invalid image path")
        .refine(
          (image) =>
            image.startsWith("/uploads/products/") &&
            !image.includes("..") &&
            !image.includes("\\") &&
            !image.includes("?") &&
            !image.includes("#"),
          "Invalid product image path"
        )
    )
    .max(
      10,
      "A product cannot have more than 10 retained images"
    )
    .optional()
);

// ==========================================
// SHARED SHOP OWNER PRODUCT FIELDS
// ==========================================

const shopOwnerProductFields = {
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

  price: z.coerce
    .number()
    .positive("Price must be greater than 0"),

  stock: z.coerce
    .number()
    .int("Stock must be an integer")
    .nonnegative("Stock cannot be negative"),

  productCategoryId: productCategoryIdSchema,
};

// ==========================================
// CREATE SHOP OWNER PRODUCT
// ==========================================

export const createShopProductSchema = z.object({
  ...shopOwnerProductFields,
});

// ==========================================
// UPDATE SHOP OWNER PRODUCT
// ==========================================

export const updateShopProductSchema = z
  .object({
    name: shopOwnerProductFields.name.optional(),

    description: shopOwnerProductFields.description,

    price: shopOwnerProductFields.price.optional(),

    stock: shopOwnerProductFields.stock.optional(),

    productCategoryId: optionalProductCategoryIdSchema,

    retainedImages: retainedImagesSchema,
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "Provide at least one field to update",
    }
  );

// ==========================================
// PRODUCT REPORT VALIDATION
// ==========================================

export const createProductReportSchema = z.object({
  reason: z.enum(
    [
      "COUNTERFEIT",
      "MISLEADING_INFORMATION",
      "PROHIBITED_PRODUCT",
      "SUSPICIOUS_ACTIVITY",
      "OTHER",
    ],
    {
      error: "Please select a valid product report reason",
    }
  ),

  description: z
    .string()
    .trim()
    .max(
      500,
      "Report description cannot exceed 500 characters"
    )
    .optional()
    .nullable(),
});

// ==========================================
// ADMIN PRODUCT REPORT REVIEW
// ==========================================

export const reviewProductReportSchema = z.object({
  status: z.enum(
    ["UNDER_REVIEW", "RESOLVED", "DISMISSED"],
    {
      error: "Please provide a valid report review status",
    }
  ),

  adminNote: z
    .string()
    .trim()
    .max(
      500,
      "Admin note cannot exceed 500 characters"
    )
    .optional()
    .nullable(),
});

// ==========================================
// ADMIN PRODUCT LIST FILTER VALIDATION
// ==========================================

const optionalPositiveInteger = z.preprocess(
  (value) => {
    if (
      value === "" ||
      value === undefined ||
      value === null
    ) {
      return undefined;
    }

    return Number(value);
  },
  z
    .number()
    .int()
    .positive()
    .optional()
);

export const adminProductFiltersSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .positive()
    .default(1),

  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(10),

  search: z
    .string()
    .trim()
    .optional(),

  productCategoryId: optionalPositiveInteger,

  shopId: optionalPositiveInteger,

  source: z.enum(["ALL", "SHOP"]).default("ALL"),

  isFeatured: z.preprocess(
    (value) => {
      if (value === "true") return true;
      if (value === "false") return false;

      if (
        value === "" ||
        value === undefined
      ) {
        return undefined;
      }

      return value;
    },
    z.boolean().optional()
  ),

  sortBy: z
    .enum([
      "newest",
      "oldest",
      "price_asc",
      "price_desc",
      "name_asc",
      "name_desc",
    ])
    .default("newest"),
});
