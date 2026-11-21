
import { z } from "zod";

// ==========================================
// COMMON VALIDATION
// ==========================================

const positiveIntegerString = z
  .string()
  .regex(/^[1-9]\d*$/, "ID must be a positive integer")
  .refine(
    (value) => Number.isSafeInteger(Number(value)),
    "Value must be a safe positive integer"
  );

// ==========================================
// DATE-ONLY VALIDATION
// FORMAT: YYYY-MM-DD
// EXAMPLE: 2000-05-20
// ==========================================

export const dateOnlySchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Date must use YYYY-MM-DD format"
  )
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);

    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Please provide a valid calendar date");

// ==========================================
// DATE OF BIRTH VALIDATION
// ADMIN MUST BE AT LEAST 18 YEARS OLD
// ==========================================

const dateOfBirthSchema = dateOnlySchema.refine((value) => {
  const [year, month, day] = value.split("-").map(Number);

  const today = new Date();

  let age = today.getFullYear() - year;

  if (
    today.getMonth() + 1 < month ||
    (
      today.getMonth() + 1 === month &&
      today.getDate() < day
    )
  ) {
    age--;
  }

  return age >= 18;
}, "Admin must be at least 18 years old");

// ==========================================
// ADMIN ROLE ID VALIDATION
// ==========================================

const adminRoleIdSchema = z.union([
  z.number()
    .int("Admin Role ID must be an integer")
    .positive("Admin Role ID must be positive")
    .refine(
      Number.isSafeInteger,
      "Admin Role ID must be a safe integer"
    ),

  positiveIntegerString,
]);

// ==========================================
// CREATE ADMIN
// ==========================================

export const createAdminSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name cannot exceed 100 characters"),

    email: z
      .string()
      .trim()
      .email("Invalid email address"),

    phone: z
      .string()
      .trim()
      .optional(),

    dateOfBirth: dateOfBirthSchema.optional(),

    gender: z
      .enum(["MALE", "FEMALE", "OTHER"])
      .optional(),

    adminRoleId: adminRoleIdSchema,
  }).strict(),
});

// ==========================================
// ADMIN ID
// ==========================================

export const adminIdSchema = z.object({
  params: z.object({
    adminId: positiveIntegerString,
  }),
});

// ==========================================
// UPDATE ADMIN PROFILE
// ==========================================

export const updateAdminSchema = z.object({
  params: z.object({
    adminId: positiveIntegerString,
  }),

  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name cannot exceed 100 characters")
      .optional(),

    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .optional(),

    phone: z
      .string()
      .trim()
      .nullable()
      .optional(),

    dateOfBirth: dateOfBirthSchema
      .nullable()
      .optional(),

    gender: z
      .enum(["MALE", "FEMALE", "OTHER"])
      .nullable()
      .optional(),
  })
    .strict()
    .refine(
      (data) => Object.keys(data).length > 0,
      {
        message: "At least one Admin profile field is required.",
      }
    ),
});

// ==========================================
// UPDATE ADMIN STATUS
// ==========================================

export const updateAdminStatusSchema = z.object({
  params: z.object({
    adminId: positiveIntegerString,
  }),

  body: z.object({
    isActive: z.boolean(),
  }).strict(),
});

// ==========================================
// ADMIN ACTIVITY LOG FILTERS
// ==========================================

export const adminActivityLogsSchema = z.object({
  query: z.object({
    page: positiveIntegerString.optional(),

    limit: positiveIntegerString
      .optional()
      .refine(
        (value) =>
          value === undefined || Number(value) <= 100,
        "Limit cannot exceed 100"
      ),

    actorId: positiveIntegerString.optional(),

    action: z
      .string()
      .trim()
      .min(1, "Action cannot be empty")
      .optional(),

    targetType: z
      .string()
      .trim()
      .min(1, "Target type cannot be empty")
      .optional(),

    startDate: z
      .string()
      .datetime()
      .optional(),

    endDate: z
      .string()
      .datetime()
      .optional(),
  }),
}).superRefine((data, ctx) => {
  const { startDate, endDate } = data.query;

  if (
    startDate &&
    endDate &&
    new Date(startDate) > new Date(endDate)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["query", "endDate"],
      message: "End date must be on or after start date",
    });
  }
});

// ==========================================
// MARKETPLACE USERS
// ==========================================

export const marketplaceUsersSchema = z.object({
  query: z.object({
    page: positiveIntegerString.optional(),

    limit: positiveIntegerString
      .optional()
      .refine(
        (value) =>
          value === undefined || Number(value) <= 100,
        "Limit cannot exceed 100"
      ),

    search: z
      .string()
      .trim()
      .min(1, "Search cannot be empty")
      .optional(),

    role: z
      .enum(["USER", "SHOP_OWNER"])
      .optional(),

    isActive: z
      .enum(["true", "false"])
      .optional(),
  }),
});

// ==========================================
// UPDATE MARKETPLACE USER STATUS
// ==========================================

export const updateMarketplaceUserStatusSchema = z.object({
  params: z.object({
    userId: positiveIntegerString,
  }),

  body: z.object({
    isActive: z.boolean(),
  }).strict(),
});

// ==========================================
// SHOP MANAGEMENT
// ==========================================

export const shopManagementSchema = z.object({
  query: z.object({
    page: positiveIntegerString.optional(),

    limit: positiveIntegerString
      .optional()
      .refine(
        (value) =>
          value === undefined || Number(value) <= 100,
        "Limit cannot exceed 100"
      ),

    search: z
      .string()
      .trim()
      .min(1, "Search cannot be empty")
      .optional(),

    status: z
      .enum(["ACTIVE", "DEACTIVATED"])
      .optional(),
  }),
});

// ==========================================
// UPDATE SHOP STATUS
// ==========================================

export const updateShopStatusSchema = z.object({
  params: z.object({
    shopId: positiveIntegerString,
  }),

  body: z.object({
    status: z.enum(["ACTIVE", "DEACTIVATED"]),
  }).strict(),
});

// ==========================================
// SHOP CATEGORY COMMON BODY
// ==========================================

const shopCategoryBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(100, "Category name cannot exceed 100 characters"),

  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional(),
});

// ==========================================
// CREATE SHOP CATEGORY
// NAME REQUIRED
// IMAGE OPTIONAL - HANDLED BY MULTER
// ==========================================

export const createShopCategorySchema = z.object({
  body: shopCategoryBodySchema.strict(),
});

// ==========================================
// UPDATE SHOP CATEGORY
// TEXT FIELDS OPTIONAL
// IMAGE OPTIONAL - HANDLED BY MULTER
//
// An empty body is allowed because an image
// may have been uploaded through req.file.
//
// The service must verify that at least one
// field or image was actually provided.
// ==========================================

export const updateShopCategorySchema = z.object({
  params: z.object({
    categoryId: positiveIntegerString,
  }),

  body: shopCategoryBodySchema
    .partial()
    .strict(),
});

// ==========================================
// DELETE SHOP CATEGORY
// ==========================================

export const shopCategoryIdSchema = z.object({
  params: z.object({
    categoryId: positiveIntegerString,
  }),
});
