
import { z } from "zod";

// ==========================================
// DATE OF BIRTH VALIDATION
// ==========================================

const isAtLeast18 = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const dob = new Date(Date.UTC(year, month - 1, day));

  // Validate actual calendar date
  if (
    dob.getUTCFullYear() !== year ||
    dob.getUTCMonth() !== month - 1 ||
    dob.getUTCDate() !== day
  ) {
    return false;
  }

  const today = new Date();

  let age = today.getFullYear() - year;

  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) {
    age--;
  }

  return age >= 18;
};

const dateOfBirthSchema = z.string().refine(isAtLeast18, {
  message:
    "You must be at least 18 years old and provide a valid date of birth.",
});

// ==========================================
// ETHIOPIAN PHONE VALIDATION
// ==========================================

// Supported formats:
// 0912345678
// 0712345678
// +251912345678
// +251712345678
// 251912345678
// 251712345678

const ethiopianPhoneRegex =
  /^(0[79]\d{8}|\+251[79]\d{8}|251[79]\d{8})$/;

const phoneSchema = z.string().trim().regex(
  ethiopianPhoneRegex,
  "Invalid Ethiopian phone number"
);

// ==========================================
// SHOP OWNER VALIDATION
// ==========================================

const shopSchema = z.object({
  name: z.string().trim().min(
    2,
    "Shop name must be at least 2 characters"
  ),

  description: z.string().trim().min(
    10,
    "Shop description must be at least 10 characters"
  ),

  // Actual database ShopCategory ID.
  shopCategoryId: z.coerce.number().int().positive({
    message: "Please select a valid shop category.",
  }),

  // Custom category name.
  // The corresponding image is uploaded separately
  // using the customCategoryImage multipart file field.
  customCategoryName: z.string().trim().min(
    2,
    "Custom shop category must be at least 2 characters"
  ).max(
    100,
    "Custom shop category cannot exceed 100 characters"
  ).optional(),

  phone: phoneSchema,

  email: z.union([
    z.string().trim().email("Invalid shop email"),
    z.literal(""),
  ]).optional(),

  address: z.string().trim().optional(),

  city: z.string().trim().optional(),

  region: z.string().trim().optional(),

}).strict();

// ==========================================
// PARSE MULTIPART REGISTRATION DATA
// ==========================================

// FormData sends nested objects as strings.
// Convert the shop JSON string back into an object
// before Zod validates the registration request.

const parseMultipartRegistrationData = (data) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  const parsed = { ...data };

  if (typeof parsed.shop === "string") {
    try {
      parsed.shop = JSON.parse(parsed.shop);
    } catch {
      // Leave invalid JSON untouched so Zod rejects it.
    }
  }

  return parsed;
};

// ==========================================
// REGISTRATION VALIDATION
// ==========================================

export const registerSchema = z.preprocess(
  parseMultipartRegistrationData,

  z.object({
    name: z.string().trim().min(
      2,
      "Name must be at least 2 characters"
    ),

    email: z.string().trim().email(
      "Invalid email address"
    ),

    password: z.string().min(
      8,
      "Password must be at least 8 characters long"
    ),

    phone: phoneSchema,

    dateOfBirth: dateOfBirthSchema,

    gender: z.enum(
      ["MALE", "FEMALE", "OTHER"],
      {
        error: "Gender is required",
      }
    ),

    address: z.string().trim().optional(),

    city: z.string().trim().optional(),

    country: z.string().trim().optional(),

    // Public registration only permits these two roles.
    role: z.enum(["USER", "SHOP_OWNER"]).default("USER"),

    shop: shopSchema.optional(),

  }).superRefine((data, ctx) => {
    if (data.role === "SHOP_OWNER" && !data.shop) {
      ctx.addIssue({
        code: "custom",
        path: ["shop"],
        message:
          "Shop information is required for Shop Owner registration",
      });
    }

    if (data.role === "USER" && data.shop) {
      ctx.addIssue({
        code: "custom",
        path: ["shop"],
        message:
          "Shop information is only allowed for Shop Owner registration",
      });
    }
  })
);

// ==========================================
// LOGIN VALIDATION
// ==========================================

export const loginSchema = z.object({
  email: z.string().trim().email({
    message: "Invalid email address",
  }),

  password: z.string().min(1, {
    message: "Password is required",
  }),
});

// ==========================================
// UPDATE PROFILE VALIDATION
// ==========================================

// Shared validation for USER, SHOP_OWNER,
// ADMIN and SUPER_ADMIN.
//
// Role-specific restrictions are enforced by
// updateUserProfile() using the authenticated user's
// actual database role.

export const updateProfileSchema = z.object({
  name: z.string().trim().min(
    2,
    "Name must contain at least 2 characters"
  ).max(100).optional(),

  phone: phoneSchema.nullable().optional(),

  gender: z.enum(
    ["MALE", "FEMALE", "OTHER"],
    {
      error: "Gender should be MALE, FEMALE, or OTHER",
    }
  ).nullable().optional(),

  dateOfBirth: dateOfBirthSchema.nullable().optional(),

  address: z.string().trim().max(255).nullable().optional(),

  city: z.string().trim().max(100).nullable().optional(),

  country: z.string().trim().max(100).nullable().optional(),

  profileImage: z.string().trim().max(2048).nullable().optional(),

}).strict().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "At least one profile field must be provided",
  }
);

// ==========================================
// FORGOT PASSWORD VALIDATION
// ==========================================

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email({
    message: "Invalid email address",
  }),
});

// ==========================================
// RESET PASSWORD VALIDATION
// ==========================================

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),

  newPassword: z.string().min(
    8,
    "Password must be at least 8 characters long"
  ),
});

// ==========================================
// CHANGE PASSWORD VALIDATION
// ==========================================

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(
    1,
    "Old password is required"
  ),

  newPassword: z.string().min(
    8,
    "New password must be at least 8 characters long"
  ),
}).refine(
  (data) => data.oldPassword !== data.newPassword,
  {
    message:
      "New password must be different from your current password",
    path: ["newPassword"],
  }
);

// ==========================================
// ADMIN FIRST-TIME PASSWORD SETUP VALIDATION
// ==========================================

// Verify Admin password setup link
export const verifyAdminPasswordSetupSchema = z.object({
  token: z.string().trim().min(
    1,
    "Admin password setup token is required"
  ),
});

// Set Admin's initial password
export const adminPasswordSetupSchema = z.object({
  token: z.string().trim().min(
    1,
    "Admin password setup token is required"
  ),

  newPassword: z.string().min(
    8,
    "Password must be at least 8 characters long"
  ),

  confirmPassword: z.string().min(
    1,
    "Please confirm your password"
  ),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }
);

// ==========================================
// ADMIN USER UPDATE VALIDATION
// ==========================================

// Administrative roles must be managed through
// dedicated Super Admin endpoints.

export const updateUserSchema = z.object({
  email: z.string().trim().email({
    message: "Invalid email address",
  }).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "At least one user field must be provided",
  }
);

// ==========================================
// REFRESH TOKEN VALIDATION
// ==========================================

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(
    1,
    "Refresh token is required"
  ),
});

// ==========================================
// LOGOUT VALIDATION
// ==========================================

export const logoutSchema = z.object({
  refreshToken: z.string().min(
    1,
    "Refresh token is required"
  ),
});
