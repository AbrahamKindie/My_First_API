
import prisma from "../db/prisma.js";

// Helper for consistent errors
const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// 1. Create Product
export const createProduct = async (data) => {
  const category = await prisma.category.findUnique({
    where: { id: data.categoryId },
  });

  if (!category) {
    throw createError("Category not found", 404);
  }

  return await prisma.product.create({
    data: {
      name: data.name,
      description: data.description,
      price: data.price,
      stock: data.stock ?? 0,
      categoryId: data.categoryId,
    },
    include: {
      category: true,
    },
  });
};

// 2. Get All Products
export const getAllProducts = async () => {
  return await prisma.product.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      category: true,
    },
  });
};

// 3. Get Product By ID
export const getProductById = async (id) => {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError("Invalid product ID", 400);
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
    },
  });

  if (!product) {
    throw createError("Product not found", 404);
  }

  return product;
};

// 4. Update Product
export const updateProduct = async (id, data) => {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError("Invalid product ID", 400);
  }

  const existingProduct = await prisma.product.findUnique({
    where: { id },
  });

  if (!existingProduct) {
    throw createError("Product not found", 404);
  }

  // Check category if it is being updated
  if (data.categoryId !== undefined) {
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });

    if (!category) {
      throw createError("Category not found", 404);
    }
  }

  return await prisma.product.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && {
        description: data.description,
      }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.stock !== undefined && { stock: data.stock }),
      ...(data.categoryId !== undefined && {
        categoryId: data.categoryId,
      }),
    },
    include: {
      category: true,
    },
  });
};

// 5. Delete Product
export const deleteProduct = async (id) => {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError("Invalid product ID", 400);
  }

  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    throw createError("Product not found", 404);
  }

  await prisma.product.delete({
    where: { id },
  });

  return product;
};
