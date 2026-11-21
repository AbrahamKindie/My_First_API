
import { z } from "zod";

// Create review
export const createReviewSchema = z.object({
  rating: z
    .number({
      required_error: "Rating is required",
      invalid_type_error: "Rating must be a number",
    })
    .int("Rating must be an integer")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating cannot exceed 5"),

  comment: z
    .string()
    .trim()
    .min(3, "Comment must be at least 3 characters")
    .max(1000, "Comment cannot exceed 1000 characters"),
}).strict();

// Update review
export const updateReviewSchema = z.object({
  rating: z
    .number({
      invalid_type_error: "Rating must be a number",
    })
    .int("Rating must be an integer")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating cannot exceed 5")
    .optional(),

  comment: z
    .string()
    .trim()
    .min(3, "Comment must be at least 3 characters")
    .max(1000, "Comment cannot exceed 1000 characters")
    .optional(),
})
.strict()
.refine(
  (data) =>
    data.rating !== undefined ||
    data.comment !== undefined,
  {
    message: "Provide a rating or comment to update",
  }
);
