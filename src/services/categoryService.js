
import prisma from "../db/prisma.js";

// ==========================================
// REUSABLE HELPERS
// ==========================================

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateCategoryId = (id) => {
  const categoryId = Number(id);

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw createError("Invalid category ID", 400);
  }

  return categoryId;
};

// ==========================================
// PUBLIC CATEGORY SELECT
//
// All shop categories are returned.
// Only active shops are included.
// Only active products are counted.
// ==========================================

const publicCategorySelect = {
  id: true,
  name: true,
  description: true,
  image: true,

  shops: {
    where: {
      status: "ACTIVE",
    },

    orderBy: {
      name: "asc",
    },

    select: {
      id: true,
      name: true,
      description: true,
      logo: true,
      coverImage: true,
      address: true,
      city: true,
      region: true,
      status: true,

      _count: {
        select: {
          products: {
            where: {
              status: "ACTIVE",
            },
          },
        },
      },

      productCategories: {
        orderBy: {
          name: "asc",
        },

        select: {
          id: true,
          name: true,
          description: true,

          _count: {
            select: {
              products: {
                where: {
                  status: "ACTIVE",
                },
              },
            },
          },
        },
      },
    },
  },
};

// ==========================================
// FORMAT CATEGORY COUNTS
// ==========================================

const formatCategoryCounts = (category) => {
  const shops = (category.shops || []).map((shop) => {
    const productsCount = shop._count?.products || 0;

    const productCategories = (
      shop.productCategories || []
    ).map((productCategory) => ({
      id: productCategory.id,
      name: productCategory.name,
      description: productCategory.description,
      productsCount:
        productCategory._count?.products || 0,
    }));

    return {
      id: shop.id,
      name: shop.name,
      description: shop.description,
      logo: shop.logo,
      coverImage: shop.coverImage,
      address: shop.address,
      city: shop.city,
      region: shop.region,
      status: shop.status,

      productsCount,
      productCategories,
    };
  });

  // Count unique product category names across active shops.
  const uniqueProductCategories = new Set();

  shops.forEach((shop) => {
    shop.productCategories.forEach((productCategory) => {
      const normalizedName = String(
        productCategory.name || ""
      )
        .trim()
        .toLowerCase();

      if (normalizedName) {
        uniqueProductCategories.add(normalizedName);
      }
    });
  });

  // Total active products across all active shops.
  const productsCount = shops.reduce(
    (total, shop) => total + shop.productsCount,
    0
  );

  return {
    id: category.id,
    name: category.name,
    description: category.description,
    image: category.image,

    shopsCount: shops.length,
    productCategoriesCount: uniqueProductCategories.size,
    productsCount,

    shops,
  };
};

// ==========================================
// GET ALL SHOP CATEGORIES
// ==========================================

export const getAllCategories = async () => {
  const categories = await prisma.shopCategory.findMany({
    orderBy: {
      name: "asc",
    },

    select: publicCategorySelect,
  });

  return categories.map(formatCategoryCounts);
};

// ==========================================
// GET SHOP CATEGORY BY ID
// ==========================================

export const getCategoryById = async (id) => {
  const categoryId = validateCategoryId(id);

  const category = await prisma.shopCategory.findUnique({
    where: {
      id: categoryId,
    },

    select: publicCategorySelect,
  });

  if (!category) {
    throw createError("Shop category not found", 404);
  }

  return formatCategoryCounts(category);
};
