
import prisma from "../db/prisma.js";
import { enrichProducts } from "./productService.js";

import {
  createProductCategorySchema,
  updateProductCategorySchema,
} from "../validators/categoryValidation.js";

// ============================================
// ERROR HELPER
// ============================================

const createError = (message, statusCode = 400, details) => {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (details) {
    error.details = details;
  }

  return error;
};

// ============================================
// VALIDATION HELPERS
// ============================================

const validateId = (id, fieldName = "Category ID") => {
  const parsedId = Number(id);

  if (!Number.isSafeInteger(parsedId) || parsedId <= 0) {
    throw createError(`Invalid ${fieldName}`, 400);
  }

  return parsedId;
};

const validateShopId = (shopId) => {
  const parsedShopId = Number(shopId);

  if (!Number.isSafeInteger(parsedShopId) || parsedShopId <= 0) {
    throw createError("Invalid shop ID", 400);
  }

  return parsedShopId;
};

const validateData = (schema, data) => {
  const result = schema.safeParse(data);

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

  return result.data;
};

// ============================================
// VERIFY ACTIVE SHOP
// ============================================

const ensureActiveShop = async (shopId) => {
  const shop = await prisma.shop.findFirst({
    where: {
      id: shopId,
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  if (!shop) {
    throw createError("Your shop is deactivated.", 403);
  }

  return shop;
};

// ============================================
// CATEGORY INCLUDE
// ============================================

const categoryCountInclude = {
  _count: {
    select: {
      products: true,
    },
  },
};

// ============================================
// 1. CREATE PRODUCT CATEGORY
// ============================================

export const createProductCategory = async (shopId, data) => {
  const validShopId = validateShopId(shopId);

  await ensureActiveShop(validShopId);

  const validatedData = validateData(
    createProductCategorySchema,
    data
  );

  try {
    return await prisma.productCategory.create({
      data: {
        shopId: validShopId,
        name: validatedData.name,
        description: validatedData.description ?? null,
      },
      include: {
        ...categoryCountInclude,
        products: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw createError(
        "You already have a product category with this name.",
        409
      );
    }

    throw error;
  }
};

// ============================================
// 2. GET MY PRODUCT CATEGORIES
// Includes assigned product names for the table
// ============================================

export const getMyProductCategories = async (shopId) => {
  const validShopId = validateShopId(shopId);

  await ensureActiveShop(validShopId);

  return prisma.productCategory.findMany({
    where: {
      shopId: validShopId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      ...categoryCountInclude,
      products: {
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
};

// ============================================
// 3. GET PRODUCT CATEGORY BY ID
// Includes complete product details and stock
// ============================================

export const getProductCategoryById = async (shopId, id) => {
  const validShopId = validateShopId(shopId);
  const categoryId = validateId(id);

  await ensureActiveShop(validShopId);

  const category = await prisma.productCategory.findFirst({
    where: {
      id: categoryId,
      shopId: validShopId,
    },
    include: {
      _count: {
        select: {
          products: true,
        },
      },
      products: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          discount: true,
          shop: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!category) {
    throw createError("Product category not found.", 404);
  }

  // Reuse the same stock, pricing, and review calculations
  // used by the rest of the ShopEase product system.
  const enrichedProducts = await enrichProducts(category.products);

  return {
    ...category,
    products: enrichedProducts,
  };
};

// ============================================
// 4. UPDATE PRODUCT CATEGORY
// ============================================

export const updateProductCategory = async (shopId, id, data) => {
  const validShopId = validateShopId(shopId);
  const categoryId = validateId(id);

  await ensureActiveShop(validShopId);

  const validatedData = validateData(
    updateProductCategorySchema,
    data
  );

  if (Object.keys(validatedData).length === 0) {
    throw createError(
      "At least one category field must be provided.",
      400
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const result = await tx.productCategory.updateMany({
        where: {
          id: categoryId,
          shopId: validShopId,
        },
        data: validatedData,
      });

      if (result.count === 0) {
        throw createError("Product category not found.", 404);
      }

      return tx.productCategory.findFirst({
        where: {
          id: categoryId,
          shopId: validShopId,
        },
        include: {
          ...categoryCountInclude,
          products: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    if (error.code === "P2002") {
      throw createError(
        "You already have a product category with this name.",
        409
      );
    }

    throw error;
  }
};

// ============================================
// 5. DELETE PRODUCT CATEGORY
// ============================================

export const deleteProductCategory = async (shopId, id) => {
  const validShopId = validateShopId(shopId);
  const categoryId = validateId(id);

  await ensureActiveShop(validShopId);

  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.productCategory.findFirst({
        where: {
          id: categoryId,
          shopId: validShopId,
        },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      if (!category) {
        throw createError("Product category not found.", 404);
      }

      if (category._count.products > 0) {
        throw createError(
          "Unable to delete this category because products are assigned to it.",
          409
        );
      }

      await tx.productCategory.deleteMany({
        where: {
          id: categoryId,
          shopId: validShopId,
        },
      });

      return {
        message: "Product category deleted successfully.",
      };
    });
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    if (error.code === "P2003" || error.code === "P2014") {
      throw createError(
        "Unable to delete this category because products are assigned to it.",
        409
      );
    }

    throw error;
  }
};
