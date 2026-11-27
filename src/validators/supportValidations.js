
import { z } from "zod";

// ==========================================
// CONSTANTS
// ==========================================

const SUPPORT_CATEGORIES = [
  "ACCOUNT",
  "ORDER",
  "PAYMENT",
  "PRODUCT",
  "SHOP",
  "SHIPPING",
  "RETURN_REFUND",
  "TECHNICAL",
  "OTHER",
];

const SUPPORT_PRIORITIES = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
];

const SUPPORT_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_USER",
  "RESOLVED",
  "REJECTED",
  "CLOSED",
];

// ==========================================
// REUSABLE VALIDATION SCHEMAS
// ==========================================

const optionalStringSchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    }

    return value;
  },
  z.string().optional()
);

const optionalPositiveIdSchema = z.preprocess(
  (value) => {
    if (
      value === "" ||
      value === null ||
      value === undefined
    ) {
      return undefined;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (trimmed === "") {
        return undefined;
      }

      const number = Number(trimmed);

      if (
        Number.isSafeInteger(number) &&
        number > 0
      ) {
        return number;
      }

      return value;
    }

    return value;
  },
  z.number().int().positive().optional()
);

const paginationSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(1),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20),
});

// ==========================================
// CREATE SUPPORT TICKET
// GUEST / AUTHENTICATED CUSTOMER
// ==========================================

export const createSupportTicketSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, "Subject is required")
    .max(150, "Subject cannot exceed 150 characters"),

  category: z.enum(SUPPORT_CATEGORIES),

  priority: z
    .enum(SUPPORT_PRIORITIES)
    .optional()
    .default("NORMAL"),

  description: z
    .string()
    .trim()
    .min(
      10,
      "Description must be at least 10 characters"
    )
    .max(
      5000,
      "Description cannot exceed 5000 characters"
    ),

  guestName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional(),

  guestEmail: z
    .string()
    .trim()
    .email("Please provide a valid email address")
    .max(254)
    .optional(),

  // Product and shop are plain text fields.
  // No Order relation is used.

  productName: z
    .string()
    .trim()
    .max(150)
    .optional(),

  shopName: z
    .string()
    .trim()
    .max(150)
    .optional(),
});

// ==========================================
// CREATE SUPPORT MESSAGE / REPLY
// ==========================================

export const createSupportMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(
      5000,
      "Message cannot exceed 5000 characters"
    ),
});

// ==========================================
// SUPPORT TICKET PARAMS
// ==========================================

export const supportTicketParamsSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Ticket ID is required")
    .max(100),
});

// ==========================================
// CUSTOMER TICKET LIST QUERY
// ==========================================

export const supportTicketListQuerySchema =
  paginationSchema.extend({
    status: z
      .enum(SUPPORT_STATUSES)
      .optional(),

    category: z
      .enum(SUPPORT_CATEGORIES)
      .optional(),

    search: z
      .string()
      .trim()
      .max(150)
      .optional(),
  });

// ==========================================
// ADMIN TICKET LIST QUERY
// ==========================================

export const adminSupportTicketListQuerySchema =
  paginationSchema.extend({
    status: z
      .enum(SUPPORT_STATUSES)
      .optional(),

    priority: z
      .enum(SUPPORT_PRIORITIES)
      .optional(),

    category: z
      .enum(SUPPORT_CATEGORIES)
      .optional(),

    assignedAdminId: optionalStringSchema,

    search: z
      .string()
      .trim()
      .max(150)
      .optional(),
  });

// ==========================================
// UPDATE SUPPORT TICKET STATUS
// ==========================================

export const updateSupportTicketStatusSchema =
  z.object({
    status: z.enum(SUPPORT_STATUSES).refine(
      (status) =>
        status !== "RESOLVED" &&
        status !== "REJECTED",
      {
        message:
          "Use the dedicated Resolve or Reject action.",
      }
    ),
  });

// ==========================================
// RESOLVE SUPPORT TICKET
// SUMMARY IS OPTIONAL
// ==========================================

export const resolveSupportTicketSchema =
  z.object({
    summary: z
      .string()
      .trim()
      .max(
        5000,
        "Resolution summary cannot exceed 5000 characters"
      )
      .optional()
      .default(""),
  });

// ==========================================
// REJECT SUPPORT TICKET
// DESCRIPTION IS REQUIRED
// ==========================================

export const rejectSupportTicketSchema =
  z.object({
    description: z
      .string()
      .trim()
      .min(
        10,
        "Rejection description must be at least 10 characters"
      )
      .max(
        5000,
        "Rejection description cannot exceed 5000 characters"
      ),
  });

// ==========================================
// UPDATE SUPPORT TICKET PRIORITY
// ==========================================

export const updateSupportTicketPrioritySchema =
  z.object({
    priority: z.enum(SUPPORT_PRIORITIES),
  });

// ==========================================
// VERIFY ADMIN ID
// ==========================================

export const verifySupportAdminSchema =
  z.object({
    adminId: z
      .preprocess(
        (value) => {
          if (typeof value === "string") {
            const trimmed = value.trim();

            if (!trimmed) {
              return value;
            }

            const number = Number(trimmed);

            return Number.isSafeInteger(number)
              ? number
              : value;
          }

          return value;
        },
        z
          .number()
          .int()
          .positive("Enter a valid Admin ID")
      ),
  });

// ==========================================
// ASSIGN SUPPORT TICKET
// ADMIN ID OPTIONAL FOR UNASSIGNING
// ==========================================

export const assignSupportTicketSchema =
  z.object({
    adminId: optionalPositiveIdSchema,
  });
