
import prisma from "../db/prisma.js";
import { z } from "zod";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../validators/categoryValidation.js";

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
  const result = createCategorySchema.safeParse(data);

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

// 2. Get All Categories with Products and Total Products
export const getAllCategories = async () => {
  const categories = await prisma.category.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      _count: {
        select: {
          products: true,
        },
      },
       products: true,
    },
  });

  return categories;
}

// 3. Get Category By ID with Products and Total Products
export const getCategoryById = async (id) => {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError("Invalid category ID", 400);
  }

  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          products: true,
        },
      },
        products: true,
    },
  });

  if (!category) {
    throw createError("Category not found", 404);
  }

//const { _count, products, ...categoryData } = category;

return category;
}

// 4. Update Category (unchanged)
export const updateCategory = async (id, data) => {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError("Invalid category ID", 400);
  }

  const result = updateCategorySchema.safeParse(data);

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

// 5. Delete Category (unchanged)
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
    if (error.code === "P2003" || error.code === "P2014") {
      throw createError(
        "Cannot delete this category because it has related products. Please remove or reassign those products first.",
        409
      );
    }

    throw error;
  }
};
