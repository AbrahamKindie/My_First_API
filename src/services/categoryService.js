
import prisma from "../db/prisma.js";
import { z } from "zod";

// Validation schema
const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(50, "Category name cannot exceed 50 characters"),
});

// Helper for consistent errors
const createError = (message, statusCode, details) => {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (details) {
    error.details = details;
  }

  return error;
};

// 1. Create Category
export const createCategory = async (data) => {
  const result = categorySchema.safeParse(data);

  if (!result.success) {
    throw createError(
      "Validation failed",
      400,
      result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }))
    );
  }

  try {
    return await prisma.category.create({
      data: {
        name: result.data.name,
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw createError("Category name already exists", 409);
    }

    throw error;
  }
};

// 2. Get All Categories
export const getAllCategories = async () => {
  return await prisma.category.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
};

// 3. Get Category By ID
export const getCategoryById = async (id) => {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError("Invalid category ID", 400);
  }

  const category = await prisma.category.findUnique({
    where: { id },
  });

  if (!category) {
    throw createError("Category not found", 404);
  }

  return category;
};

// 4. Update Category
export const updateCategory = async (id, data) => {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError("Invalid category ID", 400);
  }

  const result = categorySchema.safeParse(data);

  if (!result.success) {
    throw createError(
      "Validation failed",
      400,
      result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }))
    );
  }

  // Check whether category exists
  const category = await prisma.category.findUnique({
    where: { id },
  });

  if (!category) {
    throw createError("Category not found", 404);
  }

  try {
    return await prisma.category.update({
      where: { id },
      data: {
        name: result.data.name,
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw createError("Category name already exists", 409);
    }

    throw error;
  }
};

// 5. Delete Category
export const deleteCategory = async (id) => {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError("Invalid category ID", 400);
  }

  const category = await prisma.category.findUnique({
    where: { id },
  });

  if (!category) {
    throw createError("Category not found", 404);
  }

  try {
    return await prisma.category.delete({
      where: { id },
    });
  } catch (error) {
    // For example, a related product may prevent deletion
    // if the Prisma relation uses restrictive deletion.
    if (error.code === "P2003" || error.code === "P2014") {
      throw createError(
        "Cannot delete this category because it has related records",
        409
      );
    }

    throw error;
  }
};
