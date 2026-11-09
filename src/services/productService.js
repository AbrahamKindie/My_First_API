
import prisma from "../db/prisma.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Validate product ID
const validateProductId = (id) => {
  const productId = Number(id);

  if (!Number.isSafeInteger(productId) || productId <= 0) {
    throw createError("Invalid product ID", 400);
  }

  return productId;
};

// Product relations included in queries
const productInclude = {
  category: true,
  discount: true,
};

// Calculate active discount information
const calculateProductPricing = (product) => {
  const originalPrice = Number(product.price);
  const discount = product.discount;
  const now = new Date();

  let activeDiscount = null;
  let discountAmount = 0;
  let discountedPrice = originalPrice;

  if (discount && discount.isActive) {
    const startsAt = discount.startsAt
      ? new Date(discount.startsAt)
      : null;

    const endsAt = discount.endsAt
      ? new Date(discount.endsAt)
      : null;

    const hasStarted = !startsAt || startsAt <= now;
    const hasNotExpired = !endsAt || endsAt >= now;

    if (hasStarted && hasNotExpired) {
      const value = Number(discount.value);

      if (discount.type === "PERCENTAGE") {
        discountAmount = (originalPrice * value) / 100;
      } else {
        discountAmount = value;
      }

      discountAmount = Math.min(discountAmount, originalPrice);

      discountedPrice = Math.max(
        0,
        originalPrice - discountAmount
      );

      discountAmount =
        Math.round(discountAmount * 100) / 100;

      discountedPrice =
        Math.round(discountedPrice * 100) / 100;

      activeDiscount = discount;
    }
  }

  return {
    originalPrice,
    discount: activeDiscount,
    hasActiveDiscount: Boolean(activeDiscount),
    discountAmount,
    discountedPrice,
  };
};

// Add sales, stock, review and pricing information to products
const enrichProducts = async (products) => {
  if (!products.length) {
    return [];
  }

  const productIds = products.map((product) => product.id);

  // Get quantities in active orders
  const [orderedQuantities, soldQuantities, reviewSummaries] =
    await Promise.all([
      prisma.orderItem.groupBy({
        by: ["productId"],
        where: {
          productId: {
            in: productIds,
          },
          order: {
            status: {
              in: ["PENDING", "CONFIRMED", "SHIPPED"],
            },
          },
        },
        _sum: {
          quantity: true,
        },
      }),

      // Get quantities from delivered orders
      prisma.orderItem.groupBy({
        by: ["productId"],
        where: {
          productId: {
            in: productIds,
          },
          order: {
            status: "DELIVERED",
          },
        },
        _sum: {
          quantity: true,
        },
      }),

      // Calculate review ratings
      prisma.productReview.groupBy({
        by: ["productId"],
        where: {
          productId: {
            in: productIds,
          },
        },
        _avg: {
          rating: true,
        },
        _count: {
          rating: true,
        },
      }),
    ]);

  const orderedMap = new Map(
    orderedQuantities.map((item) => [
      item.productId,
      item._sum.quantity || 0,
    ])
  );

  const soldMap = new Map(
    soldQuantities.map((item) => [
      item.productId,
      item._sum.quantity || 0,
    ])
  );

  const reviewMap = new Map(
    reviewSummaries.map((item) => [
      item.productId,
      {
        averageRating: Number(
          (item._avg.rating || 0).toFixed(1)
        ),
        totalReviews: item._count.rating,
      },
    ])
  );

  const now = new Date();
  const newArrivalCutoff = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000
  );

  return products.map((product) => {
    const pricing = calculateProductPricing(product);
    const review = reviewMap.get(product.id) || {
      averageRating: 0,
      totalReviews: 0,
    };

    const ordered = orderedMap.get(product.id) || 0;
    const sold = soldMap.get(product.id) || 0;

    return {
      ...product,

      // Convert Prisma Decimal to JavaScript numbers
      price: Number(product.price),

      // Discount information
      discount: pricing.discount,
      hasActiveDiscount: pricing.hasActiveDiscount,
      discountAmount: pricing.discountAmount,
      discountedPrice: pricing.discountedPrice,

      // New arrival information
      isNewArrival: product.createdAt >= newArrivalCutoff,

      // Stock and sales information
      stockInfo: {
        available: product.stock,
        ordered,
        sold,
      },

      // Review information
      reviews: {
        averageRating: review.averageRating,
        totalReviews: review.totalReviews,
      },

      averageRating: review.averageRating,
      totalReviews: review.totalReviews,
    };
  });
};

// 1. Create product (Admin)
export const createProduct = async (data) => {
  const categoryId = Number(data.categoryId);

  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
    throw createError("Invalid category ID", 400);
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!category) {
    throw createError("Category not found", 404);
  }

  const product = await prisma.product.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      stock: data.stock,
      categoryId,
      images: data.images ?? [],
      isFeatured: data.isFeatured ?? false,
    },
    include: productInclude,
  });

  const [enrichedProduct] = await enrichProducts([product]);

  return enrichedProduct;
};

// 2. Get all products
export const getAllProducts = async (
  search,
  categoryId,
  options = {}
) => {
  const {
    page = 1,
    limit = 12,
    sortBy = "newest",
    featured,
  } = options;

  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(limit) || 12)
  );

  const skip = (currentPage - 1) * pageSize;

  const where = {};

  // Search by product name
  if (search && String(search).trim()) {
    where.name = {
      contains: String(search).trim(),
      mode: "insensitive",
    };
  }

  // Filter by category
  if (categoryId !== undefined && categoryId !== null && categoryId !== "") {
    const parsedCategoryId = Number(categoryId);

    if (
      !Number.isSafeInteger(parsedCategoryId) ||
      parsedCategoryId <= 0
    ) {
      throw createError("Invalid category ID", 400);
    }

    where.categoryId = parsedCategoryId;
  }

  // Filter featured products
  if (featured !== undefined && featured !== null && featured !== "") {
    if (featured === true || featured === "true") {
      where.isFeatured = true;
    } else if (featured === false || featured === "false") {
      where.isFeatured = false;
    } else {
      throw createError("Invalid featured filter", 400);
    }
  }

  // Sorting options
  const sortOptions = {
    newest: { createdAt: "desc" },
    oldest: { createdAt: "asc" },
    price_asc: { price: "asc" },
    price_desc: { price: "desc" },
    name_asc: { name: "asc" },
    name_desc: { name: "desc" },
  };

  const orderBy = sortOptions[sortBy];

  if (!orderBy) {
    throw createError("Invalid product sorting option", 400);
  }

  const products = await prisma.product.findMany({
    where,
    skip,
    take: pageSize,
    orderBy,
    include: productInclude,
  });

  return await enrichProducts(products);
};

// 3. Get product by ID
export const getProductById = async (id) => {
  const productId = validateProductId(id);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: productInclude,
  });

  if (!product) {
    throw createError("Product not found", 404);
  }

  const [enrichedProduct] = await enrichProducts([product]);

  return enrichedProduct;
};

// 4. Update product (Admin)
export const updateProduct = async (id, data) => {
  const productId = validateProductId(id);

  const existingProduct = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!existingProduct) {
    throw createError("Product not found", 404);
  }

  if (data.categoryId !== undefined) {
    const categoryId = Number(data.categoryId);

    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
      throw createError("Invalid category ID", 400);
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw createError("Category not found", 404);
    }
  }

  const updatedProduct = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && {
        description: data.description,
      }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.stock !== undefined && { stock: data.stock }),
      ...(data.categoryId !== undefined && {
        categoryId: Number(data.categoryId),
      }),
      ...(data.images !== undefined && { images: data.images }),
      ...(data.isFeatured !== undefined && {
        isFeatured: data.isFeatured,
      }),
    },
    include: productInclude,
  });

  const [enrichedProduct] = await enrichProducts([updatedProduct]);

  return enrichedProduct;
};

// 5. Delete product (Admin)
export const deleteProduct = async (id) => {
  const productId = validateProductId(id);

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw createError("Product not found", 404);
  }

  try {
    await prisma.product.delete({
      where: { id: productId },
    });

    return {
      message: "Product deleted successfully",
    };
  } catch (error) {
    if (error.code === "P2003") {
      throw createError(
        "This product cannot be deleted because it is associated with existing orders",
        409
      );
    }

    throw error;
  }
};

// 6. Get featured products
export const getFeaturedProducts = async (limit = 8) => {
  const pageSize = Math.min(
    100,
    Math.max(1, Number(limit) || 8)
  );

  const products = await prisma.product.findMany({
    where: {
      isFeatured: true,
    },
    take: pageSize,
    orderBy: {
      createdAt: "desc",
    },
    include: productInclude,
  });

  return await enrichProducts(products);
};

// 7. Get new arrivals
export const getNewArrivals = async (limit = 8) => {
  const pageSize = Math.min(
    100,
    Math.max(1, Number(limit) || 8)
  );

  const cutoffDate = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  );

  const products = await prisma.product.findMany({
    where: {
      createdAt: {
        gte: cutoffDate,
      },
    },
    take: pageSize,
    orderBy: {
      createdAt: "desc",
    },
    include: productInclude,
  });

  return await enrichProducts(products);
};

// 8. Get best-selling products
export const getBestSellingProducts = async (limit = 8) => {
  const pageSize = Math.min(
    100,
    Math.max(1, Number(limit) || 8)
  );

  // Only delivered orders count as completed sales.
  const bestSelling = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: {
        status: "DELIVERED",
      },
    },
    _sum: {
      quantity: true,
    },
    orderBy: {
      _sum: {
        quantity: "desc",
      },
    },
    take: pageSize,
  });

  if (!bestSelling.length) {
    return [];
  }

  const productIds = bestSelling.map(
    (item) => item.productId
  );

  const products = await prisma.product.findMany({
    where: {
      id: {
        in: productIds,
      },
    },
    include: productInclude,
  });

  // Restore the best-selling ranking order.
  const productMap = new Map(
    products.map((product) => [product.id, product])
  );

  const orderedProducts = productIds
    .map((id) => productMap.get(id))
    .filter(Boolean);

  const enrichedProducts = await enrichProducts(orderedProducts);

  const soldMap = new Map(
    bestSelling.map((item) => [
      item.productId,
      item._sum.quantity || 0,
    ])
  );

  return enrichedProducts.map((product) => ({
    ...product,
    stockInfo: {
      ...product.stockInfo,
      sold: soldMap.get(product.id) || 0,
    },
  }));
};

// 9. Set product featured status (Admin)
export const setProductFeatured = async (id, isFeatured) => {
  const productId = validateProductId(id);

  if (typeof isFeatured !== "boolean") {
    throw createError("isFeatured must be a boolean", 400);
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw createError("Product not found", 404);
  }

  const updatedProduct = await prisma.product.update({
    where: { id: productId },
    data: {
      isFeatured,
    },
    include: productInclude,
  });

  const [enrichedProduct] = await enrichProducts([updatedProduct]);

  return enrichedProduct;
};

// 10. Create or update product discount (Admin)
export const setProductDiscount = async (id, data) => {
  const productId = validateProductId(id);

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw createError("Product not found", 404);
  }

  if (!["PERCENTAGE", "FIXED"].includes(data.type)) {
    throw createError("Invalid discount type", 400);
  }

  const value = Number(data.value);

  if (!Number.isFinite(value) || value <= 0) {
    throw createError("Discount value must be greater than 0", 400);
  }

  const originalPrice = Number(product.price);

  if (data.type === "PERCENTAGE" && value > 100) {
    throw createError("Percentage discount cannot exceed 100%", 400);
  }

  if (data.type === "FIXED" && value >= originalPrice) {
    throw createError(
      "Fixed discount must be less than the product price",
      400
    );
  }

  const startsAt =
    data.startsAt === undefined || data.startsAt === null
      ? null
      : new Date(data.startsAt);

  const endsAt =
    data.endsAt === undefined || data.endsAt === null
      ? null
      : new Date(data.endsAt);

  if (startsAt && Number.isNaN(startsAt.getTime())) {
    throw createError("Invalid discount start date", 400);
  }

  if (endsAt && Number.isNaN(endsAt.getTime())) {
    throw createError("Invalid discount end date", 400);
  }

  if (startsAt && endsAt && endsAt <= startsAt) {
    throw createError(
      "Discount end date must be after start date",
      400
    );
  }

  const discount = await prisma.productDiscount.upsert({
    where: {
      productId,
    },
    update: {
      type: data.type,
      value: value.toFixed(2),
      startsAt,
      endsAt,
      isActive: data.isActive ?? true,
    },
    create: {
      productId,
      type: data.type,
      value: value.toFixed(2),
      startsAt,
      endsAt,
      isActive: data.isActive ?? true,
    },
  });

  return {
    message: "Product discount saved successfully",
    data: discount,
  };
};

// 11. Remove product discount (Admin)
export const removeProductDiscount = async (id) => {
  const productId = validateProductId(id);

  const discount = await prisma.productDiscount.findUnique({
    where: { productId },
  });

  if (!discount) {
    throw createError("Product discount not found", 404);
  }

  await prisma.productDiscount.delete({
    where: { productId },
  });

  return {
    message: "Product discount removed successfully",
  };
};
